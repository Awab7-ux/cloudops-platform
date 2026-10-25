"""SQLAlchemy repository for Application persistence operations."""

from __future__ import annotations

import logging

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.sql.elements import ColumnElement
from sqlalchemy.orm import Session

from app.core.logging import safe_log_value
from app.domain.exceptions import ConflictError
from app.models.application import Application, ApplicationStatus, Environment
from app.repositories.pagination import validate_pagination

logger = logging.getLogger(__name__)


# Persists and retrieves Application rows through one injected session.
class ApplicationRepository:
    """Provide SQLAlchemy data access for application rows.

    Attributes:
        _session: Request-scoped SQLAlchemy session.
    """

    # Stores the request-scoped session used by repository operations.
    def __init__(self, session: Session) -> None:
        """Initialize a repository with a SQLAlchemy session.

        Args:
            session: Request-scoped SQLAlchemy session.
        """
        logger.debug("ApplicationRepository.__init__ entry")
        self._session = session
        logger.debug("ApplicationRepository.__init__ exit")

    # Commits an application and converts uniqueness failures to a domain error.
    def _commit_application(self, application: Application) -> Application:
        """Commit and refresh one application row.

        Args:
            application: Application instance pending persistence.

        Returns:
            The refreshed application instance.

        Raises:
            ConflictError: If the database rejects a unique application name.
        """
        logger.debug(
            "ApplicationRepository._commit_application entry: name_len=%d",
            len(application.name),
        )
        try:
            self._session.commit()
        except IntegrityError as exc:
            # WHY: rollback clears the failed transaction before the caller can reuse it.
            self._session.rollback()
            logger.warning(
                "Application persistence failed: exception_type=%s",
                safe_log_value(type(exc).__name__),
            )
            logger.debug("Application persistence traceback", exc_info=exc)
            logger.debug(
                "ApplicationRepository._commit_application exit: conflict=%s",
                True,
            )
            raise ConflictError from exc
        self._session.refresh(application)
        logger.debug(
            "ApplicationRepository._commit_application exit: conflict=%s",
            False,
        )
        return application

    # Inserts one application row.
    def add(self, application: Application) -> Application:
        """Add and commit an application.

        Args:
            application: Unsaved application model.

        Returns:
            The committed and refreshed application model.

        Raises:
            ConflictError: If the application name is already persisted.
        """
        logger.debug(
            "ApplicationRepository.add entry: name_len=%d",
            len(application.name),
        )
        self._session.add(application)
        result = self._commit_application(application)
        logger.debug("ApplicationRepository.add exit: id_len=%d", len(result.id))
        return result

    # Retrieves one application by its primary key.
    def get(self, application_id: str) -> Application | None:
        """Find an application by UUID string.

        Args:
            application_id: UUID string primary key.

        Returns:
            The matching application, or ``None`` when absent.
        """
        logger.debug(
            "ApplicationRepository.get entry: id_len=%d",
            len(application_id),
        )
        result = self._session.scalar(
            select(Application).where(Application.id == application_id)
        )
        logger.debug(
            "ApplicationRepository.get exit: found=%s",
            result is not None,
        )
        return result

    # Retrieves one application by its exact name.
    def get_by_name(self, name: str) -> Application | None:
        """Find an application by exact, case-sensitive name.

        Args:
            name: Exact stored application name.

        Returns:
            The matching application, or ``None`` when absent.
        """
        logger.debug(
            "ApplicationRepository.get_by_name entry: name_len=%d",
            len(name),
        )
        result = self._session.scalar(
            select(Application).where(Application.name == name)
        )
        logger.debug(
            "ApplicationRepository.get_by_name exit: found=%s",
            result is not None,
        )
        return result

    # Retrieves a filtered and deterministically ordered application page.
    def list(
        self,
        limit: int,
        offset: int,
        environment: Environment | None = None,
        status: ApplicationStatus | None = None,
    ) -> tuple[list[Application], int]:
        """List applications and count all rows matching the filters.

        Args:
            limit: Number of rows to return.
            offset: Number of matching rows to skip.
            environment: Optional environment filter.
            status: Optional status filter.

        Returns:
            A tuple containing the page rows and matching total count.

        Raises:
            ValueError: If pagination is outside the supported bounds.
        """
        logger.debug(
            "ApplicationRepository.list entry: limit=%d offset=%d environment=%s status=%s",
            limit,
            offset,
            safe_log_value(environment.value if environment else None),
            safe_log_value(status.value if status else None),
        )
        validate_pagination(limit, offset)
        conditions: list[ColumnElement[bool]] = []
        if environment is not None:
            conditions.append(Application.environment == environment)
        if status is not None:
            conditions.append(Application.status == status)

        statement = select(Application)
        count_statement = select(func.count()).select_from(Application)
        if conditions:
            statement = statement.where(*conditions)
            count_statement = count_statement.where(*conditions)
        # WHY: id ascending makes equal timestamps deterministic across requests.
        statement = statement.order_by(
            Application.created_at.desc(),
            Application.id.asc(),
        )
        items = list(
            self._session.scalars(statement.limit(limit).offset(offset)).all()
        )
        total = int(self._session.scalar(count_statement) or 0)
        logger.debug(
            "ApplicationRepository.list exit: item_count=%d total=%d",
            len(items),
            total,
        )
        return items, total

    # Commits changes to an existing application row.
    def update(self, application: Application) -> Application:
        """Commit and refresh changes to an application.

        Args:
            application: Existing application with modified fields.

        Returns:
            The committed and refreshed application model.

        Raises:
            ConflictError: If the updated name is already persisted.
        """
        logger.debug(
            "ApplicationRepository.update entry: id_len=%d",
            len(application.id),
        )
        result = self._commit_application(application)
        logger.debug("ApplicationRepository.update exit: id_len=%d", len(result.id))
        return result

    # Deletes an existing application row.
    def delete(self, application: Application) -> None:
        """Delete and commit an application.

        Args:
            application: Existing application model to delete.
        """
        logger.debug(
            "ApplicationRepository.delete entry: id_len=%d",
            len(application.id),
        )
        self._session.delete(application)
        self._session.commit()
        logger.debug("ApplicationRepository.delete exit: deleted=%s", True)
