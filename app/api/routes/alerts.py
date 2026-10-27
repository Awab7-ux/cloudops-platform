"""HTTP routes for the derived alerts endpoint."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Query

from app.core.pagination import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MIN_PAGE_SIZE
from app.models.alert import AlertSeverity, AlertType
from app.schemas.alert import AlertList
from app.services.alerts import AlertService, get_alert_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["alerts"])


# Reads the derived, aggregated alert feed for the current system state.
@router.get("/alerts", response_model=AlertList, status_code=200)
def read_alerts(
    limit: int = Query(
        default=DEFAULT_PAGE_SIZE,
        ge=MIN_PAGE_SIZE,
        le=MAX_PAGE_SIZE,
    ),
    offset: int = Query(default=0, ge=0),
    severity: AlertSeverity | None = None,
    alert_type: AlertType | None = Query(default=None, alias="type"),
    application_id: str | None = None,
    service: AlertService = Depends(get_alert_service),
) -> AlertList:
    """Return the derived alert feed with optional filters and pagination.

    Args:
        limit: Number of alerts to return.
        offset: Number of rows to skip before the page.
        severity: Optional severity filter.
        alert_type: Optional alert type filter under the ``type`` query parameter.
        application_id: Optional application UUID filter.
        service: Injected alert service.

    Returns:
        The sorted, paginated alert list for the current state.
    """
    logger.debug(
        "read_alerts entry: limit=%d offset=%d severity=%s type=%s app_id=%s",
        limit,
        offset,
        severity.value if severity else None,
        alert_type.value if alert_type else None,
        application_id,
    )
    response = service.list(
        limit=limit,
        offset=offset,
        severity=severity,
        alert_type=alert_type,
        application_id=application_id,
    )
    logger.debug(
        "read_alerts exit: total=%d item_count=%d",
        response.total,
        len(response.items),
    )
    return response
