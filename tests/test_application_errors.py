"""Tests for Application domain exception HTTP mappings."""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.errors import ConflictError, NotFoundError
from app.main import create_app


# Builds an app with routes that raise each application domain exception.
def _build_domain_error_app() -> FastAPI:
    """Build a test app exposing safe domain-error trigger routes."""
    application = create_app()

    # Raises the not-found domain exception for the test request.
    @application.get("/_test/not-found")
    def raise_not_found() -> None:
        """Raise a not-found error containing unsafe internal text."""
        raise NotFoundError("database path must not be exposed")

    # Raises the conflict domain exception for the test request.
    @application.get("/_test/conflict")
    def raise_conflict() -> None:
        """Raise a conflict error containing unsafe internal text."""
        raise ConflictError("SQL must not be exposed")

    return application


# Verifies both domain exceptions map to their exact safe response bodies.
def test_domain_errors_have_safe_bodies_and_headers(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Domain errors return safe details with request and CORS headers."""
    monkeypatch.setenv("DATABASE_URL", "sqlite:///:memory:")
    application = _build_domain_error_app()

    with TestClient(application, raise_server_exceptions=False) as client:
        for path, status, detail in (
            ("/_test/not-found", 404, "application not found"),
            ("/_test/conflict", 409, "application name already exists"),
        ):
            response = client.get(
                path,
                headers={
                    "Origin": "http://localhost:3000",
                    "X-Request-ID": "domain-error-test",
                },
            )

            assert response.status_code == status
            assert response.json() == {"detail": detail}
            assert response.headers["x-request-id"] == "domain-error-test"
            assert (
                response.headers["access-control-allow-origin"]
                == "http://localhost:3000"
            )
            assert "database" not in response.text
            assert "SQL" not in response.text
