"""Application ORM model, enums, and UTC timestamp handling."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
import logging
from uuid import uuid4

from sqlalchemy import DateTime, Enum as SqlEnum, String
from sqlalchemy.engine import Dialect
from sqlalchemy.types import TypeDecorator
from sqlalchemy.orm import Mapped, mapped_column

from app.core.logging import safe_log_value
from app.db.base import Base

logger = logging.getLogger(__name__)


# Defines the environments supported by an application.
class Environment(str, Enum):
    """Deployment environment assigned to an application."""

    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


# Defines the health statuses supported by an application.
class ApplicationStatus(str, Enum):
    """Operational status assigned to an application."""

    HEALTHY = "healthy"
    DEGRADED = "degraded"
    DOWN = "down"
    UNKNOWN = "unknown"


# Generates the code-owned UUID primary key value.
def _generate_application_id() -> str:
    """Generate a UUID4 string for a new application.

    Returns:
        A UUID4 encoded as a string.
    """
    logger.debug("_generate_application_id entry")
    application_id = str(uuid4())
    logger.debug("_generate_application_id exit: id_length=%d", len(application_id))
    return application_id


# Generates an aware UTC timestamp for ORM insert defaults.
def _utc_now() -> datetime:
    """Return the current timezone-aware UTC datetime.

    Returns:
        The current datetime with UTC timezone information.
    """
    logger.debug("_utc_now entry")
    value = datetime.now(timezone.utc)
    logger.debug("_utc_now exit: timezone=%s", safe_log_value(value.tzinfo))
    return value


# Normalizes timestamp binding and result conversion for every database dialect.
class UtcDateTime(TypeDecorator[datetime]):
    """Store datetimes as UTC and return them as timezone-aware UTC values."""

    impl = DateTime(timezone=True)
    cache_ok = True

    # Normalizes an ORM timestamp before sending it to the database driver.
    def process_bind_param(
        self,
        value: datetime | None,
        dialect: Dialect,
    ) -> datetime | None:
        """Normalize a timestamp to UTC for database storage.

        Args:
            value: Datetime supplied by the ORM.
            dialect: SQLAlchemy dialect receiving the value.

        Returns:
            A UTC datetime, or ``None`` when no timestamp was supplied.
        """
        logger.debug(
            "UtcDateTime.process_bind_param entry: has_value=%s dialect=%s",
            value is not None,
            safe_log_value(dialect.name),
        )
        if value is None:
            logger.debug("UtcDateTime.process_bind_param exit: has_value=%s", False)
            return None
        normalized = (
            value.replace(tzinfo=timezone.utc)
            if value.tzinfo is None
            else value.astimezone(timezone.utc)
        )
        # WHY: SQLite drops tzinfo, so bind naive UTC and restore UTC on read below.
        result = normalized.replace(tzinfo=None) if dialect.name == "sqlite" else normalized
        logger.debug("UtcDateTime.process_bind_param exit: has_value=%s", True)
        return result

    # Restores timezone information after a database value is loaded.
    def process_result_value(
        self,
        value: datetime | None,
        dialect: Dialect,
    ) -> datetime | None:
        """Return a database timestamp as an aware UTC datetime.

        Args:
            value: Datetime returned by the database driver.
            dialect: SQLAlchemy dialect that returned the value.

        Returns:
            A timezone-aware UTC datetime, or ``None`` when the column is null.
        """
        logger.debug(
            "UtcDateTime.process_result_value entry: has_value=%s dialect=%s",
            value is not None,
            safe_log_value(dialect.name),
        )
        if value is None:
            logger.debug("UtcDateTime.process_result_value exit: has_value=%s", False)
            return None
        result = (
            value.replace(tzinfo=timezone.utc)
            if value.tzinfo is None
            else value.astimezone(timezone.utc)
        )
        logger.debug("UtcDateTime.process_result_value exit: has_value=%s", True)
        return result


# Maps applications to the applications database table.
class Application(Base):
    """Persist an application and its operational metadata."""

    __tablename__ = "applications"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=_generate_application_id,
    )
    # WHY: uniqueness is exact and case-sensitive after schema stripping by contract.
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    environment: Mapped[Environment] = mapped_column(
        SqlEnum(
            Environment,
            native_enum=False,
            values_callable=lambda members: [member.value for member in members],
        ),
        nullable=False,
    )
    status: Mapped[ApplicationStatus] = mapped_column(
        SqlEnum(
            ApplicationStatus,
            native_enum=False,
            values_callable=lambda members: [member.value for member in members],
        ),
        nullable=False,
        default=ApplicationStatus.UNKNOWN,
    )
    created_at: Mapped[datetime] = mapped_column(
        UtcDateTime(),
        nullable=False,
        default=_utc_now,
    )
    updated_at: Mapped[datetime] = mapped_column(
        UtcDateTime(),
        nullable=False,
        default=_utc_now,
    )
