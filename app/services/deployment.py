"""Deployment business services and FastAPI dependency providers."""

from __future__ import annotations

import logging

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.logging import safe_log_value
from app.db.session import get_session
from app.domain.exceptions import ConflictError, NotFoundError
from app.models.deployment import Deployment, DeploymentStatus
from app.repositories.application import ApplicationRepository
from app.repositories.deployment import DeploymentRepository
from app.schemas.deployment import (
    DeploymentCreate,
    DeploymentStatusUpdate,
)
from app.services.application import get_application_repository
from app.services.clock import Clock, get_clock
from app.services.deployment_transitions import is_transition_allowed

logger = logging.getLogger(__name__)


# Applies deployment business rules through injected repositories and clock.
class DeploymentService:
    """Coordinate deployment business operations.

    Attributes:
        _repository: Injected deployment repository.
        _application_repository: Injected application repository.
        _clock: Injected callable returning aware UTC datetimes.
    """

    # Stores the service dependencies.
    def __init__(
        self,
        repository: DeploymentRepository,
        application_repository: ApplicationRepository,
        clock: Clock,
    ) -> None:
        """Initialize a deployment service.

        Args:
            repository: Deployment data-access repository.
            application_repository: Application lookup repository.
            clock: Callable returning timezone-aware UTC datetimes.
        """
        logger.debug("DeploymentService.__init__ entry")
        self._repository = repository
        self._application_repository = application_repository
        self._clock = clock
        logger.debug("DeploymentService.__init__ exit")

    # Creates a pending deployment for an existing application.
    def create_for_application(
        self,
        application_id: str,
        payload: DeploymentCreate,
    ) -> Deployment:
        """Create a pending deployment under an application.

        Args:
            application_id: Parent application UUID string.
            payload: Validated deployment creation payload.

        Returns:
            The persisted pending deployment.

        Raises:
            NotFoundError: If the parent application does not exist.
        """
        logger.debug(
            "DeploymentService.create_for_application entry: application_id_len=%d "
            "version_len=%d",
            len(application_id),
            len(payload.version),
        )
        if self._application_repository.get(application_id) is None:
            raise NotFoundError("application")
        # WHY: the service owns creation time and normalizes the stored SHA.
        creation_time = self._clock()
        commit_sha = payload.commit_sha.lower() if payload.commit_sha else None
        deployment = Deployment(
            application_id=application_id,
            version=payload.version,
            commit_sha=commit_sha,
            status=DeploymentStatus.PENDING,
            created_at=creation_time,
        )
        result = self._repository.add(deployment)
        logger.debug(
            "DeploymentService.create_for_application exit: id_len=%d",
            len(result.id),
        )
        return result

    # Lists deployments after verifying the parent application exists.
    def list_for_application(
        self,
        application_id: str,
        limit: int,
        offset: int,
        status: DeploymentStatus | None = None,
    ) -> tuple[list[Deployment], int]:
        """List one application's deployments with optional status filtering.

        Args:
            application_id: Parent application UUID string.
            limit: Number of rows requested.
            offset: Number of matching rows to skip.
            status: Optional lifecycle status filter.

        Returns:
            A tuple containing the page rows and matching total count.

        Raises:
            NotFoundError: If the parent application does not exist.
        """
        logger.debug(
            "DeploymentService.list_for_application entry: application_id_len=%d "
            "limit=%d offset=%d status=%s",
            len(application_id),
            limit,
            offset,
            safe_log_value(status.value if status else None),
        )
        if self._application_repository.get(application_id) is None:
            raise NotFoundError("application")
        result = self._repository.list_for_application(
            application_id,
            limit,
            offset,
            status,
        )
        logger.debug(
            "DeploymentService.list_for_application exit: item_count=%d total=%d",
            len(result[0]),
            result[1],
        )
        return result

    # Retrieves a deployment or raises a domain not-found error.
    def get(self, deployment_id: str) -> Deployment:
        """Get a deployment by identifier.

        Args:
            deployment_id: UUID string primary key.

        Returns:
            The matching deployment model.

        Raises:
            NotFoundError: If no deployment has the supplied identifier.
        """
        logger.debug(
            "DeploymentService.get entry: id_len=%d",
            len(deployment_id),
        )
        deployment = self._repository.get(deployment_id)
        if deployment is None:
            raise NotFoundError("deployment")
        logger.debug("DeploymentService.get exit: found=%s", True)
        return deployment

    # Applies one validated lifecycle transition and its timestamps.
    def update_status(
        self,
        deployment_id: str,
        payload: DeploymentStatusUpdate,
    ) -> Deployment:
        """Update a deployment status according to lifecycle rules.

        Args:
            deployment_id: UUID string primary key.
            payload: Validated target status payload.

        Returns:
            The persisted deployment with its new status.

        Raises:
            ConflictError: If the requested transition is forbidden.
            NotFoundError: If the deployment does not exist.
        """
        logger.debug(
            "DeploymentService.update_status entry: id_len=%d target=%s",
            len(deployment_id),
            safe_log_value(payload.status.value),
        )
        deployment = self.get(deployment_id)
        if not is_transition_allowed(deployment.status, payload.status):
            raise ConflictError("invalid status transition")
        self._set_transition_timestamp(deployment, payload.status)
        deployment.status = payload.status
        result = self._repository.update(deployment)
        logger.debug(
            "DeploymentService.update_status exit: status=%s",
            result.status.value,
        )
        return result

    # Sets an entering timestamp once for the relevant lifecycle state.
    def _set_transition_timestamp(
        self,
        deployment: Deployment,
        target: DeploymentStatus,
    ) -> None:
        """Set the injected time when entering running or a terminal state.

        Args:
            deployment: Deployment receiving a lifecycle timestamp.
            target: Requested target status.
        """
        logger.debug(
            "DeploymentService._set_transition_timestamp entry: target=%s",
            safe_log_value(target.value),
        )
        if target is DeploymentStatus.RUNNING and deployment.started_at is None:
            # WHY: started_at records the first running transition only.
            deployment.started_at = self._clock()
        if target in {
            DeploymentStatus.SUCCEEDED,
            DeploymentStatus.FAILED,
        } and deployment.finished_at is None:
            # WHY: finished_at records the first terminal transition only.
            deployment.finished_at = self._clock()
        logger.debug("DeploymentService._set_transition_timestamp exit")


# Injects a request-scoped deployment repository.
def get_deployment_repository(
    session: Session = Depends(get_session),
) -> DeploymentRepository:
    """Create a deployment repository for the current request.

    Args:
        session: Request-scoped SQLAlchemy session.

    Returns:
        A deployment repository using the injected session.
    """
    logger.debug("get_deployment_repository entry")
    repository = DeploymentRepository(session)
    logger.debug("get_deployment_repository exit")
    return repository


# Injects a deployment service with repository and clock dependencies.
def get_deployment_service(
    repository: DeploymentRepository = Depends(get_deployment_repository),
    application_repository: ApplicationRepository = Depends(
        get_application_repository
    ),
    clock: Clock = Depends(get_clock),
) -> DeploymentService:
    """Create a deployment service for the current request.

    Args:
        repository: Request-scoped deployment repository.
        application_repository: Request-scoped application repository.
        clock: Injected UTC clock callable.

    Returns:
        A deployment service using all injected dependencies.
    """
    logger.debug("get_deployment_service entry")
    service = DeploymentService(repository, application_repository, clock)
    logger.debug("get_deployment_service exit")
    return service
