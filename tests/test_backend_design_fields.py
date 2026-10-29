"""Regression tests for optional design fields and global deployment reads."""

from __future__ import annotations

from collections.abc import Callable, Iterator
from contextlib import contextmanager
from datetime import datetime, timezone
import logging
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, event
from sqlalchemy.engine import Connection
from sqlalchemy.orm import Session
from starlette.responses import Response

from app.models.application import Application, ApplicationStatus, Environment
from app.models.deployment import Deployment, DeploymentStatus
from app.services.clock import get_clock


# Posts an application and returns the HTTP response.
def _create_application(
    client: TestClient,
    name: str,
    fields: dict[str, object] | None = None,
) -> Response:
    """Create an application through the test client.

    Args:
        client: Applications API test client.
        name: Application name.
        fields: Optional request fields to include.

    Returns:
        The create response.
    """
    payload: dict[str, object] = {
        "name": name,
        "environment": "development",
    }
    if fields is not None:
        payload.update(fields)
    return client.post("/applications", json=payload)


# Posts a deployment and returns the HTTP response.
def _create_deployment(
    client: TestClient,
    application_id: str,
    version: str,
    fields: dict[str, object] | None = None,
) -> Response:
    """Create a deployment through the test client.

    Args:
        client: Deployment API test client.
        application_id: Parent application identifier.
        version: Deployment version string.
        fields: Optional deployment fields to include.

    Returns:
        The create response.
    """
    payload: dict[str, object] = {"version": version}
    if fields is not None:
        payload.update(fields)
    return client.post(
        f"/applications/{application_id}/deployments",
        json=payload,
    )


# Provides a mutable clock for deterministic timestamp tests.
class MutableClock:
    """Return a test-controlled timezone-aware datetime."""

    # Stores the timestamp returned by this clock.
    def __init__(self, value: datetime) -> None:
        """Initialize the mutable clock.

        Args:
            value: Initial timezone-aware timestamp.
        """
        self.value = value

    # Returns the current test-controlled timestamp.
    def __call__(self) -> datetime:
        """Return the current clock value."""
        return self.value


# Overrides the production clock while a test block runs.
@contextmanager
def _clock_override(client: TestClient, clock: MutableClock) -> Iterator[None]:
    """Override and restore the application clock dependency.

    Args:
        client: Test client whose app receives the override.
        clock: Mutable clock returning deterministic values.

    Yields:
        Control while the override is installed.
    """
    client.app.dependency_overrides[get_clock] = lambda: clock
    try:
        yield
    finally:
        client.app.dependency_overrides.pop(get_clock, None)


# Counts SQL statements executed during one test-client request.
def _count_request_statements(
    engine: Engine,
    operation: Callable[[], object],
) -> int:
    """Count statements emitted while an operation executes.

    Args:
        engine: Engine used by the request-scoped session.
        operation: Operation that issues the request being measured.

    Returns:
        Number of SQL statements executed by the operation.
    """
    statements: list[str] = []

    # Collects SQL without recording any statement parameter values.
    def _record_statement(
        connection: Connection,
        cursor: Any,
        statement: str,
        parameters: Any,
        context: Any,
        executemany: bool,
    ) -> None:
        """Record one SQL statement for this count-only assertion.

        Args:
            connection: SQLAlchemy connection executing the statement.
            cursor: DB-API cursor executing the statement.
            statement: SQL text sent to the database.
            parameters: Bound values for this statement.
            context: SQLAlchemy execution context.
            executemany: Whether the cursor uses executemany.
        """
        _ = connection, cursor, parameters, context, executemany
        statements.append(statement)

    event.listen(engine, "before_cursor_execute", _record_statement)
    try:
        operation()
    finally:
        event.remove(engine, "before_cursor_execute", _record_statement)
    return len(statements)


# Verifies application design fields are optional and trimmed in responses.
def test_application_design_fields_are_optional_and_normalized(
    ready_client: TestClient,
) -> None:
    """POST supports optional design fields and trims image references."""
    without_fields = _create_application(ready_client, "Without design fields")
    with_fields = _create_application(
        ready_client,
        "With design fields",
        {
            "port": 8080,
            "image": "  ghcr.io/org/name:v1.0.0  ",
            "replicas": 4,
        },
    )

    assert without_fields.status_code == 201
    assert {
        key: without_fields.json()[key]
        for key in ("port", "image", "replicas")
    } == {"port": None, "image": None, "replicas": None}
    assert with_fields.status_code == 201
    assert with_fields.json()["port"] == 8080
    assert with_fields.json()["image"] == "ghcr.io/org/name:v1.0.0"
    assert with_fields.json()["replicas"] == 4


