"""Integration tests for the alerts endpoint."""

from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from typing import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, event
from sqlalchemy.orm import Session

from app.models.deployment import Deployment, DeploymentStatus
from app.models.log import Log
from app.services.clock import get_clock


# Provides a mutable clock value for request-scoped time injection.
class MutableClock:
    """Provide mutable deterministic timestamps to request dependencies."""

    # Initializes the clock with the test's starting timestamp.
    def __init__(self, value: datetime) -> None:
        """Initialize the clock value used by the test."""
        self.value = value

    # Returns the clock's current timestamp.
    def __call__(self) -> datetime:
        """Return the current test timestamp."""
        return self.value


 # Overrides the clock dependency for one test scope.
@contextmanager
def _clock_override(client: TestClient, clock: MutableClock) -> Iterator[None]:
    """Override and then restore the production clock dependency."""
    client.app.dependency_overrides[get_clock] = lambda: clock
    try:
        yield
    finally:
        client.app.dependency_overrides.pop(get_clock, None)


# Creates an application through its public API.
def _create_application(client: TestClient, name: str) -> dict:
    """Create one application through the public API."""
    response = client.post(
        "/applications",
        json={"name": name, "environment": "development", "status": "healthy"},
    )
    assert response.status_code == 201
    return response.json()


# Creates a deployment through its public API.
def _create_deployment(client: TestClient, application_id: str, version: str) -> dict:
    """Create one deployment through the public API."""
    response = client.post(
        f"/applications/{application_id}/deployments",
        json={"version": version},
    )
    assert response.status_code == 201
    return response.json()


# Creates a log and optionally sets its timestamp for a test window.
def _create_log(
    client: TestClient,
    application_id: str,
    level: str,
    message: str,
    *,
    engine: Engine | None = None,
    created_at: datetime | None = None,
) -> dict:
    """Create a log and optionally set its timestamp for window tests."""
    response = client.post(
        f"/applications/{application_id}/logs",
        json={"message": message, "level": level},
    )
    assert response.status_code == 201
    record = response.json()
    if engine is not None and created_at is not None:
        with Session(engine) as session:
            log = session.get(Log, record["id"])
            assert log is not None
            log.created_at = created_at
            session.commit()
    return record


# Pins a deployment creation time for deterministic latest-deployment checks.
def _set_deployment_times(
    engine: Engine,
    deployment_id: str,
    *,
    created_at: datetime | None = None,
) -> None:
    """Set deployment creation time to a deterministic test value."""
    if created_at is None:
        return
    with Session(engine) as session:
        deployment = session.get(Deployment, deployment_id)
        assert deployment is not None
        deployment.created_at = created_at
        session.commit()


# Verifies the failed-deployment and error-spike alert rules.
def test_alerts_for_each_rule_type(
    ready_client: TestClient,
    in_memory_engine: Engine,
) -> None:
    """Emit failed-deployment and error-spike alerts from current state."""
    clock = MutableClock(datetime(2026, 5, 1, 12, tzinfo=timezone.utc))
    with _clock_override(ready_client, clock):
        app = _create_application(ready_client, "Alpha")
        deployment = _create_deployment(ready_client, app["id"], "v1")

        ready_client.patch(
            f"/deployments/{deployment['id']}/status",
            json={"status": "running"},
        )
        clock.value = datetime(2026, 5, 1, 13, 0, tzinfo=timezone.utc)
        ready_client.patch(
            f"/deployments/{deployment['id']}/status",
            json={"status": "failed"},
        )
        _create_log(
            ready_client, app["id"], "error", "failure",
            engine=in_memory_engine,
            created_at=clock.value - timedelta(minutes=1),
        )
        _create_log(
            ready_client, app["id"], "error", "failure",
            engine=in_memory_engine,
            created_at=clock.value - timedelta(minutes=1),
        )
        _create_log(
            ready_client, app["id"], "error", "failure",
            engine=in_memory_engine,
            created_at=clock.value - timedelta(minutes=1),
        )
        _create_log(
            ready_client, app["id"], "error", "failure",
            engine=in_memory_engine,
            created_at=clock.value - timedelta(minutes=1),
        )
        _create_log(
            ready_client, app["id"], "error", "failure",
            engine=in_memory_engine,
            created_at=clock.value - timedelta(minutes=1),
        )

        response = ready_client.get("/alerts")

    assert response.status_code == 200
    body = response.json()
    alert_types = {item["type"] for item in body["items"]}
    assert "deployment_failed" in alert_types
    assert "error_log_spike" in alert_types
    assert body["total"] >= 2


