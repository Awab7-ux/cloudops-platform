"""Tests for request-ID middleware and global error handling.

Covers X-Request-ID generation, echo-back, sanitisation of invalid or
oversized values, and the consistent error shape for unhandled
exceptions.
"""

from __future__ import annotations

import asyncio
import logging
import uuid

import pytest
from fastapi import Request
from starlette.types import Message, Receive, Scope, Send
from fastapi.testclient import TestClient

from app.core.errors import _unhandled_exception_handler
from app.core.middleware import RequestIdMiddleware, _sanitize_request_id
from app.main import create_app


# Removes app env vars so each test starts clean.
def _clean_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Remove all app-specific env vars so each test starts clean."""
    for var in ("APP_NAME", "APP_VERSION", "PORT", "CORS_ORIGINS", "LOG_LEVEL"):
        monkeypatch.delenv(var, raising=False)


# ── X-Request-ID: generation ──────────────────────────────────────────


# When no X-Request-ID is sent, the middleware generates a UUID4.
class TestRequestIdGeneration:
    """When no X-Request-ID is sent, the middleware generates a UUID4."""

# A missing X-Request-ID header results in a generated UUID4.
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

# Each request without an ID receives a unique UUID.
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


# A valid incoming X-Request-ID is echoed back unchanged.
class TestRequestIdEcho:
    """A valid incoming X-Request-ID is echoed back unchanged."""

# A conforming ID is echoed as-is.
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


# Invalid or oversized IDs are rejected and replaced with a UUID4.
class TestRequestIdSanitisation:
    """Invalid or oversized IDs are rejected and replaced with a UUID4."""

# An ID with spaces or special characters is replaced.
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

# An ID longer than 64 characters is replaced.
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

# An ID of exactly 64 characters is accepted.
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

# An empty ID is replaced with a UUID4.
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


# Unhandled exceptions return a consistent safe 500 shape.
class TestUnexpectedErrorShape:
    """Unhandled exceptions produce a consistent, safe JSON response."""

# An unhandled exception returns a generic 500 JSON body.
    def test_500_returns_generic_detail(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """An unhandled exception yields {"detail":"Internal Server Error"}."""
        _clean_env(monkeypatch)
        test_app = create_app()

# Trigger endpoint that raises RuntimeError to exercise the 500 boundary.
        @test_app.get("/trigger-error")
        def _raise() -> None:
            """Triggers RuntimeError to exercise the 500 error boundary."""
            raise RuntimeError("secret internal details")

        client = TestClient(test_app, raise_server_exceptions=False)
        response = client.get("/trigger-error")

        assert response.status_code == 500
        assert response.json() == {"detail": "Internal Server Error"}

# The 500 body never leaks the exception traceback.
    def test_500_does_not_leak_traceback(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """The response body must not contain exception class names or
        messages."""
        _clean_env(monkeypatch)
        test_app = create_app()

# Trigger endpoint that raises RuntimeError to exercise the 500 boundary.
        @test_app.get("/trigger-error")
        def _raise() -> None:
            """Triggers RuntimeError to exercise the 500 error boundary."""
            raise ValueError("do not expose this")

        client = TestClient(test_app, raise_server_exceptions=False)
        response = client.get("/trigger-error")

        assert "ValueError" not in response.text
        assert "do not expose this" not in response.text

# The 500 response includes the X-Request-ID header.
    def test_500_has_request_id_header(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Even 500 responses carry X-Request-ID for log correlation."""
        _clean_env(monkeypatch)
        test_app = create_app()

# Trigger endpoint that raises RuntimeError to exercise the 500 boundary.
        @test_app.get("/trigger-error")
        def _raise() -> None:
            """Triggers RuntimeError to exercise the 500 error boundary."""
            raise RuntimeError("boom")

        client = TestClient(test_app, raise_server_exceptions=False)
        response = client.get("/trigger-error")

        rid = response.headers.get("x-request-id")
        assert rid is not None
        uuid.UUID(rid)

