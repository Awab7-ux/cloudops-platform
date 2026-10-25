"""Tests for deployment lifecycle transition rules."""

from __future__ import annotations

import pytest

from app.models.deployment import DeploymentStatus
from app.services.deployment_transitions import is_transition_allowed

ALLOWED_TRANSITIONS = {
    (DeploymentStatus.PENDING, DeploymentStatus.RUNNING),
    (DeploymentStatus.RUNNING, DeploymentStatus.SUCCEEDED),
    (DeploymentStatus.RUNNING, DeploymentStatus.FAILED),
    (DeploymentStatus.SUCCEEDED, DeploymentStatus.ROLLED_BACK),
    (DeploymentStatus.FAILED, DeploymentStatus.ROLLED_BACK),
}
FORBIDDEN_TRANSITIONS = [
    (current, target)
    for current in DeploymentStatus
    for target in DeploymentStatus
    if (current, target) not in ALLOWED_TRANSITIONS
]


# Verifies every explicitly supported transition is allowed.
def test_deployment_transitions_allow_only_the_lifecycle_path() -> None:
    """Allow exactly the five declared lifecycle transitions."""
    assert all(
        is_transition_allowed(current, target)
        for current, target in ALLOWED_TRANSITIONS
    )


# Verifies the generated forbidden matrix covers every other state pair.
def test_deployment_transitions_forbidden_matrix_has_twenty_cases() -> None:
    """Generate twenty forbidden cases from the five-state enum."""
    assert len(list(DeploymentStatus)) ** 2 - len(ALLOWED_TRANSITIONS) == 20
    assert len(FORBIDDEN_TRANSITIONS) == 20


# Verifies each generated forbidden state pair is rejected.
@pytest.mark.parametrize("current,target", FORBIDDEN_TRANSITIONS)
def test_deployment_transitions_reject_forbidden_pair(
    current: DeploymentStatus,
    target: DeploymentStatus,
) -> None:
    """Reject every transition outside the declared lifecycle path."""
    assert not is_transition_allowed(current, target)
