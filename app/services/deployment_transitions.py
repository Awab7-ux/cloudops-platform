"""Pure deployment lifecycle transition rules."""

from __future__ import annotations

import logging

from app.models.deployment import DeploymentStatus

logger = logging.getLogger(__name__)

# WHY: one immutable target set makes the complete lifecycle policy auditable.
ALLOWED_DEPLOYMENT_TRANSITIONS: dict[
    DeploymentStatus,
    frozenset[DeploymentStatus],
] = {
    DeploymentStatus.PENDING: frozenset({DeploymentStatus.RUNNING}),
    DeploymentStatus.RUNNING: frozenset(
        {DeploymentStatus.SUCCEEDED, DeploymentStatus.FAILED}
    ),
    DeploymentStatus.SUCCEEDED: frozenset({DeploymentStatus.ROLLED_BACK}),
    DeploymentStatus.FAILED: frozenset({DeploymentStatus.ROLLED_BACK}),
    DeploymentStatus.ROLLED_BACK: frozenset(),
}


# Checks whether a requested deployment status transition is allowed.
def is_transition_allowed(
    current: DeploymentStatus,
    target: DeploymentStatus,
) -> bool:
    """Return whether a deployment may move between two statuses.

    Args:
        current: Existing deployment status.
        target: Requested deployment status.

    Returns:
        ``True`` only for the five supported lifecycle transitions.
    """
    logger.debug(
        "is_transition_allowed entry: current=%s target=%s",
        current.value,
        target.value,
    )
    result = target in ALLOWED_DEPLOYMENT_TRANSITIONS.get(current, frozenset())
    logger.debug("is_transition_allowed exit: allowed=%s", result)
    return result
