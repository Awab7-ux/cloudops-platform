"""SQLAlchemy repository for append-only application log rows."""

from __future__ import annotations

from datetime import datetime
import logging

from sqlalchemy import func, select
from sqlalchemy.orm import Session
from sqlalchemy.sql.elements import ColumnElement

from app.core.logging import safe_log_value
from app.core.pagination import validate_pagination
from app.models.log import Log, LogLevel

logger = logging.getLogger(__name__)


# Composes the common SQL predicates for every log listing operation.
def _build_log_conditions(
    application_id: str | None = None,
    deployment_id: str | None = None,
    level: LogLevel | None = None,
    since: datetime | None = None,
    until: datetime | None = None,
) -> list[ColumnElement[bool]]:
    """Build bound SQL predicates shared by scoped and global log feeds.

    Args:
        application_id: Optional owning application filter.
        deployment_id: Optional associated deployment filter.
        level: Optional severity filter.
        since: Optional inclusive lower timestamp bound.
        until: Optional inclusive upper timestamp bound.

    Returns:
        SQLAlchemy predicates to apply to both the page and count queries.
    """
    logger.debug(
        "_build_log_conditions entry: application_filter=%s "
        "deployment_filter=%s level_filter=%s since_present=%s until_present=%s",
        application_id is not None,
        deployment_id is not None,
        level is not None,
        since is not None,
        until is not None,
    )
    # WHY: applying these predicates in SQL bounds rows and keeps count/page filters aligned.
    conditions: list[ColumnElement[bool]] = []
    if application_id is not None:
        conditions.append(Log.application_id == application_id)
    if deployment_id is not None:
        conditions.append(Log.deployment_id == deployment_id)
    if level is not None:
        conditions.append(Log.level == level)
    # WHY: inclusive bounds let clients query an exact timestamp as either edge.
    if since is not None:
        conditions.append(Log.created_at >= since)
    if until is not None:
        conditions.append(Log.created_at <= until)
    logger.debug("_build_log_conditions exit: condition_count=%d", len(conditions))
    return conditions


