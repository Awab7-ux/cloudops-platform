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
from app.domain.exceptions import (
    ConflictError,
    InvalidLogTimeRangeError,
    NotFoundError,
)

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

# WHY: only fixed domain resource names may become public response details.
_SAFE_NOT_FOUND_RESOURCES: frozenset[str] = frozenset(
    {"application", "deployment"}
)
_DEFAULT_NOT_FOUND_RESOURCE = "application"
_SAFE_CONFLICT_DETAILS: frozenset[str] = frozenset(
    {"application name already exists", "invalid status transition"}
)
_DEFAULT_CONFLICT_DETAIL = "application name already exists"
_SAFE_VALIDATION_DETAILS: frozenset[str] = frozenset(
    {"since must not be after until"}
)
_DEFAULT_VALIDATION_DETAIL = "since must not be after until"


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


# Builds the safe 404 response for missing domain resources.
async def _not_found_exception_handler(
    request: Request,
    exc: NotFoundError,
) -> JSONResponse:
    """Return the public response for a missing domain resource.

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
    resource = (
        exc.resource
        if exc.resource in _SAFE_NOT_FOUND_RESOURCES
        else _DEFAULT_NOT_FOUND_RESOURCE
    )
    response = JSONResponse(
        status_code=404,
        content={"detail": f"{resource} not found"},
    )
    logger.debug(
        "_not_found_exception_handler exit: status_code=%d",
        response.status_code,
    )
    return response


# Builds the safe 409 response for domain conflicts.
async def _conflict_exception_handler(
    request: Request,
    exc: ConflictError,
) -> JSONResponse:
    """Return the public response for a domain conflict.

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
    detail = (
        exc.detail
        if exc.detail in _SAFE_CONFLICT_DETAILS
        else _DEFAULT_CONFLICT_DETAIL
    )
    response = JSONResponse(status_code=409, content={"detail": detail})
    logger.debug(
        "_conflict_exception_handler exit: status_code=%d",
        response.status_code,
    )
    return response


# Builds the safe 422 response for a rejected log time range.
async def _invalid_log_time_range_exception_handler(
    request: Request,
    exc: InvalidLogTimeRangeError,
) -> JSONResponse:
    """Return a safe validation response for an inverted log time range.

    Args:
        request: Request that triggered the invalid range.
        exc: Domain error describing the rejected range.

    Returns:
        A 422 response with a fixed safe detail.
    """
    logger.debug(
        "_invalid_log_time_range_exception_handler entry: path=%s",
        safe_log_value(request.url.path),
    )
    detail = (
        exc.detail
        if exc.detail in _SAFE_VALIDATION_DETAILS
        else _DEFAULT_VALIDATION_DETAIL
    )
    response = JSONResponse(status_code=422, content={"detail": detail})
    logger.debug(
        "_invalid_log_time_range_exception_handler exit: status_code=%d",
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
    app.add_exception_handler(
        InvalidLogTimeRangeError,
        _invalid_log_time_range_exception_handler,
    )
    app.add_exception_handler(Exception, _unhandled_exception_handler)
    logger.debug("register_exception_handlers exit")
