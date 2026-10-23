"""Request-lifecycle middleware: ID assignment and request logging.

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

from app.core.logging import request_id_ctx

logger = logging.getLogger(__name__)

# Accept only safe characters, bounded length — prevents header
# injection and log-line abuse.
_VALID_ID_RE = re.compile(r"^[A-Za-z0-9._-]{1,64}$")


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
    if raw and _VALID_ID_RE.match(raw):
        return raw
    return str(uuid.uuid4())


class RequestIdMiddleware:
    """Pure ASGI middleware for request-ID propagation and access logging.

    For every HTTP request the middleware:

    1. Reads ``X-Request-ID`` from the incoming headers.
    2. Validates it (≤ 64 chars, ``[A-Za-z0-9._-]``); generates a
       UUID4 if the header is missing or invalid.
    3. Stores the ID in ``request_id_ctx`` (a ``ContextVar``) so the
       log formatter can include it automatically.
    4. Injects ``X-Request-ID`` into the response headers.
    5. Logs method, path, status code, and duration in milliseconds.
    """

    def __init__(self, app: ASGIApp) -> None:
        """Initialise with the next ASGI application in the stack.

        Args:
            app: The inner ASGI application.
        """
        self.app = app

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
        start = time.perf_counter()

        # Default to 500 so that even if we never see an
        # ``http.response.start`` message the log line still reflects
        # a server error.
        status_code = 500

        async def send_with_request_id(message: Message) -> None:
            """Intercept the response-start message to inject headers.

            Args:
                message: The ASGI send message.
            """
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
                headers = MutableHeaders(scope=message)
                headers.append("x-request-id", request_id)
            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        finally:
            duration_ms = (time.perf_counter() - start) * 1000
            # Logs every request including 500s so that no failure is
            # invisible in the access log.
            logger.info(
                "%s %s -> %d (%.1fms)",
                method,
                path,
                status_code,
                duration_ms,
            )
            request_id_ctx.reset(token)

