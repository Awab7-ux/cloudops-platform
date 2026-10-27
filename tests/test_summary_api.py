"""Integration tests for the summary endpoint."""

from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from typing import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine
from sqlalchemy.orm import Session

from app.models.application import ApplicationStatus, Environment
from app.models.deployment import Deployment, DeploymentStatus
from app.models.log import Log
from app.services.clock import get_clock


# Supplies a deterministic, mutable clock to summary requests.
class MutableClock:
    """Return a declared UTC timestamp for deterministic tests."""

    # Initializes the clock's current timestamp.
    def __init__(self, value: datetime) -> None:
        """Store the timestamp returned by this test clock."""
        self.value = value

    # Returns the current test timestamp.
    def __call__(self) -> datetime:
        """Return the currently configured timestamp."""
        return self.value


 # Overrides and then restores the injected clock dependency.
@contextmanager
def _clock_override(client: TestClient, clock: MutableClock) -> Iterator[None]:
    """Override and restore the UTC clock dependency for deterministic tests."""
    client.app.dependency_overrides[get_clock] = lambda: clock
    try:
        yield
    finally:
        client.app.dependency_overrides.pop(get_clock, None)


# Creates an application through its public API.
def _create_application(
    client: TestClient,
    name: str,
    environment: str = "development",
    status: str = "healthy",
) -> dict:
    """Create an application through the public API."""
    response = client.post(
        "/applications",
        json={"name": name, "environment": environment, "status": status},
    )
    assert response.status_code == 201
    return response.json()


# Creates a deployment and optionally pins its lifecycle timestamps.
def _create_deployment(
    client: TestClient,
    application_id: str,
    version: str,
    *,
    engine: Engine,
    created_at: datetime | None = None,
    started_at: datetime | None = None,
    finished_at: datetime | None = None,
) -> dict:
    """Create a deployment and optionally pin its lifecycle timestamps."""
    payload = {"version": version}
    response = client.post(f"/applications/{application_id}/deployments", json=payload)
    assert response.status_code == 201
    deployment = response.json()
    if any(value is not None for value in (created_at, started_at, finished_at)):
        with Session(engine) as session:
            row = session.get(Deployment, deployment["id"])
            assert row is not None
            if created_at is not None:
                row.created_at = created_at
            if started_at is not None:
                row.started_at = started_at
            if finished_at is not None:
                row.finished_at = finished_at
            session.commit()
    return deployment


# Creates a log with a deterministic timestamp.
def _create_log(
    client: TestClient,
    application_id: str,
    level: str,
    *,
    engine: Engine,
    created_at: datetime,
    message: str = "event",
    deployment_id: str | None = None,
) -> dict:
    """Create a log with a deterministic event timestamp."""
    payload = {"message": message, "level": level}
    if deployment_id is not None:
        payload["deployment_id"] = deployment_id
    response = client.post(f"/applications/{application_id}/logs", json=payload)
    assert response.status_code == 201
    record = response.json()
    with Session(engine) as session:
        row = session.get(Log, record["id"])
        assert row is not None
        row.created_at = created_at
        session.commit()
    return record


# Verifies empty databases return zero totals and every enum bucket.
def test_summary_empty_database(ready_client: TestClient) -> None:
    """Return zero totals and all zero-filled enum buckets for an empty DB."""
    clock = MutableClock(datetime(2026, 1, 15, 12, tzinfo=timezone.utc))
    with _clock_override(ready_client, clock):
        response = ready_client.get("/summary")

    assert response.status_code == 200
    body = response.json()
    assert body["applications"]["total"] == 0
    assert body["applications"]["by_status"] == {
        status.value: 0 for status in ApplicationStatus
    }
    assert body["applications"]["by_environment"] == {
        env.value: 0 for env in Environment
    }
    assert body["deployments"]["total"] == 0
    assert body["deployments"]["by_status"] == {
        status.value: 0 for status in DeploymentStatus
    }
    assert body["logs"]["total"] == 0
    assert body["logs"]["errors_last_24h"] == 0
    assert body["recent_failed_deployments"] == []
    assert body["generated_at"] == "2026-01-15T12:00:00Z"


