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


# Verifies Settings fall back to defaults when env vars are unset.
class TestDefaults:
    """Settings use correct defaults when no env vars are set."""

# APP_NAME defaults to DEFAULT_APP_NAME.
    def test_app_name_default(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """APP_NAME defaults to the platform name constant."""
        monkeypatch.delenv("APP_NAME", raising=False)
        monkeypatch.delenv("APP_VERSION", raising=False)
        monkeypatch.delenv("PORT", raising=False)
        monkeypatch.delenv("CORS_ORIGINS", raising=False)
        monkeypatch.delenv("LOG_LEVEL", raising=False)

        settings = build_settings()

        assert settings.app_name == DEFAULT_APP_NAME

# APP_VERSION defaults to DEFAULT_APP_VERSION.
    def test_app_version_default(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """APP_VERSION defaults to the initial semver."""
        monkeypatch.delenv("APP_NAME", raising=False)
        monkeypatch.delenv("APP_VERSION", raising=False)
        monkeypatch.delenv("PORT", raising=False)
        monkeypatch.delenv("CORS_ORIGINS", raising=False)
        monkeypatch.delenv("LOG_LEVEL", raising=False)

        settings = build_settings()

        assert settings.app_version == DEFAULT_APP_VERSION

# PORT defaults to 8000.
    def test_port_default(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """PORT defaults to 8000."""
        monkeypatch.delenv("APP_NAME", raising=False)
        monkeypatch.delenv("APP_VERSION", raising=False)
        monkeypatch.delenv("PORT", raising=False)
        monkeypatch.delenv("CORS_ORIGINS", raising=False)
        monkeypatch.delenv("LOG_LEVEL", raising=False)

        settings = build_settings()

        assert settings.port == 8000

# CORS_ORIGINS defaults to the two localhost origins.
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

# LOG_LEVEL defaults to INFO.
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


# Empty or whitespace-only env values fall back to defaults.
class TestEmptyAndWhitespace:
    """Empty or whitespace-only values fall back to defaults."""

# Empty APP_NAME falls back to the default.
    def test_empty_app_name(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """An empty APP_NAME falls back to the default."""
        monkeypatch.setenv("APP_NAME", "")
        monkeypatch.delenv("APP_VERSION", raising=False)
        monkeypatch.delenv("PORT", raising=False)
        monkeypatch.delenv("CORS_ORIGINS", raising=False)
        monkeypatch.delenv("LOG_LEVEL", raising=False)

        settings = build_settings()

        assert settings.app_name == DEFAULT_APP_NAME

# Whitespace-only APP_NAME is trimmed to the default.
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

# Whitespace-only APP_VERSION is trimmed to the default.
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

# Empty CORS_ORIGINS falls back to defaults.
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

# Whitespace-only CORS_ORIGINS falls back to defaults.
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


# Invalid env values fall back to safe defaults with a warning.
class TestInvalidValues:
    """Invalid values fall back to safe defaults with a warning."""

# Invalid LOG_LEVEL falls back to INFO.
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

# LOG_LEVEL is accepted case-insensitively.
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

# CORS_ORIGINS='*' falls back to defaults.
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

# Wildcard among origins triggers fallback to defaults.
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

# Non-integer PORT falls back to 8000.
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


# Env overrides are honored by build_settings().
class TestCustomValues:
    """Explicitly set env vars override defaults."""

# Custom APP_NAME is reflected in settings.
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

# Custom CORS_ORIGINS replaces the defaults.
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

# Settings dataclass is frozen (immutable).
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


# Ports outside 1..65535 fall back to DEFAULT_PORT.
class TestPortRange:
    """PORT values are validated; out-of-range values fall back to 8000."""

# PORT=0 is out of range and falls back.
    def test_port_zero_falls_back_with_warning(
        self,
        monkeypatch: pytest.MonkeyPatch,
        caplog: pytest.LogCaptureFixture,
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

# Negative PORT falls back to 8000.
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

# PORT above 65535 falls back to 8000.
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

# PORT=70000 falls back to 8000.
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

# Non-numeric PORT falls back to 8000.
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

# PORT=1 is accepted unchanged.
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

# PORT=65535 is accepted unchanged.
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

# PORT=8080 is accepted unchanged.
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


# CORS origins are canonicalized and malformed entries are excluded.
class TestCorsOriginValidation:
    """CORS settings contain only usable, non-duplicated origins."""

# Valid HTTP(S) origins are normalized and duplicate entries are removed.
    def test_cors_origins_are_canonicalized(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Only canonical HTTP(S) origins remain in configured CORS origins."""
        monkeypatch.setenv(
            "CORS_ORIGINS",
            "HTTPS://APP.EXAMPLE.COM, https://good.example.com/, "
            "javascript:alert(1), https://good.example.com, "
            "http://localhost:3000",
        )

        settings = build_settings()

        assert settings.cors_origins == (
            "https://app.example.com",
            "https://good.example.com",
            "http://localhost:3000",
        )

# Invalid-only CORS configuration falls back to safe defaults.
    def test_invalid_only_cors_origins_use_defaults(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """An all-invalid CORS configuration uses the safe defaults."""
        monkeypatch.setenv(
            "CORS_ORIGINS", "javascript:alert(1), https://bad.example.com/path"
        )

        settings = build_settings()

        assert settings.cors_origins == DEFAULT_CORS_ORIGINS

    # A single trailing slash is normalized away.
    def test_cors_origin_trailing_slash_normalized(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """A single trailing slash is removed from a valid origin."""
        monkeypatch.setenv("CORS_ORIGINS", "http://localhost:3000/")

        settings = build_settings()

        assert settings.cors_origins == ("http://localhost:3000",)

    # Invalid origins are dropped and produce one warning each.
    def test_invalid_cors_origin_warns_and_valid_origin_remains(
        self,
        monkeypatch: pytest.MonkeyPatch,
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        """Invalid CORS entries warn once while valid entries remain."""
        monkeypatch.setenv(
            "CORS_ORIGINS", "https://good.example.com, ftp://bad.example.com"
        )

        with caplog.at_level(logging.WARNING, logger="app.core.config"):
            settings = build_settings()

        assert settings.cors_origins == ("https://good.example.com",)
        assert caplog.messages.count(
            "Ignoring invalid CORS origin 'ftp://bad.example.com'"
        ) == 1

    # An all-invalid origin list falls back and reports the fallback.
    def test_all_invalid_cors_origins_warns_before_defaults(
        self,
        monkeypatch: pytest.MonkeyPatch,
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        """All-invalid CORS entries warn before defaults are selected."""
        monkeypatch.setenv(
            "CORS_ORIGINS", "ftp://bad.example.com,not-an-origin"
        )

        with caplog.at_level(logging.WARNING, logger="app.core.config"):
            settings = build_settings()

        assert settings.cors_origins == DEFAULT_CORS_ORIGINS
        assert caplog.messages.count(
            "Ignoring invalid CORS origin 'ftp://bad.example.com'"
        ) == 1
        assert caplog.messages.count(
            "Ignoring invalid CORS origin 'not-an-origin'"
        ) == 1
        assert "No valid CORS origins configured; using defaults" in caplog.messages

