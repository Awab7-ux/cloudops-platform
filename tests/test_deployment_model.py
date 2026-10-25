"""Tests for the Deployment ORM model and SQLite foreign-key behavior."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from sqlalchemy import Engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.application import Application, Environment
from app.models.deployment import Deployment, DeploymentStatus


# Creates and persists one application for a deployment model test.
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


# Verifies deployment enum values match the public status contract.
def test_deployment_status_values() -> None:
    """Deployment statuses use the five specified string values."""
    assert {status.value for status in DeploymentStatus} == {
        "pending",
        "running",
        "succeeded",
        "failed",
        "rolled_back",
    }


# Verifies generated deployment defaults and UTC-aware timestamps.
def test_deployment_model_defaults(
    in_memory_engine: Engine,
) -> None:
    """A deployment gets a UUID, pending status, and aware creation time."""
    session = Session(in_memory_engine)
    try:
        application = _create_application(session, "deployment-defaults")
        deployment = Deployment(application_id=application.id, version="1.0.0")
        session.add(deployment)
        session.commit()
        session.refresh(deployment)

        assert len(deployment.id) == 36
        assert deployment.status is DeploymentStatus.PENDING
        assert deployment.created_at.tzinfo is not None
        assert deployment.started_at is None
        assert deployment.finished_at is None
    finally:
        session.close()


# Verifies timestamps survive a database round trip as UTC-aware values.
def test_deployment_model_timestamps_round_trip(
    in_memory_engine: Engine,
) -> None:
    """Explicit deployment timestamps remain equal and timezone-aware."""
    created_at = datetime(2024, 1, 1, tzinfo=timezone.utc)
    started_at = datetime(2024, 1, 2, tzinfo=timezone.utc)
    session = Session(in_memory_engine)
    try:
        application = _create_application(session, "deployment-timestamps")
        deployment = Deployment(
            application_id=application.id,
            version="1.0.0",
            created_at=created_at,
            started_at=started_at,
        )
        session.add(deployment)
        session.commit()
        session.refresh(deployment)

        assert deployment.created_at == created_at
        assert deployment.started_at == started_at
        assert deployment.created_at.tzinfo is not None
        assert deployment.started_at.tzinfo is not None
    finally:
        session.close()


# Verifies SQLite rejects deployments that reference no application.
def test_deployment_model_enforces_application_foreign_key(
    in_memory_engine: Engine,
) -> None:
    """An unknown application identifier violates the foreign key."""
    session = Session(in_memory_engine)
    try:
        session.add(
            Deployment(
                application_id="00000000-0000-4000-8000-000000000000",
                version="1.0.0",
            )
        )
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()
    finally:
        session.close()


# Verifies deleting an application cascades to its deployments.
def test_deployment_model_cascades_on_application_delete(
    in_memory_engine: Engine,
) -> None:
    """Deleting an application removes its deployment rows."""
    session = Session(in_memory_engine)
    try:
        application = _create_application(session, "deployment-cascade")
        deployment = Deployment(application_id=application.id, version="1.0.0")
        session.add(deployment)
        session.commit()
        session.refresh(deployment)
        deployment_id = deployment.id

        session.delete(application)
        session.commit()

        assert session.get(Deployment, deployment_id) is None
    finally:
        session.close()
