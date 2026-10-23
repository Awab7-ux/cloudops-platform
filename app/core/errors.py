"""Global error handling for consistent JSON error responses.

Registers a catch-all exception handler that returns a uniform error
shape and *never* leaks stack traces, internal details, or environment
values to clients.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


async def _unhandled_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    """Return a generic 500 response for any unhandled exception.

    The full traceback is logged server-side at ``EXCEPTION`` level for
    debugging, but clients receive only a safe, opaque message.

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
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error"},
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Install global exception handlers on the FastAPI application.

    ``HTTPException`` (including 404) is still handled by FastAPI's
    built-in handler because Starlette's ``ExceptionMiddleware`` matches
    the most specific handler via MRO lookup.  Our ``Exception`` handler
    only catches truly unexpected errors.

    Args:
        app: The FastAPI application instance.
    """
    app.add_exception_handler(Exception, _unhandled_exception_handler)

