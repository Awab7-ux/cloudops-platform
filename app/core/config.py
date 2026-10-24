"""Application configuration parsed from environment variables.

All settings follow the 12-factor methodology: they are read from the
process environment, parsed once at startup inside create_app(), and
stored in a frozen dataclass that is injected into every component that
needs them.  No module-level singletons or lru_cache are used, so
monkeypatch-based tests can override variables between create_app() calls.
"""

from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass
from urllib.parse import SplitResult, urlsplit

from fastapi import Request

from app.core.logging import safe_log_value

logger = logging.getLogger(__name__)

DEFAULT_APP_NAME: str = "CloudOps Platform"
DEFAULT_APP_VERSION: str = "0.1.0"

# Hardcoded defaults prevent accidental wildcard exposure in production.
DEFAULT_CORS_ORIGINS: tuple[str, ...] = (
    "http://localhost:3000",
    "http://127.0.0.1:3000",
)

DEFAULT_LOG_LEVEL: str = "INFO"
VALID_CORS_SCHEMES: frozenset[str] = frozenset({"http", "https"})
MAX_CORS_ORIGIN_LENGTH: int = 2048

DEFAULT_PORT: int = 8000
MIN_PORT: int = 1
MAX_PORT: int = 65535


# Returns a trimmed env value, falling back to default when blank.
def _read_env(name: str, default: str) -> str:
    """Read a non-empty, whitespace-trimmed value from the environment.

    Args:
        name: Environment variable name.
        default: Fallback value when the variable is unset or blank.

    Returns:
        The trimmed environment value, or *default*.
    """
    logger.debug("_read_env entry: name=%s", safe_log_value(name))
    value = os.getenv(name)
    return value.strip() if value and value.strip() else default


# Canonicalizes a parsed CORS origin or returns None when it is unusable.
def _canonicalize_cors_origin(parsed: SplitResult) -> str | None:
    """Canonicalize one parsed HTTP(S) origin.

    Args:
        parsed: Parsed origin value.

    Returns:
        A canonical origin, or ``None`` for malformed input.
    """
    logger.debug("_canonicalize_cors_origin entry")
    try:
        hostname = parsed.hostname
        port = parsed.port
        if (
            parsed.scheme.lower() not in VALID_CORS_SCHEMES
            or not hostname
            or parsed.username
            or parsed.password
            or parsed.path not in ("", "/")
            or parsed.query
            or parsed.fragment
            or parsed.netloc.endswith(":")
            or not re.fullmatch(r"[A-Za-z0-9._:-]+", hostname)
        ):
            return None
        host = hostname.lower()
        host = f"[{host}]" if ":" in host else host
        suffix = f":{port}" if port is not None else ""
        return f"{parsed.scheme.lower()}://{host}{suffix}"
    except ValueError:
        return None
    finally:
        logger.debug("_canonicalize_cors_origin exit")


# Normalizes one configured CORS origin or returns None when it is unusable.
def _normalise_cors_origin(raw: str) -> str | None:
    """Normalize one HTTP(S) origin.

    Args:
        raw: Trimmed origin value.

    Returns:
        A canonical origin, or ``None`` for malformed input.
    """
    logger.debug(
        "_normalise_cors_origin entry: origin=%s", safe_log_value(raw)
    )
    try:
        if not raw or len(raw) > MAX_CORS_ORIGIN_LENGTH:
            return None
        if any(char.isspace() or ord(char) < 32 for char in raw):
            return None
        return _canonicalize_cors_origin(urlsplit(raw))
    except ValueError:
        return None
    finally:
        logger.debug("_normalise_cors_origin exit")


# Splits CORS_ORIGINS, rejects wildcard '*', and removes malformed entries.
def _parse_cors_origins(raw: str) -> tuple[str, ...]:
    """Parse a comma-separated CORS-origins string into a tuple.

    A wildcard ``*`` is explicitly rejected to prevent accidental
    exposure; the safe defaults are used instead and a warning is logged.

    Args:
        raw: Comma-separated origin strings, e.g. ``"http://a,http://b"``.

    Returns:
        Tuple of origin strings, guaranteed to never contain ``"*"``.
    """
    logger.debug("_parse_cors_origins entry: raw=%s", safe_log_value(raw))
    origins: list[str] = []
    seen: set[str] = set()
    for raw_origin in raw.split(","):
        candidate = raw_origin.strip()
        if candidate == "*":
            logger.warning(
                "CORS_ORIGINS contains wildcard '*'; "
                "falling back to defaults %s",
                safe_log_value(DEFAULT_CORS_ORIGINS),
            )
            logger.debug("_parse_cors_origins exit: wildcard_defaults=%s", True)
            return DEFAULT_CORS_ORIGINS
        origin = _normalise_cors_origin(candidate)
        if origin is None:
            logger.warning(
                "Ignoring invalid CORS origin '%s'",
                safe_log_value(candidate),
            )
            continue
        if origin not in seen:
            origins.append(origin)
            seen.add(origin)

    if origins:
        logger.debug("_parse_cors_origins exit: origin_count=%d", len(origins))
        return tuple(origins)
    logger.warning("No valid CORS origins configured; using defaults")
    logger.debug("_parse_cors_origins exit: default_origins=%s", True)
    return DEFAULT_CORS_ORIGINS


