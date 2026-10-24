"""Logging configuration for the application.

Sets up Python's standard ``logging`` module with a consistent format
that includes timestamp, level, logger name, request ID, and message.
The ``request_id_ctx`` context variable is shared with the request-ID
middleware so that every log line is automatically correlated to the
HTTP request that produced it.
"""

from __future__ import annotations

import logging
import sys
from contextvars import ContextVar

# Shared context variable — written by RequestIdMiddleware, read by the
# log filter.  Default "-" is used for log lines emitted outside a
# request context (e.g. during startup).
request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")

LOG_FORMAT = "%(asctime)s %(levelname)-8s %(name)s [%(request_id)s] %(message)s"
MAX_LOG_VALUE_LENGTH: int = 256

# Marker attribute set on our handler so setup_logging() can be called
# multiple times (e.g. in tests) without adding duplicate handlers.
_HANDLER_ATTR = "_cloudops_platform"


# Escapes control characters and bounds values before they enter log records.
def safe_log_value(value: object) -> str:
    """Return a bounded, single-line representation of a log value.

    Args:
        value: Value that may contain user-controlled text.

    Returns:
        An ASCII-escaped value truncated to ``MAX_LOG_VALUE_LENGTH``.
    """
    # WHY unicode_escape: it turns newlines and other controls into literals.
    escaped = str(value).encode("unicode_escape", "backslashreplace").decode("ascii")
    if len(escaped) > MAX_LOG_VALUE_LENGTH:
        return escaped[:MAX_LOG_VALUE_LENGTH] + "...[truncated]"
    return escaped


# logging.Filter that injects the current request ID from request_id_ctx.
class _RequestIdFilter(logging.Filter):
    """Injects the current request ID into every log record.

    The ID is read from the ``request_id_ctx`` context variable that is
    set by ``RequestIdMiddleware``.  Outside of a request context the
    value defaults to ``"-"``.
    """

# Sets record.request_id from the context var; never suppresses a record.
    def filter(self, record: logging.LogRecord) -> bool:
        """Add ``request_id`` to the log record.

        Args:
            record: The log record being processed.

        Returns:
            Always ``True`` — the record is never suppressed.
        """
        record.request_id = request_id_ctx.get()  # type: ignore[attr-defined]
        return True


# Configures the root logger once (deduped via handler marker) at the given level.
def setup_logging(log_level: str) -> None:
    """Configure the root logger with a consistent format and level.

    Adds a single ``StreamHandler`` (to *stderr*) on the first call.
    Subsequent calls — which happen when ``create_app()`` is invoked
    multiple times in a test session — update the root level but do not
    add duplicate handlers.

    Args:
        log_level: A Python logging level name (e.g. ``"INFO"``,
            ``"DEBUG"``).
    """
    root = logging.getLogger()
    root.setLevel(log_level)

    # Avoid adding duplicate handlers across multiple create_app() calls.
    if any(getattr(h, _HANDLER_ATTR, False) for h in root.handlers):
        return

    handler = logging.StreamHandler(sys.stderr)
    handler.setFormatter(logging.Formatter(LOG_FORMAT))
    handler.addFilter(_RequestIdFilter())
    setattr(handler, _HANDLER_ATTR, True)
    root.addHandler(handler)

