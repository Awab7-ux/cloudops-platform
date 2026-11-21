"""System endpoint routes: root, health, and version.

This module handles only HTTP concerns — request parsing, response
serialisation, and status codes.  All business logic is delegated to
``SystemService`` via FastAPI's ``Depends`` mechanism.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Request, Response
from prometheus_client import CONTENT_TYPE_LATEST

from app.services.alerts import AlertService, get_alert_service
from app.schemas.system import (
    HealthResponse,
    ReadyResponse,
    RootResponse,
    VersionResponse,
)
from app.services.readiness import ReadinessService, get_readiness_service
from app.services.summary import SummaryService, get_summary_service
from app.services.system import SystemService, get_system_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["system"])


# Scrapes request metrics and refreshes operational gauges from database state.
@router.get("/metrics", include_in_schema=False)
def read_metrics(
    request: Request,
    summary_service: SummaryService = Depends(get_summary_service),
    alert_service: AlertService = Depends(get_alert_service),
) -> Response:
    """Expose real request and current database metrics for Prometheus."""
    logger.debug("read_metrics entry")
    summary = summary_service.get_summary()
    metrics = request.app.state.metrics
    metrics.update_summary(summary)
    metrics.update_alert_counts(alert_service.count_active_by_type())
    response = Response(
        content=metrics.render(),
        media_type=CONTENT_TYPE_LATEST,
    )
    logger.debug("read_metrics exit")
    return response


# HTTP handler for GET / — delegates payload building to SystemService.
@router.get("/", response_model=RootResponse, status_code=200)
def read_root(
    service: SystemService = Depends(get_system_service),
) -> RootResponse:
    """Return basic service information.

    Args:
        service: Injected ``SystemService`` instance.

    Returns:
        ``RootResponse`` with the service name and a running message.
    """
    logger.debug("read_root entry")
    return service.get_root()


# HTTP handler for GET /health — delegates to SystemService.
@router.get("/health", response_model=HealthResponse, status_code=200)
def read_health(
    service: SystemService = Depends(get_system_service),
) -> HealthResponse:
    """Return the service health status.

    Args:
        service: Injected ``SystemService`` instance.

    Returns:
        ``HealthResponse`` with status ``"ok"``.
    """
    logger.debug("read_health entry")
    return service.get_health()


# HTTP handler for GET /ready; database work stays in ReadinessService.
@router.get("/ready", response_model=ReadyResponse, status_code=200)
def read_ready(
    service: ReadinessService = Depends(get_readiness_service),
) -> ReadyResponse:
    """Return database readiness status.

    Args:
        service: Injected ``ReadinessService`` instance.

    Returns:
        ``ReadyResponse`` when the database executes ``SELECT 1``.
    """
    logger.debug("read_ready entry")
    response = service.check_database()
    logger.debug("read_ready exit: status=%s", response.status)
    return response


# HTTP handler for GET /version — delegates to SystemService.
@router.get("/version", response_model=VersionResponse, status_code=200)
def read_version(
    service: SystemService = Depends(get_system_service),
) -> VersionResponse:
    """Return the service name and version.

    Args:
        service: Injected ``SystemService`` instance.

    Returns:
        ``VersionResponse`` with the service name and version.
    """
    logger.debug("read_version entry")
    return service.get_version()

