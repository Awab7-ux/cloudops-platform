"""Global error handling for consistent JSON error responses.

Provides a shared safe-error body builder and a last-resort catch-all
exception handler.  The primary error boundary lives in
``RequestIdMiddleware`` (so 500 responses pass through the CORS and
request-ID layers); this handler exists only as a defence-in-depth
fallback and *never* leaks stack traces, internal details, or
environment values to clients.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

# ── Shared safe-error body (DRY) ─────────────────────────────────────

# WHY a constant dict: both the middleware error boundary and the
# last-resort handler must return the exact same opaque body, so we
# define it once here rather than duplicating the literal.
INTERNAL_ERROR_BODY: dict[str, str] = {"detail": "Internal Server Error"}
"""Safe JSON body returned for all unexpected 500 responses."""


def build_error_response() -> JSONResponse:
    """Build a generic 500 ``JSONResponse`` with a safe, opaque body.

    This factory is called by the error boundary in
    ``RequestIdMiddleware`` and by the last-resort handler below so
    that the response shape is defined in a single place.

    Returns:
        A 500 ``JSONResponse`` with ``{"detail": "Internal Server Error"}``.
    """
    return JSONResponse(
        status_code=500,
        content=INTERNAL_ERROR_BODY,
    )


# ── Last-resort exception handler ────────────────────────────────────


async def _unhandled_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    """Return a generic 500 response for any unhandled exception.

    This handler is registered on the FastAPI app as a last-resort
    fallback.  Under normal operation the error boundary in
    ``RequestIdMiddleware`` catches exceptions first; this handler
    fires only if something goes wrong before or outside the
    middleware stack.

    The full traceback is logged server-side at ``EXCEPTION`` level
    for debugging, but clients receive only a safe, opaque message.

    Args:
        request: The request that triggered the exception.
        exc: The unhandled exception.

    Returns:
        A 500 ``JSONResponse`` with ``{"detail": "Internal Server Error"}``.
    """
    logger.exception(
        "Unhandled exception on %s %s",
        request.method,
        request.url.path,
    )
    return build_error_response()


def register_exception_handlers(app: FastAPI) -> None:
    """Install global exception handlers on the FastAPI application.

    ``HTTPException`` (including 404) is still handled by FastAPI's
    built-in handler because Starlette's ``ExceptionMiddleware`` matches
    the most specific handler via MRO lookup.  Our ``Exception`` handler
    only catches truly unexpected errors that somehow escape the
    middleware error boundary.

    Args:
        app: The FastAPI application instance.
    """
    app.add_exception_handler(Exception, _unhandled_exception_handler)

