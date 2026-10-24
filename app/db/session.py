"""SQLAlchemy engine, session-factory, and request dependency helpers."""

from __future__ import annotations

import logging
from collections.abc import Iterator

from fastapi import Request
from sqlalchemy import Engine, create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker

from app.core.logging import safe_log_value

logger = logging.getLogger(__name__)


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
