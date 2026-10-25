"""SQLAlchemy engine, session-factory, and request dependency helpers."""

from __future__ import annotations

import logging
from collections.abc import Iterator
from typing import Any

from fastapi import Request
from sqlalchemy import Engine, create_engine, event
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker

from app.core.logging import safe_log_value

logger = logging.getLogger(__name__)


# Registers SQLite foreign-key enforcement on every new connection.
def enable_sqlite_foreign_keys(engine: Engine) -> None:
    """Enable SQLite foreign-key enforcement for an engine.

    Args:
        engine: SQLAlchemy engine receiving the connection listener.
    """
    dialect = getattr(engine, "dialect", None)
    dialect_name = getattr(dialect, "name", "")
    logger.debug(
        "enable_sqlite_foreign_keys entry: dialect=%s",
        safe_log_value(dialect_name),
    )
    if dialect_name != "sqlite":
        logger.debug("enable_sqlite_foreign_keys exit: enabled=%s", False)
        return

    # WHY: SQLite does not enforce foreign keys by default.
    @event.listens_for(engine, "connect")
    def set_foreign_keys(
        dbapi_connection: Any,
        connection_record: Any,
    ) -> None:
        """Enable foreign keys on one newly opened SQLite connection.

        Args:
            dbapi_connection: Raw DB-API connection opened by SQLAlchemy.
            connection_record: SQLAlchemy connection record for the connection.
        """
        logger.debug("set_foreign_keys entry")
        _ = connection_record
        cursor = dbapi_connection.cursor()
        try:
            cursor.execute("PRAGMA foreign_keys=ON")
        finally:
            cursor.close()
        logger.debug("set_foreign_keys exit: enabled=%s", True)

    logger.debug("enable_sqlite_foreign_keys exit: enabled=%s", True)


# Creates an engine with SQLite's required cross-thread connection setting.
def create_db_engine(database_url: str) -> Engine:
    """Create a SQLAlchemy engine for the configured database URL.

    Args:
        database_url: SQLAlchemy database URL.

    Returns:
        A configured SQLAlchemy ``Engine``.
    """
    dialect_name = make_url(database_url).get_backend_name()
    logger.debug(
        "create_db_engine entry: dialect=%s", safe_log_value(dialect_name)
    )
    # WHY: SQLite connections otherwise reject use from FastAPI worker threads.
    connect_args = {"check_same_thread": False} if dialect_name == "sqlite" else {}
    engine = create_engine(database_url, connect_args=connect_args)
    enable_sqlite_foreign_keys(engine)
    logger.debug("create_db_engine exit: dialect=%s", safe_log_value(dialect_name))
    return engine


# Builds a session factory bound to one application-owned engine.
def create_session_factory(engine: Engine) -> sessionmaker[Session]:
    """Create a session factory bound to the supplied engine.

    Args:
        engine: SQLAlchemy engine owned by the application instance.

    Returns:
        A SQLAlchemy ``sessionmaker`` producing ``Session`` objects.
    """
    logger.debug(
        "create_session_factory entry: dialect=%s",
        safe_log_value(engine.dialect.name),
    )
    factory = sessionmaker(bind=engine, class_=Session)
    logger.debug("create_session_factory exit: dialect=%s", safe_log_value(engine.dialect.name))
    return factory


# Yields one request session and closes it on every exit path.
def get_session(request: Request) -> Iterator[Session]:
    """Yield a request-scoped database session.

    Args:
        request: Current request containing the application session factory.

    Yields:
        A SQLAlchemy ``Session`` for the current request.
    """
    logger.debug("get_session entry")
    factory: sessionmaker[Session] = request.app.state.session_factory
    session = factory()
    try:
        yield session
    finally:
        # WHY: closing in finally prevents leaked connections on errors.
        session.close()
        logger.debug("get_session exit: closed=%s", True)
