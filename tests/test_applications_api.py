"""Integration tests for the Applications HTTP endpoints."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from starlette.responses import Response

from app.services.clock import get_clock


# Posts one application payload and returns the HTTP response.
def _create_application(
    client: TestClient,
    name: str,
    environment: str = "development",
    status: str = "unknown",
    description: str | None = None,
) -> Response:
    """Create an application through the test client.

    Args:
        client: Applications API test client.
        name: Application name.
        environment: Application environment value.
        status: Application status value.
        description: Optional application description.

    Returns:
        The create response.
    """
    payload = {
        "name": name,
        "environment": environment,
        "status": status,
    }
    if description is not None:
        payload["description"] = description
    return client.post("/applications", json=payload)


# Verifies the primary create, read, list, update, and delete flow.
def test_applications_api_crud(ready_client: TestClient) -> None:
    """Applications API supports the complete CRUD lifecycle."""
    created = _create_application(ready_client, "Payments", description="Initial")
    assert created.status_code == 201
    application = created.json()
    application_id = application["id"]
    original_created_at = application["created_at"]

    assert ready_client.get(f"/applications/{application_id}").json() == application
    listing = ready_client.get("/applications").json()
    assert listing["total"] == 1
    assert listing["items"][0]["id"] == application_id

    patched = ready_client.patch(
        f"/applications/{application_id}",
        json={"description": "Changed", "status": "healthy"},
    )
    assert patched.status_code == 200
    assert patched.json()["created_at"] == original_created_at
    assert patched.json()["updated_at"] != original_created_at
    assert patched.json()["description"] == "Changed"

    assert ready_client.delete(f"/applications/{application_id}").status_code == 204
    assert ready_client.get(f"/applications/{application_id}").status_code == 404


# Verifies duplicate names map to a safe conflict response with headers.
def test_applications_api_duplicate_name_response(
    ready_client: TestClient,
) -> None:
    """Duplicate creation returns 409 with safe body and request ID."""
    assert _create_application(ready_client, "Payments").status_code == 201
    response = ready_client.post(
        "/applications",
        json={"name": "Payments", "environment": "staging"},
        headers={
            "Origin": "http://localhost:3000",
            "X-Request-ID": "duplicate-create",
        },
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "application name already exists"}
    assert response.headers["x-request-id"] == "duplicate-create"
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


# Verifies duplicate PATCH names and an application's own name behavior.
def test_applications_api_patch_name_rules(ready_client: TestClient) -> None:
    """PATCH rejects another application's name and allows its own name."""
    first = _create_application(ready_client, "First").json()
    second = _create_application(ready_client, "Second").json()

    conflict = ready_client.patch(
        f"/applications/{second['id']}",
        json={"name": "First"},
    )
    own_name = ready_client.patch(
        f"/applications/{first['id']}",
        json={"name": "First"},
    )

    assert conflict.status_code == 409
    assert conflict.json() == {"detail": "application name already exists"}
    assert own_name.status_code == 200


# Verifies explicit null description clears the stored description.
def test_applications_api_description_clear(ready_client: TestClient) -> None:
    """PATCH description null clears an existing description."""
    application = _create_application(
        ready_client,
        "Payments",
        description="Existing",
    ).json()

    response = ready_client.patch(
        f"/applications/{application['id']}",
        json={"description": None},
    )

    assert response.status_code == 200
    assert response.json()["description"] is None


# Verifies filters and empty filtered results in list responses.
def test_applications_api_filters_and_empty_list(ready_client: TestClient) -> None:
    """GET applications filters by environment and status."""
    _create_application(ready_client, "Staging", "staging", "degraded")
    _create_application(ready_client, "Production", "production", "healthy")

    filtered = ready_client.get(
        "/applications",
        params={"environment": "staging", "status": "degraded"},
    )
    empty = ready_client.get(
        "/applications",
        params={"environment": "development"},
    )

    assert filtered.json()["total"] == 1
    assert filtered.json()["items"][0]["name"] == "Staging"
    assert empty.json() == {"items": [], "total": 0, "limit": 50, "offset": 0}


# Verifies names are stripped and name length boundaries are enforced.
def test_applications_api_name_validation(ready_client: TestClient) -> None:
    """POST strips valid names and rejects blank or oversized names."""
    assert _create_application(ready_client, "  Payments  ").json()["name"] == "Payments"
    assert _create_application(ready_client, "a" * 100).status_code == 201
    assert _create_application(ready_client, "a" * 101).status_code == 422
    assert _create_application(ready_client, "   ").status_code == 422


# Verifies malformed enum, unknown, empty, and null PATCH payloads are 422.
def test_applications_api_payload_validation(ready_client: TestClient) -> None:
    """Applications API rejects invalid payload shapes and values."""
    invalid_enum = _create_application(ready_client, "Payments", "qa")
    unknown = ready_client.post(
        "/applications",
        json={"name": "Payments", "environment": "development", "extra": True},
    )
    empty_patch = ready_client.patch(
        "/applications/00000000-0000-4000-8000-000000000000",
        json={},
    )
    null_patch = ready_client.patch(
        "/applications/00000000-0000-4000-8000-000000000000",
        json={"status": None},
    )

    assert invalid_enum.status_code == 422
    assert unknown.status_code == 422
    assert empty_patch.status_code == 422
    assert null_patch.status_code == 422


