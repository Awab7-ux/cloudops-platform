"""Database readiness business logic for the readiness endpoint."""

from __future__ import annotations

import logging

from fastapi import Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.errors import DatabaseUnavailableError
from app.core.logging import safe_log_value
from app.db.session import get_session
from app.schemas.system import ReadyResponse

logger = logging.getLogger(__name__)


# Executes the minimal database query used by the readiness contract.
class ReadinessService:
    """Check database availability for one request.

    Attributes:
        _session: Request-scoped SQLAlchemy session.
    """

    # Stores the request-scoped session used by the service.
    def __init__(self, session: Session) -> None:
        """Initialise the readiness service.

        Args:
            session: Request-scoped SQLAlchemy session.
        """
        logger.debug("ReadinessService.__init__ entry")
        self._session = session
        logger.debug("ReadinessService.__init__ exit")

    # Runs SELECT 1 and translates database failures to a safe domain error.
    def check_database(self) -> ReadyResponse:
        """Check that the database can execute ``SELECT 1``.

        Returns:
            ``ReadyResponse`` with status ``"ready"`` when the query succeeds.

        Raises:
            DatabaseUnavailableError: If the query cannot be executed.
        """
        logger.debug("ReadinessService.check_database entry")
        try:
            self._session.execute(text("SELECT 1"))
        except Exception as exc:
            logger.error(
                "Database readiness failed: exception_type=%s",
                safe_log_value(type(exc).__name__),
            )
            raise DatabaseUnavailableError from exc
        response = ReadyResponse(status="ready")
        logger.debug(
            "ReadinessService.check_database exit: status=%s",
            safe_log_value(response.status),
        )
        return response


# Injects the request session into the readiness service.
def get_readiness_service(
    session: Session = Depends(get_session),
) -> ReadinessService:
    """Create a readiness service for the current request.

    Args:
        session: Request-scoped SQLAlchemy session.

    Returns:
        A ``ReadinessService`` using the injected session.
    """
    logger.debug("get_readiness_service entry")
    service = ReadinessService(session)
    logger.debug("get_readiness_service exit")
    return service
