"""Additional route-level tests with custom environment variables.

Complements the original ``test_main.py`` suite with env-var-driven
configuration tests for ``/health`` and ``/version``.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


# Removes app env vars so each test starts clean.
def _clean_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Remove all app-specific env vars so each test starts clean."""
    for var in ("APP_NAME", "APP_VERSION", "PORT", "CORS_ORIGINS", "LOG_LEVEL"):
        monkeypatch.delenv(var, raising=False)


# GET /health is independent of APP_NAME / APP_VERSION.
class TestHealthWithCustomEnv:
    """GET /health is independent of APP_NAME / APP_VERSION."""

# Health response is always {"status": "ok"} regardless of env.
    def test_health_ignores_custom_name(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Health response is always {"status":"ok"} regardless of env."""
        _clean_env(monkeypatch)
        monkeypatch.setenv("APP_NAME", "Totally Different")
        monkeypatch.setenv("APP_VERSION", "99.0.0")
        client = TestClient(create_app())

        response = client.get("/health")

        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


# GET /version reflects the current APP_NAME and APP_VERSION.
class TestVersionWithCustomEnv:
    """GET /version reflects the current APP_NAME and APP_VERSION."""

# Custom env vars are reflected in the version response.
    def test_version_with_custom_env(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Custom env vars are reflected in the version response."""
        _clean_env(monkeypatch)
        monkeypatch.setenv("APP_NAME", "Staging Service")
        monkeypatch.setenv("APP_VERSION", "2.5.0-rc1")
        client = TestClient(create_app())

        response = client.get("/version")

        assert response.status_code == 200
        assert response.json() == {
            "name": "Staging Service",
            "version": "2.5.0-rc1",
        }

# Whitespace around APP_NAME is stripped before use.
    def test_version_name_trimmed(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Whitespace around APP_NAME is stripped before use."""
        _clean_env(monkeypatch)
        monkeypatch.setenv("APP_NAME", "  Padded Name  ")
        client = TestClient(create_app())

        response = client.get("/version")

        assert response.json()["name"] == "Padded Name"


# GET / reflects the current APP_NAME.
class TestRootWithCustomEnv:
    """GET / reflects the current APP_NAME."""

# The root message includes the custom APP_NAME.
    def test_root_message_uses_custom_name(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """The root message includes the custom APP_NAME."""
        _clean_env(monkeypatch)
        monkeypatch.setenv("APP_NAME", "My API")
        client = TestClient(create_app())

        data = client.get("/").json()

        assert data["name"] == "My API"
        assert data["message"] == "My API API is running."

