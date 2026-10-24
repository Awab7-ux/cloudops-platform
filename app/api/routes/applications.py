"""HTTP routes for Application CRUD operations."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Query, Response

from app.models.application import ApplicationStatus, Environment
from app.schemas.application import (
    ApplicationCreate,
    ApplicationList,
    ApplicationRead,
    ApplicationUpdate,
)
from app.schemas.application import (
    MAX_APPLICATION_PAGE_SIZE,
    MIN_APPLICATION_PAGE_SIZE,
)
from app.services.application import ApplicationService, get_application_service

logger = logging.getLogger(__name__)

DEFAULT_APPLICATION_LIMIT: int = 50

router = APIRouter(prefix="/applications", tags=["applications"])


# Creates an application through the injected application service.
@router.post("", response_model=ApplicationRead, status_code=201)
def create_application(
    payload: ApplicationCreate,
    service: ApplicationService = Depends(get_application_service),
) -> ApplicationRead:
    """Create an application.

    Args:
        payload: Validated application creation body.
        service: Injected application service.

    Returns:
        The created application response.
    """
    logger.debug(
        "create_application entry: name_len=%d",
        len(payload.name),
    )
    application = service.create(payload)
    response = ApplicationRead.model_validate(application)
    logger.debug("create_application exit: id_len=%d", len(response.id))
    return response


# Lists filtered applications through the injected application service.
@router.get("", response_model=ApplicationList, status_code=200)
def list_applications(
    limit: int = Query(
        default=DEFAULT_APPLICATION_LIMIT,
        ge=MIN_APPLICATION_PAGE_SIZE,
        le=MAX_APPLICATION_PAGE_SIZE,
    ),
    offset: int = Query(default=0, ge=0),
    environment: Environment | None = None,
    status: ApplicationStatus | None = None,
    service: ApplicationService = Depends(get_application_service),
) -> ApplicationList:
    """List applications with optional filters and pagination.

    Args:
        limit: Number of rows to return.
        offset: Number of matching rows to skip.
        environment: Optional environment filter.
        status: Optional status filter.
        service: Injected application service.

    Returns:
        A paginated application response.
    """
    logger.debug(
        "list_applications entry: limit=%d offset=%d",
        limit,
        offset,
    )
    items, total = service.list(limit, offset, environment, status)
    response = ApplicationList(
        items=[ApplicationRead.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )
    logger.debug(
        "list_applications exit: item_count=%d total=%d",
        len(response.items),
        response.total,
    )
    return response


# Retrieves one application through the injected application service.
@router.get("/{application_id}", response_model=ApplicationRead, status_code=200)
def read_application(
    application_id: str,
    service: ApplicationService = Depends(get_application_service),
) -> ApplicationRead:
    """Retrieve one application by identifier.

    Args:
        application_id: UUID string path parameter.
        service: Injected application service.

    Returns:
        The requested application response.
    """
    logger.debug(
        "read_application entry: id_len=%d",
        len(application_id),
    )
    application = service.get(application_id)
    response = ApplicationRead.model_validate(application)
    logger.debug("read_application exit: id_len=%d", len(response.id))
    return response


# Updates an application through the injected application service.
@router.patch("/{application_id}", response_model=ApplicationRead, status_code=200)
def update_application(
    application_id: str,
    payload: ApplicationUpdate,
    service: ApplicationService = Depends(get_application_service),
) -> ApplicationRead:
    """Partially update one application.

    Args:
        application_id: UUID string path parameter.
        payload: Validated partial update body.
        service: Injected application service.

    Returns:
        The updated application response.
    """
    logger.debug(
        "update_application entry: id_len=%d field_count=%d",
        len(application_id),
        len(payload.model_fields_set),
    )
    application = service.update(application_id, payload)
    response = ApplicationRead.model_validate(application)
    logger.debug("update_application exit: id_len=%d", len(response.id))
    return response


# Deletes an application through the injected application service.
@router.delete("/{application_id}", status_code=204)
def delete_application(
    application_id: str,
    service: ApplicationService = Depends(get_application_service),
) -> Response:
    """Delete one application.

    Args:
        application_id: UUID string path parameter.
        service: Injected application service.

    Returns:
        An empty 204 response.
    """
    logger.debug(
        "delete_application entry: id_len=%d",
        len(application_id),
    )
    service.delete(application_id)
    response = Response(status_code=204)
    logger.debug("delete_application exit: status_code=%d", response.status_code)
    return response
