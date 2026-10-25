"""Integration tests for the Deployments HTTP endpoints."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from starlette.responses import Response

from app.services.clock import get_clock


# Provides a mutable callable clock for deterministic deployment API tests.
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


# Overrides and reliably removes the deployment clock dependency.
@contextmanager
def _clock_override(
    client: TestClient,
    clock: MutableClock,
) -> Iterator[None]:
    """Temporarily override the application clock dependency.

    Args:
        client: Deployment API test client.
        clock: Mutable deterministic clock.

    Yields:
        Control while the clock override is active.
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
        client: Deployment API test client.
        name: Application name.

    Returns:
        The create response.
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
    commit_sha: str | None = None,
) -> Response:
    """Create a deployment through the test client.

    Args:
        client: Deployment API test client.
        application_id: Parent application UUID string.
        version: Deployment version value.
        commit_sha: Optional commit SHA value.

    Returns:
        The create response.
    """
    payload: dict[str, str] = {"version": version}
    if commit_sha is not None:
        payload["commit_sha"] = commit_sha
    return client.post(f"/applications/{application_id}/deployments", json=payload)


# Asserts the shared error body, request ID, and CORS response contract.
def _assert_error_contract(
    response: Response,
    status_code: int,
    detail: str,
    request_id: str,
) -> None:
    """Check the public error response contract.

    Args:
        response: HTTP response under test.
        status_code: Expected HTTP status code.
        detail: Expected fixed error detail.
        request_id: Expected echoed request identifier.
    """
    assert response.status_code == status_code
    assert response.json() == {"detail": detail}
    assert response.headers["x-request-id"] == request_id
    assert response.headers["access-control-allow-origin"] == (
        "http://localhost:3000"
    )


# Verifies deployment creation returns a pending row with normalized values.
def test_deployments_api_create_pending(ready_client: TestClient) -> None:
    """POST deployments returns 201 with pending status and lower-case SHA."""
    clock = MutableClock(datetime(2026, 5, 1, tzinfo=timezone.utc))
    with _clock_override(ready_client, clock):
        application = _create_application(ready_client, "Deployment API Create").json()
        response = _create_deployment(
            ready_client,
            application["id"],
            " v1 ",
            "ABCDEF1",
        )

    assert response.status_code == 201
    body = response.json()
    assert body["application_id"] == application["id"]
    assert body["version"] == "v1"
    assert body["commit_sha"] == "abcdef1"
    assert body["status"] == "pending"


# Verifies missing application IDs use the fixed 404 contract.
def test_deployments_api_unknown_application_has_safe_error(
    ready_client: TestClient,
) -> None:
    """POST for an unknown application returns 404 with required headers."""
    missing_id = "00000000-0000-4000-8000-000000000000"
    response = ready_client.post(
        f"/applications/{missing_id}/deployments",
        json={"version": "v1"},
        headers={
            "Origin": "http://localhost:3000",
            "X-Request-ID": "deployment-unknown-application",
        },
    )

    _assert_error_contract(
        response,
        404,
        "application not found",
        "deployment-unknown-application",
    )


# Verifies malformed and unknown deployment IDs use the deployment 404 detail.
def test_deployments_api_missing_deployment_has_safe_error(
    ready_client: TestClient,
) -> None:
    """GET malformed and unknown IDs returns safe 404 responses."""
    missing_id = "00000000-0000-4000-8000-000000000000"
    headers = {
        "Origin": "http://localhost:3000",
        "X-Request-ID": "deployment-missing",
    }
    malformed = ready_client.get("/deployments/not-a-uuid", headers=headers)
    unknown = ready_client.get(f"/deployments/{missing_id}", headers=headers)

    _assert_error_contract(malformed, 404, "deployment not found", "deployment-missing")
    _assert_error_contract(unknown, 404, "deployment not found", "deployment-missing")


