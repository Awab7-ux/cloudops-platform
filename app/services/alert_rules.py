"""Rule thresholds and fixed templates for derived alert generation.

The rules are evaluated against aggregate queries and then merged in memory,
which keeps the per-application alert logic deterministic and makes boundary
checks easy to reason about in tests.
"""

from __future__ import annotations

from datetime import timedelta
import logging

from app.models.alert import AlertSeverity, AlertType

logger = logging.getLogger(__name__)

STUCK_DEPLOYMENT_MINUTES: int = 60
ERROR_SPIKE_THRESHOLD: int = 5
ERROR_SPIKE_WINDOW_MINUTES: int = 60
RECENT_FAILED_LIMIT: int = 5

SEVERITY_RANK: dict[AlertSeverity, int] = {
    AlertSeverity.HIGH: 0,
    AlertSeverity.MEDIUM: 1,
}

ALERT_MESSAGES: dict[AlertType, str] = {
    AlertType.DEPLOYMENT_FAILED: "Deployment failed.",
    AlertType.DEPLOYMENT_STUCK: "Deployment is stuck.",
    AlertType.ERROR_LOG_SPIKE: "Error log spike detected.",
}


# Builds a standard alert identifier using the alert type and stable resource keys.
def build_alert_id(
    alert_type: AlertType,
    application_id: str,
    deployment_id: str | None = None,
) -> str:
    """Build a deterministic alert identifier from the resource keys.

    Args:
        alert_type: Derived alert category.
        application_id: Owning application UUID.
        deployment_id: Optional deployment UUID for deployment-based alerts.

    Returns:
        A stable alert identifier string.
    """
    logger.debug(
        "build_alert_id entry: type=%s application_id_len=%d deployment_present=%s",
        alert_type.value,
        len(application_id),
        deployment_id is not None,
    )
    suffix = deployment_id if deployment_id is not None else "-"
    result = f"{alert_type.value}:{application_id}:{suffix}"
    logger.debug("build_alert_id exit: id_len=%d", len(result))
    return result


# Returns a timedelta for the threshold to keep the rule arithmetic obvious.
def minutes_delta(minutes: int) -> timedelta:
    """Return a ``timedelta`` for a number of minutes.

    Args:
        minutes: Number of minutes to convert to a ``timedelta``.

    Returns:
        A ``timedelta`` spanning the requested minutes.
    """
    logger.debug("minutes_delta entry: minutes=%d", minutes)
    result = timedelta(minutes=minutes)
    logger.debug("minutes_delta exit: total_seconds=%s", result.total_seconds())
    return result
