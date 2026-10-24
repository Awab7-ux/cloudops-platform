"""Shared database fixtures for integration tests."""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

import app.models as application_models
from app.db.base import Base
from app.db.session import create_session_factory, get_session
from app.main import create_app


# Creates one in-memory SQLite database shared by all test threads.
@pytest.fixture
def in_memory_engine() -> Iterator[Engine]:
    """Yield a thread-shareable in-memory SQLite engine."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    # Import the shared model metadata before creating test tables.
    _ = application_models
    Base.metadata.create_all(engine)
    try:
        yield engine
    finally:
        engine.dispose()


# Creates an app whose lifespan database is isolated to one test directory.
@pytest.fixture
def app(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> FastAPI:
    """Create an application backed by a temporary SQLite file."""
    database_path = tmp_path / "cloudops.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{database_path}")
    return create_app()


# Provides an app whose sessions use the shared in-memory test engine.
@pytest.fixture
def ready_client(
    in_memory_engine: Engine,
    app: FastAPI,
) -> Iterator[TestClient]:
    """Yield a TestClient using an overridden in-memory session dependency."""
    application = app
    session_factory = create_session_factory(in_memory_engine)

    # Override only the dependency; production code remains test unaware.
    def override_get_session() -> Iterator[Session]:
        """Yield and close one session from the in-memory test factory."""
        session = session_factory()
        try:
            yield session
        finally:
            session.close()

    application.dependency_overrides[get_session] = override_get_session
    try:
        with TestClient(application) as client:
            yield client
    finally:
        application.dependency_overrides.clear()

