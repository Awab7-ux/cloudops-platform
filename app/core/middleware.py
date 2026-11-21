"""Request-lifecycle middleware: ID assignment, request logging, and error boundary.

Implemented as a pure ASGI middleware (not ``BaseHTTPMiddleware``) to
avoid known context-variable propagation issues in older Starlette
versions and to give full control over the response-header injection.
"""

from __future__ import annotations

import logging
import re
import time
import uuid

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.errors import build_error_response
from app.core.logging import request_id_ctx, safe_log_value
from app.core.metrics import CloudOpsMetrics

logger = logging.getLogger(__name__)

# Accept only safe characters, bounded length — prevents header
# injection and log-line abuse.
_VALID_ID_RE = re.compile(r"[A-Za-z0-9._-]{1,64}")


# Returns raw X-Request-ID if safe, else a fresh UUID4.
def _sanitize_request_id(raw: str | None) -> str:
    """Return *raw* if it is a safe request ID, otherwise a new UUID4.

    Rules:
    * At most 64 characters.
    * Characters limited to ``[A-Za-z0-9._-]``.
    * ``None`` or empty string → new UUID4.

    Args:
        raw: The raw ``X-Request-ID`` header value, or ``None``.

    Returns:
        A validated request-ID string.
    """
    logger.debug("_sanitize_request_id entry: raw=%s", safe_log_value(raw))
    if raw and _VALID_ID_RE.fullmatch(raw):
        return raw
    return str(uuid.uuid4())


# Pure ASGI middleware: request-ID, access logging, and the 500 error boundary.
class RequestIdMiddleware:
    """Pure ASGI middleware for request-ID propagation, access logging,
    and an error boundary for unhandled exceptions.

    For every HTTP request the middleware:

    1. Reads ``X-Request-ID`` from the incoming headers.
    2. Validates it (≤ 64 chars, ``[A-Za-z0-9._-]``); generates a
       UUID4 if the header is missing or invalid.
    3. Stores the ID in ``request_id_ctx`` (a ``ContextVar``) so the
       log formatter can include it automatically.
    4. Catches any unhandled exception from the inner app and returns
       a safe 500 JSON response (error boundary).
    5. Injects ``X-Request-ID`` into the response headers.
    6. Logs method, path, status code, and duration in milliseconds.

    WHY the error boundary lives here: the global ``Exception`` handler
    registered on the FastAPI app is executed by Starlette's
    ``ServerErrorMiddleware`` — the outermost ASGI layer — so its 500
    response bypasses every ``add_middleware`` layer.  Catching the
    exception here (inside the middleware stack) ensures the response
    travels back through ``CORSMiddleware`` and gets the
    ``X-Request-ID`` header from this middleware.
    """

# Stores the inner ASGI app.
    def __init__(
        self,
        app: ASGIApp,
        metrics: CloudOpsMetrics | None = None,
    ) -> None:
        """Initialise with the next ASGI application in the stack.

        Args:
            app: The inner ASGI application.
        """
        logger.debug("RequestIdMiddleware.__init__ entry")
        self.app = app
        self.metrics = metrics

# Routes non-HTTP scopes through; for HTTP runs the ID/error-boundary flow.
    async def __call__(
        self, scope: Scope, receive: Receive, send: Send
    ) -> None:
        """Process an ASGI connection.

        Non-HTTP scopes (``lifespan``, ``websocket``) are passed through
        without modification.

        Args:
            scope: ASGI connection scope.
            receive: Callable to receive ASGI events.
            send: Callable to send ASGI events.
        """
        logger.debug(
            "RequestIdMiddleware.__call__ entry: scope_type=%s",
            safe_log_value(scope["type"]),
        )
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # --- Extract or generate request ID ---
        raw_id: str | None = None
        for header_name, header_value in scope.get("headers", []):
            if header_name == b"x-request-id":
                raw_id = header_value.decode("latin-1")
                break

        request_id = _sanitize_request_id(raw_id)
        token = request_id_ctx.set(request_id)

        method: str = scope.get("method", "?")
        path: str = scope.get("path", "?")
        safe_method = safe_log_value(method)
        safe_path = safe_log_value(path)
        safe_request_id = safe_log_value(request_id)
        start = time.perf_counter()

        # Default to 500 so that even if we never see an
        # ``http.response.start`` message the log line still reflects
        # a server error.
        status_code = 500

        # WHY track ``response_started``: once the first
        # ``http.response.start`` has been sent we cannot replace the
        # response, so the error boundary must not try.
        response_started = False

# Intercepts http.response.start to inject X-Request-ID and record status.
        async def send_with_request_id(message: Message) -> None:
            """Intercept the response-start message to inject headers.

            Args:
                message: The ASGI send message.
            """
            nonlocal status_code, response_started
            logger.debug(
                "send_with_request_id entry: message_type=%s",
                safe_log_value(message["type"]),
            )
            if message["type"] == "http.response.start":
                response_started = True
                status_code = message["status"]
                headers = MutableHeaders(scope=message)
                headers["x-request-id"] = request_id
            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        except Exception as exc:
            # WHY catch here: ensures the 500 response passes back
            # through CORSMiddleware (which wraps this middleware) so
            # CORS and X-Request-ID headers are always present.
            if not response_started:
                logger.error(
                    "Unhandled exception on method=%s path=%s "
                    "request_id=%s exception_type=%s",
                    safe_method,
                    safe_path,
                    safe_request_id,
                    safe_log_value(type(exc).__name__),
                )
                logger.debug("Unhandled exception traceback", exc_info=exc)
                # Build the safe JSON response, inject request-ID,
                # and send it through the normal ASGI channel.
                error_response = build_error_response()
                await error_response(scope, receive, send_with_request_id)
            else:
                # Response already started — the status line and headers
                # have been sent so the response cannot be replaced. Log
                # the failure and re-raise so the ASGI server can close
                # the connection cleanly instead of silently swallowing
                # the error.
                logger.error(
                    "Exception after response started on method=%s path=%s "
                    "request_id=%s exception_type=%s",
                    safe_method,
                    safe_path,
                    safe_request_id,
                    safe_log_value(type(exc).__name__),
                )
                logger.debug(
                    "Exception after response started traceback", exc_info=exc
                )
                raise
        finally:
            duration_seconds = time.perf_counter() - start
            duration_ms = duration_seconds * 1000
            # The scrape endpoint must not count its own polling traffic.
            if self.metrics is not None and path != "/metrics":
                route = scope.get("route")
                route_template = getattr(route, "path", "unmatched")
                self.metrics.record_request(
                    method=method,
                    route=route_template,
                    status_code=status_code,
                    duration_seconds=duration_seconds,
                )
            # Logs every request including 500s so that no failure is
            # invisible in the access log.
            logger.info(
                "%s %s -> %d (%.1fms)",
                safe_method,
                safe_path,
                status_code,
                duration_ms,
            )
            request_id_ctx.reset(token)

