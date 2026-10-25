"""Tests for deployment request and response schemas."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.models.deployment import DeploymentStatus
from app.schemas.deployment import DeploymentCreate, DeploymentStatusUpdate


# Verifies valid version and commit values are normalized and accepted.
def test_deployment_create_normalizes_valid_values() -> None:
    """Strip versions and lowercase case-insensitive commit SHAs."""
    short = DeploymentCreate(version=" v ", commit_sha="ABCDEF1")
    long = DeploymentCreate(version="v" * 64, commit_sha="a" * 40)

    assert short.version == "v"
    assert short.commit_sha == "abcdef1"
    assert long.version == "v" * 64
    assert long.commit_sha == "a" * 40


# Verifies blank and overlong versions are rejected.
@pytest.mark.parametrize("version", ("", " ", "v" * 65))
def test_deployment_create_rejects_invalid_versions(version: str) -> None:
    """Reject blank versions and versions longer than 64 characters."""
    with pytest.raises(ValidationError):
        DeploymentCreate(version=version)


# Verifies commit SHA length and character constraints.
@pytest.mark.parametrize(
    "commit_sha",
    ("a" * 6, "a" * 41, "not-hex", ""),
)
def test_deployment_create_rejects_invalid_commit_sha(commit_sha: str) -> None:
    """Reject empty, short, long, and non-hex commit SHAs."""
    with pytest.raises(ValidationError):
        DeploymentCreate(version="v1", commit_sha=commit_sha)


# Verifies status is required and accepts only the declared enum values.
def test_deployment_status_update_requires_status() -> None:
    """Require a valid DeploymentStatus in status update payloads."""
    assert DeploymentStatusUpdate(status=DeploymentStatus.RUNNING).status is (
        DeploymentStatus.RUNNING
    )
    with pytest.raises(ValidationError):
        DeploymentStatusUpdate.model_validate({})


# Verifies create payloads reject status and unknown fields.
@pytest.mark.parametrize(
    "payload",
    (
        {"version": "v1", "status": "pending"},
        {"version": "v1", "unknown": "value"},
    ),
)
def test_deployment_create_forbids_extra_fields(
    payload: dict[str, str],
) -> None:
    """Reject lifecycle status and unknown fields during creation."""
    with pytest.raises(ValidationError):
        DeploymentCreate.model_validate(payload)


# Verifies status updates reject undeclared lifecycle values.
def test_deployment_status_update_rejects_invalid_status() -> None:
    """Reject status values outside the deployment lifecycle."""
    with pytest.raises(ValidationError):
        DeploymentStatusUpdate.model_validate({"status": "paused"})


# Verifies status updates reject fields outside the request contract.
def test_deployment_status_update_forbids_extra_fields() -> None:
    """Reject unknown fields from status update payloads."""
    with pytest.raises(ValidationError):
        DeploymentStatusUpdate.model_validate({"status": "running", "extra": 1})
