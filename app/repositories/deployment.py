"""SQLAlchemy repository for Deployment persistence operations."""

from __future__ import annotations

import logging

from sqlalchemy import func, select
from sqlalchemy.sql.elements import ColumnElement
from sqlalchemy.orm import Session

from app.core.logging import safe_log_value
from app.core.pagination import validate_pagination
from app.models.deployment import Deployment, DeploymentStatus

logger = logging.getLogger(__name__)


# Persists and retrieves Deployment rows through one injected session.
class DeploymentRepository:
    """Provide SQLAlchemy data access for deployment rows."""

    # Stores the request-scoped session used by repository operations.
    def __init__(self, session: Session) -> None:
        """Initialize a repository with a SQLAlchemy session.

        Args:
            session: Request-scoped SQLAlchemy session.
        """
        logger.debug("DeploymentRepository.__init__ entry")
        self._session = session
        logger.debug("DeploymentRepository.__init__ exit")

    # Commits and refreshes one deployment row.
    def _commit_deployment(self, deployment: Deployment) -> Deployment:
        """Commit and refresh one deployment row.

        Args:
            deployment: Deployment instance pending persistence.

        Returns:
            The committed and refreshed deployment instance.
        """
        logger.debug(
            "DeploymentRepository._commit_deployment entry: id_len=%d",
            len(deployment.id) if deployment.id else 0,
        )
        self._session.commit()
        self._session.refresh(deployment)
        logger.debug("DeploymentRepository._commit_deployment exit")
        return deployment

    # Inserts one deployment row.
    def add(self, deployment: Deployment) -> Deployment:
        """Add and commit a deployment.

        Args:
            deployment: Unsaved deployment model.

        Returns:
            The committed and refreshed deployment model.
        """
        logger.debug(
            "DeploymentRepository.add entry: application_id_len=%d",
            len(deployment.application_id),
        )
        self._session.add(deployment)
        result = self._commit_deployment(deployment)
        logger.debug("DeploymentRepository.add exit: id_len=%d", len(result.id))
        return result

    # Retrieves one deployment by its primary key.
    def get(self, deployment_id: str) -> Deployment | None:
        """Find a deployment by UUID string.

        Args:
            deployment_id: UUID string primary key.

        Returns:
            The matching deployment, or ``None`` when absent.
        """
        logger.debug(
            "DeploymentRepository.get entry: id_len=%d",
            len(deployment_id),
        )
        result = self._session.scalar(
            select(Deployment).where(Deployment.id == deployment_id)
        )
        logger.debug(
            "DeploymentRepository.get exit: found=%s",
            result is not None,
        )
        return result

    # Retrieves a filtered and deterministically ordered deployment page.
    def list_for_application(
        self,
        application_id: str,
        limit: int,
        offset: int,
        status: DeploymentStatus | None = None,
    ) -> tuple[list[Deployment], int]:
        """List one application's deployments and the matching total.

        Args:
            application_id: Parent application UUID string.
            limit: Number of rows to return.
            offset: Number of matching rows to skip.
            status: Optional lifecycle status filter.

        Returns:
            A tuple containing the page rows and matching total count.

        Raises:
            ValueError: If pagination is outside the supported bounds.
        """
        logger.debug(
            "DeploymentRepository.list_for_application entry: application_id_len=%d "
            "limit=%d offset=%d status=%s",
            len(application_id),
            limit,
            offset,
            safe_log_value(status.value if status else None),
        )
        validate_pagination(limit, offset)
        conditions: list[ColumnElement[bool]] = [
            Deployment.application_id == application_id
        ]
        if status is not None:
            conditions.append(Deployment.status == status)
        statement = select(Deployment).where(*conditions)
        count_statement = select(func.count()).select_from(Deployment).where(
            *conditions
        )
        # WHY: ascending IDs make equal timestamps deterministic across requests.
        statement = statement.order_by(
            Deployment.created_at.desc(),
            Deployment.id.asc(),
        )
        items = list(
            self._session.scalars(statement.limit(limit).offset(offset)).all()
        )
        total = int(self._session.scalar(count_statement) or 0)
        logger.debug(
            "DeploymentRepository.list_for_application exit: item_count=%d total=%d",
            len(items),
            total,
        )
        return items, total

    # Commits changes to an existing deployment row.
    def update(self, deployment: Deployment) -> Deployment:
        """Commit and refresh changes to a deployment.

        Args:
            deployment: Existing deployment with modified fields.

        Returns:
            The committed and refreshed deployment model.
        """
        logger.debug(
            "DeploymentRepository.update entry: id_len=%d",
            len(deployment.id),
        )
        result = self._commit_deployment(deployment)
        logger.debug("DeploymentRepository.update exit: id_len=%d", len(result.id))
        return result