# Upper-cases and validates LOG_LEVEL; falls back to INFO when invalid.
def _parse_log_level(raw: str) -> str:
    """Validate and normalise a log-level string.

    Args:
        raw: Log level from the environment (e.g. ``"DEBUG"``, ``"info"``).

    Returns:
        Upper-cased log level.  Falls back to ``"INFO"`` for invalid values.
    """
    logger.debug("_parse_log_level entry: raw=%s", safe_log_value(raw))
    level = raw.strip().upper()
    valid_levels = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}

    if level not in valid_levels:
        logger.warning(
            "Invalid LOG_LEVEL '%s'; falling back to INFO",
            safe_log_value(raw),
        )
        logger.debug("_parse_log_level exit: default_level=%s", DEFAULT_LOG_LEVEL)
        return DEFAULT_LOG_LEVEL

    logger.debug("_parse_log_level exit: level=%s", safe_log_value(level))
    return level


# WHY: a port outside 1..65535 cannot be bound, so an out-of-range value
# would make the server fail to start; fall back to the safe default.
def _parse_port(raw: str) -> int:
    """Parse and validate a TCP port from an environment string.

    Accepts integers in the inclusive range ``MIN_PORT``..``MAX_PORT``.
    Non-integer or out-of-range values fall back to ``DEFAULT_PORT`` with a
    warning, because an invalid port would make the server fail to start.

    Args:
        raw: Raw PORT value from the environment.

    Returns:
        A valid port number, or ``DEFAULT_PORT`` when *raw* is unusable.
    """
    logger.debug("_parse_port entry: raw=%s", safe_log_value(raw))

    try:
        port = int(raw)
    except ValueError:
        logger.warning(
            "Invalid PORT '%s'; falling back to 8000", safe_log_value(raw)
        )
        logger.debug(
            "_parse_port exit: not an integer; using default %d", DEFAULT_PORT
        )
        return DEFAULT_PORT

    if port < MIN_PORT or port > MAX_PORT:
        logger.warning(
            "Invalid PORT '%s'; falling back to 8000", safe_log_value(raw)
        )
        logger.debug(
            "_parse_port exit: port %d out of range %d..%d; using default %d",
            port,
            MIN_PORT,
            MAX_PORT,
            DEFAULT_PORT,
        )
        return DEFAULT_PORT

    logger.debug("_parse_port exit: port=%d", port)
    return port


# Frozen dataclass holding immutable runtime settings.
@dataclass(frozen=True)
class Settings:
    """Immutable application settings built from environment variables.

    Attributes:
        app_name: Human-readable service name.
        app_version: Semantic version string.
        port: HTTP listening port (used by the container CMD).
        cors_origins: Allowed CORS origins; never includes ``"*"``.
        log_level: Python logging level name.
    """

    app_name: str
    app_version: str
    port: int
    cors_origins: tuple[str, ...]
    log_level: str


# Reads env once per create_app() call so monkeypatch tests stay isolated.
def build_settings() -> Settings:
    """Build a Settings instance from current environment variables.

    Called once per ``create_app()`` invocation so that monkeypatch-based
    tests can override environment variables between calls.

    Returns:
        A frozen ``Settings`` dataclass.
    """
    logger.debug("build_settings entry")
    cors_raw = _read_env("CORS_ORIGINS", ",".join(DEFAULT_CORS_ORIGINS))
    log_raw = _read_env("LOG_LEVEL", DEFAULT_LOG_LEVEL)

    port_raw = _read_env("PORT", str(DEFAULT_PORT))
    port = _parse_port(port_raw)

    return Settings(
        app_name=_read_env("APP_NAME", DEFAULT_APP_NAME),
        app_version=_read_env("APP_VERSION", DEFAULT_APP_VERSION),
        port=port,
        cors_origins=_parse_cors_origins(cors_raw),
        log_level=_parse_log_level(log_raw),
    )


# FastAPI dependency returning Settings from app.state (no module-level global).
def get_settings(request: Request) -> Settings:
    """FastAPI dependency that retrieves Settings from application state.

    ``create_app()`` stores the ``Settings`` instance in ``app.state``
    so that every request handler receives the same immutable object
    without importing a module-level global.

    Args:
        request: The current FastAPI request (injected automatically).

    Returns:
        The application ``Settings`` instance.
    """
    logger.debug("get_settings entry")
    return request.app.state.settings

