"""Business logic for append-only log creation and filtered retrieval."""

from __future__ import annotations

from datetime import datetime
import logging

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.logging import safe_log_value
from app.db.session import get_session
from app.domain.exceptions import InvalidLogTimeRangeError, NotFoundError
from app.models.log import Log, LogLevel
from app.repositories.application import ApplicationRepository
from app.repositories.deployment import DeploymentRepository
from app.repositories.log import LogRepository
from app.schemas.log import LogCreate
from app.services.application import get_application_repository
from app.services.clock import Clock, get_clock
from app.services.deployment import get_deployment_repository

logger = logging.getLogger(__name__)


# Validates a requested log time range before any SQL query runs.
def validate_log_time_range(
    since: datetime | None,
    until: datetime | None,
) -> None:
    """Reject invalid time ranges consistently across log endpoints.

    Args:
        since: Optional lower bound for log timestamps.
        until: Optional upper bound for log timestamps.

    Raises:
        InvalidLogTimeRangeError: If the range is inverted.
    """
    logger.debug(
        "validate_log_time_range entry: since_present=%s until_present=%s",
        since is not None,
        until is not None,
    )
    if since is not None and until is not None and since > until:
        logger.debug("validate_log_time_range exit: valid=%s", False)
        raise InvalidLogTimeRangeError()
    logger.debug("validate_log_time_range exit: valid=%s", True)


