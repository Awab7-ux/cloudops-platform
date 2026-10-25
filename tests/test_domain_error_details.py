"""Tests for domain exception attributes and HTTP response details."""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.domain.exceptions import ConflictError, NotFoundError
from app.main import create_app


# Builds routes that raise default and custom safe domain errors.
def _build_domain_detail_app() -> FastAPI:
    """Build a test application exposing domain-error trigger routes."""
    application = create_app()

    # Raises the default not-found domain exception.
    @application.get("/_test/domain-default-not-found")
    def raise_default_not_found() -> None:
        """Raise a not-found error with its default resource."""
        raise NotFoundError()

    # Raises the custom not-found domain exception.
    @application.get("/_test/domain-custom-not-found")
    def raise_custom_not_found() -> None:
        """Raise a not-found error for a deployment resource."""
        raise NotFoundError("deployment")

    # Raises the default conflict domain exception.
    @application.get("/_test/domain-default-conflict")
    def raise_default_conflict() -> None:
        """Raise a conflict error with its default detail."""
        raise ConflictError()

    # Raises the custom conflict domain exception.
    @application.get("/_test/domain-custom-conflict")
    def raise_custom_conflict() -> None:
        """Raise a conflict error for an invalid status transition."""
        raise ConflictError("invalid status transition")

    return application


# Verifies domain exceptions expose safe defaults and custom values.
def test_domain_errors_expose_defaults_and_custom_values() -> None:
    """Domain errors expose their resource and detail attributes."""
    not_found_default = NotFoundError()
    not_found_custom = NotFoundError("deployment")
    conflict_default = ConflictError()
    conflict_custom = ConflictError("invalid status transition")

    assert not_found_default.resource == "application"
    assert not_found_custom.resource == "deployment"
    assert conflict_default.detail == "application name already exists"
    assert conflict_custom.detail == "invalid status transition"


# Verifies handlers return detail attributes with request and CORS headers.
def test_domain_error_handlers_use_default_and_custom_details(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Domain handlers return the selected safe detail and required headers."""
    monkeypatch.setenv("DATABASE_URL", "sqlite:///:memory:")
    application = _build_domain_detail_app()
    cases = (
        ("/_test/domain-default-not-found", 404, "application not found"),
        ("/_test/domain-custom-not-found", 404, "deployment not found"),
        (
            "/_test/domain-default-conflict",
            409,
            "application name already exists",
        ),
        (
            "/_test/domain-custom-conflict",
            409,
            "invalid status transition",
        ),
    )

    with TestClient(application, raise_server_exceptions=False) as client:
        for path, status, detail in cases:
            response = client.get(
                path,
                headers={
                    "Origin": "http://localhost:3000",
                    "X-Request-ID": "domain-detail-test",
                },
            )

            assert response.status_code == status
            assert response.json() == {"detail": detail}
            assert response.headers["x-request-id"] == "domain-detail-test"
            assert (
                response.headers["access-control-allow-origin"]
                == "http://localhost:3000"
            )