# Verifies port accepts only the inclusive TCP/UDP port range.
@pytest.mark.parametrize(
    ("port", "expected_status"),
    [(0, 422), (1, 201), (65535, 201), (65536, 422)],
    ids=["below-minimum", "minimum", "maximum", "above-maximum"],
)
def test_application_port_bounds(
    ready_client: TestClient,
    port: int,
    expected_status: int,
) -> None:
    """POST rejects ports outside 1 through 65535."""
    response = _create_application(
        ready_client,
        "Port boundary",
        {"port": port},
    )

    assert response.status_code == expected_status


# Verifies replicas accept the inclusive supported range.
@pytest.mark.parametrize(
    ("replicas", "expected_status"),
    [(-1, 422), (0, 201), (1000, 201), (1001, 422)],
    ids=["below-minimum", "minimum", "maximum", "above-maximum"],
)
def test_application_replicas_bounds(
    ready_client: TestClient,
    replicas: int,
    expected_status: int,
) -> None:
    """POST rejects replica counts outside 0 through 1000."""
    response = _create_application(
        ready_client,
        "Replica boundary",
        {"replicas": replicas},
    )

    assert response.status_code == expected_status


# Verifies image references trim whitespace and reject blank, spaced, or long input.
@pytest.mark.parametrize(
    ("image", "expected_status", "expected_value"),
    [
        ("", 422, None),
        ("   ", 422, None),
        ("ghcr.io/org/name tag", 422, None),
        ("x" * 255, 201, "x" * 255),
        ("x" * 256, 422, None),
        ("  ghcr.io/org/name:v1  ", 201, "ghcr.io/org/name:v1"),
    ],
    ids=["empty", "whitespace-only", "internal-space", "maximum", "too-long", "trimmed"],
)
def test_application_image_validation(
    ready_client: TestClient,
    image: str,
    expected_status: int,
    expected_value: str | None,
) -> None:
    """POST enforces image reference length and whitespace rules."""
    response = _create_application(
        ready_client,
        "Image boundary",
        {"image": image},
    )

    assert response.status_code == expected_status
    if expected_status == 201:
        assert response.json()["image"] == expected_value


# Verifies PATCH changes only supplied fields and null clears optional fields.
def test_application_patch_changes_sent_fields_and_clears_null_values(
    ready_client: TestClient,
) -> None:
    """PATCH preserves omitted fields and explicitly clears nullable values."""
    application = _create_application(
        ready_client,
        "Patch design fields",
        {"port": 8080, "image": "ghcr.io/org/api:v1", "replicas": 3},
    ).json()
    path = f"/applications/{application['id']}"

    changed_port = ready_client.patch(path, json={"port": 9090})
    cleared = ready_client.patch(path, json={"image": None, "replicas": None})

    assert changed_port.status_code == 200
    assert changed_port.json()["port"] == 9090
    assert changed_port.json()["image"] == "ghcr.io/org/api:v1"
    assert changed_port.json()["replicas"] == 3
    assert cleared.status_code == 200
    assert cleared.json()["port"] == 9090
    assert cleared.json()["image"] is None
    assert cleared.json()["replicas"] is None


# Verifies response-only derived values are rejected in all application requests.
def test_application_derived_fields_are_response_only(
    ready_client: TestClient,
) -> None:
    """POST and PATCH reject deployment summary fields supplied by clients."""
    create_response = _create_application(
        ready_client,
        "Derived request rejection",
        {"latest_deployment_version": "v1"},
    )
    application = _create_application(ready_client, "Derived patch rejection").json()
    patch_response = ready_client.patch(
        f"/applications/{application['id']}",
        json={"latest_deployment_status": "failed"},
    )

    assert create_response.status_code == 422
    assert patch_response.status_code == 422


