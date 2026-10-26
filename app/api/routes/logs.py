"""HTTP routes for application and deployment log creation and listing."""

from __future__ import annotations

from datetime import datetime
import logging

from fastapi import APIRouter, Depends, Query
from pydantic import AwareDatetime

from app.core.pagination import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MIN_PAGE_SIZE
from app.models.log import LogLevel
from app.schemas.log import LogCreate, LogList, LogRead
from app.services.log import LogService, get_log_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["logs"])


# Creates a log entry under one application and records the server timestamp.
@router.post(
    "/applications/{application_id}/logs",
    response_model=LogRead,
    status_code=201,
)
def create_log(
    application_id: str,
    payload: LogCreate,
    service: LogService = Depends(get_log_service),
) -> LogRead:
    """Create a log entry for a specific application.

    Args:
        application_id: Parent application UUID.
        payload: Validated log body with optional deployment association.
        service: Injected log service.

    Returns:
        The created log response.
    """
    logger.debug(
        "create_log entry: application_id_len=%d level=%s",
        len(application_id),
        payload.level.value,
    )
    log_entry = service.create_for_application(application_id, payload)
    response = LogRead.model_validate(log_entry)
    logger.debug("create_log exit: id_len=%d", len(response.id))
    return response


# Lists log entries for one application with pagination and filters.
@router.get(
    "/applications/{application_id}/logs",
    response_model=LogList,
    status_code=200,
)
def list_application_logs(
    application_id: str,
    limit: int = Query(
        default=DEFAULT_PAGE_SIZE,
        ge=MIN_PAGE_SIZE,
        le=MAX_PAGE_SIZE,
    ),
    offset: int = Query(default=0, ge=0),
    level: LogLevel | None = None,
    since: AwareDatetime | None = Query(
        default=None,
        description="Inclusive lower-bound timestamp in ISO 8601 with timezone.",
    ),
    until: AwareDatetime | None = Query(
        default=None,
        description="Inclusive upper-bound timestamp in ISO 8601 with timezone.",
    ),
    service: LogService = Depends(get_log_service),
) -> LogList:
    """List logs for one application with optional filtering.

    Args:
        application_id: Parent application UUID.
        limit: Rows to return on the page.
        offset: Matching rows to skip before the current page.
        level: Optional severity filter.
        since: Optional lower-bound timestamp.
        until: Optional upper-bound timestamp.
        service: Injected log service.

    Returns:
        A paginated log payload.
    """
    logger.debug(
        "list_application_logs entry: application_id_len=%d limit=%d offset=%d",
        len(application_id),
        limit,
        offset,
    )
    items, total = service.list_for_application(
        application_id,
        limit,
        offset,
        level,
        since,
        until,
    )
    response = LogList(
        items=[LogRead.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )
    logger.debug(
        "list_application_logs exit: item_count=%d total=%d",
        len(response.items),
        response.total,
    )
    return response


# Lists log entries for one deployment with pagination and filters.
@router.get(
    "/deployments/{deployment_id}/logs",
    response_model=LogList,
    status_code=200,
)
def list_deployment_logs(
    deployment_id: str,
    limit: int = Query(
        default=DEFAULT_PAGE_SIZE,
        ge=MIN_PAGE_SIZE,
        le=MAX_PAGE_SIZE,
    ),
    offset: int = Query(default=0, ge=0),
    level: LogLevel | None = None,
    since: AwareDatetime | None = Query(
        default=None,
        description="Inclusive lower-bound timestamp in ISO 8601 with timezone.",
    ),
    until: AwareDatetime | None = Query(
        default=None,
        description="Inclusive upper-bound timestamp in ISO 8601 with timezone.",
    ),
    service: LogService = Depends(get_log_service),
) -> LogList:
    """List logs for one deployment with optional filtering.

    Args:
        deployment_id: Parent deployment UUID.
        limit: Rows to return on the page.
        offset: Matching rows to skip before the current page.
        level: Optional severity filter.
        since: Optional lower-bound timestamp.
        until: Optional upper-bound timestamp.
        service: Injected log service.

    Returns:
        A paginated log payload.
    """
    logger.debug(
        "list_deployment_logs entry: deployment_id_len=%d limit=%d offset=%d",
        len(deployment_id),
        limit,
        offset,
    )
    items, total = service.list_for_deployment(
        deployment_id,
        limit,
        offset,
        level,
        since,
        until,
    )
    response = LogList(
        items=[LogRead.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )
    logger.debug(
        "list_deployment_logs exit: item_count=%d total=%d",
        len(response.items),
        response.total,
    )
    return response


# Lists all logs matching the configured global filters and pagination settings.
@router.get("/logs", response_model=LogList, status_code=200)
def list_logs(
    limit: int = Query(
        default=DEFAULT_PAGE_SIZE,
        ge=MIN_PAGE_SIZE,
        le=MAX_PAGE_SIZE,
    ),
    offset: int = Query(default=0, ge=0),
    level: LogLevel | None = None,
    application_id: str | None = None,
    deployment_id: str | None = None,
    since: AwareDatetime | None = Query(
        default=None,
        description="Inclusive lower-bound timestamp in ISO 8601 with timezone.",
    ),
    until: AwareDatetime | None = Query(
        default=None,
        description="Inclusive upper-bound timestamp in ISO 8601 with timezone.",
    ),
    service: LogService = Depends(get_log_service),
) -> LogList:
    """Return the global log feed with optional filters.

    Args:
        limit: Rows to return on the page.
        offset: Matching rows to skip before the current page.
        level: Optional severity filter.
        application_id: Optional application UUID filter.
        deployment_id: Optional deployment UUID filter.
        since: Optional lower-bound timestamp.
        until: Optional upper-bound timestamp.
        service: Injected log service.

    Returns:
        A paginated global log response.
    """
    logger.debug(
        "list_logs entry: limit=%d offset=%d level=%s",
        limit,
        offset,
        level.value if level else None,
    )
    items, total = service.list_all(
        limit,
        offset,
        level,
        application_id,
        deployment_id,
        since,
        until,
    )
    response = LogList(
        items=[LogRead.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )
    logger.debug("list_logs exit: item_count=%d total=%d", len(response.items), response.total)
    return response