# Verifies aggregates and newest-first ordering of failed deployments.
def test_summary_counts_and_recent_failed_deployments(
    ready_client: TestClient,
    in_memory_engine: Engine,
) -> None:
    """Summarize entity totals and return failed deployments newest-first."""
    clock = MutableClock(datetime(2026, 2, 1, 12, tzinfo=timezone.utc))
    with _clock_override(ready_client, clock):
        app_a = _create_application(ready_client, "Alpha", "production", "healthy")
        app_b = _create_application(ready_client, "Bravo", "staging", "degraded")
        _create_application(ready_client, "Charlie", "development", "down")
        _create_application(ready_client, "Delta", "production", "unknown")

        deployment_1 = _create_deployment(
            ready_client,
            app_a["id"],
            "v1",
            engine=in_memory_engine,
            created_at=clock.value - timedelta(hours=3),
        )
        deployment_2 = _create_deployment(
            ready_client,
            app_a["id"],
            "v2",
            engine=in_memory_engine,
            created_at=clock.value - timedelta(hours=2),
        )
        deployment_3 = _create_deployment(
            ready_client,
            app_b["id"],
            "v3",
            engine=in_memory_engine,
            created_at=clock.value - timedelta(hours=1),
        )

        ready_client.patch(
            f"/deployments/{deployment_1['id']}/status",
            json={"status": "running"},
        )
        ready_client.patch(
            f"/deployments/{deployment_1['id']}/status",
            json={"status": "failed"},
        )
        ready_client.patch(
            f"/deployments/{deployment_2['id']}/status",
            json={"status": "running"},
        )
        ready_client.patch(
            f"/deployments/{deployment_2['id']}/status",
            json={"status": "succeeded"},
        )
        ready_client.patch(
            f"/deployments/{deployment_3['id']}/status",
            json={"status": "running"},
        )
        ready_client.patch(
            f"/deployments/{deployment_3['id']}/status",
            json={"status": "failed"},
        )

        _create_log(
            ready_client,
            app_a["id"],
            "error",
            engine=in_memory_engine,
            created_at=clock.value - timedelta(minutes=5),
            message="error one",
        )
        _create_log(
            ready_client,
            app_a["id"],
            "error",
            engine=in_memory_engine,
            created_at=clock.value - timedelta(minutes=4),
            message="error two",
        )
        _create_log(
            ready_client,
            app_b["id"],
            "info",
            engine=in_memory_engine,
            created_at=clock.value - timedelta(minutes=3),
            message="info one",
        )

        response = ready_client.get("/summary")

    assert response.status_code == 200
    body = response.json()
    assert body["applications"]["total"] == 4
    assert body["applications"]["by_status"]["healthy"] == 1
    assert body["applications"]["by_status"]["down"] == 1
    assert body["applications"]["by_status"]["degraded"] == 1
    assert body["applications"]["by_status"]["unknown"] == 1
    assert body["applications"]["by_environment"]["production"] == 2
    assert body["applications"]["by_environment"]["staging"] == 1
    assert body["deployments"]["total"] == 3
    assert body["deployments"]["by_status"]["failed"] == 2
    assert body["deployments"]["by_status"]["succeeded"] == 1
    assert body["recent_failed_deployments"][0]["application_id"] == app_b["id"]
    assert body["recent_failed_deployments"][0]["status"] == "failed"
    assert body["recent_failed_deployments"][1]["application_id"] == app_a["id"]
    assert body["recent_failed_deployments"][1]["status"] == "failed"
    assert body["logs"]["total"] == 3
    assert body["logs"]["errors_last_24h"] == 2


