"""Tests for DeploymentService business operations."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from sqlalchemy import Engine
from sqlalchemy.orm import Session

from app.domain.exceptions import ConflictError, NotFoundError
from app.models.application import Application, Environment
from app.models.deployment import DeploymentStatus
from app.repositories.application import ApplicationRepository
from app.repositories.deployment import DeploymentRepository
from app.schemas.deployment import DeploymentCreate, DeploymentStatusUpdate
from app.services.clock import Clock
from app.services.deployment import DeploymentService


# Provides a mutable deterministic clock for service tests.
class FakeClock:
    """Return a test-controlled timezone-aware datetime."""

    # Stores the current value returned by this fake clock.
    def __init__(self, value: datetime) -> None:
        """Initialize the fake clock.

        Args:
            value: Initial timezone-aware datetime.
        """
        self.value = value

    # Returns the currently configured test time.
    def __call__(self) -> datetime:
        """Return the currently configured datetime."""
        return self.value

    # Advances the fake clock to a new explicit value.
    def set(self, value: datetime) -> None:
        """Set the datetime returned by future calls.

        Args:
            value: New timezone-aware datetime.
        """
        self.value = value


# Creates and persists one application for a service test.
def _create_application(session: Session, name: str) -> Application:
    """Persist an application with a deterministic test name.

    Args:
        session: SQLAlchemy session bound to the test database.
        name: Unique application name for the current test.

    Returns:
        The committed application row.
    """
    application = Application(name=name, environment=Environment.DEVELOPMENT)
    session.add(application)
    session.commit()
    session.refresh(application)
    return application


# Builds a deployment service with its repositories and injected clock.
def _build_service(session: Session, clock: Clock) -> DeploymentService:
    """Construct a service using the supplied session and clock.

    Args:
        session: SQLAlchemy session bound to the test database.
        clock: Deterministic callable returning aware UTC datetimes.

    Returns:
        A deployment service with injected dependencies.
    """
    return DeploymentService(
        DeploymentRepository(session),
        ApplicationRepository(session),
        clock,
    )


# Verifies creation uses the injected clock and normalizes the commit SHA.
def test_deployment_service_create_uses_clock_and_lowercases_sha(
    in_memory_engine: Engine,
) -> None:
    """Create pending deployments with deterministic timestamps and SHA casing."""
    created_at = datetime(2024, 2, 1, tzinfo=timezone.utc)
    clock = FakeClock(created_at)
    session = Session(in_memory_engine)
    try:
        application = _create_application(session, "service-create")
        service = _build_service(session, clock)

        deployment = service.create_for_application(
            application.id,
            DeploymentCreate(version="v1", commit_sha="ABCDEF1"),
        )

        assert deployment.status is DeploymentStatus.PENDING
        assert deployment.commit_sha == "abcdef1"
        assert deployment.created_at == created_at
    finally:
        session.close()


# Verifies creation rejects an unknown application.
def test_deployment_service_create_unknown_application(
    in_memory_engine: Engine,
) -> None:
    """Raise a not-found error when the parent application is absent."""
    session = Session(in_memory_engine)
    try:
        service = _build_service(
            session,
            FakeClock(datetime(2024, 2, 1, tzinfo=timezone.utc)),
        )

        with pytest.raises(NotFoundError) as error:
            service.create_for_application(
                "00000000-0000-4000-8000-000000000000",
                DeploymentCreate(version="v1"),
            )

        assert error.value.resource == "application"
    finally:
        session.close()


# Verifies retrieval rejects an unknown deployment.
def test_deployment_service_get_missing_deployment(
    in_memory_engine: Engine,
) -> None:
    """Raise a deployment not-found error for an absent identifier."""
    session = Session(in_memory_engine)
    try:
        service = _build_service(
            session,
            FakeClock(datetime(2024, 2, 1, tzinfo=timezone.utc)),
        )

        with pytest.raises(NotFoundError) as error:
            service.get("not-a-deployment-id")

        assert error.value.resource == "deployment"
    finally:
        session.close()


# Verifies started_at is assigned once and finished_at is preserved.
def test_deployment_service_sets_lifecycle_timestamps_once(
    in_memory_engine: Engine,
) -> None:
    """Set lifecycle timestamps on entry and never overwrite them."""
    created_at = datetime(2024, 2, 1, tzinfo=timezone.utc)
    running_at = datetime(2024, 2, 2, tzinfo=timezone.utc)
    finished_at = datetime(2024, 2, 3, tzinfo=timezone.utc)
    rollback_at = datetime(2024, 2, 4, tzinfo=timezone.utc)
    clock = FakeClock(created_at)
    session = Session(in_memory_engine)
    try:
        application = _create_application(session, "service-lifecycle")
        service = _build_service(session, clock)
        deployment = service.create_for_application(
            application.id,
            DeploymentCreate(version="v1"),
        )

        clock.set(running_at)
        deployment = service.update_status(
            deployment.id,
            DeploymentStatusUpdate(status=DeploymentStatus.RUNNING),
        )
        clock.set(finished_at)
        deployment = service.update_status(
            deployment.id,
            DeploymentStatusUpdate(status=DeploymentStatus.SUCCEEDED),
        )
        clock.set(rollback_at)
        deployment = service.update_status(
            deployment.id,
            DeploymentStatusUpdate(status=DeploymentStatus.ROLLED_BACK),
        )

        assert deployment.started_at == running_at
        assert deployment.finished_at == finished_at
        assert deployment.status is DeploymentStatus.ROLLED_BACK
    finally:
        session.close()


# Verifies failed deployments also retain their first finished timestamp.
def test_deployment_service_failed_timestamp_is_set_once(
    in_memory_engine: Engine,
) -> None:
    """Set finished_at on failure and preserve it through rollback."""
    clock = FakeClock(datetime(2024, 3, 1, tzinfo=timezone.utc))
    session = Session(in_memory_engine)
    try:
        application = _create_application(session, "service-failed")
        service = _build_service(session, clock)
        deployment = service.create_for_application(
            application.id,
            DeploymentCreate(version="v1"),
        )
        clock.set(datetime(2024, 3, 2, tzinfo=timezone.utc))
        deployment = service.update_status(
            deployment.id,
            DeploymentStatusUpdate(status=DeploymentStatus.RUNNING),
        )
        failed_at = datetime(2024, 3, 3, tzinfo=timezone.utc)
        clock.set(failed_at)
        deployment = service.update_status(
            deployment.id,
            DeploymentStatusUpdate(status=DeploymentStatus.FAILED),
        )
        clock.set(datetime(2024, 3, 4, tzinfo=timezone.utc))
        deployment = service.update_status(
            deployment.id,
            DeploymentStatusUpdate(status=DeploymentStatus.ROLLED_BACK),
        )

        assert deployment.finished_at == failed_at
    finally:
        session.close()


# Verifies forbidden transitions become a domain conflict.
def test_deployment_service_rejects_forbidden_transition(
    in_memory_engine: Engine,
) -> None:
    """Raise the fixed transition conflict detail for an invalid move."""
    session = Session(in_memory_engine)
    try:
        application = _create_application(session, "service-forbidden")
        service = _build_service(
            session,
            FakeClock(datetime(2024, 4, 1, tzinfo=timezone.utc)),
        )
        deployment = service.create_for_application(
            application.id,
            DeploymentCreate(version="v1"),
        )

        with pytest.raises(ConflictError) as error:
            service.update_status(
                deployment.id,
                DeploymentStatusUpdate(status=DeploymentStatus.SUCCEEDED),
            )

        assert error.value.detail == "invalid status transition"
    finally:
        session.close()


# Verifies listing rejects an unknown parent application.
def test_deployment_service_list_unknown_application(
    in_memory_engine: Engine,
) -> None:
    """Raise an application not-found error when listing an absent parent."""
    session = Session(in_memory_engine)
    try:
        service = _build_service(
            session,
            FakeClock(datetime(2024, 5, 1, tzinfo=timezone.utc)),
        )

        with pytest.raises(NotFoundError) as error:
            service.list_for_application(
                "00000000-0000-4000-8000-000000000000",
                limit=50,
                offset=0,
            )

        assert error.value.resource == "application"
    finally:
        session.close()


# Verifies a same-state transition fails without changing persisted status.
def test_deployment_service_rejects_pending_to_pending(
    in_memory_engine: Engine,
) -> None:
    """Reject a pending-to-pending transition and retain the pending status."""
    session = Session(in_memory_engine)
    try:
        application = _create_application(session, "service-same-state")
        service = _build_service(
            session,
            FakeClock(datetime(2024, 5, 1, tzinfo=timezone.utc)),
        )
        deployment = service.create_for_application(
            application.id,
            DeploymentCreate(version="v1"),
        )

        with pytest.raises(ConflictError) as error:
            service.update_status(
                deployment.id,
                DeploymentStatusUpdate(status=DeploymentStatus.PENDING),
            )

        assert error.value.detail == "invalid status transition"
        assert service.get(deployment.id).status is DeploymentStatus.PENDING
    finally:
        session.close()