# Verifies new application creation continues to use the injected clock.
def test_application_design_fields_use_injected_clock(
    ready_client: TestClient,
) -> None:
    """Application timestamps remain deterministic when design fields are set."""
    created_at = datetime(2026, 10, 21, 12, 30, tzinfo=timezone.utc)
    updated_at = datetime(2026, 10, 22, 12, 30, tzinfo=timezone.utc)
    clock = MutableClock(created_at)
    with _clock_override(ready_client, clock):
        created = _create_application(
            ready_client,
            "Clock controlled fields",
            {"port": 8080, "replicas": 2},
        )
        clock.value = updated_at
        updated = ready_client.patch(
            f"/applications/{created.json()['id']}",
            json={"replicas": 3},
        )

    assert created.json()["created_at"] == "2026-10-21T12:30:00Z"
    assert updated.json()["updated_at"] == "2026-10-22T12:30:00Z"


# Verifies application summaries are null until a deployment exists.
def test_application_latest_deployment_fields_are_null_when_empty(
    ready_client: TestClient,
) -> None:
    """Application create, get, and list responses include null derived fields."""
    created = _create_application(ready_client, "No deployments").json()
    application_id = created["id"]

    read = ready_client.get(f"/applications/{application_id}").json()
    listed = ready_client.get("/applications").json()["items"][0]

    for body in (created, read, listed):
        assert body["latest_deployment_version"] is None
        assert body["latest_deployment_status"] is None
        assert body["latest_deployment_at"] is None


# Verifies deployment creation validates and trims branch and initiator values.
def test_deployment_branch_and_initiator_are_optional_and_trimmed(
    ready_client: TestClient,
) -> None:
    """POST deployments returns nullable, trimmed branch and initiator fields."""
    application = _create_application(ready_client, "Deployment fields").json()
    without_fields = _create_deployment(
        ready_client,
        application["id"],
        "v1",
    )
    with_fields = _create_deployment(
        ready_client,
        application["id"],
        "v2",
        {"branch": "  feature/api  ", "initiator": "  release-bot  "},
    )

    assert without_fields.status_code == 201
    assert without_fields.json()["branch"] is None
    assert without_fields.json()["initiator"] is None
    assert with_fields.status_code == 201
    assert with_fields.json()["branch"] == "feature/api"
    assert with_fields.json()["initiator"] == "release-bot"


# Verifies deployment metadata rejects blank and overlong values after trimming.
@pytest.mark.parametrize(
    ("field", "value", "expected_status"),
    [
        ("branch", " ", 422),
        ("branch", "x", 201),
        ("branch", "x" * 100, 201),
        ("branch", "x" * 101, 422),
        ("initiator", " ", 422),
        ("initiator", "x", 201),
        ("initiator", "x" * 100, 201),
        ("initiator", "x" * 101, 422),
    ],
    ids=[
        "branch-blank",
        "branch-minimum",
        "branch-maximum",
        "branch-too-long",
        "initiator-blank",
        "initiator-minimum",
        "initiator-maximum",
        "initiator-too-long",
    ],
)
def test_deployment_branch_and_initiator_bounds(
    ready_client: TestClient,
    field: str,
    value: str,
    expected_status: int,
) -> None:
    """POST enforces branch and initiator lengths after whitespace trimming."""
    application = _create_application(ready_client, "Deployment field bounds").json()
    response = _create_deployment(
        ready_client,
        application["id"],
        "v1",
        {field: value},
    )

    assert response.status_code == expected_status


# Verifies deployment lifecycle updates remain status-only.
def test_deployment_status_patch_rejects_branch_and_initiator(
    ready_client: TestClient,
) -> None:
    """PATCH status rejects immutable branch and initiator fields."""
    application = _create_application(ready_client, "Immutable metadata").json()
    deployment = _create_deployment(
        ready_client,
        application["id"],
        "v1",
        {"branch": "main", "initiator": "release-bot"},
    ).json()
    response = ready_client.patch(
        f"/deployments/{deployment['id']}/status",
        json={"status": "running", "branch": "changed"},
    )

    assert response.status_code == 422


