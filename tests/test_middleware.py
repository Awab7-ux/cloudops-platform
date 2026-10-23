"""Tests for request-ID middleware and global error handling.

Covers X-Request-ID generation, echo-back, sanitisation of invalid or
oversized values, and the consistent error shape for unhandled
exceptions.
"""

from __future__ import annotations

import asyncio
import uuid

import pytest
from starlette.types import Receive, Scope, Send
from fastapi.testclient import TestClient

from app.core.middleware import RequestIdMiddleware
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

    def test_500_body_does_not_contain_exception_text(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """The 500 response body must not leak the exception message."""
        _clean_env(monkeypatch)
        test_app = create_app()

        @test_app.get("/trigger-error")
        def _raise() -> None:
            raise RuntimeError("boom")

        client = TestClient(test_app, raise_server_exceptions=False)
        response = client.get("/trigger-error")

        assert response.status_code == 500
        # WHY "boom": the test route raises RuntimeError("boom"); it
        # must never appear in the response body sent to the client.
        assert "boom" not in response.text

    def test_500_unknown_origin_has_no_cors_header(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """A 500 response for an unknown origin has no CORS allow header."""
        _clean_env(monkeypatch)
        test_app = create_app()

        @test_app.get("/trigger-error")
        def _raise() -> None:
            raise RuntimeError("boom")

        client = TestClient(test_app, raise_server_exceptions=False)
        response = client.get(
            "/trigger-error",
            headers={"Origin": "http://evil.example.com"},
        )

        assert response.status_code == 500
        # WHY assert absence: an unknown origin must never receive
        # access-control-allow-origin, even on error responses.
        assert "access-control-allow-origin" not in response.headers


# ── Error boundary: response already started ──────────────────────────


class TestExceptionReRaisedAfterResponseStarted:
    """Once ``http.response.start`` has been sent the response cannot be
    replaced, so the middleware must log the failure and re-raise rather
    than swallow it.
    """

    async def _inner_app_that_starts_then_raises(
        self, scope: Scope, receive: Receive, send: Send
    ) -> None:
        """ASGI app that sends ``http.response.start`` then raises.

        Simulates a failure (e.g. a broken connection or streaming error)
        that occurs after the status line and headers are already on the
        wire.

        Args:
            scope: ASGI connection scope (unused).
            receive: ASGI receive callable (unused).
            send: ASGI send callable used to start the response.

        Raises:
            RuntimeError: Always, after starting the response.
        """
        await send(
            {
                "type": "http.response.start",
                "status": 200,
                "headers": [[b"content-type", b"text/plain"]],
            }
        )
        raise RuntimeError("boom after start")

    def test_exception_is_re_raised_after_response_started(
        self, caplog: pytest.LogCaptureFixture
    ) -> None:
        """An exception raised after the response started is re-raised.

        The middleware logs the exception with ``logger.exception`` and
        re-raises it instead of swallowing it, so the ASGI server sees
        the failure and can close the connection cleanly.

        Args:
            caplog: Pytest log-capture fixture.
        """
        scope: Scope = {
            "type": "http",
            "method": "GET",
            "path": "/",
            "headers": [],
            "query_string": b"",
            "server": ("testclient", 80),
            "client": ("testclient", 12345),
            "scheme": "http",
            "root_path": "",
        }

        async def receive() -> dict:
            return {"type": "http.request", "body": b"", "more_body": False}

        async def send(message: dict) -> None:
            pass

        middleware = RequestIdMiddleware(self._inner_app_that_starts_then_raises)

        with pytest.raises(RuntimeError, match="boom after start"):
            asyncio.run(middleware(scope, receive, send))

        assert "Exception after response started" in caplog.text

