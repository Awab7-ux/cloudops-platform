"""Tests for Application service business rules."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from sqlalchemy import Engine
from sqlalchemy.orm import Session

from app.domain.exceptions import ConflictError, NotFoundError
from app.models.application import Environment
from app.repositories.application import ApplicationRepository
from app.schemas.application import ApplicationCreate, ApplicationUpdate
from app.services.application import ApplicationService


# Provides a deterministic callable clock for service tests.
class FakeClock:
    """Return one test-controlled UTC timestamp on every call."""

    # Stores the timestamp returned by this fake clock.
    def __init__(self, value: datetime) -> None:
        """Initialize the fake clock value.

        Args:
            value: Time returned by each clock call.
        """
        self.value = value

    # Returns the configured timestamp.
    def __call__(self) -> datetime:
        """Return the configured timezone-aware timestamp."""
        return self.value


# Builds a service with a real repository and an injected fake clock.
def _make_service(
    session: Session,
    clock: FakeClock,
) -> ApplicationService:
    """Create an application service for a test session.

    Args:
        session: Test database session.
        clock: Deterministic service clock.

    Returns:
        An application service using the injected dependencies.
    """
    return ApplicationService(ApplicationRepository(session), clock)


# Verifies duplicate names are rejected on create.
def test_application_service_rejects_duplicate_create(
    in_memory_engine: Engine,
) -> None:
    """Service raises ConflictError for a duplicate create name."""
    clock = FakeClock(datetime(2026, 1, 1, tzinfo=timezone.utc))
    with Session(in_memory_engine) as session:
        service = _make_service(session, clock)
        payload = ApplicationCreate(name="Payments", environment=Environment.DEVELOPMENT)
        service.create(payload)

        with pytest.raises(ConflictError):
            service.create(payload)


# Verifies creation timestamps use the injected clock exactly once.
def test_application_service_create_uses_injected_clock(
    in_memory_engine: Engine,
) -> None:
    """Service uses the fixed clock for both creation timestamps."""
    fixed_time = datetime(2020, 1, 1, tzinfo=timezone.utc)
    clock = FakeClock(fixed_time)
    with Session(in_memory_engine) as session:
        service = _make_service(session, clock)
        application = service.create(
            ApplicationCreate(name="Payments", environment=Environment.DEVELOPMENT)
        )

    assert application.created_at == fixed_time
    assert application.updated_at == fixed_time


# Verifies duplicate update names are rejected but self-renames are allowed.
def test_application_service_update_name_rules(in_memory_engine: Engine) -> None:
    """Service rejects another row's name and allows the current name."""
    clock = FakeClock(datetime(2026, 1, 1, tzinfo=timezone.utc))
    with Session(in_memory_engine) as session:
        service = _make_service(session, clock)
        first = service.create(
            ApplicationCreate(name="First", environment=Environment.DEVELOPMENT)
        )
        service.create(
            ApplicationCreate(name="Second", environment=Environment.DEVELOPMENT)
        )

        with pytest.raises(ConflictError):
            service.update(first.id, ApplicationUpdate(name="Second"))
        assert service.update(first.id, ApplicationUpdate(name="First")).name == "First"


# Verifies update timestamps use the injected clock without changing creation time.
def test_application_service_update_timestamps(in_memory_engine: Engine) -> None:
    """Service updates updated_at and preserves created_at."""
    initial_time = datetime(2026, 1, 1, tzinfo=timezone.utc)
    changed_time = datetime(2026, 1, 2, tzinfo=timezone.utc)
    clock = FakeClock(initial_time)
    with Session(in_memory_engine) as session:
        service = _make_service(session, clock)
        created = service.create(
            ApplicationCreate(name="Payments", environment=Environment.DEVELOPMENT)
        )
        created_at = created.created_at
        clock.value = changed_time

        updated = service.update(
            created.id,
            ApplicationUpdate(description="Changed"),
        )

        assert updated.created_at == created_at
        assert updated.updated_at == changed_time


# Verifies missing identifiers raise the service domain not-found error.
def test_application_service_missing_application(in_memory_engine: Engine) -> None:
    """Service raises NotFoundError for missing get, update, and delete."""
    clock = FakeClock(datetime(2026, 1, 1, tzinfo=timezone.utc))
    with Session(in_memory_engine) as session:
        service = _make_service(session, clock)
        missing_id = "00000000-0000-4000-8000-000000000000"

        with pytest.raises(NotFoundError):
            service.get(missing_id)
        with pytest.raises(NotFoundError):
            service.update(missing_id, ApplicationUpdate(description="x"))
        with pytest.raises(NotFoundError):
            service.delete(missing_id)
