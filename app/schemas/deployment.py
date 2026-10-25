"""Pydantic schemas for the Deployments API contract."""

from __future__ import annotations

from datetime import datetime
import logging

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.deployment import DeploymentStatus
from app.repositories.pagination import (
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    MIN_PAGE_SIZE,
)

logger = logging.getLogger(__name__)

MAX_DEPLOYMENT_VERSION_LENGTH: int = 64
MIN_COMMIT_SHA_LENGTH: int = 7
MAX_COMMIT_SHA_LENGTH: int = 40


# Defines the validated payload for creating a deployment.
class DeploymentCreate(BaseModel):
    """Request body for creating a deployment."""

    model_config = ConfigDict(extra="forbid")

    version: str = Field(
        min_length=1,
        max_length=MAX_DEPLOYMENT_VERSION_LENGTH,
    )
    commit_sha: str | None = Field(
        default=None,
        min_length=MIN_COMMIT_SHA_LENGTH,
        max_length=MAX_COMMIT_SHA_LENGTH,
        pattern=r"^[0-9a-f]+$",
    )

    # Strips version whitespace before applying length constraints.
    @field_validator("version", mode="before")
    def _normalize_version(cls, value: object) -> object:
        """Strip surrounding whitespace from a version candidate.

        Args:
            value: Raw version value from the request body.

        Returns:
            The stripped string when ``value`` is a string; otherwise the raw value.
        """
        logger.debug(
            "DeploymentCreate._normalize_version entry: value_type=%s",
            type(value).__name__,
        )
        result = value.strip() if isinstance(value, str) else value
        logger.debug(
            "DeploymentCreate._normalize_version exit: value_len=%d",
            len(result) if isinstance(result, str) else 0,
        )
        return result

    # Normalizes commit SHA casing before applying its fixed hex pattern.
    @field_validator("commit_sha", mode="before")
    def _normalize_commit_sha(cls, value: object) -> object:
        """Strip and lowercase an optional commit SHA.

        Args:
            value: Raw commit SHA value from the request body.

        Returns:
            The normalized SHA when ``value`` is a string; otherwise the raw value.
        """
        logger.debug(
            "DeploymentCreate._normalize_commit_sha entry: value_type=%s",
            type(value).__name__,
        )
        result = value.strip().lower() if isinstance(value, str) else value
        logger.debug(
            "DeploymentCreate._normalize_commit_sha exit: value_len=%d",
            len(result) if isinstance(result, str) else 0,
        )
        return result


# Defines the validated payload for a deployment status update.
class DeploymentStatusUpdate(BaseModel):
    """Request body for changing a deployment lifecycle status."""

    model_config = ConfigDict(extra="forbid")

    status: DeploymentStatus


# Defines the serialized representation of one deployment.
class DeploymentRead(BaseModel):
    """Response body for one deployment row."""

    model_config = ConfigDict(extra="forbid", from_attributes=True)

    id: str
    application_id: str
    version: str
    commit_sha: str | None
    status: DeploymentStatus
    started_at: datetime | None
    finished_at: datetime | None
    created_at: datetime


# Defines the paginated serialized representation of deployments.
class DeploymentList(BaseModel):
    """Response body for a paginated deployment list."""

    model_config = ConfigDict(extra="forbid")

    items: list[DeploymentRead]
    total: int = Field(ge=0)
    limit: int = Field(
        default=DEFAULT_PAGE_SIZE,
        ge=MIN_PAGE_SIZE,
        le=MAX_PAGE_SIZE,
    )
    offset: int = Field(ge=0)


__all__ = [
    "DeploymentCreate",
    "DeploymentList",
    "DeploymentRead",
    "DeploymentStatusUpdate",
]
