"""Clock dependency used to inject timezone-aware UTC time."""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timezone
import logging

from app.core.logging import safe_log_value

logger = logging.getLogger(__name__)

Clock = Callable[[], datetime]


# Returns the current timezone-aware UTC time for production dependencies.
def _utc_now() -> datetime:
    """Return the current timezone-aware UTC datetime.

    Returns:
        The current datetime with UTC timezone information.
    """
    logger.debug("clock._utc_now entry")
    value = datetime.now(timezone.utc)
    logger.debug("clock._utc_now exit: timezone=%s", safe_log_value(value.tzinfo))
    return value


# Provides the production clock callable through dependency injection.
def get_clock() -> Clock:
    """Return the production UTC clock dependency.

    Returns:
        A callable returning timezone-aware UTC datetimes.
    """
    logger.debug("get_clock entry")
    clock = _utc_now
    logger.debug("get_clock exit: callable=%s", safe_log_value(clock.__name__))
    return clock