# Verifies latest deployment selection uses creation time and ID tie ordering.
def test_application_latest_deployment_uses_created_at_then_id_ascending(
    ready_client: TestClient,
) -> None:
    """Application summaries choose the latest row without crossing applications."""
    clock = MutableClock(datetime(2026, 10, 1, tzinfo=timezone.utc))
    with _clock_override(ready_client, clock):
        first_app = _create_application(ready_client, "Primary latest app").json()
        second_app = _create_application(ready_client, "Other latest app").json()
        no_deployment_app = _create_application(ready_client, "Empty latest app").json()
        clock.value = datetime(2026, 10, 15, tzinfo=timezone.utc)
        newest_by_time = _create_deployment(
            ready_client,
            first_app["id"],
            "newest-by-time",
        ).json()
        clock.value = datetime(2026, 10, 10, tzinfo=timezone.utc)
        _create_deployment(ready_client, first_app["id"], "older-inserted-later")
        clock.value = datetime(2026, 10, 20, tzinfo=timezone.utc)
        tie_first = _create_deployment(
            ready_client,
            first_app["id"],
            "tie-first-created",
        ).json()
        tie_second = _create_deployment(
            ready_client,
            first_app["id"],
            "tie-second-created",
        ).json()
        clock.value = datetime(2026, 10, 25, tzinfo=timezone.utc)
        _create_deployment(ready_client, second_app["id"], "other-app-only")
        response = ready_client.get("/applications", params={"limit": 200})

    items = {item["id"]: item for item in response.json()["items"]}
    first_item = items[first_app["id"]]
    second_item = items[second_app["id"]]
    empty_item = items[no_deployment_app["id"]]
    expected_tie = min((tie_first, tie_second), key=lambda item: item["id"])

    assert first_item["latest_deployment_version"] == expected_tie["version"]
    assert first_item["latest_deployment_status"] == "pending"
    assert first_item["latest_deployment_at"] == expected_tie["created_at"]
    assert first_item["latest_deployment_version"] != "other-app-only"
    assert second_item["latest_deployment_version"] == "other-app-only"
    assert empty_item["latest_deployment_version"] is None
    assert newest_by_time["version"] == "newest-by-time"


# Verifies latest time fallback prefers finished, then started, then created.
def test_latest_deployment_at_uses_finished_started_created_fallback(
    ready_client: TestClient,
) -> None:
    """Application summary timestamps follow the deployment lifecycle fallback."""
    clock = MutableClock(datetime(2026, 10, 1, tzinfo=timezone.utc))
    with _clock_override(ready_client, clock):
        finished_app = _create_application(ready_client, "Finished fallback").json()
        finished_deployment = _create_deployment(
            ready_client,
            finished_app["id"],
            "finished",
        ).json()
        clock.value = datetime(2026, 10, 2, tzinfo=timezone.utc)
        started = ready_client.patch(
            f"/deployments/{finished_deployment['id']}/status",
            json={"status": "running"},
        ).json()
        clock.value = datetime(2026, 10, 3, tzinfo=timezone.utc)
        finished = ready_client.patch(
            f"/deployments/{finished_deployment['id']}/status",
            json={"status": "succeeded"},
        ).json()

        started_app = _create_application(ready_client, "Started fallback").json()
        started_deployment = _create_deployment(
            ready_client,
            started_app["id"],
            "started",
        ).json()
        clock.value = datetime(2026, 10, 5, tzinfo=timezone.utc)
        started_deployment = ready_client.patch(
            f"/deployments/{started_deployment['id']}/status",
            json={"status": "running"},
        ).json()

        created_app = _create_application(ready_client, "Created fallback").json()
        created_deployment = _create_deployment(
            ready_client,
            created_app["id"],
            "created",
        ).json()
        listing = ready_client.get("/applications", params={"limit": 200}).json()

    items = {item["id"]: item for item in listing["items"]}
    assert items[finished_app["id"]]["latest_deployment_at"] == finished["finished_at"]
    assert items[started_app["id"]]["latest_deployment_at"] == started_deployment["started_at"]
    assert items[created_app["id"]]["latest_deployment_at"] == created_deployment["created_at"]
    assert started["started_at"] is not None