# Verifies the recent failed deployments list is limited and ordered newest-first.
def test_summary_recent_failed_deployments_limit_and_order(
    ready_client: TestClient,
    in_memory_engine: Engine,
) -> None:
    """Return exactly the five newest among seven failures inserted in reverse order."""
    clock = MutableClock(datetime(2026, 2, 2, 12, tzinfo=timezone.utc))
    with _clock_override(ready_client, clock):
        app = _create_application(ready_client, "RecentFailedLimit")
        deployment_ids: dict[int, str] = {}
        for index in reversed(range(7)):
            deployment = _create_deployment(
                ready_client,
                app["id"],
                f"v{index}",
                engine=in_memory_engine,
            )
            ready_client.patch(
                f"/deployments/{deployment['id']}/status",
                json={"status": "running"},
            )
            ready_client.patch(
                f"/deployments/{deployment['id']}/status",
                json={"status": "failed"},
            )
            with Session(in_memory_engine) as session:
                row = session.get(Deployment, deployment["id"])
                assert row is not None
                row.created_at = clock.value - timedelta(minutes=7 - index)
                session.commit()
            deployment_ids[index] = deployment["id"]

        response = ready_client.get("/summary")

    assert response.status_code == 200
    recent = response.json()["recent_failed_deployments"]
    assert len(recent) == 5
    assert [item["id"] for item in recent] == [
        deployment_ids[index] for index in reversed(range(2, 7))
    ]


# Verifies inclusive lower bounds and upper bounds at the injected current time.
def test_summary_24h_boundaries_and_generated_at(
    ready_client: TestClient,
    in_memory_engine: Engine,
) -> None:
    """Include the exact lower bound and now, excluding just-outside records."""
    clock = MutableClock(datetime(2026, 3, 10, 12, 0, 0, tzinfo=timezone.utc))
    with _clock_override(ready_client, clock):
        app = _create_application(ready_client, "Windowed", "production", "healthy")
        _create_deployment(
            ready_client,
            app["id"],
            "boundary",
            engine=in_memory_engine,
            created_at=clock.value - timedelta(days=1),
        )
        _create_deployment(
            ready_client,
            app["id"],
            "now",
            engine=in_memory_engine,
            created_at=clock.value,
        )
        _create_deployment(
            ready_client,
            app["id"],
            "old",
            engine=in_memory_engine,
            created_at=clock.value - timedelta(days=1, microseconds=1),
        )
        _create_log(
            ready_client,
            app["id"],
            "error",
            engine=in_memory_engine,
            created_at=clock.value - timedelta(days=1),
        )
        _create_log(
            ready_client,
            app["id"],
            "error",
            engine=in_memory_engine,
            created_at=clock.value,
        )
        _create_log(
            ready_client,
            app["id"],
            "error",
            engine=in_memory_engine,
            created_at=clock.value - timedelta(days=1, microseconds=1),
        )
        _create_log(
            ready_client,
            app["id"],
            "error",
            engine=in_memory_engine,
            created_at=clock.value + timedelta(seconds=1),
        )
        response = ready_client.get("/summary")

    assert response.status_code == 200
    body = response.json()
    assert body["generated_at"] == "2026-03-10T12:00:00Z"
    assert body["deployments"]["last_24h"] == 2
    assert body["logs"]["total"] == 4
    assert body["logs"]["errors_last_24h"] == 2


# Verifies counts at inside, exact, and outside 24-hour boundaries.
@pytest.mark.parametrize(
    "hours_delta, expected_count",
    [(23, 1), (24, 1), (24.0001, 0)],
)
def test_summary_24h_windows(
    ready_client: TestClient,
    in_memory_engine: Engine,
    hours_delta: float,
    expected_count: int,
) -> None:
    """Count deployments exactly at and inside the trailing 24-hour window."""
    clock = MutableClock(datetime(2026, 3, 20, 9, 0, tzinfo=timezone.utc))
    with _clock_override(ready_client, clock):
        app = _create_application(ready_client, "TimeWindow", "development", "healthy")
        _create_deployment(
            ready_client,
            app["id"],
            "v1",
            engine=in_memory_engine,
            created_at=clock.value - timedelta(hours=hours_delta),
        )
        _create_log(
            ready_client,
            app["id"],
            "error",
            engine=in_memory_engine,
            created_at=clock.value - timedelta(hours=hours_delta),
        )
        # The timings in this test exercise the boundary only through the summary query.
        response = ready_client.get("/summary")

    assert response.status_code == 200
    assert response.json()["deployments"]["last_24h"] == expected_count
    assert response.json()["logs"]["errors_last_24h"] == expected_count
