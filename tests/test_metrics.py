"""Tests for real Prometheus request and database metrics."""

from fastapi.testclient import TestClient
from prometheus_client.parser import text_string_to_metric_families

def _samples(text: str) -> list[tuple[str, dict[str, str], float]]:
    """Flatten metric families into sample names, labels, and values."""
    return [
        (sample.name, sample.labels, sample.value)
        for family in text_string_to_metric_families(text)
        for sample in family.samples
    ]


def test_metrics_count_real_requests_and_ignore_scrapes(
    ready_client: TestClient,
) -> None:
    """The scrape includes actual routes but does not count /metrics itself."""
    assert ready_client.get("/health").status_code == 200
    response = ready_client.get("/metrics")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/plain")
    samples = _samples(response.text)
    assert (
        "cloudops_http_requests_total",
        {"method": "GET", "route": "/health", "status_code": "200"},
        1.0,
    ) in samples
    assert any(
        name == "cloudops_http_request_duration_seconds_count"
        and labels == {"method": "GET", "route": "/health"}
        and value == 1.0
        for name, labels, value in samples
    )
    assert not any(
        labels.get("route") == "/metrics"
        for _, labels, _ in samples
    )


def test_metrics_refresh_operational_gauges_from_database(
    ready_client: TestClient,
) -> None:
    """Database gauges match real applications and deployments at scrape time."""
    application_response = ready_client.post(
        "/applications",
        json={
            "name": "metrics-test-app",
            "environment": "development",
            "status": "healthy",
        },
    )
    assert application_response.status_code == 201
    application_id = application_response.json()["id"]

    deployment_response = ready_client.post(
        f"/applications/{application_id}/deployments",
        json={"version": "1.0.0"},
    )
    assert deployment_response.status_code == 201

    response = ready_client.get("/metrics")
    assert response.status_code == 200
    samples = _samples(response.text)
    assert ("cloudops_applications_total", {}, 1.0) in samples
    assert (
        "cloudops_applications_by_status",
        {"status": "healthy"},
        1.0,
    ) in samples
    assert ("cloudops_deployments_total", {}, 1.0) in samples
    assert (
        "cloudops_deployments_by_status",
        {"status": "pending"},
        1.0,
    ) in samples
    assert (
        "cloudops_active_alerts",
        {"type": "deployment_failed"},
        0.0,
    ) in samples
    assert (
        "cloudops_active_alerts",
        {"type": "deployment_stuck"},
        0.0,
    ) in samples
    assert (
        "cloudops_active_alerts",
        {"type": "error_log_spike"},
        0.0,
    ) in samples


def test_metrics_publish_current_derived_alerts_and_clear_resolved_types(
    ready_client: TestClient,
) -> None:
    """Prometheus alert gauges reflect current backend rules, not stale values."""
    application_response = ready_client.post(
        "/applications",
        json={
            "name": "metrics-alert-app",
            "environment": "development",
            "status": "healthy",
        },
    )
    application_id = application_response.json()["id"]
    failed_response = ready_client.post(
        f"/applications/{application_id}/deployments",
        json={"version": "1.0.0"},
    )
    failed_id = failed_response.json()["id"]
    ready_client.patch(
        f"/deployments/{failed_id}/status",
        json={"status": "running"},
    )
    ready_client.patch(
        f"/deployments/{failed_id}/status",
        json={"status": "failed"},
    )
    for index in range(5):
        ready_client.post(
            f"/applications/{application_id}/logs",
            json={"level": "error", "message": f"error-{index}"},
        )

    active_samples = _samples(ready_client.get("/metrics").text)
    assert (
        "cloudops_active_alerts",
        {"type": "deployment_failed"},
        1.0,
    ) in active_samples
    assert (
        "cloudops_active_alerts",
        {"type": "error_log_spike"},
        1.0,
    ) in active_samples

    succeeded_response = ready_client.post(
        f"/applications/{application_id}/deployments",
        json={"version": "1.0.1"},
    )
    succeeded_id = succeeded_response.json()["id"]
    ready_client.patch(
        f"/deployments/{succeeded_id}/status",
        json={"status": "running"},
    )
    ready_client.patch(
        f"/deployments/{succeeded_id}/status",
        json={"status": "succeeded"},
    )

    resolved_samples = _samples(ready_client.get("/metrics").text)
    assert (
        "cloudops_active_alerts",
        {"type": "deployment_failed"},
        0.0,
    ) in resolved_samples
    assert (
        "cloudops_active_alerts",
        {"type": "error_log_spike"},
        1.0,
    ) in resolved_samples