# Verifies a newer successful deployment clears an older failure alert.
def test_failed_alert_is_cleared_by_newer_successful_deployment(
    ready_client: TestClient,
    in_memory_engine: Engine,
) -> None:
    """Clear a failed alert when a newer deployment succeeds."""
    clock = MutableClock(datetime(2026, 6, 1, 12, tzinfo=timezone.utc))
    with _clock_override(ready_client, clock):
        app = _create_application(ready_client, "Bravo")
        first = _create_deployment(ready_client, app["id"], "v1")
        ready_client.patch(
            f"/deployments/{first['id']}/status",
            json={"status": "running"},
        )
        ready_client.patch(
            f"/deployments/{first['id']}/status",
            json={"status": "failed"},
        )
        _set_deployment_times(
            in_memory_engine,
            first["id"],
            created_at=clock.value,
        )
        clock.value += timedelta(seconds=1)
        second = _create_deployment(ready_client, app["id"], "v2")
        _set_deployment_times(
            in_memory_engine,
            second["id"],
            created_at=clock.value,
        )
        ready_client.patch(
            f"/deployments/{second['id']}/status",
            json={"status": "succeeded"},
        )

        response = ready_client.get("/alerts")

    assert response.status_code == 200
    assert response.json()["items"] == []
    assert response.json()["total"] == 0


# Verifies high severity alerts sort before medium severity alerts.
def test_alerts_are_ordered_by_severity_then_since_desc(ready_client: TestClient) -> None:
    """Order high-severity failed alerts before medium-severity alerts."""
    clock = MutableClock(datetime(2026, 7, 1, 10, tzinfo=timezone.utc))
    with _clock_override(ready_client, clock):
        app = _create_application(ready_client, "Charlie")
        deployment = _create_deployment(ready_client, app["id"], "v1")
        ready_client.patch(
            f"/deployments/{deployment['id']}/status",
            json={"status": "running"},
        )
        ready_client.patch(
            f"/deployments/{deployment['id']}/status",
            json={"status": "failed"},
        )
        response = ready_client.get("/alerts")

    assert response.status_code == 200
    items = response.json()["items"]
    assert items and items[0]["type"] == "deployment_failed"
    assert items[0]["severity"] == "high"


# Verifies the deployment-stuck rule at all threshold boundaries.
@pytest.mark.parametrize(
    ("age", "expected_count"),
    [
        (timedelta(minutes=59, seconds=59), 0),
        (timedelta(minutes=60), 1),
        (timedelta(minutes=60, seconds=1), 1),
    ],
)
def test_stuck_deployment_threshold_boundaries(
    ready_client: TestClient,
    age: timedelta,
    expected_count: int,
) -> None:
    """Apply the stuck threshold at 59:59, 60:00, and 60:01 precisely."""
    clock = MutableClock(datetime(2026, 8, 1, 12, tzinfo=timezone.utc))
    with _clock_override(ready_client, clock):
        app = _create_application(ready_client, f"Stuck-{age.total_seconds()}")
        deployment = _create_deployment(ready_client, app["id"], "v1")
        ready_client.patch(
            f"/deployments/{deployment['id']}/status",
            json={"status": "running"},
        )
        clock.value += age
        response = ready_client.get("/alerts", params={"type": "deployment_stuck"})

    assert response.status_code == 200
    assert response.json()["total"] == expected_count


# Verifies the error-spike threshold below, at, and above its limit.
@pytest.mark.parametrize(("log_count", "expected_count"), [(4, 0), (5, 1), (6, 1)])
def test_error_spike_count_boundary(
    ready_client: TestClient,
    in_memory_engine: Engine,
    log_count: int,
    expected_count: int,
) -> None:
    """Emit a per-application spike only at five or more recent errors."""
    clock = MutableClock(datetime(2026, 9, 1, 12, tzinfo=timezone.utc))
    with _clock_override(ready_client, clock):
        app = _create_application(ready_client, f"Errors-{log_count}")
        for index in range(log_count):
            _create_log(
                ready_client,
                app["id"],
                "error",
                f"error-{index}",
                engine=in_memory_engine,
                created_at=clock.value - timedelta(minutes=1),
            )
        response = ready_client.get("/alerts", params={"type": "error_log_spike"})

    assert response.status_code == 200
    assert response.json()["total"] == expected_count


