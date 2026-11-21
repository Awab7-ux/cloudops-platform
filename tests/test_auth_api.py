"""Authentication and authorization integration tests."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt
from fastapi.testclient import TestClient
import pytest

from app.core.auth import create_access_token
from app.models.user import UserRole
from app.repositories.user import UserRepository
from app.services.user import UserService


def _create_viewer(client: TestClient) -> str:
    session_factory = client.app.state.test_session_factory
    with session_factory() as session:
        user = UserService(UserRepository(session)).create_user(
            "test-viewer",
            "test-viewer-password",
            UserRole.VIEWER,
        )
        return create_access_token(user, client.app.state.settings)


def test_login_success_and_me(ready_client: TestClient) -> None:
    login = ready_client.post(
        "/auth/login",
        json={"username": "test-admin", "password": "test-admin-password"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    assert login.json()["token_type"] == "bearer"
    assert login.json()["expires_in"] == 1800
    claims = jwt.decode(
        token,
        ready_client.app.state.settings.jwt_secret,
        algorithms=["HS256"],
    )
    profile = ready_client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert claims["role"] == "admin"
    assert claims["sub"] == profile.json()["id"]
    assert claims["exp"] > datetime.now(timezone.utc).timestamp()

    assert profile.status_code == 200
    assert profile.json()["username"] == "test-admin"
    assert profile.json()["role"] == "admin"
    assert "password_hash" not in profile.json()


def test_login_failure_is_generic(ready_client: TestClient) -> None:
    response = ready_client.post(
        "/auth/login",
        json={"username": "test-admin", "password": "wrong-password"},
    )
    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid credentials"}


def test_missing_token_returns_safe_401_with_request_id(
    unauthenticated_client: TestClient,
) -> None:
    response = unauthenticated_client.get(
        "/applications",
        headers={"X-Request-ID": "auth-missing-token"},
    )
    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid authentication credentials"}
    assert response.headers["x-request-id"] == "auth-missing-token"


def test_expired_and_tampered_tokens_return_401(
    unauthenticated_client: TestClient,
) -> None:
    settings = unauthenticated_client.app.state.settings
    expired = jwt.encode(
        {
            "sub": "unused-user",
            "role": "admin",
            "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
        },
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    with unauthenticated_client.app.state.test_session_factory() as session:
        admin = UserRepository(session).get_by_username("test-admin")
        assert admin is not None
        token = create_access_token(admin, settings)
    header, payload, signature = token.split(".")
    replacement = "a" if signature[0] != "a" else "b"
    tampered = f"{header}.{payload}.{replacement}{signature[1:]}"

    for candidate in (expired, tampered):
        response = unauthenticated_client.get(
            "/applications",
            headers={"Authorization": f"Bearer {candidate}"},
        )
        assert response.status_code == 401


def test_viewer_cannot_write_but_admin_can(
    ready_client: TestClient,
) -> None:
    response = ready_client.get("/applications")
    application_id = response.json()["items"][0]["id"] if response.json()["items"] else None
    if application_id is None:
        created = ready_client.post(
            "/applications",
            json={"name": "Auth test application", "environment": "development"},
        )
        assert created.status_code == 201
        application_id = created.json()["id"]

    viewer_token = _create_viewer(ready_client)
    viewer_read = ready_client.get(
        "/applications",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    viewer_write = ready_client.patch(
        f"/applications/{application_id}",
        json={"description": "viewer cannot change this"},
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    admin_write = ready_client.patch(
        f"/applications/{application_id}",
        json={"description": "admin update"},
    )

    assert viewer_read.status_code == 200
    assert viewer_write.status_code == 403
    assert viewer_write.json() == {"detail": "Insufficient permissions"}
    assert admin_write.status_code == 200
    assert admin_write.json()["description"] == "admin update"


def test_health_ready_version_and_metrics_remain_public(
    unauthenticated_client: TestClient,
) -> None:
    for path in ("/health", "/ready", "/version", "/metrics"):
        response = unauthenticated_client.get(path)
        assert response.status_code == 200


def test_initial_admin_is_seeded_only_for_an_empty_database(
    app,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("ADMIN_USERNAME", "bootstrap-admin")
    monkeypatch.setenv("ADMIN_PASSWORD", "bootstrap-password")
    with TestClient(app) as client:
        response = client.post(
            "/auth/login",
            json={"username": "bootstrap-admin", "password": "bootstrap-password"},
        )
    assert response.status_code == 200
