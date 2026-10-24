"""Tests for Settings parsing from environment variables.

Covers defaults, empty/whitespace values, CORS wildcard rejection,
and invalid LOG_LEVEL fallback.
"""

from __future__ import annotations

import logging

import pytest

from app.core.config import (
    DEFAULT_APP_NAME,
    DEFAULT_APP_VERSION,
    DEFAULT_CORS_ORIGINS,
    DEFAULT_LOG_LEVEL,
    build_settings,
)


class TestDefaults:
    """Settings use correct defaults when no env vars are set."""

    def test_app_name_default(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """APP_NAME defaults to the platform name constant."""
        monkeypatch.delenv("APP_NAME", raising=False)
        monkeypatch.delenv("APP_VERSION", raising=False)
        monkeypatch.delenv("PORT", raising=False)
        monkeypatch.delenv("CORS_ORIGINS", raising=False)
        monkeypatch.delenv("LOG_LEVEL", raising=False)

        settings = build_settings()

        assert settings.app_name == DEFAULT_APP_NAME

    def test_app_version_default(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """APP_VERSION defaults to the initial semver."""
        monkeypatch.delenv("APP_NAME", raising=False)
        monkeypatch.delenv("APP_VERSION", raising=False)
        monkeypatch.delenv("PORT", raising=False)
        monkeypatch.delenv("CORS_ORIGINS", raising=False)
        monkeypatch.delenv("LOG_LEVEL", raising=False)

        settings = build_settings()

        assert settings.app_version == DEFAULT_APP_VERSION

    def test_port_default(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """PORT defaults to 8000."""
        monkeypatch.delenv("APP_NAME", raising=False)
        monkeypatch.delenv("APP_VERSION", raising=False)
        monkeypatch.delenv("PORT", raising=False)
        monkeypatch.delenv("CORS_ORIGINS", raising=False)
        monkeypatch.delenv("LOG_LEVEL", raising=False)

        settings = build_settings()

        assert settings.port == 8000

    def test_cors_origins_default(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """CORS_ORIGINS defaults to the two localhost origins."""
        monkeypatch.delenv("APP_NAME", raising=False)
        monkeypatch.delenv("APP_VERSION", raising=False)
        monkeypatch.delenv("PORT", raising=False)
        monkeypatch.delenv("CORS_ORIGINS", raising=False)
        monkeypatch.delenv("LOG_LEVEL", raising=False)

        settings = build_settings()

        assert settings.cors_origins == DEFAULT_CORS_ORIGINS

    def test_log_level_default(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """LOG_LEVEL defaults to INFO."""
        monkeypatch.delenv("APP_NAME", raising=False)
        monkeypatch.delenv("APP_VERSION", raising=False)
        monkeypatch.delenv("PORT", raising=False)
        monkeypatch.delenv("CORS_ORIGINS", raising=False)
        monkeypatch.delenv("LOG_LEVEL", raising=False)

        settings = build_settings()

        assert settings.log_level == DEFAULT_LOG_LEVEL


class TestEmptyAndWhitespace:
    """Empty or whitespace-only values fall back to defaults."""

    def test_empty_app_name(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """An empty APP_NAME falls back to the default."""
        monkeypatch.setenv("APP_NAME", "")
        monkeypatch.delenv("APP_VERSION", raising=False)
        monkeypatch.delenv("PORT", raising=False)
        monkeypatch.delenv("CORS_ORIGINS", raising=False)
        monkeypatch.delenv("LOG_LEVEL", raising=False)

        settings = build_settings()

        assert settings.app_name == DEFAULT_APP_NAME

    def test_whitespace_app_name(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """A whitespace-only APP_NAME falls back to the default."""
        monkeypatch.setenv("APP_NAME", "   ")
        monkeypatch.delenv("APP_VERSION", raising=False)
        monkeypatch.delenv("PORT", raising=False)
        monkeypatch.delenv("CORS_ORIGINS", raising=False)
        monkeypatch.delenv("LOG_LEVEL", raising=False)

        settings = build_settings()

        assert settings.app_name == DEFAULT_APP_NAME

    def test_whitespace_app_version(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """A whitespace-only APP_VERSION falls back to the default."""
        monkeypatch.setenv("APP_VERSION", "  ")
        monkeypatch.delenv("APP_NAME", raising=False)
        monkeypatch.delenv("PORT", raising=False)
        monkeypatch.delenv("CORS_ORIGINS", raising=False)
        monkeypatch.delenv("LOG_LEVEL", raising=False)

        settings = build_settings()

        assert settings.app_version == DEFAULT_APP_VERSION

    def test_empty_cors_origins(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """An empty CORS_ORIGINS falls back to the defaults."""
        monkeypatch.setenv("CORS_ORIGINS", "")
        monkeypatch.delenv("APP_NAME", raising=False)
        monkeypatch.delenv("APP_VERSION", raising=False)
        monkeypatch.delenv("PORT", raising=False)
        monkeypatch.delenv("LOG_LEVEL", raising=False)

        settings = build_settings()

        assert settings.cors_origins == DEFAULT_CORS_ORIGINS

    def test_whitespace_cors_origins(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """A whitespace-only CORS_ORIGINS falls back to the defaults."""
        monkeypatch.setenv("CORS_ORIGINS", "  ,  , ")
        monkeypatch.delenv("APP_NAME", raising=False)
        monkeypatch.delenv("APP_VERSION", raising=False)
        monkeypatch.delenv("PORT", raising=False)
        monkeypatch.delenv("LOG_LEVEL", raising=False)

        settings = build_settings()

        assert settings.cors_origins == DEFAULT_CORS_ORIGINS


class TestInvalidValues:
    """Invalid values fall back to safe defaults with a warning."""

    def test_invalid_log_level(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """An unrecognised LOG_LEVEL falls back to INFO."""
        monkeypatch.setenv("LOG_LEVEL", "VERBOSE")
        monkeypatch.delenv("APP_NAME", raising=False)
        monkeypatch.delenv("APP_VERSION", raising=False)
        monkeypatch.delenv("PORT", raising=False)
        monkeypatch.delenv("CORS_ORIGINS", raising=False)

        settings = build_settings()

        assert settings.log_level == "INFO"

    def test_log_level_case_insensitive(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """LOG_LEVEL is normalised to uppercase."""
        monkeypatch.setenv("LOG_LEVEL", "debug")
        monkeypatch.delenv("APP_NAME", raising=False)
        monkeypatch.delenv("APP_VERSION", raising=False)
        monkeypatch.delenv("PORT", raising=False)
        monkeypatch.delenv("CORS_ORIGINS", raising=False)

        settings = build_settings()

        assert settings.log_level == "DEBUG"

    def test_cors_wildcard_rejected(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """CORS_ORIGINS='*' is rejected; defaults are used instead."""
        monkeypatch.setenv("CORS_ORIGINS", "*")
        monkeypatch.delenv("APP_NAME", raising=False)
        monkeypatch.delenv("APP_VERSION", raising=False)
        monkeypatch.delenv("PORT", raising=False)
        monkeypatch.delenv("LOG_LEVEL", raising=False)

        settings = build_settings()

        assert settings.cors_origins == DEFAULT_CORS_ORIGINS

    def test_cors_wildcard_among_origins_rejected(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """CORS_ORIGINS containing '*' among other origins is rejected."""
        monkeypatch.setenv("CORS_ORIGINS", "http://good.example.com,*")
        monkeypatch.delenv("APP_NAME", raising=False)
        monkeypatch.delenv("APP_VERSION", raising=False)
        monkeypatch.delenv("PORT", raising=False)
        monkeypatch.delenv("LOG_LEVEL", raising=False)

        settings = build_settings()

        assert settings.cors_origins == DEFAULT_CORS_ORIGINS

    def test_invalid_port_falls_back(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """A non-integer PORT falls back to 8000."""
        monkeypatch.setenv("PORT", "not-a-number")
        monkeypatch.delenv("APP_NAME", raising=False)
        monkeypatch.delenv("APP_VERSION", raising=False)
        monkeypatch.delenv("CORS_ORIGINS", raising=False)
        monkeypatch.delenv("LOG_LEVEL", raising=False)

        settings = build_settings()

        assert settings.port == 8000


class TestCustomValues:
    """Explicitly set env vars override defaults."""

    def test_custom_app_name(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """APP_NAME overrides the default."""
        monkeypatch.setenv("APP_NAME", "Custom Service")
        monkeypatch.delenv("APP_VERSION", raising=False)
        monkeypatch.delenv("PORT", raising=False)
        monkeypatch.delenv("CORS_ORIGINS", raising=False)
        monkeypatch.delenv("LOG_LEVEL", raising=False)

        settings = build_settings()

        assert settings.app_name == "Custom Service"

    def test_custom_cors_origins(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """CORS_ORIGINS overrides the defaults."""
        monkeypatch.setenv(
            "CORS_ORIGINS", "https://app.example.com, https://staging.example.com"
        )
        monkeypatch.delenv("APP_NAME", raising=False)
        monkeypatch.delenv("APP_VERSION", raising=False)
        monkeypatch.delenv("PORT", raising=False)
        monkeypatch.delenv("LOG_LEVEL", raising=False)

        settings = build_settings()

        assert settings.cors_origins == (
            "https://app.example.com",
            "https://staging.example.com",
        )

    def test_settings_is_frozen(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Settings attributes cannot be reassigned after creation."""
        monkeypatch.delenv("APP_NAME", raising=False)
        monkeypatch.delenv("APP_VERSION", raising=False)
        monkeypatch.delenv("PORT", raising=False)
        monkeypatch.delenv("CORS_ORIGINS", raising=False)
        monkeypatch.delenv("LOG_LEVEL", raising=False)

        settings = build_settings()

        with pytest.raises(AttributeError):
            settings.app_name = "hacked"  # type: ignore[misc]


class TestPortRange:
    """PORT values are validated; out-of-range values fall back to 8000."""

    def test_port_zero_falls_back_with_warning(
        self, monkeypatch: pytest.MonkeyPatch, caplog
    ) -> None:
        """PORT='0' is out of range; warns and falls back to 8000."""
        monkeypatch.setenv("PORT", "0")
        monkeypatch.delenv("APP_NAME", raising=False)
        monkeypatch.delenv("APP_VERSION", raising=False)
        monkeypatch.delenv("CORS_ORIGINS", raising=False)
        monkeypatch.delenv("LOG_LEVEL", raising=False)

        with caplog.at_level(logging.WARNING):
            settings = build_settings()

        assert settings.port == 8000
        assert "Invalid PORT '0'; falling back to 8000" in caplog.text

    def test_port_negative_falls_back(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """PORT='-1' is out of range; falls back to 8000."""
        monkeypatch.setenv("PORT", "-1")
        monkeypatch.delenv("APP_NAME", raising=False)
        monkeypatch.delenv("APP_VERSION", raising=False)
        monkeypatch.delenv("CORS_ORIGINS", raising=False)
        monkeypatch.delenv("LOG_LEVEL", raising=False)

        settings = build_settings()

        assert settings.port == 8000

    def test_port_above_max_falls_back(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """PORT='65536' is out of range; falls back to 8000."""
        monkeypatch.setenv("PORT", "65536")
        monkeypatch.delenv("APP_NAME", raising=False)
        monkeypatch.delenv("APP_VERSION", raising=False)
        monkeypatch.delenv("CORS_ORIGINS", raising=False)
        monkeypatch.delenv("LOG_LEVEL", raising=False)

        settings = build_settings()

        assert settings.port == 8000

    def test_port_70000_falls_back(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """PORT='70000' is out of range; falls back to 8000."""
        monkeypatch.setenv("PORT", "70000")
        monkeypatch.delenv("APP_NAME", raising=False)
        monkeypatch.delenv("APP_VERSION", raising=False)
        monkeypatch.delenv("CORS_ORIGINS", raising=False)
        monkeypatch.delenv("LOG_LEVEL", raising=False)

        settings = build_settings()

        assert settings.port == 8000

    def test_port_abc_falls_back(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """PORT='abc' is not an integer; falls back to 8000."""
        monkeypatch.setenv("PORT", "abc")
        monkeypatch.delenv("APP_NAME", raising=False)
        monkeypatch.delenv("APP_VERSION", raising=False)
        monkeypatch.delenv("CORS_ORIGINS", raising=False)
        monkeypatch.delenv("LOG_LEVEL", raising=False)

        settings = build_settings()

        assert settings.port == 8000

    def test_port_min_accepted(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """PORT='1' is accepted unchanged."""
        monkeypatch.setenv("PORT", "1")
        monkeypatch.delenv("APP_NAME", raising=False)
        monkeypatch.delenv("APP_VERSION", raising=False)
        monkeypatch.delenv("CORS_ORIGINS", raising=False)
        monkeypatch.delenv("LOG_LEVEL", raising=False)

        settings = build_settings()

        assert settings.port == 1

    def test_port_max_accepted(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """PORT='65535' is accepted unchanged."""
        monkeypatch.setenv("PORT", "65535")
        monkeypatch.delenv("APP_NAME", raising=False)
        monkeypatch.delenv("APP_VERSION", raising=False)
        monkeypatch.delenv("CORS_ORIGINS", raising=False)
        monkeypatch.delenv("LOG_LEVEL", raising=False)

        settings = build_settings()

        assert settings.port == 65535

    def test_port_custom_accepted(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """PORT='8080' is accepted unchanged."""
        monkeypatch.setenv("PORT", "8080")
        monkeypatch.delenv("APP_NAME", raising=False)
        monkeypatch.delenv("APP_VERSION", raising=False)
        monkeypatch.delenv("CORS_ORIGINS", raising=False)
        monkeypatch.delenv("LOG_LEVEL", raising=False)

        settings = build_settings()

        assert settings.port == 8080

