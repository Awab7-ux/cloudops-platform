"""Shared database fixtures for integration tests."""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.config import DEFAULT_DATABASE_URL
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
    try:
        yield engine
    finally:
        engine.dispose()


# Provides an app whose sessions use the shared in-memory test engine.
@pytest.fixture
def ready_client(
    in_memory_engine: Engine,
    monkeypatch: pytest.MonkeyPatch,
) -> Iterator[TestClient]:
    """Yield a TestClient using an overridden in-memory session dependency."""
    monkeypatch.setenv("DATABASE_URL", DEFAULT_DATABASE_URL)
    application: FastAPI = create_app()
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