# Verifies create and status payload validation return 422 with headers.
def test_deployments_api_payload_validation(ready_client: TestClient) -> None:
    """Reject invalid version, SHA, status, and unknown create fields."""
    application = _create_application(ready_client, "Deployment API Validation").json()
    application_id = application["id"]
    headers = {
        "Origin": "http://localhost:3000",
        "X-Request-ID": "deployment-validation",
    }
    invalid_version = _create_deployment(ready_client, application_id, " ")
    invalid_sha = _create_deployment(
        ready_client,
        application_id,
        "v1",
        "a" * 6,
    )
    extra_status = ready_client.post(
        f"/applications/{application_id}/deployments",
        json={"version": "v1", "status": "pending"},
        headers=headers,
    )

    for response in (invalid_version, invalid_sha, extra_status):
        assert response.status_code == 422
    assert extra_status.headers["x-request-id"] == "deployment-validation"
    assert extra_status.headers["access-control-allow-origin"] == (
        "http://localhost:3000"
    )


# Verifies status filtering, empty results, and list pagination bounds.
def test_deployments_api_lists_filters_and_empty_results(
    ready_client: TestClient,
) -> None:
    """GET deployments filters by status and returns empty pages safely."""
    clock = MutableClock(datetime(2026, 6, 1, tzinfo=timezone.utc))
    with _clock_override(ready_client, clock):
        application = _create_application(ready_client, "Deployment API Filters").json()
        first = _create_deployment(ready_client, application["id"], "v1").json()
        clock.value = datetime(2026, 6, 2, tzinfo=timezone.utc)
        second = _create_deployment(ready_client, application["id"], "v2").json()
        clock.value = datetime(2026, 6, 3, tzinfo=timezone.utc)
        _create_deployment(ready_client, application["id"], "v3")
        running = ready_client.patch(
            f"/deployments/{first['id']}/status",
            json={"status": "running"},
        )
        assert running.status_code == 200
        filtered = ready_client.get(
            f"/applications/{application['id']}/deployments",
            params={"status": "running"},
        )
        empty = ready_client.get(
            f"/applications/{application['id']}/deployments",
            params={"status": "failed"},
        )

    assert [item["id"] for item in filtered.json()["items"]] == [first["id"]]
    assert filtered.json()["total"] == 1
    assert empty.json() == {"items": [], "total": 0, "limit": 50, "offset": 0}
    assert second["status"] == "pending"


# Verifies query pagination bounds at both ends of the allowed range.
@pytest.mark.parametrize(
    ("limit", "offset", "expected_status"),
    [(0, 0, 422), (1, 0, 200), (200, 0, 200), (201, 0, 422), (50, -1, 422)],
)
# Verifies each deployment pagination combination receives the expected result.
def test_deployments_api_pagination_bounds(
    ready_client: TestClient,
    limit: int,
    offset: int,
    expected_status: int,
) -> None:
    """GET deployments enforces limit and offset bounds."""
    application = _create_application(
        ready_client,
        "Deployment API Page %d %d" % (limit, offset),
    ).json()
    response = ready_client.get(
        f"/applications/{application['id']}/deployments",
        params={"limit": limit, "offset": offset},
    )

    assert response.status_code == expected_status


# Verifies injected timestamps control newest-first ordering and page contents.
def test_deployments_api_page_contents_and_newest_first(
    ready_client: TestClient,
) -> None:
    """GET deployments returns deterministic newest-first page content."""
    clock = MutableClock(datetime(2026, 7, 1, tzinfo=timezone.utc))
    with _clock_override(ready_client, clock):
        application = _create_application(ready_client, "Deployment API Pages").json()
        for number in range(1, 6):
            clock.value = datetime(2026, 7, number, tzinfo=timezone.utc)
            assert _create_deployment(
                ready_client,
                application["id"],
                "page-%d" % number,
            ).status_code == 201
        page = ready_client.get(
            f"/applications/{application['id']}/deployments",
            params={"limit": 2, "offset": 2},
        )
        empty_page = ready_client.get(
            f"/applications/{application['id']}/deployments",
            params={"limit": 2, "offset": 5},
        )
        newest = ready_client.get(
            f"/applications/{application['id']}/deployments",
        )

    page_body = page.json()
    assert [item["version"] for item in page_body["items"]] == [
        "page-3",
        "page-2",
    ]
    assert page_body["total"] == 5
    assert page_body["limit"] == 2
    assert page_body["offset"] == 2
    assert empty_page.json()["items"] == []
    assert empty_page.json()["total"] == 5
    assert [item["version"] for item in newest.json()["items"]] == [
        "page-5",
        "page-4",
        "page-3",
        "page-2",
        "page-1",
    ]


