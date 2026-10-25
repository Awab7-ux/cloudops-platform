"""Deployment ORM model and lifecycle status enum."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
import logging
from uuid import uuid4

from sqlalchemy import Enum as SqlEnum
from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.application import UtcDateTime, _utc_now

logger = logging.getLogger(__name__)


# Defines the lifecycle states supported by a deployment.
class DeploymentStatus(str, Enum):
    """Lifecycle status assigned to a deployment."""

    PENDING = "pending"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"


# Generates the code-owned UUID primary key value.
def _generate_deployment_id() -> str:
    """Generate a UUID4 string for a new deployment.

    Returns:
        A UUID4 encoded as a string.
    """
    logger.debug("_generate_deployment_id entry")
    deployment_id = str(uuid4())
    logger.debug(
        "_generate_deployment_id exit: id_length=%d",
        len(deployment_id),
    )
    return deployment_id


# Maps deployments to applications and stores deployment lifecycle metadata.
class Deployment(Base):
    """Persist one deployment associated with an application."""

    __tablename__ = "deployments"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=_generate_deployment_id,
    )
    # WHY: the database cascade removes child rows and requires SQLite PRAGMA.
    application_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version: Mapped[str] = mapped_column(String(64), nullable=False)
    commit_sha: Mapped[str | None] = mapped_column(String(40), nullable=True)
    status: Mapped[DeploymentStatus] = mapped_column(
        SqlEnum(
            DeploymentStatus,
            native_enum=False,
            values_callable=lambda members: [member.value for member in members],
        ),
        nullable=False,
        default=DeploymentStatus.PENDING,
    )
    started_at: Mapped[datetime | None] = mapped_column(
        UtcDateTime(),
        nullable=True,
    )
    finished_at: Mapped[datetime | None] = mapped_column(
        UtcDateTime(),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        UtcDateTime(),
        nullable=False,
        default=_utc_now,
    )
