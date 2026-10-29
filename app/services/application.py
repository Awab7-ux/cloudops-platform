"""Application business services and FastAPI dependency providers."""

from __future__ import annotations

import logging

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.logging import safe_log_value
from app.db.session import get_session
from app.domain.exceptions import ConflictError, NotFoundError
from app.models.application import Application, ApplicationStatus, Environment
from app.repositories.application import ApplicationRepository
from app.schemas.application import ApplicationCreate, ApplicationUpdate
from app.services.clock import Clock, get_clock

logger = logging.getLogger(__name__)


# Applies application business rules through an injected repository and clock.
class ApplicationService:
    """Coordinate application business operations.

    Attributes:
        _repository: Injected application repository.
        _clock: Injected callable returning aware UTC datetimes.
    """

    # Stores the service dependencies.
    def __init__(self, repository: ApplicationRepository, clock: Clock) -> None:
        """Initialize an application service.

        Args:
            repository: Application data-access repository.
            clock: Callable returning timezone-aware UTC datetimes.
        """
        logger.debug("ApplicationService.__init__ entry")
        self._repository = repository
        self._clock = clock
        logger.debug("ApplicationService.__init__ exit")

    # Creates an application after checking the exact name.
    def create(self, payload: ApplicationCreate) -> Application:
        """Create an application while enforcing unique names.

        Args:
            payload: Validated application creation payload.

        Returns:
            The persisted application model.

        Raises:
            ConflictError: If the exact name already exists.
        """
        logger.debug(
            "ApplicationService.create entry: name_len=%d environment=%s",
            len(payload.name),
            safe_log_value(payload.environment.value),
        )
        if self._repository.get_by_name(payload.name) is not None:
            logger.debug("ApplicationService.create exit: conflict=%s", True)
            raise ConflictError
        creation_time = self._clock()
        # WHY: the service owns time so tests stay deterministic and both creation fields match.
        application = Application(
            name=payload.name,
            description=payload.description,
            port=payload.port,
            image=payload.image,
            replicas=payload.replicas,
            environment=payload.environment,
            status=payload.status,
            created_at=creation_time,
            updated_at=creation_time,
        )
        result = self._repository.add(application)
        logger.debug("ApplicationService.create exit: id_len=%d", len(result.id))
        return result

    # Retrieves an application or raises a domain not-found error.
    def get(self, application_id: str) -> Application:
        """Get an application by identifier.

        Args:
            application_id: UUID string primary key.

        Returns:
            The matching application model.

        Raises:
            NotFoundError: If no application has the supplied identifier.
        """
        logger.debug(
            "ApplicationService.get entry: id_len=%d",
            len(application_id),
        )
        application = self._repository.get(application_id)
        if application is None:
            logger.debug("ApplicationService.get exit: found=%s", False)
            raise NotFoundError
        logger.debug("ApplicationService.get exit: found=%s", True)
        return application

    # Lists applications through the repository with optional filters.
    def list(
        self,
        limit: int,
        offset: int,
        environment: Environment | None = None,
        status: ApplicationStatus | None = None,
    ) -> tuple[list[Application], int]:
        """List applications with filters and pagination.

        Args:
            limit: Number of rows requested.
            offset: Number of matching rows to skip.
            environment: Optional environment filter.
            status: Optional status filter.

        Returns:
            A tuple containing the page rows and matching total count.
        """
        logger.debug(
            "ApplicationService.list entry: limit=%d offset=%d",
            limit,
            offset,
        )
        result = self._repository.list(limit, offset, environment, status)
        logger.debug(
            "ApplicationService.list exit: item_count=%d total=%d",
            len(result[0]),
            result[1],
        )
        return result

    # Updates supplied fields and advances updated_at using the injected clock.
    def update(self, application_id: str, payload: ApplicationUpdate) -> Application:
        """Update an application while preserving its creation timestamp.

        Args:
            application_id: UUID string primary key.
            payload: Validated partial update payload.

        Returns:
            The persisted application model.

        Raises:
            ConflictError: If another application owns a requested name.
            NotFoundError: If no application has the supplied identifier.
        """
        logger.debug(
            "ApplicationService.update entry: id_len=%d field_count=%d",
            len(application_id),
            len(payload.model_fields_set),
        )
        application = self.get(application_id)
        if "name" in payload.model_fields_set and payload.name is not None:
            existing = self._repository.get_by_name(payload.name)
            if existing is not None and existing.id != application.id:
                logger.debug("ApplicationService.update exit: conflict=%s", True)
                raise ConflictError
            application.name = payload.name
        if "description" in payload.model_fields_set:
            application.description = payload.description
        if "port" in payload.model_fields_set:
            application.port = payload.port
        if "image" in payload.model_fields_set:
            application.image = payload.image
        if "replicas" in payload.model_fields_set:
            application.replicas = payload.replicas
        if "environment" in payload.model_fields_set and payload.environment is not None:
            application.environment = payload.environment
        if "status" in payload.model_fields_set and payload.status is not None:
            application.status = payload.status
        # WHY: every successful update receives a fresh injected time; created_at is untouched.
        application.updated_at = self._clock()
        result = self._repository.update(application)
        logger.debug("ApplicationService.update exit: id_len=%d", len(result.id))
        return result

    # Deletes an application after verifying that it exists.
    def delete(self, application_id: str) -> None:
        """Delete an application by identifier.

        Args:
            application_id: UUID string primary key.

        Raises:
            NotFoundError: If no application has the supplied identifier.
        """
        logger.debug(
            "ApplicationService.delete entry: id_len=%d",
            len(application_id),
        )
        application = self.get(application_id)
        self._repository.delete(application)
        logger.debug("ApplicationService.delete exit: deleted=%s", True)


# Injects a request-scoped application repository.
def get_application_repository(
    session: Session = Depends(get_session),
) -> ApplicationRepository:
    """Create an application repository for the current request.

    Args:
        session: Request-scoped SQLAlchemy session.

    Returns:
        An application repository using the injected session.
    """
    logger.debug("get_application_repository entry")
    repository = ApplicationRepository(session)
    logger.debug("get_application_repository exit")
    return repository


# Injects a service with repository and clock dependencies.
def get_application_service(
    repository: ApplicationRepository = Depends(get_application_repository),
    clock: Clock = Depends(get_clock),
) -> ApplicationService:
    """Create an application service for the current request.

    Args:
        repository: Request-scoped application repository.
        clock: Injected UTC clock callable.

    Returns:
        An application service using both dependencies.
    """
    logger.debug("get_application_service entry")
    service = ApplicationService(repository, clock)
    logger.debug("get_application_service exit")
    return service