# Verifies application-list SQL count stays fixed as applications and deployments grow.
def test_application_list_statement_count_does_not_scale_with_rows(
    ready_client: TestClient,
    in_memory_engine: Engine,
) -> None:
    """GET applications uses a fixed number of statements for small and large pages."""
    creation_time = datetime(2026, 10, 1, tzinfo=timezone.utc)
    with Session(in_memory_engine) as session:
        small_apps = [
            Application(
                name=f"Count small {number}",
                environment=Environment.DEVELOPMENT,
                status=ApplicationStatus.UNKNOWN,
                created_at=creation_time,
                updated_at=creation_time,
            )
            for number in range(3)
        ]
        session.add_all(small_apps)
        session.flush()
        session.add_all(
            [
                Deployment(
                    application_id=application.id,
                    version=f"small-{application_index}-{deployment_index}",
                    status=DeploymentStatus.PENDING,
                    created_at=creation_time,
                )
                for application_index, application in enumerate(small_apps)
                for deployment_index in range(4)
            ]
        )
        session.commit()

    small_count = _count_request_statements(
        in_memory_engine,
        lambda: ready_client.get("/applications", params={"limit": 200}),
    )

    with Session(in_memory_engine) as session:
        large_apps = [
            Application(
                name=f"Count large {number}",
                environment=Environment.DEVELOPMENT,
                status=ApplicationStatus.UNKNOWN,
                created_at=creation_time,
                updated_at=creation_time,
            )
            for number in range(27)
        ]
        session.add_all(large_apps)
        session.flush()
        session.add_all(
            [
                Deployment(
                    application_id=application.id,
                    version=f"large-{application_index}-{deployment_index}",
                    status=DeploymentStatus.PENDING,
                    created_at=creation_time,
                )
                for application_index, application in enumerate(large_apps)
                for deployment_index in range(5)
            ]
        )
        session.commit()

    large_count = _count_request_statements(
        in_memory_engine,
        lambda: ready_client.get("/applications", params={"limit": 200}),
    )

    assert small_count == large_count


# Verifies global listing filters and joins each application's public labels.
def test_global_deployments_filters_and_response_fields(
    ready_client: TestClient,
) -> None:
    """GET deployments filters by all supported fields and returns app labels."""
    development = _create_application(
        ready_client,
        "Application Needle",
    ).json()
    production = ready_client.post(
        "/applications",
        json={"name": "Production API", "environment": "production"},
    ).json()
    selected = _create_deployment(
        ready_client,
        development["id"],
        "ReleaseNeedle",
        {"commit_sha": "a1b2c3d", "branch": "FeatureBranchNeedle", "initiator": "release-bot"},
    ).json()
    assert ready_client.patch(
        f"/deployments/{selected['id']}/status",
        json={"status": "running"},
    ).status_code == 200
    other_development = _create_deployment(
        ready_client,
        development["id"],
        "other-dev",
    ).json()
    production_deployment = _create_deployment(
        ready_client,
        production["id"],
        "production-version",
    ).json()

    by_application = ready_client.get(
        "/deployments",
        params={"application_id": development["id"]},
    )
    by_status = ready_client.get("/deployments", params={"status": "running"})
    by_environment = ready_client.get(
        "/deployments",
        params={"environment": "production"},
    )
    by_version = ready_client.get("/deployments", params={"q": "releaseneedle"})
    by_commit = ready_client.get("/deployments", params={"q": "B2C3"})
    by_branch = ready_client.get("/deployments", params={"q": "branchneedle"})
    by_application_name = ready_client.get(
        "/deployments",
        params={"q": "APPLICATION NEEDLE"},
    )
    combined = ready_client.get(
        "/deployments",
        params={
            "application_id": development["id"],
            "status": "running",
            "environment": "development",
            "q": "Needle",
        },
    )
    item = by_version.json()["items"][0]
    single_read = ready_client.get(f"/deployments/{selected['id']}")

    assert by_application.json()["total"] == 2
    assert [row["id"] for row in by_status.json()["items"]] == [selected["id"]]
    assert [row["id"] for row in by_environment.json()["items"]] == [production_deployment["id"]]
    assert [row["id"] for row in by_version.json()["items"]] == [selected["id"]]
    assert [row["id"] for row in by_commit.json()["items"]] == [selected["id"]]
    assert [row["id"] for row in by_branch.json()["items"]] == [selected["id"]]
    assert {
        row["id"] for row in by_application_name.json()["items"]
    } == {selected["id"], other_development["id"]}
    assert [row["id"] for row in combined.json()["items"]] == [selected["id"]]
    assert item["application_name"] == "Application Needle"
    assert item["application_environment"] == "development"
    assert item["branch"] == "FeatureBranchNeedle"
    assert item["initiator"] == "release-bot"
    assert single_read.status_code == 200
    assert single_read.json()["id"] == selected["id"]


