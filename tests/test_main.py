import pytest
from fastapi.testclient import TestClient

from app.main import (
    DEFAULT_APP_NAME,
    DEFAULT_APP_VERSION,
    create_app,
)


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.delenv("APP_NAME", raising=False)
    monkeypatch.delenv("APP_VERSION", raising=False)
    return TestClient(create_app())


def test_root_returns_service_information(client: TestClient) -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    assert response.json() == {
        "name": DEFAULT_APP_NAME,
        "message": "CloudOps Platform API is running.",
    }


def test_health_returns_healthy_status(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    assert response.json() == {"status": "ok"}


def test_version_returns_default_service_version(client: TestClient) -> None:
    response = client.get("/version")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    assert response.json() == {
        "name": DEFAULT_APP_NAME,
        "version": DEFAULT_APP_VERSION,
    }


def test_environment_variables_configure_service(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("APP_NAME", "CloudOps Staging")
    monkeypatch.setenv("APP_VERSION", "1.2.3")
    client = TestClient(create_app())

    assert client.get("/").json()["name"] == "CloudOps Staging"
    assert client.get("/version").json() == {
        "name": "CloudOps Staging",
        "version": "1.2.3",
    }


def test_unknown_route_returns_not_found(client: TestClient) -> None:
    response = client.get("/unknown")

    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/json")
