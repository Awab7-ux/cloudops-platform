"""Business logic for the dashboard summary endpoint."""

from __future__ import annotations

import logging

from fastapi import Depends
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.repositories.summary import SummaryRepository
from app.schemas.summary import (
    ApplicationSummary,
    DeploymentSummary,
    LogSummary,
    RecentFailedDeployment,
    SummaryResponse,
)
from app.services.clock import Clock, get_clock

logger = logging.getLogger(__name__)


# Builds the complete dashboard summary from repository aggregates and the injected clock.
class SummaryService:
    """Compose the summary payload with zero-filled enum buckets and recency windows."""

    # Stores the repository and clock used to build the summary API response.
    def __init__(self, repository: SummaryRepository, clock: Clock) -> None:
        """Initialize the summary service with repository and clock dependencies.

        Args:
            repository: Summary repository containing the aggregate SQL queries.
            clock: Callable returning timezone-aware UTC datetimes.
        """
        logger.debug("SummaryService.__init__ entry")
        self._repository = repository
        self._clock = clock
        logger.debug("SummaryService.__init__ exit")

    # Produces the summary payload used by the dashboard overview.
    def get_summary(self) -> SummaryResponse:
        """Compute the dashboard summary at the injected current time.

        Returns:
            A complete and zero-filled summary payload for the dashboard endpoints.
        """
        logger.debug("SummaryService.get_summary entry")
        now = self._clock()
        application_total, by_status, by_environment = self._repository.get_application_summary()
        deployment_total, deployment_statuses, last_24h = self._repository.get_deployment_summary(now)
        log_total, errors_last_24h = self._repository.get_log_summary(now)
        recent_failed = self._repository.get_recent_failed_deployments()

        response = SummaryResponse(
            applications=ApplicationSummary(
                total=application_total,
                by_status=by_status,
                by_environment=by_environment,
            ),
            deployments=DeploymentSummary(
                total=deployment_total,
                by_status=deployment_statuses,
                last_24h=last_24h,
            ),
            logs=LogSummary(
                total=log_total,
                errors_last_24h=errors_last_24h,
            ),
            recent_failed_deployments=[
                RecentFailedDeployment.model_validate(item)
                for item in recent_failed
            ],
            generated_at=now,
        )
        logger.debug(
            "SummaryService.get_summary exit: generated_at=%s",
            response.generated_at.isoformat(),
        )
        return response


# Injects the repository and clock for each dashboard summary request.
def get_summary_service(
    session: Session = Depends(get_session),
    clock: Clock = Depends(get_clock),
) -> SummaryService:
    """Create a summary service bound to the current request session."""
    logger.debug("get_summary_service entry")
    service = SummaryService(SummaryRepository(session), clock)
    logger.debug("get_summary_service exit")
    return service