# Verifies the full lifecycle timestamps use exact injected values.
def test_deployments_api_patch_lifecycle_uses_clock(
    ready_client: TestClient,
) -> None:
    """PATCH lifecycle transitions set exact started and finished timestamps."""
    created_at = datetime(2026, 8, 1, tzinfo=timezone.utc)
    running_at = datetime(2026, 8, 2, tzinfo=timezone.utc)
    succeeded_at = datetime(2026, 8, 3, tzinfo=timezone.utc)
    rollback_at = datetime(2026, 8, 4, tzinfo=timezone.utc)
    clock = MutableClock(created_at)
    with _clock_override(ready_client, clock):
        application = _create_application(ready_client, "Deployment API Lifecycle").json()
        created = _create_deployment(
            ready_client,
            application["id"],
            "v1",
        ).json()
        clock.value = running_at
        running = ready_client.patch(
            f"/deployments/{created['id']}/status",
            json={"status": "running"},
        ).json()
        clock.value = succeeded_at
        succeeded = ready_client.patch(
            f"/deployments/{created['id']}/status",
            json={"status": "succeeded"},
        ).json()
        clock.value = rollback_at
        rolled_back = ready_client.patch(
            f"/deployments/{created['id']}/status",
            json={"status": "rolled_back"},
        ).json()

    assert created["created_at"] == created_at.isoformat().replace("+00:00", "Z")
    assert running["started_at"] == running_at.isoformat().replace("+00:00", "Z")
    assert succeeded["finished_at"] == succeeded_at.isoformat().replace("+00:00", "Z")
    assert rolled_back["status"] == "rolled_back"
    assert rolled_back["finished_at"] == succeeded["finished_at"]


# Verifies forbidden status transitions return the fixed conflict contract.
def test_deployments_api_forbidden_transition_has_safe_error(
    ready_client: TestClient,
) -> None:
    """PATCH forbidden transitions return 409 with headers."""
    application = _create_application(ready_client, "Deployment API Conflict").json()
    deployment = _create_deployment(
        ready_client,
        application["id"],
        "v1",
    ).json()
    response = ready_client.patch(
        f"/deployments/{deployment['id']}/status",
        json={"status": "succeeded"},
        headers={
            "Origin": "http://localhost:3000",
            "X-Request-ID": "deployment-conflict",
        },
    )

    _assert_error_contract(
        response,
        409,
        "invalid status transition",
        "deployment-conflict",
    )


# Verifies deleting an application cascades to its deployments.
def test_deployments_api_application_delete_cascades(
    ready_client: TestClient,
) -> None:
    """Deleting a parent makes its deployment return the deployment 404."""
    application = _create_application(ready_client, "Deployment API Cascade").json()
    deployment = _create_deployment(
        ready_client,
        application["id"],
        "v1",
    ).json()
    assert ready_client.delete(f"/applications/{application['id']}").status_code == 204

    response = ready_client.get(
        f"/deployments/{deployment['id']}",
        headers={
            "Origin": "http://localhost:3000",
            "X-Request-ID": "deployment-cascade",
        },
    )

    _assert_error_contract(
        response,
        404,
        "deployment not found",
        "deployment-cascade",
    )


# Verifies PATCH status payloads reject invalid and extra fields.
def test_deployments_api_patch_rejects_invalid_status_payloads(
    ready_client: TestClient,
) -> None:
    """Return 422 for unsupported statuses and unknown status fields."""
    application = _create_application(
        ready_client,
        "Deployment API Invalid Status",
    ).json()
    deployment = _create_deployment(
        ready_client,
        application["id"],
        "v1",
    ).json()
    invalid_status = ready_client.patch(
        f"/deployments/{deployment['id']}/status",
        json={"status": "paused"},
    )
    extra_field = ready_client.patch(
        f"/deployments/{deployment['id']}/status",
        json={"status": "running", "extra": 1},
    )

    assert invalid_status.status_code == 422
    assert extra_field.status_code == 422