# Persists and queries log rows through one injected session.
class LogRepository:
    """Provide SQLAlchemy data access for log records."""

    # Stores the request-scoped database session used by repository work.
    def __init__(self, session: Session) -> None:
        """Initialize a repository with a SQLAlchemy session.

        Args:
            session: Request-scoped SQLAlchemy session.
        """
        logger.debug("LogRepository.__init__ entry")
        self._session = session
        logger.debug("LogRepository.__init__ exit")

    # Commits a new log row and refreshes it from the database.
    def _commit_log(self, log_entry: Log) -> Log:
        """Persist a log row and refresh it for returned state.

        Args:
            log_entry: Unsaved log row pending commit.

        Returns:
            The refreshed, committed log row.
        """
        logger.debug(
            "LogRepository._commit_log entry: application_id_len=%d",
            len(log_entry.application_id),
        )
        self._session.commit()
        self._session.refresh(log_entry)
        logger.debug("LogRepository._commit_log exit")
        return log_entry

    # Inserts one log row into the database.
    def add(self, log_entry: Log) -> Log:
        """Persist a new log row and return the refreshed record.

        Args:
            log_entry: Unsaved log model to insert.

        Returns:
            The inserted, committed log row.
        """
        logger.debug(
            "LogRepository.add entry: application_id_len=%d level=%s",
            len(log_entry.application_id),
            safe_log_value(log_entry.level.value),
        )
        self._session.add(log_entry)
        result = self._commit_log(log_entry)
        logger.debug("LogRepository.add exit: id_len=%d", len(result.id))
        return result

    # Finds one log row by its primary key.
    def get(self, log_id: str) -> Log | None:
        """Fetch one log by identifier.

        Args:
            log_id: UUID primary key for a log row.

        Returns:
            The matching log row, or ``None`` when not found.
        """
        logger.debug("LogRepository.get entry: id_len=%d", len(log_id))
        result = self._session.scalar(select(Log).where(Log.id == log_id))
        logger.debug("LogRepository.get exit: found=%s", result is not None)
        return result

    # Lists logs for one application with optional filtering.
    def list_for_application(
        self,
        application_id: str,
        limit: int,
        offset: int,
        level: LogLevel | None = None,
        since: datetime | None = None,
        until: datetime | None = None,
    ) -> tuple[list[Log], int]:
        """List application logs using a stable order and filtered count.

        Args:
            application_id: Parent application UUID.
            limit: Number of rows to return.
            offset: Number of matching rows to skip.
            level: Optional log-level filter.
            since: Optional lower-bound timestamp filter.
            until: Optional upper-bound timestamp filter.

        Returns:
            A page of log rows and a total matching count.
        """
        logger.debug(
            "LogRepository.list_for_application entry: application_id_len=%d "
            "limit=%d offset=%d level=%s since_present=%s until_present=%s",
            len(application_id),
            limit,
            offset,
            safe_log_value(level.value if level else None),
            since is not None,
            until is not None,
        )
        validate_pagination(limit, offset)
        conditions = _build_log_conditions(
            application_id=application_id,
            level=level,
            since=since,
            until=until,
        )
        statement = select(Log).where(*conditions)
        count_statement = select(func.count()).select_from(Log).where(*conditions)
        # WHY: the id tie-breaker keeps pagination stable when timestamps collide.
        statement = statement.order_by(Log.created_at.desc(), Log.id.asc())
        items = list(
            self._session.scalars(statement.limit(limit).offset(offset)).all()
        )
        total = int(self._session.scalar(count_statement) or 0)
        logger.debug(
            "LogRepository.list_for_application exit: item_count=%d total=%d",
            len(items),
            total,
        )
        return items, total

    # Lists logs for one deployment with optional filtering.
    def list_for_deployment(
        self,
        deployment_id: str,
        limit: int,
        offset: int,
        level: LogLevel | None = None,
        since: datetime | None = None,
        until: datetime | None = None,
    ) -> tuple[list[Log], int]:
        """List deployment logs using the same filtering and ordering rules.

        Args:
            deployment_id: Parent deployment UUID.
            limit: Number of rows to return.
            offset: Number of matching rows to skip.
            level: Optional log-level filter.
            since: Optional lower-bound timestamp filter.
            until: Optional upper-bound timestamp filter.

        Returns:
            A page of log rows and a total matching count.
        """
        logger.debug(
            "LogRepository.list_for_deployment entry: deployment_id_len=%d "
            "limit=%d offset=%d level=%s since_present=%s until_present=%s",
            len(deployment_id),
            limit,
            offset,
            safe_log_value(level.value if level else None),
            since is not None,
            until is not None,
        )
        validate_pagination(limit, offset)
        conditions = _build_log_conditions(
            deployment_id=deployment_id,
            level=level,
            since=since,
            until=until,
        )
        statement = select(Log).where(*conditions)
        count_statement = select(func.count()).select_from(Log).where(*conditions)
        # WHY: the id tie-breaker keeps pagination stable when timestamps collide.
        statement = statement.order_by(Log.created_at.desc(), Log.id.asc())
        items = list(
            self._session.scalars(statement.limit(limit).offset(offset)).all()
        )
        total = int(self._session.scalar(count_statement) or 0)
        logger.debug(
            "LogRepository.list_for_deployment exit: item_count=%d total=%d",
            len(items),
            total,
        )
        return items, total

    # Lists logs across the platform with combined filters.
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
        """List all log rows matching an arbitrary set of filters.

        Args:
            limit: Number of rows to return.
            offset: Number of matching rows to skip.
            level: Optional severity filter.
            application_id: Optional application UUID filter.
            deployment_id: Optional deployment UUID filter.
            since: Optional lower-bound timestamp filter.
            until: Optional upper-bound timestamp filter.

        Returns:
            A filtered page of log rows and a total matching count.
        """
        logger.debug(
            "LogRepository.list_all entry: limit=%d offset=%d level=%s "
            "application_id_len=%s deployment_id_len=%s "
            "since_present=%s until_present=%s",
            limit,
            offset,
            safe_log_value(level.value if level else None),
            len(application_id) if application_id else 0,
            len(deployment_id) if deployment_id else 0,
            since is not None,
            until is not None,
        )
        validate_pagination(limit, offset)
        conditions = _build_log_conditions(
            application_id=application_id,
            deployment_id=deployment_id,
            level=level,
            since=since,
            until=until,
        )
        statement = select(Log).where(*conditions)
        count_statement = select(func.count()).select_from(Log).where(*conditions)
        # WHY: the id tie-breaker keeps pagination stable when timestamps collide.
        statement = statement.order_by(Log.created_at.desc(), Log.id.asc())
        items = list(
            self._session.scalars(statement.limit(limit).offset(offset)).all()
        )
        total = int(self._session.scalar(count_statement) or 0)
        logger.debug(
            "LogRepository.list_all exit: item_count=%d total=%d",
            len(items),
            total,
        )
        return items, total
