"""Tests for CORS middleware behaviour.

Validates that allowed origins receive proper CORS headers, unknown
origins are blocked, and environment overrides are respected.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


# Removes app env vars so each test starts clean.
# Removes app env vars so CORS tests use deterministic defaults.
def _clean_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Remove all app-specific env vars so each test starts clean."""
    for var in ("APP_NAME", "APP_VERSION", "PORT", "CORS_ORIGINS", "LOG_LEVEL"):
        monkeypatch.delenv(var, raising=False)


# Verifies browser preflight behavior for every method exposed by routes.
@pytest.mark.parametrize("method", ["GET", "POST", "PATCH", "DELETE"])
def test_allowed_methods_accept_content_type_preflight(
    monkeypatch: pytest.MonkeyPatch, method: str
) -> None:
    """Allowed route methods accept JSON preflight requests."""
    _clean_env(monkeypatch)
    client = TestClient(create_app())

    response = client.options(
        "/applications",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": method,
            "Access-Control-Request-Headers": "content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == (
        "http://localhost:3000"
    )
    assert method in response.headers["access-control-allow-methods"]
    assert "content-type" in response.headers[
        "access-control-allow-headers"
    ].lower()


# Blocks CORS preflight requests from origins outside the configured list.
def test_preflight_from_disallowed_origin_has_no_allow_origin(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A disallowed origin receives no allow-origin header."""
    _clean_env(monkeypatch)
    client = TestClient(create_app())

    response = client.options(
        "/applications",
        headers={
            "Origin": "http://evil.example",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )

    assert "access-control-allow-origin" not in response.headers


# Ensures methods not used by routes are excluded from preflight approval.
def test_preflight_rejects_unused_put_method(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """PUT is not allowed because no API route uses it."""
    _clean_env(monkeypatch)
    client = TestClient(create_app())

    response = client.options(
        "/applications",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "PUT",
            "Access-Control-Request-Headers": "content-type",
        },
    )

    assert "PUT" not in response.headers.get(
        "access-control-allow-methods", ""
    )


# Preserves CORS access to ordinary GET responses without credentials.
def test_simple_get_allows_origin_without_credentials(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A simple GET allows the frontend origin without credentials."""
    _clean_env(monkeypatch)
    client = TestClient(create_app())

    response = client.get("/", headers={"Origin": "http://localhost:3000"})

    assert response.headers["access-control-allow-origin"] == (
        "http://localhost:3000"
    )
    assert "access-control-allow-credentials" not in response.headers


# Keeps the explicit request-header policy restricted to Content-Type.
def test_only_content_type_is_configured_as_an_allowed_header(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The CORS middleware explicitly allows only Content-Type."""
    _clean_env(monkeypatch)
    application = create_app()
    cors_middleware = next(
        middleware
        for middleware in application.user_middleware
        if middleware.cls.__name__ == "CORSMiddleware"
    )

    assert cors_middleware.kwargs["allow_headers"] == ["Content-Type"]


# Allowed origins receive CORS allow-origin headers.
class TestCorsAllowed:
    """Requests from allowed origins get CORS response headers."""

# http://localhost:3000 is allowed by default.
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

# http://127.0.0.1:3000 is allowed by default.
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


# Unknown origins get no CORS headers.
class TestCorsBlocked:
    """Requests from unknown origins do not receive CORS headers."""

# Non-allow-listed origin gets no access-control-allow-origin.
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


# CORS_ORIGINS overrides the compiled-in defaults.
class TestCorsEnvOverride:
    """CORS_ORIGINS env var overrides the compiled-in defaults."""

    # A custom origin is accepted when configured through the environment.
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

# Default origin is blocked once CORS_ORIGINS is overridden.
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

# Wildcard CORS_ORIGINS falls back to safe defaults.
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