# Verifies a well-formed missing deployment ID uses the safe 404 contract.
def test_deployments_api_patch_missing_deployment_has_safe_error(
    ready_client: TestClient,
) -> None:
    """PATCH an unknown deployment returns its fixed error and headers."""
    missing_id = "00000000-0000-4000-8000-000000000000"
    response = ready_client.patch(
        f"/deployments/{missing_id}/status",
        json={"status": "running"},
        headers={
            "Origin": "http://localhost:3000",
            "X-Request-ID": "deployment-patch-missing",
        },
    )

    _assert_error_contract(
        response,
        404,
        "deployment not found",
        "deployment-patch-missing",
    )


# Verifies listing an unknown application's deployments uses the safe 404 contract.
def test_deployments_api_list_missing_application_has_safe_error(
    ready_client: TestClient,
) -> None:
    """GET deployments for an unknown application returns fixed error headers."""
    missing_id = "00000000-0000-4000-8000-000000000000"
    response = ready_client.get(
        f"/applications/{missing_id}/deployments",
        headers={
            "Origin": "http://localhost:3000",
            "X-Request-ID": "deployment-list-missing-application",
        },
    )

    _assert_error_contract(
        response,
        404,
        "application not found",
        "deployment-list-missing-application",
    )


# Verifies PATCH rejects a running-to-running transition with its safe contract.
def test_deployments_api_same_state_transition_has_safe_error(
    ready_client: TestClient,
) -> None:
    """PATCH running to running returns 409 with required response headers."""
    application = _create_application(
        ready_client,
        "Deployment API Same State",
    ).json()
    deployment = _create_deployment(
        ready_client,
        application["id"],
        "v1",
    ).json()
    started = ready_client.patch(
        f"/deployments/{deployment['id']}/status",
        json={"status": "running"},
    )
    assert started.status_code == 200

    response = ready_client.patch(
        f"/deployments/{deployment['id']}/status",
        json={"status": "running"},
        headers={
            "Origin": "http://localhost:3000",
            "X-Request-ID": "deployment-same-state",
        },
    )

    _assert_error_contract(
        response,
        409,
        "invalid status transition",
        "deployment-same-state",
    )


# Verifies failed lifecycle timestamps are exact and preserved on rollback.
def test_deployments_api_failed_lifecycle_uses_clock(
    ready_client: TestClient,
) -> None:
    """Preserve the first finished timestamp through rollback after failure."""
    created_at = datetime(2026, 9, 1, tzinfo=timezone.utc)
    running_at = datetime(2026, 9, 2, tzinfo=timezone.utc)
    failed_at = datetime(2026, 9, 3, tzinfo=timezone.utc)
    rollback_at = datetime(2026, 9, 4, tzinfo=timezone.utc)
    clock = MutableClock(created_at)
    with _clock_override(ready_client, clock):
        application = _create_application(
            ready_client,
            "Deployment API Failed Lifecycle",
        ).json()
        created = _create_deployment(
            ready_client,
            application["id"],
            "v1",
        ).json()
        clock.value = running_at
        running = ready_client.patch(
            f"/deployments/{created['id']}/status",
            json={"status": "running"},
        ).json()
        clock.value = failed_at
        failed = ready_client.patch(
            f"/deployments/{created['id']}/status",
            json={"status": "failed"},
        ).json()
        clock.value = rollback_at
        rolled_back = ready_client.patch(
            f"/deployments/{created['id']}/status",
            json={"status": "rolled_back"},
        ).json()

    assert created["status"] == "pending"
    assert created["created_at"] == created_at.isoformat().replace("+00:00", "Z")
    assert running["status"] == "running"
    assert running["started_at"] == running_at.isoformat().replace("+00:00", "Z")
    assert failed["status"] == "failed"
    assert failed["started_at"] == running["started_at"]
    assert failed["finished_at"] == failed_at.isoformat().replace("+00:00", "Z")
    assert rolled_back["status"] == "rolled_back"
    assert rolled_back["started_at"] == running["started_at"]
    assert rolled_back["finished_at"] == failed["finished_at"]