# Verifies future-dated logs do not trigger the error-spike rule.
def test_error_spike_excludes_future_logs(
    ready_client: TestClient,
    in_memory_engine: Engine,
) -> None:
    """Do not count error records later than the injected current time."""
    clock = MutableClock(datetime(2026, 9, 2, 12, tzinfo=timezone.utc))
    with _clock_override(ready_client, clock):
        app = _create_application(ready_client, "FutureErrors")
        for index in range(5):
            _create_log(
                ready_client,
                app["id"],
                "error",
                f"future-error-{index}",
                engine=in_memory_engine,
                created_at=clock.value + timedelta(seconds=1),
            )
        response = ready_client.get("/alerts", params={"type": "error_log_spike"})

    assert response.status_code == 200
    assert response.json()["total"] == 0


# Verifies the inclusive error-spike time-window boundaries.
@pytest.mark.parametrize(
    ("boundary_time", "expected_count"),
    [
        ("lower", 1),
        ("now", 1),
        ("before_lower", 0),
    ],
)
def test_error_spike_window_boundaries(
    ready_client: TestClient,
    in_memory_engine: Engine,
    boundary_time: str,
    expected_count: int,
) -> None:
    """Include both exact endpoints but exclude one microsecond before the window."""
    clock = MutableClock(datetime(2026, 9, 3, 12, tzinfo=timezone.utc))
    with _clock_override(ready_client, clock):
        app = _create_application(ready_client, f"SpikeBoundary-{boundary_time}")
        if boundary_time == "lower":
            first_time = clock.value - timedelta(minutes=60)
        elif boundary_time == "now":
            first_time = clock.value
        else:
            first_time = clock.value - timedelta(minutes=60, microseconds=1)
        timestamps = [first_time] + [clock.value - timedelta(seconds=1)] * 4
        for index, created_at in enumerate(timestamps):
            _create_log(
                ready_client,
                app["id"],
                "error",
                f"boundary-error-{index}",
                engine=in_memory_engine,
                created_at=created_at,
            )
        response = ready_client.get("/alerts", params={"type": "error_log_spike"})

    assert response.status_code == 200
    assert response.json()["total"] == expected_count


# Verifies only error-level logs contribute to error spikes.
def test_error_spike_counts_only_error_level_logs(
    ready_client: TestClient,
    in_memory_engine: Engine,
) -> None:
    """Do not combine info, warning, or debug logs with errors toward the threshold."""
    clock = MutableClock(datetime(2026, 9, 4, 12, tzinfo=timezone.utc))
    with _clock_override(ready_client, clock):
        app = _create_application(ready_client, "SpikeLevels")
        for index, level in enumerate(("info", "warning", "debug")):
            _create_log(
                ready_client,
                app["id"],
                level,
                f"non-error-{index}",
                engine=in_memory_engine,
                created_at=clock.value - timedelta(minutes=1),
            )
        for index in range(4):
            _create_log(
                ready_client,
                app["id"],
                "error",
                f"error-{index}",
                engine=in_memory_engine,
                created_at=clock.value - timedelta(minutes=1),
            )
        below_threshold = ready_client.get(
            "/alerts", params={"type": "error_log_spike"}
        )
        _create_log(
            ready_client,
            app["id"],
            "error",
            "error-fifth",
            engine=in_memory_engine,
            created_at=clock.value - timedelta(minutes=1),
        )
        at_threshold = ready_client.get(
            "/alerts", params={"type": "error_log_spike"}
        )

    assert below_threshold.status_code == 200
    assert below_threshold.json()["total"] == 0
    assert at_threshold.status_code == 200
    assert at_threshold.json()["total"] == 1


