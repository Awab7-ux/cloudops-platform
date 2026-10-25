"""Tests for DeploymentRepository persistence and list behavior."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Engine
from sqlalchemy.orm import Session

from app.models.application import Application, Environment
from app.models.deployment import Deployment, DeploymentStatus
from app.repositories.deployment import DeploymentRepository


# Creates and persists one application for a repository test.
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


# Creates and persists one deployment with explicit ordering metadata.
def _create_deployment(
    session: Session,
    application_id: str,
    name: str,
    created_at: datetime,
    deployment_id: str | None = None,
    status: DeploymentStatus = DeploymentStatus.PENDING,
) -> Deployment:
    """Persist one deployment used by repository assertions.

    Args:
        session: SQLAlchemy session bound to the test database.
        application_id: Parent application identifier.
        name: Version value identifying this test deployment.
        created_at: Explicit timestamp used for deterministic ordering.
        deployment_id: Optional explicit UUID string.
        status: Lifecycle status to persist.

    Returns:
        The committed deployment row.
    """
    deployment = Deployment(
        id=deployment_id,
        application_id=application_id,
        version=name,
        status=status,
        created_at=created_at,
    )
    session.add(deployment)
    session.commit()
    session.refresh(deployment)
    return deployment


# Verifies repository CRUD operations commit and refresh rows.
def test_deployment_repository_crud(in_memory_engine: Engine) -> None:
    """Add, retrieve, update, and retrieve a deployment row."""
    session = Session(in_memory_engine)
    try:
        application = _create_application(session, "repository-crud")
        repository = DeploymentRepository(session)
        created = _create_deployment(
            session,
            application.id,
            "1.0.0",
            datetime(2024, 1, 1, tzinfo=timezone.utc),
        )
        assert repository.get(created.id) is not None

        created.version = "1.0.1"
        updated = repository.update(created)

        assert updated.version == "1.0.1"
        assert repository.get(created.id).version == "1.0.1"
    finally:
        session.close()


# Verifies status filtering and matching totals.
def test_deployment_repository_status_filter_and_total(
    in_memory_engine: Engine,
) -> None:
    """Filter deployment rows by status and count only matching rows."""
    session = Session(in_memory_engine)
    try:
        application = _create_application(session, "repository-status")
        for index, status in enumerate(
            (
                DeploymentStatus.RUNNING,
                DeploymentStatus.FAILED,
                DeploymentStatus.RUNNING,
            )
        ):
            _create_deployment(
                session,
                application.id,
                "status-%d" % index,
                datetime(2024, 1, index + 1, tzinfo=timezone.utc),
                status=status,
            )

        items, total = DeploymentRepository(session).list_for_application(
            application.id,
            limit=50,
            offset=0,
            status=DeploymentStatus.RUNNING,
        )

        assert [item.status for item in items] == [
            DeploymentStatus.RUNNING,
            DeploymentStatus.RUNNING,
        ]
        assert total == 2
    finally:
        session.close()


# Verifies explicit timestamps produce newest-first content.
def test_deployment_repository_orders_newest_first(
    in_memory_engine: Engine,
) -> None:
    """List deployments newest first with explicit creation timestamps."""
    session = Session(in_memory_engine)
    try:
        application = _create_application(session, "repository-order")
        for index in (1, 2, 3):
            _create_deployment(
                session,
                application.id,
                "version-%d" % index,
                datetime(2024, 1, index, tzinfo=timezone.utc),
            )

        items, total = DeploymentRepository(session).list_for_application(
            application.id,
            limit=50,
            offset=0,
            status=None,
        )

        assert [item.version for item in items] == [
            "version-3",
            "version-2",
            "version-1",
        ]
        assert total == 3
    finally:
        session.close()


# Verifies equal timestamps use ascending IDs as the tie-break.
def test_deployment_repository_tie_break_with_many_rows(
    in_memory_engine: Engine,
) -> None:
    """Order five equal-time deployments by ascending identifier."""
    session = Session(in_memory_engine)
    try:
        application = _create_application(session, "repository-tie")
        created_at = datetime(2024, 1, 1, tzinfo=timezone.utc)
        identifiers = [
            "00000000-0000-4000-8000-00000000000%d" % index
            for index in range(1, 6)
        ]
        for deployment_id in reversed(identifiers):
            _create_deployment(
                session,
                application.id,
                deployment_id[-1],
                created_at,
                deployment_id=deployment_id,
            )

        items, _ = DeploymentRepository(session).list_for_application(
            application.id,
            limit=50,
            offset=0,
            status=None,
        )

        assert [item.id for item in items] == identifiers
    finally:
        session.close()


# Verifies page contents and totals at an interior and terminal offset.
def test_deployment_repository_page_contents(
    in_memory_engine: Engine,
) -> None:
    """Return the requested page and an empty page beyond the total."""
    session = Session(in_memory_engine)
    try:
        application = _create_application(session, "repository-page")
        for index in range(1, 6):
            _create_deployment(
                session,
                application.id,
                "page-%d" % index,
                datetime(2024, 1, index, tzinfo=timezone.utc),
            )
        repository = DeploymentRepository(session)

        items, total = repository.list_for_application(
            application.id,
            limit=2,
            offset=2,
            status=None,
        )
        empty_items, empty_total = repository.list_for_application(
            application.id,
            limit=2,
            offset=5,
            status=None,
        )

        assert [item.version for item in items] == ["page-3", "page-2"]
        assert total == 5
        assert empty_items == []
        assert empty_total == 5
    finally:
        session.close()


# Verifies list results contain only deployments for the requested application.
def test_deployment_repository_scopes_to_application(
    in_memory_engine: Engine,
) -> None:
    """Exclude deployments belonging to a different application."""
    session = Session(in_memory_engine)
    try:
        first = _create_application(session, "repository-scope-first")
        second = _create_application(session, "repository-scope-second")
        timestamp = datetime(2024, 1, 1, tzinfo=timezone.utc)
        _create_deployment(session, first.id, "first", timestamp)
        _create_deployment(session, second.id, "second", timestamp)

        items, total = DeploymentRepository(session).list_for_application(
            first.id,
            limit=50,
            offset=0,
            status=None,
        )

        assert [item.version for item in items] == ["first"]
        assert total == 1
    finally:
        session.close()
