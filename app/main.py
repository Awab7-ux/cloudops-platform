"""Application entry point and factory.

``create_app()`` is the single place where all components are wired
together: configuration, logging, middleware, CORS, error handlers, and
routers.  The module-level ``app`` instance is consumed by Uvicorn and
the Dockerfile ``CMD``.

Backward-compatibility note
---------------------------
``DEFAULT_APP_NAME`` and ``DEFAULT_APP_VERSION`` are re-exported here
so that existing tests can continue to import them from ``app.main``.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.system import router as system_router
from app.core.config import (
    DEFAULT_APP_NAME,
    DEFAULT_APP_VERSION,
    build_settings,
)
from app.core.errors import register_exception_handlers
from app.core.logging import setup_logging
from app.core.middleware import RequestIdMiddleware

# Re-exported so existing tests that do
#   ``from app.main import DEFAULT_APP_NAME, DEFAULT_APP_VERSION``
# keep working without modification.
__all__ = ["DEFAULT_APP_NAME", "DEFAULT_APP_VERSION", "create_app", "app"]

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    """Create and fully configure the FastAPI application.

    Reads all settings from environment variables (no caching — every
    call re-reads the environment so that monkeypatch-based tests work),
    configures logging, installs middleware, mounts routers, and
    registers the global exception handler.

    **Middleware ordering** (outermost → innermost):

    1. ``CORSMiddleware`` — enforces the origin allow-list with a
       GET-only, no-credentials policy.
    2. ``RequestIdMiddleware`` — assigns/validates ``X-Request-ID``,
       logs method, path, status code, and duration, and acts as the
       error boundary for unhandled exceptions.

    The error boundary in ``RequestIdMiddleware`` catches unhandled
    exceptions and returns a safe 500 JSON response *inside* the
    middleware stack, so the response passes back through
    ``CORSMiddleware``.  This guarantees that ``X-Request-ID`` **and**
    CORS headers are present even on 500 responses.

    Returns:
        A fully configured ``FastAPI`` application instance.
    """
    settings = build_settings()

    setup_logging(settings.log_level)

    application = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
    )

    # Store settings in app.state for dependency injection via
    # get_settings(request) — avoids module-level singletons.
    application.state.settings = settings

    # --- Exception handlers (innermost — part of the ASGI app) ---
    register_exception_handlers(application)

    # --- Routers ---
    application.include_router(system_router)

    # --- Middleware (added bottom-up; last add_middleware = outermost) ---
    # WHY this order: Starlette makes the *last* ``add_middleware``
    # call the outermost layer.  CORSMiddleware must be outermost so
    # that CORS headers are added to every response — including the
    # safe 500s produced by the error boundary inside
    # RequestIdMiddleware.

    # Request-ID + access-log + error boundary: catches unhandled
    # exceptions inside the stack so the 500 response travels back
    # through CORSMiddleware and gets both X-Request-ID and CORS
    # headers.
    application.add_middleware(RequestIdMiddleware)

    # CORS: outermost layer — allow only the configured origins, only
    # GET, never send credentials.  Wildcard "*" is already rejected
    # by build_settings().
    application.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_methods=["GET"],
        allow_credentials=False,
        # Empty list: no extra request headers are permitted in
        # preflight.  GET with standard headers is a "simple request"
        # and does not trigger preflight anyway.
        allow_headers=[],
    )

    logger.info(
        "Application started: name=%s, version=%s, log_level=%s, "
        "cors_origins=%s",
        settings.app_name,
        settings.app_version,
        settings.log_level,
        settings.cors_origins,
    )

    return application


app = create_app()