# Verifies query pagination bounds at both ends of the allowed range.
@pytest.mark.parametrize(
    ("limit", "offset", "expected_status"),
    [(0, 0, 422), (1, 0, 200), (200, 0, 200), (201, 0, 422), (50, -1, 422)],
)
# Verifies each parameter combination receives the expected validation result.
def test_applications_api_pagination_bounds(
    ready_client: TestClient,
    limit: int,
    offset: int,
    expected_status: int,
) -> None:
    """GET applications enforces limit and offset bounds."""
    response = ready_client.get(
        "/applications",
        params={"limit": limit, "offset": offset},
    )

    assert response.status_code == expected_status


# Verifies malformed and missing identifiers use the domain 404 contract.
def test_applications_api_not_found_and_malformed_id(
    ready_client: TestClient,
) -> None:
    """Malformed and unknown application IDs return safe 404 responses."""
    malformed = ready_client.get("/applications/not-a-uuid")
    missing = ready_client.get("/applications/00000000-0000-4000-8000-000000000000")

    assert malformed.status_code == 404
    assert missing.status_code == 404
    assert malformed.json() == {"detail": "application not found"}
    assert missing.json() == {"detail": "application not found"}


# Provides a mutable callable clock for deterministic API timestamp tests.
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


# Overrides and reliably removes the application clock dependency.
@contextmanager
def _clock_override(
    client: TestClient,
    clock: MutableClock,
) -> Iterator[None]:
    """Temporarily override the application clock dependency.

    Args:
        client: Applications API test client.
        clock: Mutable deterministic clock.

    Yields:
        Control while the clock override is active.
    """
    client.app.dependency_overrides[get_clock] = lambda: clock
    try:
        yield
    finally:
        client.app.dependency_overrides.pop(get_clock, None)


# Verifies API list ordering uses the injected creation times.
def test_applications_api_lists_newest_first(ready_client: TestClient) -> None:
    """GET applications returns rows newest first."""
    clock = MutableClock(datetime(2026, 1, 1, tzinfo=timezone.utc))
    with _clock_override(ready_client, clock):
        for name, day in (("Oldest", 1), ("Middle", 2), ("Newest", 3)):
            clock.value = datetime(2026, 1, day, tzinfo=timezone.utc)
            assert _create_application(ready_client, name).status_code == 201
        listing = ready_client.get("/applications")

    assert [item["name"] for item in listing.json()["items"]] == [
        "Newest",
        "Middle",
        "Oldest",
    ]


# Verifies API page contents, totals, and an empty page beyond the end.
def test_applications_api_page_contents(ready_client: TestClient) -> None:
    """GET applications returns the requested page and total."""
    clock = MutableClock(datetime(2026, 1, 1, tzinfo=timezone.utc))
    with _clock_override(ready_client, clock):
        for number in range(1, 6):
            clock.value = datetime(2026, 1, number, tzinfo=timezone.utc)
            assert _create_application(ready_client, f"Application {number}").status_code == 201
        page = ready_client.get("/applications", params={"limit": 2, "offset": 2})
        final_page = ready_client.get("/applications", params={"limit": 2, "offset": 5})

    page_body = page.json()
    final_body = final_page.json()
    assert [item["name"] for item in page_body["items"]] == [
        "Application 3",
        "Application 2",
    ]
    assert page_body["total"] == 5
    assert page_body["limit"] == 2
    assert page_body["offset"] == 2
    assert final_body["items"] == []
    assert final_body["total"] == 5


# Verifies API creation and update timestamps use the injected clock exactly.
def test_applications_api_updated_at_uses_clock(ready_client: TestClient) -> None:
    """PATCH preserves created_at and sets updated_at to the clock value."""
    created_time = datetime(2026, 2, 1, tzinfo=timezone.utc)
    updated_time = datetime(2026, 2, 2, tzinfo=timezone.utc)
    clock = MutableClock(created_time)
    with _clock_override(ready_client, clock):
        created = _create_application(ready_client, "Payments")
        clock.value = updated_time
        updated = ready_client.patch(
            f"/applications/{created.json()['id']}",
            json={"description": "Updated"},
        )

    created_iso = created_time.isoformat().replace("+00:00", "Z")
    updated_iso = updated_time.isoformat().replace("+00:00", "Z")
    assert created.json()["created_at"] == created_iso
    assert updated.json()["created_at"] == created_iso
    assert updated.json()["updated_at"] == updated_iso


# Verifies missing PATCH and DELETE IDs return the safe 404 contract.
def test_applications_api_patch_and_delete_missing_id(
    ready_client: TestClient,
) -> None:
    """PATCH and DELETE missing IDs return safe details and request IDs."""
    missing_id = "00000000-0000-4000-8000-000000000000"
    patch_response = ready_client.patch(
        f"/applications/{missing_id}",
        json={"description": "missing"},
        headers={"X-Request-ID": "missing-patch"},
    )
    delete_response = ready_client.delete(
        f"/applications/{missing_id}",
        headers={"X-Request-ID": "missing-delete"},
    )

    for response, request_id in (
        (patch_response, "missing-patch"),
        (delete_response, "missing-delete"),
    ):
        assert response.status_code == 404
        assert response.json() == {"detail": "application not found"}
        assert response.headers["x-request-id"] == request_id


# Verifies deleting an application twice returns 204 then the safe 404.
def test_applications_api_delete_twice(ready_client: TestClient) -> None:
    """DELETE succeeds once and returns not found on the second call."""
    application = _create_application(ready_client, "Payments").json()
    path = f"/applications/{application['id']}"

    first = ready_client.delete(path)
    second = ready_client.delete(path)

    assert first.status_code == 204
    assert second.status_code == 404
    assert second.json() == {"detail": "application not found"}