# Verifies global search treats SQL wildcard characters as literal text.
def test_global_deployments_q_matches_percent_and_underscore_literally(
    ready_client: TestClient,
) -> None:
    """GET deployments escapes percent and underscore in user search terms."""
    application = _create_application(ready_client, "Literal search app").json()
    percent_match = _create_deployment(
        ready_client,
        application["id"],
        "version%literal",
    ).json()
    _create_deployment(ready_client, application["id"], "versionXliteral")
    underscore_match = _create_deployment(
        ready_client,
        application["id"],
        "safe-version",
        {"branch": "branch_under_score"},
    ).json()
    _create_deployment(
        ready_client,
        application["id"],
        "another-version",
        {"branch": "branchXunderXscore"},
    )

    percent = ready_client.get("/deployments", params={"q": "%"})
    underscore = ready_client.get("/deployments", params={"q": "_"})

    assert [item["id"] for item in percent.json()["items"]] == [percent_match["id"]]
    assert [item["id"] for item in underscore.json()["items"]] == [underscore_match["id"]]


# Verifies global listing pagination, reverse insertion ordering, and total count.
def test_global_deployments_ordering_and_paging(
    ready_client: TestClient,
) -> None:
    """GET deployments sorts newest first with ID tie ordering and stable pages."""
    application = _create_application(ready_client, "Global pages").json()
    clock = MutableClock(datetime(2026, 10, 1, tzinfo=timezone.utc))
    created: list[dict[str, Any]] = []
    with _clock_override(ready_client, clock):
        for number in (5, 3, 1, 4, 2):
            clock.value = datetime(2026, 10, number, tzinfo=timezone.utc)
            created.append(
                _create_deployment(
                    ready_client,
                    application["id"],
                    f"page-{number}",
                ).json()
            )
        clock.value = datetime(2026, 10, 5, tzinfo=timezone.utc)
        created.append(
            _create_deployment(
                ready_client,
                application["id"],
                "page-tie",
            ).json()
        )
        full = ready_client.get("/deployments", params={"limit": 200})
        first_page = ready_client.get("/deployments", params={"limit": 2, "offset": 0})
        second_page = ready_client.get("/deployments", params={"limit": 2, "offset": 2})
        third_page = ready_client.get("/deployments", params={"limit": 2, "offset": 4})

    expected = sorted(created, key=lambda item: item["id"])
    expected = sorted(
        expected,
        key=lambda item: item["created_at"],
        reverse=True,
    )
    expected_ids = [item["id"] for item in expected]
    full_body = full.json()

    assert [item["id"] for item in full_body["items"]] == expected_ids
    assert [item["id"] for item in first_page.json()["items"]] == expected_ids[:2]
    assert [item["id"] for item in second_page.json()["items"]] == expected_ids[2:4]
    assert [item["id"] for item in third_page.json()["items"]] == expected_ids[4:6]
    assert first_page.json()["total"] == 6
    assert second_page.json()["total"] == 6
    assert second_page.json()["limit"] == 2
    assert second_page.json()["offset"] == 2


# Verifies global query values are validated after trimming and before SQL execution.
@pytest.mark.parametrize(
    ("params", "expected_status"),
    [
        ({"q": ""}, 422),
        ({"q": "   "}, 422),
        ({"q": "x" * 101}, 422),
        ({"q": "x" * 100}, 200),
        ({"status": "unknown"}, 422),
        ({"environment": "qa"}, 422),
        ({"limit": 0}, 422),
        ({"limit": 201}, 422),
        ({"offset": -1}, 422),
    ],
    ids=[
        "empty-query",
        "trimmed-empty-query",
        "query-too-long",
        "query-at-maximum",
        "invalid-status",
        "invalid-environment",
        "limit-zero",
        "limit-over-maximum",
        "offset-negative",
    ],
)
def test_global_deployments_query_validation(
    ready_client: TestClient,
    params: dict[str, object],
    expected_status: int,
) -> None:
    """GET deployments returns 422 for invalid filters and pagination."""
    response = ready_client.get("/deployments", params=params)

    assert response.status_code == expected_status


