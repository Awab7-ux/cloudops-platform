"""HTTP routes for Deployment lifecycle operations."""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.core.pagination import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MIN_PAGE_SIZE
from app.models.deployment import DeploymentStatus
from app.schemas.deployment import (
    DeploymentCreate,
    DeploymentGlobalQuery,
    DeploymentList,
    DeploymentRead,
    DeploymentStatusUpdate,
    GlobalDeploymentList,
    GlobalDeploymentRead,
)
from app.services.deployment import DeploymentService, get_deployment_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["deployments"])


# Creates a deployment through the injected deployment service.
@router.post(
    "/applications/{application_id}/deployments",
    response_model=DeploymentRead,
    status_code=201,
)
def create_deployment(
    application_id: str,
    payload: DeploymentCreate,
    service: DeploymentService = Depends(get_deployment_service),
) -> DeploymentRead:
    """Create a pending deployment under an application.

    Args:
        application_id: Parent application UUID string.
        payload: Validated deployment creation body.
        service: Injected deployment service.

    Returns:
        The created deployment response.
    """
    logger.debug(
        "create_deployment entry: application_id_len=%d version_len=%d",
        len(application_id),
        len(payload.version),
    )
    deployment = service.create_for_application(application_id, payload)
    response = DeploymentRead.model_validate(deployment)
    logger.debug("create_deployment exit: id_len=%d", len(response.id))
    return response


# Lists one application's deployments through the injected service.
@router.get(
    "/applications/{application_id}/deployments",
    response_model=DeploymentList,
    status_code=200,
)
def list_deployments(
    application_id: str,
    limit: int = Query(
        default=DEFAULT_PAGE_SIZE,
        ge=MIN_PAGE_SIZE,
        le=MAX_PAGE_SIZE,
    ),
    offset: int = Query(default=0, ge=0),
    status: DeploymentStatus | None = None,
    service: DeploymentService = Depends(get_deployment_service),
) -> DeploymentList:
    """List an application's deployments with optional status filtering.

    Args:
        application_id: Parent application UUID string.
        limit: Number of rows to return.
        offset: Number of matching rows to skip.
        status: Optional lifecycle status filter.
        service: Injected deployment service.

    Returns:
        A paginated deployment response.
    """
    logger.debug(
        "list_deployments entry: application_id_len=%d limit=%d offset=%d",
        len(application_id),
        limit,
        offset,
    )
    items, total = service.list_for_application(
        application_id,
        limit,
        offset,
        status,
    )
    response = DeploymentList(
        items=[DeploymentRead.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )
    logger.debug(
        "list_deployments exit: item_count=%d total=%d",
        len(response.items),
        response.total,
    )
    return response


# Lists deployments across applications through the injected service.
@router.get(
    "/deployments",
    response_model=GlobalDeploymentList,
    status_code=200,
)
def list_global_deployments(
    query: Annotated[DeploymentGlobalQuery, Query()],
    service: DeploymentService = Depends(get_deployment_service),
) -> GlobalDeploymentList:
    """List deployments with optional application, status, environment, and text filters.

    Args:
        query: Validated global filters and page bounds.
        service: Injected deployment service.

    Returns:
        A paginated global deployment response.
    """
    logger.debug(
        "list_global_deployments entry: limit=%d offset=%d has_query=%s",
        query.limit,
        query.offset,
        query.q is not None,
    )
    items, total = service.list_global(query)
    response = GlobalDeploymentList(
        items=[GlobalDeploymentRead.model_validate(item) for item in items],
        total=total,
        limit=query.limit,
        offset=query.offset,
    )
    logger.debug(
        "list_global_deployments exit: item_count=%d total=%d",
        len(response.items),
        response.total,
    )
    return response


# Retrieves one deployment through the injected deployment service.
@router.get(
    "/deployments/{deployment_id}",
    response_model=DeploymentRead,
    status_code=200,
)
def read_deployment(
    deployment_id: str,
    service: DeploymentService = Depends(get_deployment_service),
) -> DeploymentRead:
    """Retrieve one deployment by identifier.

    Args:
        deployment_id: UUID string path parameter.
        service: Injected deployment service.

    Returns:
        The requested deployment response.
    """
    logger.debug(
        "read_deployment entry: id_len=%d",
        len(deployment_id),
    )
    deployment = service.get(deployment_id)
    response = DeploymentRead.model_validate(deployment)
    logger.debug("read_deployment exit: id_len=%d", len(response.id))
    return response


# Updates a deployment status through the injected service.
@router.patch(
    "/deployments/{deployment_id}/status",
    response_model=DeploymentRead,
    status_code=200,
)
def update_deployment_status(
    deployment_id: str,
    payload: DeploymentStatusUpdate,
    service: DeploymentService = Depends(get_deployment_service),
) -> DeploymentRead:
    """Change one deployment's lifecycle status.

    Args:
        deployment_id: UUID string path parameter.
        payload: Validated target status body.
        service: Injected deployment service.

    Returns:
        The updated deployment response.
    """
    logger.debug(
        "update_deployment_status entry: id_len=%d status=%s",
        len(deployment_id),
        payload.status.value,
    )
    deployment = service.update_status(deployment_id, payload)
    response = DeploymentRead.model_validate(deployment)
    logger.debug(
        "update_deployment_status exit: id_len=%d",
        len(response.id),
    )
    return response