# Verifies the stuck rule uses started_at rather than created_at when available.
@pytest.mark.parametrize(
    ("created_age", "started_age", "expected_count"),
    [
        (timedelta(hours=3), timedelta(minutes=10), 0),
        (timedelta(minutes=10), timedelta(hours=2), 1),
    ],
)
def test_stuck_deployment_uses_started_at(
    ready_client: TestClient,
    in_memory_engine: Engine,
    created_age: timedelta,
    started_age: timedelta,
    expected_count: int,
) -> None:
    """Use the start timestamp as the stuck anchor whenever it exists."""
    clock = MutableClock(datetime(2026, 9, 5, 12, tzinfo=timezone.utc))
    with _clock_override(ready_client, clock):
        app = _create_application(ready_client, "StartedAnchor")
        deployment = _create_deployment(ready_client, app["id"], "v1")
        ready_client.patch(
            f"/deployments/{deployment['id']}/status",
            json={"status": "running"},
        )
        with Session(in_memory_engine) as session:
            row = session.get(Deployment, deployment["id"])
            assert row is not None
            row.created_at = clock.value - created_age
            row.started_at = clock.value - started_age
            session.commit()
        response = ready_client.get("/alerts", params={"type": "deployment_stuck"})

    assert response.status_code == 200
    assert response.json()["total"] == expected_count


# Verifies old non-running deployments never produce stuck alerts.
@pytest.mark.parametrize(
    "status",
    [
        DeploymentStatus.PENDING,
        DeploymentStatus.SUCCEEDED,
        DeploymentStatus.FAILED,
        DeploymentStatus.ROLLED_BACK,
    ],
)
def test_stuck_alert_ignores_non_running_deployments(
    ready_client: TestClient,
    in_memory_engine: Engine,
    status: DeploymentStatus,
) -> None:
    """Exclude every non-running lifecycle state from stuck deployment alerts."""
    clock = MutableClock(datetime(2026, 9, 6, 12, tzinfo=timezone.utc))
    with _clock_override(ready_client, clock):
        app = _create_application(ready_client, f"NonRunning-{status.value}")
        deployment = _create_deployment(ready_client, app["id"], "v1")
        with Session(in_memory_engine) as session:
            row = session.get(Deployment, deployment["id"])
            assert row is not None
            row.status = status
            row.created_at = clock.value - timedelta(hours=2)
            session.commit()
        response = ready_client.get("/alerts", params={"type": "deployment_stuck"})

    assert response.status_code == 200
    assert response.json()["total"] == 0


# Verifies overlapping alert rules, filters, pagination, and fixed messages.
def test_alert_overlap_filters_pagination_and_fixed_messages(
    ready_client: TestClient,
    in_memory_engine: Engine,
) -> None:
    """Preserve distinct overlapping rules and filter/page their fixed messages."""
    clock = MutableClock(datetime(2026, 10, 1, 12, tzinfo=timezone.utc))
    with _clock_override(ready_client, clock):
        app = _create_application(ready_client, "Overlap")
        running = _create_deployment(ready_client, app["id"], "v1")
        ready_client.patch(
            f"/deployments/{running['id']}/status",
            json={"status": "running"},
        )
        clock.value += timedelta(minutes=60)
        failed = _create_deployment(ready_client, app["id"], "v2")
        ready_client.patch(
            f"/deployments/{failed['id']}/status",
            json={"status": "running"},
        )
        ready_client.patch(
            f"/deployments/{failed['id']}/status",
            json={"status": "failed"},
        )
        _set_deployment_times(
            in_memory_engine,
            failed["id"],
            created_at=clock.value,
        )
        for index in range(5):
            _create_log(
                ready_client,
                app["id"],
                "error",
                f"private-log-{index}",
                engine=in_memory_engine,
                created_at=clock.value - timedelta(minutes=2),
            )

        response = ready_client.get("/alerts", params={"application_id": app["id"]})
        high = ready_client.get("/alerts", params={"severity": "high"})
        page = ready_client.get("/alerts", params={"limit": 1, "offset": 1})
        filtered = ready_client.get(
            "/alerts",
            params={"application_id": app["id"], "type": "deployment_stuck"},
        )

    items = response.json()["items"]
    types = {item["type"] for item in items}
    assert types == {"deployment_failed", "deployment_stuck", "error_log_spike"}
    assert [item["type"] for item in items] == [
        "deployment_failed",
        "error_log_spike",
        "deployment_stuck",
    ]
    assert all(item["application_id"] == app["id"] for item in items)
    assert {item["message"] for item in items} == {
        "Deployment failed.",
        "Deployment is stuck.",
        "Error log spike detected.",
    }
    assert high.json()["total"] == 1
    assert high.json()["items"][0]["type"] == "deployment_failed"
    assert page.json()["limit"] == 1
    assert page.json()["offset"] == 1
    assert [item["type"] for item in page.json()["items"]] == [
        "error_log_spike"
    ]
    assert filtered.json()["total"] == 1
    assert filtered.json()["items"][0]["type"] == "deployment_stuck"
    assert all(
        marker not in item["message"]
        for item in items
        for marker in ("Overlap", "private-log-")
    )


