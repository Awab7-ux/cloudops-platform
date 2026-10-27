"""Alert metadata used by derived alert queries and response schemas."""

from __future__ import annotations

from enum import Enum
import logging

logger = logging.getLogger(__name__)


# Defines the alert severities surfaced by the derived incident feed.
class AlertSeverity(str, Enum):
    """Severity for derived operational alerts."""

    HIGH = "high"
    MEDIUM = "medium"


# Defines the stable derived alert types emitted by the alert rules engine.
class AlertType(str, Enum):
    """Notification type for derived alert conditions."""

    DEPLOYMENT_FAILED = "deployment_failed"
    DEPLOYMENT_STUCK = "deployment_stuck"
    ERROR_LOG_SPIKE = "error_log_spike"
