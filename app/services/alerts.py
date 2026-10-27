"""Business logic for the derived alerts dashboard endpoint."""

from __future__ import annotations

import logging

from fastapi import Depends
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.models.alert import AlertSeverity, AlertType
from app.repositories.alerts import AlertRepository
from app.schemas.alert import AlertList
from app.services.clock import Clock, get_clock

logger = logging.getLogger(__name__)


# Generates the derived alert list from aggregate repository queries and the injected clock.
class AlertService:
    """Compute the derived operational alert feed for the dashboard."""

    # Stores the repository and clock used by the alert calculations.
    def __init__(self, repository: AlertRepository, clock: Clock) -> None:
        """Initialize the service with repository and time dependencies.

        Args:
            repository: Alert query repository with aggregate SQL methods.
            clock: Callable returning timezone-aware UTC datetimes.
        """
        logger.debug("AlertService.__init__ entry")
        self._repository = repository
        self._clock = clock
        logger.debug("AlertService.__init__ exit")

    # Returns the sorted paginated alert payload for the dashboard API.
    def list(
        self,
        limit: int,
        offset: int,
        severity: AlertSeverity | None = None,
        alert_type: AlertType | None = None,
        application_id: str | None = None,
    ) -> AlertList:
        """Build the alert list using the current injected time.

        Args:
            limit: Number of alert rows to return.
            offset: Number of rows to skip before the page.
            severity: Optional severity filter.
            alert_type: Optional alert type filter.
            application_id: Optional application filter.

        Returns:
            A paginated alert list response model.
        """
        logger.debug(
            "AlertService.list entry: limit=%d offset=%d severity=%s type=%s app_filter=%s",
            limit,
            offset,
            severity.value if severity else None,
            alert_type.value if alert_type else None,
            application_id,
        )
        now = self._clock()
        items, total = self._repository.list_alerts(
            now,
            limit,
            offset,
            severity,
            alert_type,
            application_id,
        )
        response = AlertList(
            items=[
                {
                    "id": item["id"],
                    "type": item["type"],
                    "severity": item["severity"],
                    "application_id": item["application_id"],
                    "application_name": item["application_name"],
                    "deployment_id": item["deployment_id"],
                    "message": item["message"],
                    "since": item["since"],
                }
                for item in items
            ],
            total=total,
            limit=limit,
            offset=offset,
            generated_at=now,
        )
        logger.debug(
            "AlertService.list exit: total=%d item_count=%d",
            total,
            len(response.items),
        )
        return response


# Injects the repository and current clock for each request.
def get_alert_service(
    session: Session = Depends(get_session),
    clock: Clock = Depends(get_clock),
) -> AlertService:
    """Create an alert service bound to the current request session."""
    logger.debug("get_alert_service entry")
    service = AlertService(AlertRepository(session), clock)
    logger.debug("get_alert_service exit")
    return service
