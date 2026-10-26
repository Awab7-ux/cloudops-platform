"""Integration tests for append-only log endpoints."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
import logging

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session
from starlette.responses import Response

from app.models.deployment import Deployment
from app.models.log import Log
from app.services.clock import get_clock


# Provides a mutable callable clock for deterministic log API tests.
class MutableClock:
    """Return a test-controlled timezone-aware UTC datetime."""

    # Stores the current timestamp returned by the clock.
    def __init__(self, value: datetime) -> None:
        """Initialize the clock with a timestamp.

        Args:
            value: Initial timezone-aware UTC timestamp.
        """
        self.value = value

    # Returns the current mutable timestamp.
    def __call__(self) -> datetime:
        """Return the current test-controlled timestamp."""
        return self.value


# Overrides the application clock dependency for log endpoints.
@contextmanager
def _clock_override(
    client: TestClient,
    clock: MutableClock,
) -> Iterator[None]:
    """Temporarily override the injected clock dependency.

    Args:
        client: Test client whose app is being exercised.
        clock: Deterministic clock callable.

    Yields:
        Control while the override remains active.
    """
    client.app.dependency_overrides[get_clock] = lambda: clock
    try:
        yield
    finally:
        client.app.dependency_overrides.pop(get_clock, None)


# Posts one application payload and returns the HTTP response.
def _create_application(client: TestClient, name: str) -> Response:
    """Create an application through the test client.

    Args:
        client: Log API test client.
        name: Application name.

    Returns:
        The application creation response.
    """
    return client.post(
        "/applications",
        json={"name": name, "environment": "development"},
    )


# Posts one deployment payload and returns the HTTP response.
def _create_deployment(
    client: TestClient,
    application_id: str,
    version: str,
) -> Response:
    """Create a deployment through the log API client.

    Args:
        client: Log API test client.
        application_id: Parent application UUID string.
        version: Deployment version value.

    Returns:
        The deployment creation response.
    """
    return client.post(
        f"/applications/{application_id}/deployments",
        json={"version": version},
    )


# Posts one log payload and returns the HTTP response.
def _create_log(
    client: TestClient,
    application_id: str,
    message: str,
    level: str = "info",
    deployment_id: str | None = None,
    source: str | None = None,
) -> Response:
    """Create a log entry through the app logs route.

    Args:
        client: Log API test client.
        application_id: Parent application UUID string.
        message: Log message content.
        level: Requested log severity.
        deployment_id: Optional parent deployment UUID.
        source: Optional source label.

    Returns:
        The log creation response.
    """
    payload: dict[str, str | None] = {"message": message, "level": level}
    if deployment_id is not None:
        payload["deployment_id"] = deployment_id
    if source is not None:
        payload["source"] = source
    return client.post(f"/applications/{application_id}/logs", json=payload)


# Verifies creating and reading application logs with a deployment association.
def test_logs_api_create_and_read(ready_client: TestClient) -> None:
    """POST and GET log endpoints expose server-generated timestamps and associations."""
    clock = MutableClock(datetime(2026, 4, 1, tzinfo=timezone.utc))
    with _clock_override(ready_client, clock):
        app = _create_application(ready_client, "Gateway").json()
        deployment = _create_deployment(ready_client, app["id"], "v1.0.0").json()
        created = _create_log(
            ready_client,
            app["id"],
            "Deployment started",
            level="error",
            deployment_id=deployment["id"],
        )

    assert created.status_code == 201
    body = created.json()
    assert body["application_id"] == app["id"]
    assert body["deployment_id"] == deployment["id"]
    assert body["level"] == "error"
    assert body["message"] == "Deployment started"
    assert body["created_at"].endswith("Z")
    assert body["created_at"] == "2026-04-01T00:00:00Z"

    app_logs = ready_client.get(f"/applications/{app['id']}/logs").json()
    assert app_logs["total"] == 1
    assert app_logs["items"][0]["id"] == body["id"]

    deployment_logs = ready_client.get(
        f"/deployments/{deployment['id']}/logs",
    ).json()
    assert deployment_logs["total"] == 1
    assert deployment_logs["items"][0]["message"] == "Deployment started"


# Verifies filters and global log retrieval work with time-window validation.
def test_logs_api_filters_global_and_time_ranges(ready_client: TestClient) -> None:
    """Log retrieval supports filtering by level, deployment, and time range."""
    clock = MutableClock(datetime(2026, 5, 1, tzinfo=timezone.utc))
    with _clock_override(ready_client, clock):
        app = _create_application(ready_client, "Payments").json()
        deployment = _create_deployment(ready_client, app["id"], "v2").json()
        _create_log(ready_client, app["id"], "info event", level="info")
        clock.value = datetime(2026, 5, 2, tzinfo=timezone.utc)
        _create_log(
            ready_client,
            app["id"],
            "error event",
            level="error",
            deployment_id=deployment["id"],
        )
        clock.value = datetime(2026, 5, 3, tzinfo=timezone.utc)
        _create_log(ready_client, app["id"], "warning event", level="warning")

    filtered = ready_client.get(
        "/logs",
        params={
            "level": "error",
            "deployment_id": deployment["id"],
            "since": "2026-05-01T00:00:00Z",
            "until": "2026-05-03T00:00:00Z",
        },
    )
    assert filtered.status_code == 200
    assert filtered.json()["total"] == 1
    assert filtered.json()["items"][0]["message"] == "error event"

    bad_range = ready_client.get(
        "/logs",
        params={
            "since": "2026-05-10T00:00:00Z",
            "until": "2026-05-01T00:00:00Z",
        },
    )
    assert bad_range.status_code == 422
    assert bad_range.json() == {"detail": "since must not be after until"}


# Verifies pagination ordering and page boundaries for reverse-inserted rows.
def test_logs_api_pagination_ordering(ready_client: TestClient) -> None:
    """The newest logs appear first and paginated pages stay stable."""
    clock = MutableClock(datetime(2026, 6, 1, tzinfo=timezone.utc))
    with _clock_override(ready_client, clock):
        app = _create_application(ready_client, "Registry").json()
        clock.value = datetime(2026, 6, 3, tzinfo=timezone.utc)
        _create_log(ready_client, app["id"], "third")
        clock.value = datetime(2026, 6, 2, tzinfo=timezone.utc)
        _create_log(ready_client, app["id"], "second")
        clock.value = datetime(2026, 6, 1, tzinfo=timezone.utc)
        _create_log(ready_client, app["id"], "first")

    response = ready_client.get(
        f"/applications/{app['id']}/logs",
        params={"limit": 2, "offset": 0},
    )
    payload = response.json()
    assert response.status_code == 200
    assert [item["message"] for item in payload["items"]] == ["third", "second"]
    assert payload["total"] == 3

    next_page = ready_client.get(
        f"/applications/{app['id']}/logs",
        params={"limit": 2, "offset": 2},
    )
    assert next_page.json()["items"][0]["message"] == "first"


# Verifies unsupported payload shapes and invalid names are rejected early.
def test_logs_api_validation_and_missing_resources(ready_client: TestClient) -> None:
    """Logs reject bad payloads and return safe not-found responses."""
    app = _create_application(ready_client, "Queue").json()
    missing_app = "00000000-0000-4000-8000-000000000000"

    invalid = ready_client.post(
        f"/applications/{app['id']}/logs",
        json={"level": "fatal", "message": "invalid"},
    )
    extra = ready_client.post(
        f"/applications/{app['id']}/logs",
        json={"level": "info", "message": "ok", "extra": True},
    )
    missing = ready_client.get(f"/applications/{missing_app}/logs")
    bad_dep = ready_client.post(
        f"/applications/{app['id']}/logs",
        json={"level": "info", "message": "bad deployment", "deployment_id": missing_app},
    )

    assert invalid.status_code == 422
    assert extra.status_code == 422
    assert missing.status_code == 404
    assert bad_dep.status_code == 404

    wrong_app = ready_client.post(
        "/applications",
        json={"name": "Other", "environment": "production"},
    ).json()
    dep = ready_client.post(
        f"/applications/{wrong_app['id']}/deployments",
        json={"version": "v1"},
    ).json()
    cross_app = ready_client.post(
        f"/applications/{app['id']}/logs",
        json={"level": "warning", "message": "cross-app", "deployment_id": dep["id"]},
    )
    assert cross_app.status_code == 404


# Verifies log rows are deleted with their parent application and do not leak secret text.
def test_logs_api_cascade_delete_and_no_sensitive_values(
    ready_client: TestClient,
    caplog: pytest.LogCaptureFixture,
    in_memory_engine: Engine,
) -> None:
    """Application deletion cascades logs and no raw secret message is logged."""
    clock = MutableClock(datetime(2026, 7, 1, tzinfo=timezone.utc))
    with _clock_override(ready_client, clock):
        app = _create_application(ready_client, "Observability").json()
        _create_log(ready_client, app["id"], "token=secret-value-123")
        with caplog.at_level(logging.DEBUG):
            _create_log(ready_client, app["id"], "token=super-secret-456")
        response = ready_client.delete(f"/applications/{app['id']}")

    assert response.status_code == 204
    assert ready_client.get("/logs").json() == {"items": [], "total": 0, "limit": 50, "offset": 0}
    with Session(in_memory_engine) as session:
        remaining_logs = session.scalar(select(func.count()).select_from(Log))
    assert remaining_logs == 0
    assert "secret-value-123" not in caplog.text
    assert "super-secret-456" not in caplog.text
    assert any("create_log entry" in record.message for record in caplog.records)
    assert any(
        "LogService.create_for_application" in record.message
        for record in caplog.records
    )


# Proves field normalization and maximum lengths at the API boundary.
@pytest.mark.parametrize(
    ("message_length", "expected_status"),
    [(2000, 201), (2001, 422)],
    ids=["message-max-length", "message-over-max"],
)
def test_logs_api_message_length_boundaries(
    ready_client: TestClient,
    message_length: int,
    expected_status: int,
) -> None:
    """Accept messages through 2000 characters and reject longer messages."""
    app = _create_application(ready_client, f"Length-{message_length}").json()
    response = _create_log(ready_client, app["id"], "x" * message_length)

    assert response.status_code == expected_status


# Proves blank messages are rejected after whitespace normalization.
@pytest.mark.parametrize(
    "message",
    ["", " \t\n "],
    ids=["empty", "whitespace-only"],
)
def test_logs_api_rejects_blank_messages(
    ready_client: TestClient,
    message: str,
) -> None:
    """Reject empty and whitespace-only messages."""
    app = _create_application(ready_client, f"Blank-{len(message)}").json()

    response = _create_log(ready_client, app["id"], message)

    assert response.status_code == 422


# Proves source length limits, stripping, and whitespace rejection.
@pytest.mark.parametrize(
    ("source", "expected_status", "expected_source"),
    [
        ("s" * 100, 201, "s" * 100),
        ("s" * 101, 422, None),
        ("  worker-1  ", 201, "worker-1"),
        ("   ", 422, None),
    ],
    ids=["source-max-length", "source-over-max", "source-trimmed", "source-blank"],
)
def test_logs_api_source_validation(
    ready_client: TestClient,
    source: str,
    expected_status: int,
    expected_source: str | None,
) -> None:
    """Validate source bounds and ensure persisted source labels are trimmed."""
    app = _create_application(ready_client, f"Source-{len(source)}-{source[:1]}").json()

    response = _create_log(ready_client, app["id"], "source test", source=source)

    assert response.status_code == expected_status
    if expected_status == 201:
        assert response.json()["source"] == expected_source


# Proves timestamps are server-owned and cannot be supplied in create requests.
def test_logs_api_rejects_client_created_at_and_uses_injected_clock(
    ready_client: TestClient,
) -> None:
    """Use the injected clock and reject client attempts to set created_at."""
    instant = datetime(2026, 8, 1, 12, 30, tzinfo=timezone.utc)
    clock = MutableClock(instant)
    with _clock_override(ready_client, clock):
        app = _create_application(ready_client, "Clock-boundary").json()
        created = _create_log(ready_client, app["id"], "clock-owned")
        client_timestamp = ready_client.post(
            f"/applications/{app['id']}/logs",
            json={
                "message": "client timestamp",
                "created_at": "2020-01-01T00:00:00Z",
            },
        )

    assert created.status_code == 201
    assert created.json()["created_at"] == "2026-08-01T12:30:00Z"
    assert client_timestamp.status_code == 422


# Proves each supported log filter works independently and in combination.
@pytest.mark.parametrize(
    ("params", "expected_messages"),
    [
        ({"level": "error"}, ["other-app", "match-error"]),
        ({"application_id": "app-a"}, ["match-warning", "match-error"]),
        ({"deployment_id": "dep-a"}, ["match-error"]),
        ({"since": "2026-09-02T00:00:00Z"}, ["other-app", "match-warning"]),
        ({"until": "2026-09-02T00:00:00Z"}, ["match-warning", "match-error"]),
        (
            {
                "application_id": "app-a",
                "deployment_id": "dep-a",
                "level": "error",
                "since": "2026-09-01T00:00:00Z",
                "until": "2026-09-02T00:00:00Z",
            },
            ["match-error"],
        ),
    ],
    ids=[
        "level",
        "application",
        "deployment",
        "since",
        "until",
        "combined",
    ],
)
def test_logs_api_global_filters(
    ready_client: TestClient,
    params: dict[str, str],
    expected_messages: list[str],
) -> None:
    """Apply each global log filter separately and verify combined filtering."""
    clock = MutableClock(datetime(2026, 9, 1, tzinfo=timezone.utc))
    with _clock_override(ready_client, clock):
        app_a = _create_application(ready_client, "Filter-A").json()
        dep_a = _create_deployment(ready_client, app_a["id"], "a1").json()
        app_b = _create_application(ready_client, "Filter-B").json()
        _create_log(
            ready_client,
            app_a["id"],
            "match-error",
            level="error",
            deployment_id=dep_a["id"],
        )
        clock.value = datetime(2026, 9, 2, tzinfo=timezone.utc)
        _create_log(ready_client, app_a["id"], "match-warning", level="warning")
        clock.value = datetime(2026, 9, 3, tzinfo=timezone.utc)
        _create_log(ready_client, app_b["id"], "other-app", level="error")

    actual_params = dict(params)
    if actual_params.get("application_id") == "app-a":
        actual_params["application_id"] = app_a["id"]
    if actual_params.get("deployment_id") == "dep-a":
        actual_params["deployment_id"] = dep_a["id"]
    response = ready_client.get("/logs", params=actual_params)

    assert response.status_code == 200
    assert [item["message"] for item in response.json()["items"]] == expected_messages


# Proves time bounds include exact edges and exclude timestamps outside them.
@pytest.mark.parametrize(
    ("params", "expected_messages"),
    [
        (
            {
                "since": "2026-10-01T00:00:00Z",
                "until": "2026-10-01T00:00:00Z",
            },
            ["edge"],
        ),
        ({"since": "2026-10-01T00:00:00.000001Z"}, ["after"]),
        ({"until": "2026-09-30T23:59:59.999999Z"}, ["before"]),
    ],
    ids=["inclusive-exact-edge", "inclusive-since", "inclusive-until"],
)
def test_logs_api_time_boundaries(
    ready_client: TestClient,
    params: dict[str, str],
    expected_messages: list[str],
) -> None:
    """Use inclusive UTC bounds and exclude rows just beyond either edge."""
    boundary = datetime(2026, 10, 1, tzinfo=timezone.utc)
    clock = MutableClock(boundary - timedelta(microseconds=1))
    with _clock_override(ready_client, clock):
        app = _create_application(ready_client, "Time-edges").json()
        _create_log(ready_client, app["id"], "before")
        clock.value = boundary
        _create_log(ready_client, app["id"], "edge")
        clock.value = boundary + timedelta(microseconds=1)
        _create_log(ready_client, app["id"], "after")

    response = ready_client.get(
        f"/applications/{app['id']}/logs",
        params=params,
    )

    assert response.status_code == 200
    assert [item["message"] for item in response.json()["items"]] == expected_messages


# Proves timestamp syntax, timezone awareness, and range-order validation.
@pytest.mark.parametrize(
    ("params", "expected_detail", "validation_location"),
    [
        ({"since": "2026-10-01T00:00:00"}, None, ["query", "since"]),
        ({"until": "2026-10-01T00:00:00"}, None, ["query", "until"]),
        ({"since": "not-a-timestamp"}, None, ["query", "since"]),
        (
            {
                "since": "2026-10-02T00:00:00Z",
                "until": "2026-10-01T00:00:00Z",
            },
            "since must not be after until",
            None,
        ),
    ],
    ids=["naive-since", "naive-until", "malformed", "inverted-range"],
)
def test_logs_api_rejects_invalid_time_filters(
    ready_client: TestClient,
    params: dict[str, str],
    expected_detail: str | None,
    validation_location: list[str] | None,
) -> None:
    """Use FastAPI validation for malformed timestamps and map inverted ranges."""
    response = ready_client.get("/logs", params=params)

    assert response.status_code == 422
    body = response.json()
    if expected_detail is not None:
        assert body == {"detail": expected_detail}
    else:
        assert isinstance(body["detail"], list)
        assert body["detail"][0]["loc"] == validation_location


# Proves invalid log-level filters and pagination bounds return 422.
@pytest.mark.parametrize(
    ("params", "endpoint"),
    [
        ({"level": "fatal"}, "/logs"),
        ({"limit": 0}, "/logs"),
        ({"limit": 201}, "/logs"),
        ({"limit": -1}, "/logs"),
        ({"offset": -1}, "/logs"),
    ],
    ids=["invalid-level", "limit-zero", "limit-over-max", "limit-negative", "offset-negative"],
)
def test_logs_api_rejects_invalid_filters_and_pagination(
    ready_client: TestClient,
    params: dict[str, int | str],
    endpoint: str,
) -> None:
    """Reject out-of-contract log filters and pagination values."""
    response = ready_client.get(endpoint, params=params)

    assert response.status_code == 422


# Proves default and maximum page sizes are accepted by the endpoint.
@pytest.mark.parametrize(
    ("limit", "expected_limit"),
    [(None, 50), (200, 200)],
    ids=["default-limit", "maximum-limit"],
)
def test_logs_api_default_and_maximum_limits(
    ready_client: TestClient,
    limit: int | None,
    expected_limit: int,
) -> None:
    """Return the default page size and accept the documented maximum."""
    params = {} if limit is None else {"limit": limit}

    response = ready_client.get("/logs", params=params)

    assert response.status_code == 200
    assert response.json()["limit"] == expected_limit


# Proves same-time rows sort by ascending identifier and pages contain exact rows.
def test_logs_api_same_timestamp_ordering_and_paging(
    ready_client: TestClient,
) -> None:
    """Sort timestamp ties by id and return the precise next page."""
    clock = MutableClock(datetime(2026, 11, 1, tzinfo=timezone.utc))
    with _clock_override(ready_client, clock):
        app = _create_application(ready_client, "Same-time").json()
        for message in ("first", "second", "third", "fourth"):
            _create_log(ready_client, app["id"], message)

    first_page = ready_client.get(
        f"/applications/{app['id']}/logs",
        params={"limit": 2},
    ).json()
    second_page = ready_client.get(
        f"/applications/{app['id']}/logs",
        params={"limit": 2, "offset": 2},
    ).json()
    all_rows = ready_client.get(
        f"/applications/{app['id']}/logs",
        params={"limit": 200},
    ).json()

    assert [row["id"] for row in all_rows["items"]] == sorted(
        row["id"] for row in all_rows["items"]
    )
    assert [row["id"] for row in first_page["items"]] == [
        row["id"] for row in all_rows["items"][:2]
    ]
    assert [row["id"] for row in second_page["items"]] == [
        row["id"] for row in all_rows["items"][2:]
    ]
    assert second_page["total"] == 4


# Proves totals count filtered matches independently of page boundaries.
def test_logs_api_total_ignores_limit_and_offset(ready_client: TestClient) -> None:
    """Keep total equal to the full filtered match count on each page."""
    app = _create_application(ready_client, "Total-count").json()
    for index in range(5):
        _create_log(ready_client, app["id"], f"row-{index}")

    first_page = ready_client.get(
        "/logs",
        params={"application_id": app["id"], "limit": 2, "offset": 0},
    ).json()
    later_page = ready_client.get(
        "/logs",
        params={"application_id": app["id"], "limit": 2, "offset": 3},
    ).json()

    assert len(first_page["items"]) == 2
    assert len(later_page["items"]) == 2
    assert first_page["total"] == later_page["total"] == 5


# Proves logs remain append-only through every common mutation method.
@pytest.mark.parametrize("method", ["put", "patch", "delete"], ids=["put", "patch", "delete"])
def test_logs_api_is_append_only(
    ready_client: TestClient,
    method: str,
) -> None:
    """Reject updates and deletion on an existing log resource path."""
    app = _create_application(ready_client, f"Append-only-{method}").json()
    log = _create_log(ready_client, app["id"], "immutable").json()

    response = ready_client.request(
        method.upper(),
        f"/applications/{app['id']}/logs/{log['id']}",
        json={"message": "changed"},
    )

    assert response.status_code in {404, 405}


# Proves the cross-application deployment filter is indistinguishable from missing.
def test_logs_api_global_cross_application_deployment_is_not_found(
    ready_client: TestClient,
) -> None:
    """Hide deployments belonging to another application in scoped global queries."""
    app_a = _create_application(ready_client, "Global-owner").json()
    app_b = _create_application(ready_client, "Global-other").json()
    deployment = _create_deployment(ready_client, app_b["id"], "other").json()

    response = ready_client.get(
        "/logs",
        params={"application_id": app_a["id"], "deployment_id": deployment["id"]},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "deployment not found"}


# Proves deleting a deployment removes dependent logs and required indexes exist.
def test_logs_api_deployment_cascade_and_query_indexes(
    ready_client: TestClient,
    in_memory_engine: Engine,
) -> None:
    """Cascade deployment deletion and expose the expected log query indexes."""
    app = _create_application(ready_client, "Deployment-cascade").json()
    deployment = _create_deployment(ready_client, app["id"], "cascade").json()
    created = _create_log(
        ready_client,
        app["id"],
        "deployment-owned",
        deployment_id=deployment["id"],
    )
    assert created.status_code == 201

    index_columns = {
        tuple(column.name for column in index.columns)
        for index in Log.__table__.indexes
    }
    assert ("application_id",) in index_columns
    assert ("deployment_id",) in index_columns
    assert ("application_id", "created_at") in index_columns

    with Session(in_memory_engine) as session:
        deployment_row = session.get(Deployment, deployment["id"])
        assert deployment_row is not None
        session.delete(deployment_row)
        session.commit()
        remaining_logs = session.scalar(
            select(func.count()).select_from(Log).where(
                Log.deployment_id == deployment["id"]
            )
        )

    assert remaining_logs == 0
