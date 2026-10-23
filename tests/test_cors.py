"""Tests for CORS middleware behaviour.

Validates that allowed origins receive proper CORS headers, unknown
origins are blocked, and environment overrides are respected.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


def _clean_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Remove all app-specific env vars so each test starts clean."""
    for var in ("APP_NAME", "APP_VERSION", "PORT", "CORS_ORIGINS", "LOG_LEVEL"):
        monkeypatch.delenv(var, raising=False)


class TestCorsAllowed:
    """Requests from allowed origins get CORS response headers."""

    def test_localhost_3000_allowed(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """The default origin http://localhost:3000 is allowed."""
        _clean_env(monkeypatch)
        client = TestClient(create_app())

        response = client.get("/", headers={"Origin": "http://localhost:3000"})

        assert response.status_code == 200
        assert (
            response.headers["access-control-allow-origin"]
            == "http://localhost:3000"
        )

    def test_127_0_0_1_3000_allowed(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """The default origin http://127.0.0.1:3000 is allowed."""
        _clean_env(monkeypatch)
        client = TestClient(create_app())

        response = client.get(
            "/health", headers={"Origin": "http://127.0.0.1:3000"}
        )

        assert response.status_code == 200
        assert (
            response.headers["access-control-allow-origin"]
            == "http://127.0.0.1:3000"
        )


class TestCorsBlocked:
    """Requests from unknown origins do not receive CORS headers."""

    def test_unknown_origin_no_cors_header(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """An origin not in the allow-list gets no CORS headers."""
        _clean_env(monkeypatch)
        client = TestClient(create_app())

        response = client.get(
            "/", headers={"Origin": "http://evil.example.com"}
        )

        # The request still succeeds (CORS is enforced by browsers, not
        # the server), but no allow-origin header is present.
        assert response.status_code == 200
        assert "access-control-allow-origin" not in response.headers


class TestCorsEnvOverride:
    """CORS_ORIGINS env var overrides the compiled-in defaults."""

    def test_custom_origin_allowed(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """A custom CORS_ORIGINS value allows the specified origin."""
        _clean_env(monkeypatch)
        monkeypatch.setenv("CORS_ORIGINS", "https://app.example.com")
        client = TestClient(create_app())

        response = client.get(
            "/", headers={"Origin": "https://app.example.com"}
        )

        assert (
            response.headers["access-control-allow-origin"]
            == "https://app.example.com"
        )

    def test_default_origin_blocked_after_override(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """The compiled-in default is blocked when CORS_ORIGINS is overridden."""
        _clean_env(monkeypatch)
        monkeypatch.setenv("CORS_ORIGINS", "https://app.example.com")
        client = TestClient(create_app())

        response = client.get(
            "/", headers={"Origin": "http://localhost:3000"}
        )

        assert "access-control-allow-origin" not in response.headers

    def test_wildcard_falls_back_to_defaults(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """CORS_ORIGINS='*' falls back to defaults, not open access."""
        _clean_env(monkeypatch)
        monkeypatch.setenv("CORS_ORIGINS", "*")
        client = TestClient(create_app())

        # Default origin should still work
        response = client.get(
            "/", headers={"Origin": "http://localhost:3000"}
        )
        assert (
            response.headers["access-control-allow-origin"]
            == "http://localhost:3000"
        )

        # Random origin should be blocked
        response2 = client.get(
            "/", headers={"Origin": "http://attacker.example.com"}
        )
        assert "access-control-allow-origin" not in response2.headers

