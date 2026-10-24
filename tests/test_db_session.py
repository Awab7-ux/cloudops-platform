"""Tests for SQLAlchemy engine and session dependency helpers."""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import Mock

import pytest
from fastapi import Request
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session

import app.db.session as session_module
from app.db.session import create_db_engine, create_session_factory, get_session


# SQLite engines receive the cross-thread connection option.
def test_create_db_engine_configures_sqlite_connections(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """SQLite engine creation enables cross-thread connections."""
    captured: dict[str, Any] = {}
    fake_engine = cast(Engine, object())

    # Capture the engine factory arguments without opening a database.
    def fake_create_engine(url: str, **kwargs: Any) -> Engine:
        """Capture engine factory arguments and return a fake engine."""
        captured["url"] = url
        captured.update(kwargs)
        return fake_engine

    monkeypatch.setattr(session_module, "create_engine", fake_create_engine)

    result = create_db_engine("sqlite:///./test.db")

    assert result is fake_engine
    assert captured == {
        "url": "sqlite:///./test.db",
        "connect_args": {"check_same_thread": False},
    }


# Non-SQLite engines do not receive SQLite-only connection options.
def test_create_db_engine_leaves_non_sqlite_options_empty(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Non-SQLite engine creation has no SQLite connection arguments."""
    captured: dict[str, Any] = {}
    fake_engine = cast(Engine, object())

    # Capture engine factory arguments without opening a database.
    def fake_create_engine(url: str, **kwargs: Any) -> Engine:
        """Capture engine factory arguments and return a fake engine."""
        captured["url"] = url
        captured.update(kwargs)
        return fake_engine

    monkeypatch.setattr(session_module, "create_engine", fake_create_engine)

    result = create_db_engine("postgresql://db.example/cloudops")

    assert result is fake_engine
    assert captured == {
        "url": "postgresql://db.example/cloudops",
        "connect_args": {},
    }


# Session factories are bound to the engine supplied by the application.
def test_create_session_factory_binds_engine() -> None:
    """The session factory creates sessions bound to its engine."""
    engine = create_engine("sqlite:///:memory:")

    factory = create_session_factory(engine)
    session = factory()

    try:
        assert session.bind is engine
    finally:
        session.close()
        engine.dispose()


# The session dependency closes its session when request handling raises.
def test_get_session_closes_session_when_body_raises() -> None:
    """The dependency closes its session even when the consumer raises."""
    session = Mock(spec=Session)
    factory = Mock(return_value=session)
    request = cast(
        Request,
        SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(
            session_factory=factory,
        ))),
    )
    dependency = get_session(request)

    next(dependency)
    with pytest.raises(RuntimeError, match="consumer failed"):
        dependency.throw(RuntimeError("consumer failed"))

    session.close.assert_called_once_with()