# The 500 response keeps CORS headers for an allowed origin.
    def test_500_has_cors_headers_for_allowed_origin(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """A 500 response to an allowed origin still includes CORS headers."""
        _clean_env(monkeypatch)
        test_app = create_app()

# Trigger endpoint that raises RuntimeError to exercise the 500 boundary.
        @test_app.get("/trigger-error")
        def _raise() -> None:
            """Triggers RuntimeError to exercise the 500 error boundary."""
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

# The 500 body does not contain the exception text.
    def test_500_body_does_not_contain_exception_text(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """The 500 response body must not leak the exception message."""
        _clean_env(monkeypatch)
        test_app = create_app()

# Trigger endpoint that raises RuntimeError to exercise the 500 boundary.
        @test_app.get("/trigger-error")
        def _raise() -> None:
            """Triggers RuntimeError to exercise the 500 error boundary."""
            raise RuntimeError("boom")

        client = TestClient(test_app, raise_server_exceptions=False)
        response = client.get("/trigger-error")

        assert response.status_code == 500
        # WHY "boom": the test route raises RuntimeError("boom"); it
        # must never appear in the response body sent to the client.
        assert "boom" not in response.text

# A 500 for an unknown origin has no CORS allow header.
    def test_500_unknown_origin_has_no_cors_header(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """A 500 response for an unknown origin has no CORS allow header."""
        _clean_env(monkeypatch)
        test_app = create_app()

# Trigger endpoint that raises RuntimeError to exercise the 500 boundary.
        @test_app.get("/trigger-error")
        def _raise() -> None:
            """Triggers RuntimeError to exercise the 500 error boundary."""
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


# Once the response started, failures are logged and re-raised.
class TestExceptionReRaisedAfterResponseStarted:
    """Once ``http.response.start`` has been sent the response cannot be
    replaced, so the middleware must log the failure and re-raise rather
    than swallow it.
    """

# ASGI app that starts the response then raises RuntimeError.
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

# An exception raised after the response started is re-raised.
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

# ASGI receive returning an empty HTTP request body.
        async def receive() -> dict:
            """ASGI receive returning an empty HTTP request body."""
            return {"type": "http.request", "body": b"", "more_body": False}

# ASGI send no-op used to run the middleware directly.
        async def send(message: dict) -> None:
            """ASGI send no-op used to run the middleware directly."""
            pass

        middleware = RequestIdMiddleware(self._inner_app_that_starts_then_raises)

        with pytest.raises(RuntimeError, match="boom after start"):
            asyncio.run(middleware(scope, receive, send))

        assert "Exception after response started" in caplog.text


# Request-ID handling rejects control characters and duplicate response values.
class TestRequestIdHeaderBoundary:
    """Request-ID headers are safe and unambiguous at the ASGI boundary."""

    # A trailing newline is not accepted as part of a request ID.
    def test_trailing_newline_id_replaced(self) -> None:
        """A request ID ending in a newline is replaced with a UUID4."""
        request_id = _sanitize_request_id("safe\n")

        assert request_id != "safe\n"
        uuid.UUID(request_id)

    # An inner response request ID is replaced rather than duplicated.
    def test_response_has_one_request_id_header(self) -> None:
        """The middleware emits exactly one X-Request-ID response header."""
        scope: Scope = {
            "type": "http",
            "method": "GET",
            "path": "/",
            "headers": [],
        }
        messages: list[Message] = []

        # Sends a response and raises after the response has started.
        async def inner_app(
            inner_scope: Scope, receive: Receive, send: Send
        ) -> None:
            """Send a response containing an existing request ID header."""
            await send(
                {
                    "type": "http.response.start",
                    "status": 200,
                    "headers": [(b"x-request-id", b"inner")],
                }
            )

        # Returns an empty HTTP request body to the middleware.
        async def receive() -> Message:
            """Return an empty HTTP request body."""
            return {"type": "http.request", "body": b"", "more_body": False}

        # Collects response messages emitted by the middleware.
        async def send(message: Message) -> None:
            """Collect ASGI messages sent by the middleware."""
            messages.append(message)

        asyncio.run(RequestIdMiddleware(inner_app)(scope, receive, send))

        headers = messages[0]["headers"]
        request_id_headers = [
            header for header in headers  # type: ignore[union-attr]
            if header[0] == b"x-request-id"
        ]
        assert len(request_id_headers) == 1
        assert request_id_headers[0][1] != b"inner"


# Request metadata and exception messages do not create unsafe log records.
class TestSafeRequestLogging:
    """Request logs escape untrusted metadata and omit exception messages."""

    # A percent-encoded newline in a path remains on one log record line.
    def test_access_log_escapes_newline_path(
        self, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
    ) -> None:
        """Access logs escape a newline decoded into the request path."""
        _clean_env(monkeypatch)
        client = TestClient(create_app())

        with caplog.at_level(logging.INFO, logger="app.core.middleware"):
            response = client.get("/%0aINJECT")

        access_logs = [
            record.getMessage()
            for record in caplog.records
            if record.name == "app.core.middleware" and "-> 404" in record.getMessage()
        ]
        assert response.status_code == 404
        assert access_logs
        assert access_logs[-1].startswith(
            "GET /\\nINJECT -> 404 ("
        )
        assert "GET /\nINJECT" not in access_logs[-1]

    # A user-controlled exception message is omitted from application logs.
    def test_exception_log_omits_exception_message(
        self, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
    ) -> None:
        """Unhandled exception logs include type but not exception text."""
        _clean_env(monkeypatch)
        test_app = create_app()

        # Route raises a message containing a newline and sensitive text.
        @test_app.get("/log-error")
        def raise_error() -> None:
            """Raise an exception with user-controlled text."""
            raise RuntimeError("secret\nINJECT")

        client = TestClient(test_app, raise_server_exceptions=False)
        with caplog.at_level(logging.ERROR, logger="app.core.middleware"):
            response = client.get("/log-error")

        middleware_logs = [
            record.getMessage()
            for record in caplog.records
            if record.name == "app.core.middleware"
        ]
        assert response.status_code == 500
        assert any(
            "exception_type=RuntimeError" in message
            for message in middleware_logs
        )
        assert all("secret" not in message for message in middleware_logs)
        assert all("INJECT" not in message for message in middleware_logs)


# Tracebacks are available only in DEBUG records for all exception paths.
class TestDebugTracebackLogging:
    """Exception summaries stay safe while DEBUG retains tracebacks."""

    # The last-resort handler includes exception info at DEBUG level.
    def test_handler_debug_record_has_traceback(
        self, caplog: pytest.LogCaptureFixture
    ) -> None:
        """The global handler emits exception info only at DEBUG."""
        scope: Scope = {
            "type": "http",
            "method": "GET",
            "path": "/handler-error",
            "headers": [],
            "query_string": b"",
            "server": ("testserver", 80),
            "scheme": "http",
            "root_path": "",
        }
        request = Request(scope)
        exception = RuntimeError("handler secret")

        with caplog.at_level(logging.DEBUG, logger="app.core.errors"):
            import asyncio

            asyncio.run(_unhandled_exception_handler(request, exception))

        records = [
            record
            for record in caplog.records
            if record.name == "app.core.errors"
        ]
        debug_records = [record for record in records if record.exc_info]
        assert debug_records
        assert any(
            "exception_type=RuntimeError" in record.getMessage()
            for record in records
        )
        assert all("handler secret" not in record.getMessage() for record in records)

    # The last-resort handler omits traceback info at INFO level.
    def test_handler_info_record_has_no_traceback(
        self, caplog: pytest.LogCaptureFixture
    ) -> None:
        """The global handler emits no exception info at INFO."""
        scope: Scope = {
            "type": "http",
            "method": "GET",
            "path": "/handler-error",
            "headers": [],
            "query_string": b"",
            "server": ("testserver", 80),
            "scheme": "http",
            "root_path": "",
        }
        request = Request(scope)
        exception = RuntimeError("handler secret")

        with caplog.at_level(logging.INFO, logger="app.core.errors"):
            import asyncio

            asyncio.run(_unhandled_exception_handler(request, exception))

        records = [
            record
            for record in caplog.records
            if record.name == "app.core.errors"
        ]
        assert records
        assert all(record.exc_info is None for record in records)
        assert any(
            "exception_type=RuntimeError" in record.getMessage()
            for record in records
        )
        assert all("handler secret" not in record.getMessage() for record in records)

    # Middleware before response start includes exception info at DEBUG level.
    def test_before_response_debug_record_has_traceback(
        self, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
    ) -> None:
        """The pre-response middleware error retains a DEBUG traceback."""
        _clean_env(monkeypatch)
        test_app = create_app()

        # Route raises before sending a response.
        @test_app.get("/before-error")
        def raise_error() -> None:
            """Raise an exception before response start."""
            raise RuntimeError("before secret")

        client = TestClient(test_app, raise_server_exceptions=False)
        with caplog.at_level(logging.DEBUG, logger="app.core.middleware"):
            response = client.get("/before-error")

        records = [
            record
            for record in caplog.records
            if record.name == "app.core.middleware"
            and "Unhandled exception" in record.getMessage()
        ]
        debug_records = [record for record in records if record.exc_info]
        assert response.status_code == 500
        assert debug_records
        assert any(
            "exception_type=RuntimeError" in record.getMessage()
            for record in records
        )
        assert all("before secret" not in record.getMessage() for record in records)

    # Middleware before response start omits exception info at INFO level.
    def test_before_response_info_record_has_no_traceback(
        self, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
    ) -> None:
        """The pre-response middleware error has no INFO traceback."""
        _clean_env(monkeypatch)
        test_app = create_app()

        # Route raises before sending a response.
        @test_app.get("/before-error")
        def raise_error() -> None:
            """Raise an exception before response start."""
            raise RuntimeError("before secret")

        client = TestClient(test_app, raise_server_exceptions=False)
        with caplog.at_level(logging.INFO, logger="app.core.middleware"):
            response = client.get("/before-error")

        records = [
            record
            for record in caplog.records
            if record.name == "app.core.middleware"
            and "Unhandled exception" in record.getMessage()
        ]
        assert response.status_code == 500
        assert records
        assert all(record.exc_info is None for record in records)
        assert any(
            "exception_type=RuntimeError" in record.getMessage()
            for record in records
        )
        assert all("before secret" not in record.getMessage() for record in records)

    # Middleware after response start includes exception info at DEBUG level.
    def test_after_response_debug_record_has_traceback(
        self, caplog: pytest.LogCaptureFixture
    ) -> None:
        """The post-response middleware error retains a DEBUG traceback."""
        scope: Scope = {
            "type": "http",
            "method": "GET",
            "path": "/after-error",
            "headers": [],
            "query_string": b"",
            "server": ("testserver", 80),
            "scheme": "http",
            "root_path": "",
        }
        messages: list[Message] = []

        # Sends a response and raises after the response has started.
        async def inner_app(
            inner_scope: Scope, receive: Receive, send: Send
        ) -> None:
            """Start a response and then raise an exception."""
            await send(
                {
                    "type": "http.response.start",
                    "status": 200,
                    "headers": [],
                }
            )
            raise RuntimeError("after secret")

        # Returns an empty HTTP request body to the middleware.
        async def receive() -> Message:
            """Return an empty HTTP request body."""
            return {"type": "http.request", "body": b"", "more_body": False}

        # Collects response messages emitted by the middleware.
        async def send(message: Message) -> None:
            """Collect ASGI response messages."""
            messages.append(message)

        middleware = RequestIdMiddleware(inner_app)
        with caplog.at_level(logging.DEBUG, logger="app.core.middleware"):
            with pytest.raises(RuntimeError, match="after secret"):
                import asyncio

                asyncio.run(middleware(scope, receive, send))

        records = [
            record
            for record in caplog.records
            if record.name == "app.core.middleware"
            and "Exception after response started" in record.getMessage()
        ]
        debug_records = [record for record in records if record.exc_info]
        assert messages
        assert debug_records
        assert any(
            "exception_type=RuntimeError" in record.getMessage()
            for record in records
        )
        assert all("after secret" not in record.getMessage() for record in records)

    # Middleware after response start omits exception info at INFO level.
    def test_after_response_info_record_has_no_traceback(
        self, caplog: pytest.LogCaptureFixture
    ) -> None:
        """The post-response middleware error has no INFO traceback."""
        scope: Scope = {
            "type": "http",
            "method": "GET",
            "path": "/after-error",
            "headers": [],
            "query_string": b"",
            "server": ("testserver", 80),
            "scheme": "http",
            "root_path": "",
        }
        messages: list[Message] = []

        # Sends a response and raises after the response has started.
        async def inner_app(
            inner_scope: Scope, receive: Receive, send: Send
        ) -> None:
            """Start a response and then raise an exception."""
            await send(
                {
                    "type": "http.response.start",
                    "status": 200,
                    "headers": [],
                }
            )
            raise RuntimeError("after secret")

        # Returns an empty HTTP request body to the middleware.
        async def receive() -> Message:
            """Return an empty HTTP request body."""
            return {"type": "http.request", "body": b"", "more_body": False}

        # Collects response messages emitted by the middleware.
        async def send(message: Message) -> None:
            """Collect ASGI response messages."""
            messages.append(message)

        middleware = RequestIdMiddleware(inner_app)
        with caplog.at_level(logging.INFO, logger="app.core.middleware"):
            with pytest.raises(RuntimeError, match="after secret"):
                import asyncio

                asyncio.run(middleware(scope, receive, send))

        records = [
            record
            for record in caplog.records
            if record.name == "app.core.middleware"
            and "Exception after response started" in record.getMessage()
        ]
        assert messages
        assert records
        assert all(record.exc_info is None for record in records)
        assert any(
            "exception_type=RuntimeError" in record.getMessage()
            for record in records
        )
        assert all("after secret" not in record.getMessage() for record in records)

