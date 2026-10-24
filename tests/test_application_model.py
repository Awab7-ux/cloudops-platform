"""Tests for the Application SQLAlchemy model and its enum values."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import Engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.application import Application, ApplicationStatus, Environment


# Verifies the model defaults and code-generated UUID primary key.
def test_application_defaults(
    in_memory_engine: Engine,
) -> None:
    """Application defaults include unknown status and a UUID string id."""
    with Session(in_memory_engine) as session:
        application = Application(
            name="Payments",
            environment=Environment.DEVELOPMENT,
        )
        session.add(application)
        session.commit()
        session.refresh(application)

        assert UUID(application.id).version == 4
        assert application.status is ApplicationStatus.UNKNOWN
        assert application.description is None


# Verifies enum members expose the public string contract.
def test_application_enum_values() -> None:
    """Environment and status enums contain the required string values."""
    assert [member.value for member in Environment] == [
        "development",
        "staging",
        "production",
    ]
    assert [member.value for member in ApplicationStatus] == [
        "healthy",
        "degraded",
        "down",
        "unknown",
    ]


# Verifies SQLite round trips preserve UTC-aware timestamps.
def test_application_timestamps_are_utc_aware_after_round_trip(
    in_memory_engine: Engine,
) -> None:
    """Created and updated timestamps are timezone-aware UTC values."""
    with Session(in_memory_engine) as session:
        application = Application(
            name="Payments",
            environment=Environment.STAGING,
        )
        session.add(application)
        session.commit()
        session.refresh(application)

        for value in (application.created_at, application.updated_at):
            assert isinstance(value, datetime)
            assert value.tzinfo is not None
            assert value.utcoffset() == timezone.utc.utcoffset(value)


# Verifies the database enforces exact, case-sensitive name uniqueness.
def test_application_name_is_unique_at_database_level(
    in_memory_engine: Engine,
) -> None:
    """The database rejects two applications with the same exact name."""
    with Session(in_memory_engine) as session:
        first = Application(name="Payments", environment=Environment.PRODUCTION)
        second = Application(name="Payments", environment=Environment.PRODUCTION)
        session.add(first)
        session.commit()
        session.add(second)

        try:
            session.commit()
        except IntegrityError:
            session.rollback()
        else:
            raise AssertionError("duplicate application name was accepted")