# Verifies invalid pagination and alert filters are rejected by request validation.
@pytest.mark.parametrize(
    "params",
    [
        {"limit": 0},
        {"limit": 201},
        {"offset": -1},
        {"severity": "urgent"},
        {"type": "not-an-alert"},
    ],
)
def test_alerts_reject_invalid_query_parameters(
    ready_client: TestClient,
    params: dict[str, object],
) -> None:
    """Return HTTP 422 for invalid limits, offsets, severities, and types."""
    response = ready_client.get("/alerts", params=params)

    assert response.status_code == 422


# Verifies application filters exclude alerts owned by other applications.
def test_application_filter_excludes_other_applications(
    ready_client: TestClient,
) -> None:
    """Return only alerts belonging to the requested application."""
    clock = MutableClock(datetime(2026, 10, 4, 12, tzinfo=timezone.utc))
    with _clock_override(ready_client, clock):
        first_app = _create_application(ready_client, "First")
        second_app = _create_application(ready_client, "Second")
        for app in (first_app, second_app):
            deployment = _create_deployment(ready_client, app["id"], "v1")
            ready_client.patch(
                f"/deployments/{deployment['id']}/status",
                json={"status": "running"},
            )
            ready_client.patch(
                f"/deployments/{deployment['id']}/status",
                json={"status": "failed"},
            )
        response = ready_client.get(
            "/alerts",
            params={"application_id": first_app["id"]},
        )

    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["application_id"] == first_app["id"]


# Verifies alert SQL query count stays constant as applications increase.
def test_alert_query_count_does_not_scale_with_application_count(
    ready_client: TestClient,
    in_memory_engine: Engine,
) -> None:
    """Keep alert SELECT count constant between three and thirty applications."""
    clock = MutableClock(datetime(2026, 10, 2, 12, tzinfo=timezone.utc))
    counts: list[int] = []

    with _clock_override(ready_client, clock):
        for index in range(3):
            _create_application(ready_client, f"Count-{index}")

        # Counts SELECT statements for a single alert request.
        def count_selects() -> None:
            """Count SQL SELECT statements for one alert request."""
            statement_count = 0

            # Captures SQL SELECT statements emitted by the request.
            def before_cursor_execute(
                connection: object,
                cursor: object,
                statement: str,
                parameters: object,
                context: object,
                executemany: bool,
            ) -> None:
                """Track only SELECT statements issued for the API request."""
                nonlocal statement_count
                if statement.lstrip().upper().startswith("SELECT"):
                    statement_count += 1

            event.listen(in_memory_engine, "before_cursor_execute", before_cursor_execute)
            try:
                response = ready_client.get("/alerts")
                assert response.status_code == 200
            finally:
                event.remove(
                    in_memory_engine,
                    "before_cursor_execute",
                    before_cursor_execute,
                )
            counts.append(statement_count)

        count_selects()
        for index in range(3, 30):
            _create_application(ready_client, f"Count-{index}")
        count_selects()

    assert counts[0] == counts[1]


# Verifies alert logging never exposes log message content.
def test_alert_logs_do_not_include_log_message_content(
    ready_client: TestClient,
    in_memory_engine: Engine,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Keep application log message content out of captured service logs."""
    clock = MutableClock(datetime(2026, 10, 3, 12, tzinfo=timezone.utc))
    caplog.set_level("DEBUG")
    secret_message = "sensitive-log-message-should-not-appear"
    with _clock_override(ready_client, clock):
        application_marker = "PRIVATE-APPLICATION-NAME-MARKER"
        app = _create_application(ready_client, application_marker)
        for index in range(5):
            _create_log(
                ready_client,
                app["id"],
                "error",
                secret_message,
                engine=in_memory_engine,
                created_at=clock.value - timedelta(minutes=1),
            )
        response = ready_client.get("/alerts")

    assert response.status_code == 200
    assert secret_message not in caplog.text
    assert application_marker not in caplog.text
    assert all(
        application_marker not in item["message"]
        and secret_message not in item["message"]
        for item in response.json()["items"]
    )
