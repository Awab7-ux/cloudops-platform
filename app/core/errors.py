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

from app.core.logging import safe_log_value
from app.domain.exceptions import ConflictError, NotFoundError

logger = logging.getLogger(__name__)


# Domain error raised when the readiness query cannot use the database.
class DatabaseUnavailableError(Exception):
    """Indicate that the configured database is unavailable."""

# ── Shared safe-error body (DRY) ─────────────────────────────────────

# WHY a constant dict: both the middleware error boundary and the
# last-resort handler must return the exact same opaque body, so we
# define it once here rather than duplicating the literal.
INTERNAL_ERROR_BODY: dict[str, str] = {"detail": "Internal Server Error"}
"""Safe JSON body returned for all unexpected 500 responses."""


# Builds the shared opaque 500 JSON body used by middleware and handler.
def build_error_response() -> JSONResponse:
    """Build a generic 500 ``JSONResponse`` with a safe, opaque body.

    This factory is called by the error boundary in
    ``RequestIdMiddleware`` and by the last-resort handler below so
    that the response shape is defined in a single place.

    Returns:
        A 500 ``JSONResponse`` with ``{"detail": "Internal Server Error"}``.
    """
    logger.debug("build_error_response entry")
    return JSONResponse(
        status_code=500,
        content=INTERNAL_ERROR_BODY,
    )


# Builds the safe response for a failed database readiness check.
async def _database_unavailable_exception_handler(
    request: Request,
    exc: DatabaseUnavailableError,
) -> JSONResponse:
    """Return a safe 503 response for database unavailability.

    Args:
        request: Request that triggered the readiness failure.
        exc: Domain error describing database unavailability.

    Returns:
        A JSON response without database exception details.
    """
    logger.debug(
        "_database_unavailable_exception_handler entry: method=%s path=%s",
        safe_log_value(request.method),
        safe_log_value(request.url.path),
    )
    response = JSONResponse(
        status_code=503,
        content={"detail": "database unavailable"},
    )
    logger.debug(
        "_database_unavailable_exception_handler exit: status_code=%d",
        response.status_code,
    )
    return response


# Builds the safe 404 response for missing application resources.
async def _not_found_exception_handler(
    request: Request,
    exc: NotFoundError,
) -> JSONResponse:
    """Return the public response for a missing application.

    Args:
        request: Request that triggered the missing-resource error.
        exc: Domain error describing the missing resource.

    Returns:
        A 404 response with a fixed safe detail.
    """
    logger.debug(
        "_not_found_exception_handler entry: path=%s",
        safe_log_value(request.url.path),
    )
    response = JSONResponse(
        status_code=404,
        content={"detail": "application not found"},
    )
    logger.debug(
        "_not_found_exception_handler exit: status_code=%d",
        response.status_code,
    )
    return response


# Builds the safe 409 response for duplicate application names.
async def _conflict_exception_handler(
    request: Request,
    exc: ConflictError,
) -> JSONResponse:
    """Return the public response for an application name conflict.

    Args:
        request: Request that triggered the conflict error.
        exc: Domain error describing the conflict.

    Returns:
        A 409 response with a fixed safe detail.
    """
    logger.debug(
        "_conflict_exception_handler entry: path=%s",
        safe_log_value(request.url.path),
    )
    response = JSONResponse(
        status_code=409,
        content={"detail": "application name already exists"},
    )
    logger.debug(
        "_conflict_exception_handler exit: status_code=%d",
        response.status_code,
    )
    return response


# ── Last-resort exception handler ────────────────────────────────────


# Last-resort handler: logs the traceback, returns a safe opaque 500 body.
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

    A safe summary is logged server-side for correlation, but clients
    receive only a safe, opaque message.

    Args:
        request: The request that triggered the exception.
        exc: The unhandled exception.

    Returns:
        A 500 ``JSONResponse`` with ``{"detail": "Internal Server Error"}``.
    """
    logger.debug("_unhandled_exception_handler entry")
    logger.error(
        "Unhandled exception on method=%s path=%s exception_type=%s",
        safe_log_value(request.method),
        safe_log_value(request.url.path),
        safe_log_value(type(exc).__name__),
    )
    logger.debug("Unhandled exception traceback", exc_info=exc)
    return build_error_response()


# Registers the catch-all Exception handler as defence-in-depth.
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
    logger.debug("register_exception_handlers entry")
    app.add_exception_handler(
        DatabaseUnavailableError,
        _database_unavailable_exception_handler,
    )
    app.add_exception_handler(NotFoundError, _not_found_exception_handler)
    app.add_exception_handler(ConflictError, _conflict_exception_handler)
    app.add_exception_handler(Exception, _unhandled_exception_handler)
    logger.debug("register_exception_handlers exit")

