"""Application and deployment log records persisted with append-only semantics."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
import logging
from uuid import uuid4

from sqlalchemy import Enum as SqlEnum
from sqlalchemy import ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.application import UtcDateTime, _utc_now

logger = logging.getLogger(__name__)


# Defines the supported log severities for append-only application telemetry.
class LogLevel(str, Enum):
    """Severity for application and deployment log entries."""

    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


# Generates a UUID-based identifier for a log row.
def _generate_log_id() -> str:
    """Create a stable application log identifier.

    Returns:
        A UUID4 string used as the log primary key.
    """
    logger.debug("_generate_log_id entry")
    log_id = str(uuid4())
    logger.debug("_generate_log_id exit: id_length=%d", len(log_id))
    return log_id


# Stores append-only log rows associated with an application and optional deployment.
class Log(Base):
    """Persist one operational log entry tied to an application."""

    __tablename__ = "logs"
    # WHY: application log pages commonly filter by owner and then sort by time.
    __table_args__ = (
        Index("ix_logs_application_created_at", "application_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=_generate_log_id,
    )
    # WHY: logs have no independent lifetime after their owning application is removed.
    application_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # WHY: deployment removal must not leave logs referencing a deleted deployment.
    deployment_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("deployments.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    level: Mapped[LogLevel] = mapped_column(
        SqlEnum(
            LogLevel,
            native_enum=False,
            values_callable=lambda members: [member.value for member in members],
        ),
        nullable=False,
        default=LogLevel.INFO,
    )
    message: Mapped[str] = mapped_column(String(2000), nullable=False)
    source: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        UtcDateTime(),
        nullable=False,
        default=_utc_now,
    )
