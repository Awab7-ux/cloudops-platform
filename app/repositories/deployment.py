"""SQLAlchemy repository for Deployment persistence operations."""

from __future__ import annotations

import logging

from sqlalchemy import func, or_, select
from sqlalchemy.sql.elements import ColumnElement
from sqlalchemy.orm import Session

from app.core.logging import safe_log_value
from app.core.pagination import validate_pagination
from app.models.application import Application
from app.models.deployment import Deployment, DeploymentStatus
from app.schemas.deployment import DeploymentGlobalQuery

logger = logging.getLogger(__name__)


# Escapes user wildcard characters before building a LIKE pattern.
def _escape_like_query(query: str) -> str:
    """Escape the chosen LIKE escape character and SQL wildcards.

    Args:
        query: Trimmed search string supplied by the validated query schema.

    Returns:
        A string whose percent and underscore characters match literally.
    """
    logger.debug("_escape_like_query entry: query_len=%d", len(query))
    # WHY: backslash is the LIKE escape character, so escape it before wildcards.
    escaped = (
        query.replace("\\", "\\\\")
        .replace("%", "\\%")
        .replace("_", "\\_")
    )
    logger.debug("_escape_like_query exit: query_len=%d", len(escaped))
    return escaped


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

    # Lists deployments globally and adds parent labels from the same join.
    def list_global(
        self,
        query: DeploymentGlobalQuery,
    ) -> tuple[list[Deployment], int]:
        """List all matching deployments and their application labels.

        Args:
            query: Validated global filters and pagination values.

        Returns:
            A tuple containing page rows and the matching total count.

        Raises:
            ValueError: If pagination is outside the supported bounds.
        """
        logger.debug(
            "DeploymentRepository.list_global entry: "
            "application_id_len=%d status=%s environment=%s has_query=%s "
            "limit=%d offset=%d",
            len(query.application_id) if query.application_id else 0,
            safe_log_value(query.status.value if query.status else None),
            safe_log_value(query.environment.value if query.environment else None),
            query.q is not None,
            query.limit,
            query.offset,
        )
        validate_pagination(query.limit, query.offset)
        join_condition = Application.id == Deployment.application_id
        conditions: list[ColumnElement[bool]] = []
        if query.application_id is not None:
            conditions.append(Deployment.application_id == query.application_id)
        if query.status is not None:
            conditions.append(Deployment.status == query.status)
        if query.environment is not None:
            conditions.append(Application.environment == query.environment)
        if query.q is not None:
            # WHY: SQLAlchemy expressions bind the escaped pattern and ESCAPE
            # makes user-entered percent and underscore characters literal.
            pattern = f"%{_escape_like_query(query.q)}%"
            conditions.append(
                or_(
                    Deployment.version.ilike(pattern, escape="\\"),
                    Deployment.commit_sha.ilike(pattern, escape="\\"),
                    Deployment.branch.ilike(pattern, escape="\\"),
                    Application.name.ilike(pattern, escape="\\"),
                )
            )

        statement = (
            select(
                Deployment,
                Application.name.label("application_name"),
                Application.environment.label("application_environment"),
            )
            .join(Application, join_condition)
        )
        count_statement = (
            select(func.count())
            .select_from(Deployment)
            .join(Application, join_condition)
        )
        if conditions:
            statement = statement.where(*conditions)
            count_statement = count_statement.where(*conditions)
        # WHY: creation time sorts newest first; ID asc stabilizes equal timestamps.
        statement = statement.order_by(
            Deployment.created_at.desc(),
            Deployment.id.asc(),
        )
        rows = self._session.execute(
            statement.limit(query.limit).offset(query.offset)
        ).all()
        items: list[Deployment] = []
        for deployment, application_name, application_environment in rows:
            deployment.application_name = application_name
            deployment.application_environment = application_environment
            items.append(deployment)
        total = int(self._session.scalar(count_statement) or 0)
        logger.debug(
            "DeploymentRepository.list_global exit: item_count=%d total=%d",
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
