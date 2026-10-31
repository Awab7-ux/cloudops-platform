"""SQL queries for derived alert rules and aggregation."""

from __future__ import annotations

from datetime import datetime
import logging

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.logging import safe_log_value
from app.models.alert import AlertSeverity, AlertType
from app.models.application import Application
from app.models.deployment import Deployment, DeploymentStatus
from app.models.log import Log, LogLevel
from app.services.alert_rules import (
    ALERT_MESSAGES,
    ERROR_SPIKE_THRESHOLD,
    ERROR_SPIKE_WINDOW_MINUTES,
    SEVERITY_RANK,
    STUCK_DEPLOYMENT_MINUTES,
    build_alert_id,
    minutes_delta,
)

logger = logging.getLogger(__name__)


# Builds the derived alert feed from aggregate SQL and a small in-memory merge step.
class AlertRepository:
    """Query the deployment and log tables and return derived alerts."""

    # Stores the request-scoped database session used by alert calculations.
    def __init__(self, session: Session) -> None:
        """Initialize the repository with a session.

        Args:
            session: Active SQLAlchemy session backing the repository.
        """
        logger.debug("AlertRepository.__init__ entry")
        self._session = session
        logger.debug("AlertRepository.__init__ exit")

    # Returns a map of application IDs to human-readable names for alert output.
    def _get_application_names(self) -> dict[str, str]:
        """Fetch all application names for later alert assembly."""
        logger.debug("AlertRepository._get_application_names entry")
        rows = self._session.execute(
            select(Application.id, Application.name)
        ).all()
        names = {application_id: name for application_id, name in rows}
        logger.debug(
            "AlertRepository._get_application_names exit: count=%d",
            len(names),
        )
        return names

    # Returns a list of deployment_failed alerts based on the latest deployment per app.
    def _get_failed_deployment_alerts(
        self,
        now: datetime,
        names: dict[str, str],
    ) -> list[dict[str, object]]:
        """Find the latest deployment per application and flag failed finals."""
        logger.debug(
            "AlertRepository._get_failed_deployment_alerts entry: now=%s",
            safe_log_value(now.isoformat()),
        )
        # WHY: SQL ranks each application's deployments once, avoiding a
        # per-application query and ensuring later successes clear old failures.
        latest_deployments = (
            select(
                Deployment.application_id.label("application_id"),
                Deployment.id.label("deployment_id"),
                Deployment.finished_at.label("finished_at"),
                Deployment.created_at.label("created_at"),
                Deployment.status.label("status"),
                func.row_number()
                .over(
                    partition_by=Deployment.application_id,
                    order_by=(Deployment.created_at.desc(), Deployment.id.asc()),
                )
                .label("deployment_rank"),
            )
            .subquery()
        )
        rows = self._session.execute(
            select(
                latest_deployments.c.application_id,
                latest_deployments.c.deployment_id,
                latest_deployments.c.finished_at,
                latest_deployments.c.created_at,
                latest_deployments.c.status,
            )
            .where(latest_deployments.c.deployment_rank == 1)
            .where(latest_deployments.c.status == DeploymentStatus.FAILED)
            .order_by(latest_deployments.c.application_id.asc())
        ).all()
        alerts: list[dict[str, object]] = []
        for application_id, deployment_id, finished_at, created_at, status in rows:
            since = finished_at if finished_at is not None else created_at
            alerts.append(
                {
                    "id": build_alert_id(AlertType.DEPLOYMENT_FAILED, application_id, deployment_id),
                    "type": AlertType.DEPLOYMENT_FAILED,
                    "severity": AlertSeverity.HIGH,
                    "application_id": application_id,
                    "application_name": names.get(application_id, "unknown"),
                    "deployment_id": deployment_id,
                    "message": ALERT_MESSAGES[AlertType.DEPLOYMENT_FAILED],
                    "since": since,
                }
            )
        logger.debug(
            "AlertRepository._get_failed_deployment_alerts exit: count=%d",
            len(alerts),
        )
        return alerts

    # Returns deployment_stuck alerts for running deployments older than the threshold.
    def _get_stuck_deployment_alerts(
        self,
        now: datetime,
        names: dict[str, str],
    ) -> list[dict[str, object]]:
        """Find running deployments whose start time is at or past the stuck threshold."""
        logger.debug(
            "AlertRepository._get_stuck_deployment_alerts entry: now=%s",
            safe_log_value(now.isoformat()),
        )
        threshold_time = now - minutes_delta(STUCK_DEPLOYMENT_MINUTES)
        anchor = func.coalesce(Deployment.started_at, Deployment.created_at)
        rows = self._session.execute(
            select(
                Deployment.id,
                Deployment.application_id,
                Deployment.started_at,
                Deployment.created_at,
            )
            .where(Deployment.status == DeploymentStatus.RUNNING)
            .where(anchor <= threshold_time)
        ).all()
        alerts: list[dict[str, object]] = []
        for deployment_id, application_id, started_at, created_at in rows:
            anchor = started_at or created_at
            alerts.append(
                {
                    "id": build_alert_id(AlertType.DEPLOYMENT_STUCK, application_id, deployment_id),
                    "type": AlertType.DEPLOYMENT_STUCK,
                    "severity": AlertSeverity.MEDIUM,
                    "application_id": application_id,
                    "application_name": names.get(application_id, "unknown"),
                    "deployment_id": deployment_id,
                    "message": ALERT_MESSAGES[AlertType.DEPLOYMENT_STUCK],
                    "since": anchor,
                }
            )
        logger.debug(
            "AlertRepository._get_stuck_deployment_alerts exit: count=%d",
            len(alerts),
        )
        return alerts

    # Returns error_log_spike alerts for applications with enough error logs in the window.
    def _get_error_spike_alerts(
        self,
        now: datetime,
        names: dict[str, str],
    ) -> list[dict[str, object]]:
        """Count error logs in the last hour and emit one alert per breached app."""
        logger.debug(
            "AlertRepository._get_error_spike_alerts entry: now=%s",
            safe_log_value(now.isoformat()),
        )
        window_start = now - minutes_delta(ERROR_SPIKE_WINDOW_MINUTES)
        rows = self._session.execute(
            select(
                Log.application_id,
                func.count(Log.id).label("count"),
                func.min(Log.created_at).label("since"),
            )
            .where(Log.level == LogLevel.ERROR)
            .where(Log.created_at >= window_start)
            .where(Log.created_at <= now)
            .group_by(Log.application_id)
            .having(func.count(Log.id) >= ERROR_SPIKE_THRESHOLD)
            .order_by(func.min(Log.created_at).asc())
        ).all()
        alerts: list[dict[str, object]] = []
        for application_id, _, since in rows:
            alerts.append(
                {
                    "id": build_alert_id(AlertType.ERROR_LOG_SPIKE, application_id),
                    "type": AlertType.ERROR_LOG_SPIKE,
                    "severity": AlertSeverity.MEDIUM,
                    "application_id": application_id,
                    "application_name": names.get(application_id, "unknown"),
                    "deployment_id": None,
                    "message": ALERT_MESSAGES[AlertType.ERROR_LOG_SPIKE],
                    "since": since,
                }
            )
        logger.debug(
            "AlertRepository._get_error_spike_alerts exit: count=%d",
            len(alerts),
        )
        return alerts

    # Builds the full alert set once so the API and metrics use identical rule results.
    def _get_current_alerts(
        self,
        now: datetime,
    ) -> tuple[dict[str, str], list[dict[str, object]]]:
        """Return all currently derived alerts and the application name map."""
        logger.debug("AlertRepository._get_current_alerts entry")
        names = self._get_application_names()
        alerts: list[dict[str, object]] = []
        alerts.extend(self._get_failed_deployment_alerts(now, names))
        alerts.extend(self._get_stuck_deployment_alerts(now, names))
        alerts.extend(self._get_error_spike_alerts(now, names))
        logger.debug(
            "AlertRepository._get_current_alerts exit: count=%d",
            len(alerts),
        )
        return names, alerts

    # Counts the same derived alert set for Prometheus without paging it.
    def count_alerts_by_type(self, now: datetime) -> dict[str, int]:
        """Return current alert counts keyed by the stable alert type."""
        logger.debug("AlertRepository.count_alerts_by_type entry")
        counts = {alert_type.value: 0 for alert_type in AlertType}
        _, alerts = self._get_current_alerts(now)
        for alert in alerts:
            alert_type = alert["type"]
            if isinstance(alert_type, AlertType):
                counts[alert_type.value] += 1
        logger.debug(
            "AlertRepository.count_alerts_by_type exit: counts=%s",
            counts,
        )
        return counts

    # Returns the merged, filtered, paginated alert list for the API.
    def list_alerts(
        self,
        now: datetime,
        limit: int,
        offset: int,
        severity: AlertSeverity | None = None,
        alert_type: AlertType | None = None,
        application_id: str | None = None,
    ) -> tuple[list[dict[str, object]], int]:
        """Merge the derived alert rules and page the final list.

        Args:
            now: The current injected UTC time used for alert rule calculations.
            limit: Number of rows to return.
            offset: Number of rows to skip before the paginated slice.
            severity: Optional filter on alert severity.
            alert_type: Optional alert type filter.
            application_id: Optional application filter.

        Returns:
            A tuple containing the paginated alert items and the total filtered count.
        """
        logger.debug(
            "AlertRepository.list_alerts entry: limit=%d offset=%d severity=%s type=%s app_filter=%s",
            limit,
            offset,
            safe_log_value(severity.value if severity else None),
            safe_log_value(alert_type.value if alert_type else None),
            safe_log_value(application_id),
        )
        names, page_items = self._get_current_alerts(now)

        filtered = page_items
        if severity is not None:
            filtered = [item for item in filtered if item["severity"] == severity]
        if alert_type is not None:
            filtered = [item for item in filtered if item["type"] == alert_type]
        if application_id is not None:
            filtered = [
                item for item in filtered if item["application_id"] == application_id
            ]
            if application_id not in names:
                filtered = []

        filtered.sort(
            key=lambda item: (
                SEVERITY_RANK[AlertSeverity(item["severity"])],
                -(item["since"]).timestamp(),
                item["id"],
            )
        )
        total = len(filtered)
        paged = filtered[offset : offset + limit]
        logger.debug(
            "AlertRepository.list_alerts exit: total=%d page_count=%d",
            total,
            len(paged),
        )
        return paged, total
