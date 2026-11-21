"""Shared database fixtures for integration tests."""

from __future__ import annotations

from collections.abc import Callable, Iterator
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

import app.models as application_models
from app.db.base import Base
from app.db.session import (
    create_session_factory,
    enable_sqlite_foreign_keys,
    get_session,
)
from app.core.auth import create_access_token
from app.models.user import UserRole
from app.repositories.user import UserRepository
from app.services.user import UserService
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
    enable_sqlite_foreign_keys(engine)
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
    monkeypatch.setenv("JWT_SECRET", "pytest-only-signing-key-that-is-at-least-32-bytes")
    monkeypatch.delenv("ADMIN_USERNAME", raising=False)
    monkeypatch.delenv("ADMIN_PASSWORD", raising=False)
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
    application.state.test_session_factory = session_factory
    try:
        with TestClient(application) as client:
            with session_factory() as session:
                admin = UserService(UserRepository(session)).create_user(
                    "test-admin",
                    "test-admin-password",
                    UserRole.ADMIN,
                )
                token = create_access_token(admin, application.state.settings)
            client.headers.update({"Authorization": f"Bearer {token}"})
            yield client
    finally:
        application.dependency_overrides.clear()


@pytest.fixture
def unauthenticated_client(ready_client: TestClient) -> TestClient:
    """Return the shared test client without its default administrator token."""
    ready_client.headers.pop("Authorization", None)
    return ready_client


@pytest.fixture
def admin_auth_headers() -> Callable[[FastAPI], dict[str, str]]:
    """Create or reuse an admin for a test app and return its bearer header."""
    def create_headers(application: FastAPI) -> dict[str, str]:
        session_factory = application.state.session_factory
        with session_factory() as session:
            repository = UserRepository(session)
            admin = repository.get_by_username("fixture-admin")
            if admin is None:
                admin = UserService(repository).create_user(
                    "fixture-admin",
                    "fixture-admin-password",
                    UserRole.ADMIN,
                )
            token = create_access_token(admin, application.state.settings)
        return {"Authorization": f"Bearer {token}"}

    return create_headers
