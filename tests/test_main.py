"""Tests for the system routes and application factory behavior."""
import pytest
from fastapi.testclient import TestClient

from app.main import (
    DEFAULT_APP_NAME,
    DEFAULT_APP_VERSION,
    create_app,
)


# TestClient fixture backed by a fresh create_app() instance.
@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    """TestClient fixture backed by a fresh create_app() instance."""
    monkeypatch.delenv("APP_NAME", raising=False)
    monkeypatch.delenv("APP_VERSION", raising=False)
    return TestClient(create_app())


# GET / returns the default service name and running message.
def test_root_returns_service_information(client: TestClient) -> None:
    """GET / returns the default service name and running message."""
    response = client.get("/")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    assert response.json() == {
        "name": DEFAULT_APP_NAME,
        "message": "CloudOps Platform API is running.",
    }


# GET /health returns {"status": "ok"}.
def test_health_returns_healthy_status(client: TestClient) -> None:
    """GET /health returns {"status": "ok"}."""
    response = client.get("/health")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    assert response.json() == {"status": "ok"}


# GET /version returns the default name and version.
def test_version_returns_default_service_version(client: TestClient) -> None:
    """GET /version returns the default name and version."""
    response = client.get("/version")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    assert response.json() == {
        "name": DEFAULT_APP_NAME,
        "version": DEFAULT_APP_VERSION,
    }


# Overriding APP_NAME and APP_VERSION is reflected in route responses.
def test_environment_variables_configure_service(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Overriding APP_NAME and APP_VERSION is reflected in route responses."""
    monkeypatch.setenv("APP_NAME", "CloudOps Staging")
    monkeypatch.setenv("APP_VERSION", "1.2.3")
    client = TestClient(create_app())

    assert client.get("/").json()["name"] == "CloudOps Staging"
    assert client.get("/version").json() == {
        "name": "CloudOps Staging",
        "version": "1.2.3",
    }


# GET /unknown returns 404 with a JSON content type.
def test_unknown_route_returns_not_found(client: TestClient) -> None:
    """GET /unknown returns 404 with a JSON content type."""
    response = client.get("/unknown")

    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/json")
