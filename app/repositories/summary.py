"""SQL queries for dashboard summary aggregates."""

from __future__ import annotations

from datetime import datetime, timedelta
import logging

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.logging import safe_log_value
from app.models.application import Application, ApplicationStatus, Environment
from app.models.deployment import Deployment, DeploymentStatus
from app.models.log import Log, LogLevel
from app.services.alert_rules import RECENT_FAILED_LIMIT

logger = logging.getLogger(__name__)


# Returns a portable string for Enum members and raw persisted values.
def _enum_value(value: object) -> str:
    """Return a string value from either Enum members or raw database strings."""
    logger.debug("_enum_value entry: value_type=%s", type(value).__name__)
    if hasattr(value, "value"):
        result = str(value.value)
    else:
        result = str(value)
    logger.debug("_enum_value exit: value=%s", safe_log_value(result))
    return result


# Builds aggregate dashboard counts from the application, deployment, and log tables.
class SummaryRepository:
    """Fetch the derived summary counts used by the dashboard APIs."""

    # Stores the request-scoped session used by summary queries.
    def __init__(self, session: Session) -> None:
        """Initialize the repository with a request-scoped session.

        Args:
            session: Active SQLAlchemy session for aggregate queries.
        """
        logger.debug("SummaryRepository.__init__ entry")
        self._session = session
        logger.debug("SummaryRepository.__init__ exit")

    # Returns aggregate counts for application statuses and environments.
    def get_application_summary(self) -> tuple[int, dict[str, int], dict[str, int]]:
        """Fetch total applications and zero-filled enum buckets.

        Returns:
            Tuple containing the total count, status buckets, and environment buckets.
        """
        logger.debug("SummaryRepository.get_application_summary entry")
        totals = {status.value: 0 for status in ApplicationStatus}
        environments = {environment.value: 0 for environment in Environment}

        status_rows = self._session.execute(
            select(Application.status, func.count(Application.id))
            .group_by(Application.status)
        ).all()
        for status_value, count in status_rows:
            totals[_enum_value(status_value)] = int(count)

        environment_rows = self._session.execute(
            select(Application.environment, func.count(Application.id))
            .group_by(Application.environment)
        ).all()
        for environment_value, count in environment_rows:
            environments[_enum_value(environment_value)] = int(count)

        total = int(
            self._session.scalar(select(func.count()).select_from(Application)) or 0
        )
        logger.debug(
            "SummaryRepository.get_application_summary exit: total=%d status_count=%d env_count=%d",
            total,
            len(totals),
            len(environments),
        )
        return total, totals, environments

    # Returns deployment totals with a zero-filled status dictionary and 24h bucket.
    def get_deployment_summary(self, now: datetime) -> tuple[int, dict[str, int], int]:
        """Fetch deployment totals and the recent 24h bucket.

        Args:
            now: The injected current UTC time used for the recency window.

        Returns:
            Tuple containing total deployments, zero-filled status buckets, and the
            number of deployments created within the last 24 hours.
        """
        logger.debug(
            "SummaryRepository.get_deployment_summary entry: now=%s",
            safe_log_value(now.isoformat()),
        )
        totals = {status.value: 0 for status in DeploymentStatus}

        status_rows = self._session.execute(
            select(Deployment.status, func.count(Deployment.id))
            .group_by(Deployment.status)
        ).all()
        for status_value, count in status_rows:
            totals[_enum_value(status_value)] = int(count)

        total = int(
            self._session.scalar(select(func.count()).select_from(Deployment)) or 0
        )
        window_start = now - timedelta(days=1)
        last_24h = int(
            self._session.scalar(
                select(func.count())
                .select_from(Deployment)
                .where(Deployment.created_at >= window_start)
                .where(Deployment.created_at <= now)
            )
            or 0
        )
        logger.debug(
            "SummaryRepository.get_deployment_summary exit: total=%d last_24h=%d",
            total,
            last_24h,
        )
        return total, totals, last_24h

    # Returns log totals and the number of error logs in the trailing 24 hours.
    def get_log_summary(self, now: datetime) -> tuple[int, int]:
        """Fetch the total log count and the 24h error count.

        Args:
            now: Current UTC time for the trailing 24h window.

        Returns:
            A tuple containing the total count and the number of error logs in the
            last 24 hours.
        """
        logger.debug(
            "SummaryRepository.get_log_summary entry: now=%s",
            safe_log_value(now.isoformat()),
        )
        total = int(self._session.scalar(select(func.count()).select_from(Log)) or 0)
        window_start = now - timedelta(days=1)
        errors_last_24h = int(
            self._session.scalar(
                select(func.count())
                .select_from(Log)
                .where(Log.level == LogLevel.ERROR)
                .where(Log.created_at >= window_start)
                .where(Log.created_at <= now)
            )
            or 0
        )
        logger.debug(
            "SummaryRepository.get_log_summary exit: total=%d errors_last_24h=%d",
            total,
            errors_last_24h,
        )
        return total, errors_last_24h

    # Returns the newest failed deployments for the dashboard's recent-failures list.
    def get_recent_failed_deployments(self) -> list[dict[str, object]]:
        """Fetch the newest failed deployments in descending creation order.

        Returns:
            A list of failed deployment summaries including the application name.
        """
        logger.debug("SummaryRepository.get_recent_failed_deployments entry")
        rows = self._session.execute(
            select(
                Deployment.id,
                Deployment.application_id,
                Application.name.label("application_name"),
                Deployment.commit_sha,
                Deployment.status,
                Deployment.finished_at,
            )
            .join(Application, Application.id == Deployment.application_id)
            .where(Deployment.status == DeploymentStatus.FAILED)
            .order_by(Deployment.created_at.desc(), Deployment.id.asc())
            .limit(RECENT_FAILED_LIMIT)
        ).all()
        result = [
            {
                "id": row[0],
                "application_id": row[1],
                "application_name": row[2],
                "commit_sha": row[3],
                "status": _enum_value(row[4]),
                "finished_at": row[5],
            }
            for row in rows
        ]
        logger.debug(
            "SummaryRepository.get_recent_failed_deployments exit: count=%d",
            len(result),
        )
        return result
