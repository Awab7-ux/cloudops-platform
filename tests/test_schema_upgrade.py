"""Tests for additive schema upgrades on existing SQLite databases."""

from __future__ import annotations

import logging
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine
from sqlalchemy.exc import OperationalError

import app.models as application_models
from app.db.base import Base
from app.main import create_app


# Calls the SQLite additive upgrade without importing it during test collection.
def _run_upgrade(engine: Engine) -> int:
    """Run the production schema upgrade function.

    Args:
        engine: Engine connected to the test database.

    Returns:
        Number of columns added by this invocation.
    """
    try:
        from app.db.upgrade import upgrade_sqlite_schema
    except ImportError as exc:
        pytest.fail(f"SQLite additive upgrade function is missing: {exc}")
    return upgrade_sqlite_schema(engine)


# Creates the old application and deployment table definitions with stored rows.
def _create_legacy_database(database_path: Path) -> Engine:
    """Create a SQLite database matching the pre-design-fields ORM schema.

    Args:
        database_path: Temporary path for the database file.

    Returns:
        An engine connected to the legacy database.
    """
    engine = create_engine(f"sqlite:///{database_path}")
    with engine.begin() as connection:
        connection.exec_driver_sql(
            """
            CREATE TABLE applications (
                id VARCHAR(36) NOT NULL,
                name VARCHAR(100) NOT NULL,
                description VARCHAR(500),
                environment VARCHAR(11) NOT NULL,
                status VARCHAR(8) NOT NULL,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                PRIMARY KEY (id),
                UNIQUE (name)
            )
            """
        )
        connection.exec_driver_sql(
            """
            CREATE TABLE deployments (
                id VARCHAR(36) NOT NULL,
                application_id VARCHAR(36) NOT NULL,
                version VARCHAR(64) NOT NULL,
                commit_sha VARCHAR(40),
                status VARCHAR(11) NOT NULL,
                started_at DATETIME,
                finished_at DATETIME,
                created_at DATETIME NOT NULL,
                PRIMARY KEY (id),
                FOREIGN KEY(application_id) REFERENCES applications (id)
                    ON DELETE CASCADE
            )
            """
        )
        connection.exec_driver_sql(
            "CREATE INDEX ix_deployments_application_id "
            "ON deployments (application_id)"
        )
        connection.exec_driver_sql(
            """
            INSERT INTO applications (
                id, name, description, environment, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "00000000-0000-4000-8000-000000000001",
                "Legacy Application",
                "Existing description",
                "development",
                "healthy",
                "2026-10-01 12:00:00.000000",
                "2026-10-01 12:00:00.000000",
            ),
        )
        connection.exec_driver_sql(
            """
            INSERT INTO deployments (
                id, application_id, version, commit_sha, status,
                started_at, finished_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "00000000-0000-4000-8000-000000000002",
                "00000000-0000-4000-8000-000000000001",
                "legacy-v1",
                "a1b2c3d",
                "succeeded",
                "2026-10-01 12:05:00.000000",
                "2026-10-01 12:10:00.000000",
                "2026-10-01 12:01:00.000000",
            ),
        )
    return engine


# Verifies old tables upgrade additively, idempotently, and remain API-readable.
def test_sqlite_upgrade_preserves_legacy_rows_and_is_idempotent(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Upgrade adds five nullable columns and supports subsequent API writes."""
    database_path = tmp_path / "legacy-cloudops.db"
    engine = _create_legacy_database(database_path)
    first_added = _run_upgrade(engine)
    second_added = _run_upgrade(engine)

    with engine.connect() as connection:
        application_columns = {
            row[1] for row in connection.exec_driver_sql("PRAGMA table_info(applications)")
        }
        deployment_columns = {
            row[1] for row in connection.exec_driver_sql("PRAGMA table_info(deployments)")
        }
        application_count = connection.exec_driver_sql(
            "SELECT COUNT(*) FROM applications"
        ).scalar_one()
        deployment_count = connection.exec_driver_sql(
            "SELECT COUNT(*) FROM deployments"
        ).scalar_one()

    assert first_added == 5
    assert second_added == 0
    assert {"port", "image", "replicas"} <= application_columns
    assert {"branch", "initiator"} <= deployment_columns
    assert application_count == 1
    assert deployment_count == 1
    engine.dispose()

    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{database_path}")
    application = create_app()
    with TestClient(application) as client:
        legacy_application = client.get(
            "/applications/00000000-0000-4000-8000-000000000001"
        )
        legacy_deployment = client.get(
            "/deployments/00000000-0000-4000-8000-000000000002"
        )
        updated_application = client.patch(
            "/applications/00000000-0000-4000-8000-000000000001",
            json={"port": 8080, "image": "ghcr.io/org/legacy:v2", "replicas": 2},
        )
        created_deployment = client.post(
            "/applications/00000000-0000-4000-8000-000000000001/deployments",
            json={"version": "legacy-v2", "branch": "main", "initiator": "owner"},
        )

    assert legacy_application.status_code == 200
    assert legacy_application.json()["name"] == "Legacy Application"
    assert legacy_application.json()["port"] is None
    assert legacy_application.json()["latest_deployment_version"] == "legacy-v1"
    assert legacy_deployment.status_code == 200
    assert legacy_deployment.json()["version"] == "legacy-v1"
    assert legacy_deployment.json()["branch"] is None
    assert updated_application.status_code == 200
    assert updated_application.json()["port"] == 8080
    assert updated_application.json()["image"] == "ghcr.io/org/legacy:v2"
    assert created_deployment.status_code == 201
    assert created_deployment.json()["branch"] == "main"
    assert created_deployment.json()["initiator"] == "owner"


# Verifies a failed upgrade is logged safely and propagated to its caller.
def test_sqlite_upgrade_failure_is_logged_and_surfaced(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """An invalid database raises while logging only the exception type."""
    engine = create_engine("sqlite://")
    caplog.set_level(logging.ERROR, logger="app.db.upgrade")
    try:
        with pytest.raises(OperationalError):
            _run_upgrade(engine)
    finally:
        engine.dispose()

    assert any(
        "SQLite additive schema upgrade failed" in record.getMessage()
        and "OperationalError" in record.getMessage()
        for record in caplog.records
    )


# Verifies startup against a current schema does not attempt duplicate columns.
def test_sqlite_upgrade_does_not_alter_existing_columns() -> None:
    """The additive upgrade reports no work when all columns already exist."""
    engine = create_engine("sqlite://")
    _ = application_models
    Base.metadata.create_all(engine)
    try:
        added_count = _run_upgrade(engine)
    finally:
        engine.dispose()

    assert added_count == 0