# Verifies an unknown global application filter returns an empty page.
def test_global_deployments_unknown_application_returns_empty_page(
    ready_client: TestClient,
) -> None:
    """GET deployments does not turn an unknown filter into a not-found error."""
    response = ready_client.get(
        "/deployments",
        params={"application_id": "00000000-0000-4000-8000-000000000000"},
    )

    assert response.status_code == 200
    assert response.json() == {"items": [], "total": 0, "limit": 50, "offset": 0}


# Verifies global-list SQL count stays fixed as unrelated rows grow.
def test_global_deployments_statement_count_does_not_scale_with_applications(
    ready_client: TestClient,
    in_memory_engine: Engine,
) -> None:
    """GET deployments uses a fixed number of statements for small and large data."""
    creation_time = datetime(2026, 10, 1, tzinfo=timezone.utc)
    with Session(in_memory_engine) as session:
        small_apps = [
            Application(
                name=f"Global count small {number}",
                environment=Environment.DEVELOPMENT,
                status=ApplicationStatus.UNKNOWN,
                created_at=creation_time,
                updated_at=creation_time,
            )
            for number in range(3)
        ]
        session.add_all(small_apps)
        session.flush()
        session.add_all(
            [
                Deployment(
                    application_id=application.id,
                    version=f"global-small-{number}",
                    status=DeploymentStatus.PENDING,
                    created_at=creation_time,
                )
                for number, application in enumerate(small_apps)
            ]
        )
        session.commit()

    small_count = _count_request_statements(
        in_memory_engine,
        lambda: ready_client.get("/deployments"),
    )

    with Session(in_memory_engine) as session:
        large_apps = [
            Application(
                name=f"Global count large {number}",
                environment=Environment.DEVELOPMENT,
                status=ApplicationStatus.UNKNOWN,
                created_at=creation_time,
                updated_at=creation_time,
            )
            for number in range(27)
        ]
        session.add_all(large_apps)
        session.flush()
        session.add_all(
            [
                Deployment(
                    application_id=application.id,
                    version=f"global-large-{application_index}-{deployment_index}",
                    status=DeploymentStatus.PENDING,
                    created_at=creation_time,
                )
                for application_index, application in enumerate(large_apps)
                for deployment_index in range(4)
            ]
        )
        session.commit()

    large_count = _count_request_statements(
        in_memory_engine,
        lambda: ready_client.get("/deployments"),
    )

    assert small_count == large_count


# Verifies DEBUG records include events but never caller-supplied field values.
def test_design_field_logs_exclude_query_image_branch_and_initiator(
    ready_client: TestClient,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Debug logs expose operation names without recording user text values."""
    image_marker = "imageprivacytoken"
    branch_marker = "branchprivacytoken"
    initiator_marker = "initiatorprivacytoken"
    query_marker = "branchprivacy"
    caplog.set_level(logging.DEBUG)
    application = _create_application(
        ready_client,
        "Log privacy application",
        {"image": f"ghcr.io/org/{image_marker}:v1"},
    ).json()
    _create_deployment(
        ready_client,
        application["id"],
        "private-version",
        {"branch": branch_marker, "initiator": initiator_marker},
    )

    client_loggers = [
        logging.getLogger(name)
        for name in ("httpx", "httpx2", "httpcore")
    ]
    original_levels = {logger: logger.level for logger in client_loggers}
    for client_logger in client_loggers:
        client_logger.setLevel(logging.WARNING)
    try:
        response = ready_client.get("/deployments", params={"q": query_marker})
    finally:
        for client_logger, level in original_levels.items():
            client_logger.setLevel(level)
    messages = [record.getMessage() for record in caplog.records]

    assert response.status_code == 200
    assert any("ApplicationService.create entry" in message for message in messages)
    assert any("list_global" in message for message in messages)
    for marker in (image_marker, branch_marker, initiator_marker, query_marker):
        assert all(marker not in message for message in messages)
