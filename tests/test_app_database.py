"""Tests for database wiring in the FastAPI application factory."""

from __future__ import annotations

from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine
from sqlalchemy.orm import Session

import app.main as main_module
from app.db.base import Base
from app.main import create_app


# The application stores its engine and session factory in app.state.
def test_create_app_wires_database_state(monkeypatch: pytest.MonkeyPatch) -> None:
    """create_app stores an engine and bound session factory in app.state."""
    monkeypatch.setenv("DATABASE_URL", "sqlite:///:memory:")

    application = create_app()
    engine = application.state.engine
    session_factory = application.state.session_factory
    session = session_factory()

    try:
        assert isinstance(engine, Engine)
        assert isinstance(session, Session)
        assert session.bind is engine
    finally:
        session.close()
        engine.dispose()


# Lifespan creates metadata tables and disposes the engine at shutdown.
def test_database_lifespan_creates_tables_and_disposes_engine(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The lifespan creates tables on startup and disposes the engine."""
    monkeypatch.setenv("DATABASE_URL", "sqlite:///:memory:")
    application = create_app()
    create_all = Mock(wraps=Base.metadata.create_all)
    dispose = Mock(wraps=application.state.engine.dispose)
    monkeypatch.setattr(Base.metadata, "create_all", create_all)
    monkeypatch.setattr(application.state.engine, "dispose", dispose)

    with TestClient(application):
        pass

    create_all.assert_called_once_with(bind=application.state.engine)
    dispose.assert_called_once_with()


# Multiple factory calls produce independent applications and engines.
def test_create_app_can_be_called_multiple_times(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Repeated create_app calls create independent usable applications."""
    monkeypatch.setenv("DATABASE_URL", "sqlite:///:memory:")
    first = create_app()
    second = create_app()

    try:
        assert first is not second
        assert first.state.engine is not second.state.engine
        with TestClient(first) as first_client, TestClient(second) as second_client:
            assert first_client.get("/health").json() == {"status": "ok"}
            assert second_client.get("/health").json() == {"status": "ok"}
    finally:
        first.state.engine.dispose()
        second.state.engine.dispose()

