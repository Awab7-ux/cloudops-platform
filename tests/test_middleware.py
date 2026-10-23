"""Tests for request-ID middleware and global error handling.

Covers X-Request-ID generation, echo-back, sanitisation of invalid or
oversized values, and the consistent error shape for unhandled
exceptions.
"""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


def _clean_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Remove all app-specific env vars so each test starts clean."""
    for var in ("APP_NAME", "APP_VERSION", "PORT", "CORS_ORIGINS", "LOG_LEVEL"):
        monkeypatch.delenv(var, raising=False)


# ── X-Request-ID: generation ──────────────────────────────────────────


class TestRequestIdGeneration:
    """When no X-Request-ID is sent, the middleware generates a UUID4."""

    def test_response_contains_generated_request_id(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """A missing X-Request-ID header results in a generated UUID4."""
        _clean_env(monkeypatch)
        client = TestClient(create_app())

        response = client.get("/health")

        rid = response.headers.get("x-request-id")
        assert rid is not None
        # Must be a valid UUID.
        uuid.UUID(rid)

    def test_different_requests_get_different_ids(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Each request without an ID receives a unique UUID."""
        _clean_env(monkeypatch)
        client = TestClient(create_app())

        r1 = client.get("/health")
        r2 = client.get("/health")

        assert r1.headers["x-request-id"] != r2.headers["x-request-id"]


# ── X-Request-ID: echo ────────────────────────────────────────────────


class TestRequestIdEcho:
    """A valid incoming X-Request-ID is echoed back unchanged."""

    def test_valid_id_echoed(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """A conforming ID (alphanumeric, dots, hyphens, underscores) is
        echoed as-is."""
        _clean_env(monkeypatch)
        client = TestClient(create_app())

        response = client.get(
            "/health", headers={"X-Request-ID": "my-trace.123_abc"}
        )

        assert response.headers["x-request-id"] == "my-trace.123_abc"


# ── X-Request-ID: sanitisation ────────────────────────────────────────


class TestRequestIdSanitisation:
    """Invalid or oversized IDs are rejected and replaced with a UUID4."""

    def test_special_chars_rejected(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """An ID with spaces or special characters is replaced."""
        _clean_env(monkeypatch)
        client = TestClient(create_app())

        response = client.get(
            "/health", headers={"X-Request-ID": "bad id with spaces!"}
        )

        rid = response.headers["x-request-id"]
        assert rid != "bad id with spaces!"
        uuid.UUID(rid)  # Must be a valid UUID4

    def test_oversized_id_rejected(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """An ID longer than 64 characters is replaced."""
        _clean_env(monkeypatch)
        client = TestClient(create_app())
        long_id = "a" * 65

        response = client.get(
            "/health", headers={"X-Request-ID": long_id}
        )

        rid = response.headers["x-request-id"]
        assert rid != long_id
        uuid.UUID(rid)

    def test_exactly_64_chars_accepted(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """An ID of exactly 64 valid characters is accepted."""
        _clean_env(monkeypatch)
        client = TestClient(create_app())
        exact_id = "a" * 64

        response = client.get(
            "/health", headers={"X-Request-ID": exact_id}
        )

        assert response.headers["x-request-id"] == exact_id

    def test_empty_id_replaced(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """An empty X-Request-ID header is replaced with a UUID4."""
        _clean_env(monkeypatch)
        client = TestClient(create_app())

        response = client.get(
            "/health", headers={"X-Request-ID": ""}
        )

        rid = response.headers["x-request-id"]
        assert rid != ""
        uuid.UUID(rid)


# ── Unexpected-error response shape ───────────────────────────────────


class TestUnexpectedErrorShape:
    """Unhandled exceptions produce a consistent, safe JSON response."""

    def test_500_returns_generic_detail(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """An unhandled exception yields {"detail":"Internal Server Error"}."""
        _clean_env(monkeypatch)
        test_app = create_app()

        @test_app.get("/trigger-error")
        def _raise() -> None:
            raise RuntimeError("secret internal details")

        client = TestClient(test_app, raise_server_exceptions=False)
        response = client.get("/trigger-error")

        assert response.status_code == 500
        assert response.json() == {"detail": "Internal Server Error"}

    def test_500_does_not_leak_traceback(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """The response body must not contain exception class names or
        messages."""
        _clean_env(monkeypatch)
        test_app = create_app()

        @test_app.get("/trigger-error")
        def _raise() -> None:
            raise ValueError("do not expose this")

        client = TestClient(test_app, raise_server_exceptions=False)
        response = client.get("/trigger-error")

        assert "ValueError" not in response.text
        assert "do not expose this" not in response.text

    def test_500_has_request_id_header(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Even 500 responses carry X-Request-ID for log correlation."""
        _clean_env(monkeypatch)
        test_app = create_app()

        @test_app.get("/trigger-error")
        def _raise() -> None:
            raise RuntimeError("boom")

        client = TestClient(test_app, raise_server_exceptions=False)
        response = client.get("/trigger-error")

        rid = response.headers.get("x-request-id")
        assert rid is not None
        uuid.UUID(rid)

    def test_500_has_cors_headers_for_allowed_origin(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """A 500 response to an allowed origin still includes CORS headers."""
        _clean_env(monkeypatch)
        test_app = create_app()

        @test_app.get("/trigger-error")
        def _raise() -> None:
            raise RuntimeError("boom")

        client = TestClient(test_app, raise_server_exceptions=False)
        response = client.get(
            "/trigger-error",
            headers={"Origin": "http://localhost:3000"},
        )

        assert response.status_code == 500
        assert (
            response.headers.get("access-control-allow-origin")
            == "http://localhost:3000"
        )