# Applies business rules for appending and querying log rows.
class LogService:
    """Coordinate log writes and retrieval with injected repositories and time."""

    # Stores repository and clock dependencies used for log operations.
    def __init__(
        self,
        repository: LogRepository,
        application_repository: ApplicationRepository,
        deployment_repository: DeploymentRepository,
        clock: Clock,
    ) -> None:
        """Initialize the log service with persistence and time dependencies.

        Args:
            repository: Log persistence repository.
            application_repository: Application lookup repository.
            deployment_repository: Deployment lookup repository.
            clock: Injectable time source returning UTC-aware datetimes.
        """
        logger.debug("LogService.__init__ entry")
        self._repository = repository
        self._application_repository = application_repository
        self._deployment_repository = deployment_repository
        self._clock = clock
        logger.debug("LogService.__init__ exit")

    # Creates a log row under an application after verifying related resources.
    def create_for_application(
        self,
        application_id: str,
        payload: LogCreate,
    ) -> Log:
        """Create a log row with a server-generated timestamp.

        Args:
            application_id: Parent application UUID.
            payload: Validated log payload.

        Returns:
            The persisted log row.

        Raises:
            NotFoundError: If the application or referenced deployment is missing.
        """
        logger.debug(
            "LogService.create_for_application entry: application_id_len=%d "
            "level=%s deployment_id_len=%s source_present=%s",
            len(application_id),
            safe_log_value(payload.level.value),
            len(payload.deployment_id) if payload.deployment_id else 0,
            payload.source is not None,
        )
        if self._application_repository.get(application_id) is None:
            raise NotFoundError("application")
        deployment_id = payload.deployment_id
        if deployment_id is not None:
            deployment = self._deployment_repository.get(deployment_id)
            # WHY: conceal cross-application deployment IDs as ordinary missing resources.
            if deployment is None or deployment.application_id != application_id:
                raise NotFoundError("deployment")
        # WHY: the injected clock keeps timestamps server-owned and deterministic in tests.
        creation_time = self._clock()
        log_entry = Log(
            application_id=application_id,
            deployment_id=deployment_id,
            level=payload.level,
            message=payload.message,
            source=payload.source,
            created_at=creation_time,
        )
        result = self._repository.add(log_entry)
        logger.debug(
            "LogService.create_for_application exit: id_len=%d",
            len(result.id),
        )
        return result

    # Lists logs for one application with optional filters.
    def list_for_application(
        self,
        application_id: str,
        limit: int,
        offset: int,
        level: LogLevel | None = None,
        since: datetime | None = None,
        until: datetime | None = None,
    ) -> tuple[list[Log], int]:
        """Return a page of logs for one application.

        Args:
            application_id: Parent application UUID.
            limit: Requested number of rows.
            offset: Matching rows to skip.
            level: Optional severity filter.
            since: Optional lower-bound timestamp filter.
            until: Optional upper-bound timestamp filter.

        Returns:
            A tuple containing the page rows and total count.

        Raises:
            NotFoundError: If the application does not exist.
            InvalidLogTimeRangeError: If the supplied time range is inverted.
        """
        logger.debug(
            "LogService.list_for_application entry: application_id_len=%d "
            "limit=%d offset=%d level=%s",
            len(application_id),
            limit,
            offset,
            safe_log_value(level.value if level else None),
        )
        if self._application_repository.get(application_id) is None:
            raise NotFoundError("application")
        validate_log_time_range(since, until)
        result = self._repository.list_for_application(
            application_id,
            limit,
            offset,
            level,
            since,
            until,
        )
        logger.debug(
            "LogService.list_for_application exit: item_count=%d total=%d",
            len(result[0]),
            result[1],
        )
        return result

    # Lists logs for one deployment with optional filters.
    def list_for_deployment(
        self,
        deployment_id: str,
        limit: int,
        offset: int,
        level: LogLevel | None = None,
        since: datetime | None = None,
        until: datetime | None = None,
    ) -> tuple[list[Log], int]:
        """Return a page of logs for one deployment.

        Args:
            deployment_id: Parent deployment UUID.
            limit: Requested number of rows.
            offset: Matching rows to skip.
            level: Optional severity filter.
            since: Optional lower-bound timestamp filter.
            until: Optional upper-bound timestamp filter.

        Returns:
            A tuple containing the page rows and total count.

        Raises:
            NotFoundError: If the deployment does not exist.
            InvalidLogTimeRangeError: If the supplied time range is inverted.
        """
        logger.debug(
            "LogService.list_for_deployment entry: deployment_id_len=%d "
            "limit=%d offset=%d level=%s",
            len(deployment_id),
            limit,
            offset,
            safe_log_value(level.value if level else None),
        )
        if self._deployment_repository.get(deployment_id) is None:
            raise NotFoundError("deployment")
        validate_log_time_range(since, until)
        result = self._repository.list_for_deployment(
            deployment_id,
            limit,
            offset,
            level,
            since,
            until,
        )
        logger.debug(
            "LogService.list_for_deployment exit: item_count=%d total=%d",
            len(result[0]),
            result[1],
        )
        return result

    # Lists logs across the platform with shared filters.
    def list_all(
        self,
        limit: int,
        offset: int,
        level: LogLevel | None = None,
        application_id: str | None = None,
        deployment_id: str | None = None,
        since: datetime | None = None,
        until: datetime | None = None,
    ) -> tuple[list[Log], int]:
        """Return the global log page after validating combined filters.

        Args:
            limit: Requested number of rows.
            offset: Matching rows to skip.
            level: Optional severity filter.
            application_id: Optional application UUID filter.
            deployment_id: Optional deployment UUID filter.
            since: Optional lower-bound timestamp filter.
            until: Optional upper-bound timestamp filter.

        Returns:
            A tuple containing the page rows and total count.

        Raises:
            InvalidLogTimeRangeError: If the supplied time range is inverted.
        """
        logger.debug(
            "LogService.list_all entry: limit=%d offset=%d level=%s "
            "application_id_len=%s deployment_id_len=%s",
            limit,
            offset,
            safe_log_value(level.value if level else None),
            len(application_id) if application_id else 0,
            len(deployment_id) if deployment_id else 0,
        )
        validate_log_time_range(since, until)
        if application_id is not None and self._application_repository.get(application_id) is None:
            raise NotFoundError("application")
        if deployment_id is not None:
            deployment = self._deployment_repository.get(deployment_id)
            if deployment is None:
                raise NotFoundError("deployment")
            if application_id is not None and deployment.application_id != application_id:
                raise NotFoundError("deployment")
        result = self._repository.list_all(
            limit,
            offset,
            level,
            application_id,
            deployment_id,
            since,
            until,
        )
        logger.debug(
            "LogService.list_all exit: item_count=%d total=%d",
            len(result[0]),
            result[1],
        )
        return result


# Injects a repository for log persistence and retrieval.
def get_log_repository(
    session: Session = Depends(get_session),
) -> LogRepository:
    """Create a log repository bound to the current request session.

    Args:
        session: Request-scoped SQLAlchemy session.

    Returns:
        A repository using the injected session.
    """
    logger.debug("get_log_repository entry")
    repository = LogRepository(session)
    logger.debug("get_log_repository exit")
    return repository


# Injects a log service with repository and time dependencies.
def get_log_service(
    repository: LogRepository = Depends(get_log_repository),
    application_repository: ApplicationRepository = Depends(
        get_application_repository
    ),
    deployment_repository: DeploymentRepository = Depends(
        get_deployment_repository
    ),
    clock: Clock = Depends(get_clock),
) -> LogService:
    """Build a log service with its repository and clock dependencies.

    Args:
        repository: Log persistence repository.
        application_repository: Application repository for ownership checks.
        deployment_repository: Deployment repository for deployment validation.
        clock: Clock dependency used to stamp server-generated timestamps.

    Returns:
        A configured log service.
    """
    logger.debug("get_log_service entry")
    service = LogService(
        repository,
        application_repository,
        deployment_repository,
        clock,
    )
    logger.debug("get_log_service exit")
    return service
