"""Pydantic schemas for the Deployments API contract."""

from __future__ import annotations

from datetime import datetime
import logging

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.pagination import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MIN_PAGE_SIZE
from app.models.application import Environment
from app.models.deployment import DeploymentStatus

logger = logging.getLogger(__name__)

MAX_DEPLOYMENT_VERSION_LENGTH: int = 64
MIN_COMMIT_SHA_LENGTH: int = 7
MAX_COMMIT_SHA_LENGTH: int = 40
MIN_DEPLOYMENT_LABEL_LENGTH: int = 1
MAX_DEPLOYMENT_LABEL_LENGTH: int = 100
MIN_DEPLOYMENT_SEARCH_LENGTH: int = 1
MAX_DEPLOYMENT_SEARCH_LENGTH: int = 100


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
    branch: str | None = Field(
        default=None,
        min_length=MIN_DEPLOYMENT_LABEL_LENGTH,
        max_length=MAX_DEPLOYMENT_LABEL_LENGTH,
    )
    initiator: str | None = Field(
        default=None,
        min_length=MIN_DEPLOYMENT_LABEL_LENGTH,
        max_length=MAX_DEPLOYMENT_LABEL_LENGTH,
    )

    # Strips version whitespace before applying length constraints.
    @field_validator("version", mode="before")
    @classmethod
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
    @classmethod
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

    # Trims optional deployment labels before applying their length constraints.
    @field_validator("branch", "initiator", mode="before")
    @classmethod
    def _normalize_labels(cls, value: object) -> object:
        """Trim surrounding whitespace from optional deployment labels.

        Args:
            value: Raw branch or initiator value from the request body.

        Returns:
            The trimmed string when ``value`` is a string; otherwise the raw value.
        """
        logger.debug(
            "DeploymentCreate._normalize_labels entry: value_type=%s",
            type(value).__name__,
        )
        result = value.strip() if isinstance(value, str) else value
        logger.debug(
            "DeploymentCreate._normalize_labels exit: value_type=%s value_len=%d",
            type(result).__name__,
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
    branch: str | None
    initiator: str | None
    status: DeploymentStatus
    started_at: datetime | None
    finished_at: datetime | None
    created_at: datetime


# Defines query filters and pagination for the global deployment listing.
class DeploymentGlobalQuery(BaseModel):
    """Validated query parameters for ``GET /deployments``.

    Attributes:
        application_id: Optional parent application filter.
        status: Optional lifecycle status filter.
        environment: Optional parent application environment filter.
        q: Optional case-insensitive substring search.
        limit: Number of rows requested.
        offset: Number of matching rows skipped.
    """

    model_config = ConfigDict(extra="forbid")

    application_id: str | None = None
    status: DeploymentStatus | None = None
    environment: Environment | None = None
    q: str | None = Field(
        default=None,
        min_length=MIN_DEPLOYMENT_SEARCH_LENGTH,
        max_length=MAX_DEPLOYMENT_SEARCH_LENGTH,
    )
    limit: int = Field(
        default=DEFAULT_PAGE_SIZE,
        ge=MIN_PAGE_SIZE,
        le=MAX_PAGE_SIZE,
    )
    offset: int = Field(default=0, ge=0)

    # Trims a query before its declared length constraints are applied.
    @field_validator("q", mode="before")
    @classmethod
    def _normalize_query(cls, value: object) -> object:
        """Strip surrounding whitespace from a global search query.

        Args:
            value: Raw query string supplied by the client.

        Returns:
            The trimmed query when ``value`` is a string; otherwise the raw value.
        """
        logger.debug(
            "DeploymentGlobalQuery._normalize_query entry: value_type=%s",
            type(value).__name__,
        )
        result = value.strip() if isinstance(value, str) else value
        logger.debug(
            "DeploymentGlobalQuery._normalize_query exit: value_type=%s value_len=%d",
            type(result).__name__,
            len(result) if isinstance(result, str) else 0,
        )
        return result


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


# Adds parent application labels to a deployment response for the global list.
class GlobalDeploymentRead(DeploymentRead):
    """Response body for one deployment in the global list.

    Attributes:
        application_name: Name of the deployment's application.
        application_environment: Environment of the deployment's application.
    """

    application_name: str
    application_environment: Environment


# Defines the paginated serialized representation of global deployments.
class GlobalDeploymentList(BaseModel):
    """Response body for a paginated global deployment list.

    Attributes:
        items: Deployments on the requested page with application labels.
        total: Number of deployments matching the filters.
        limit: Requested page size.
        offset: Number of matching deployments skipped.
    """

    model_config = ConfigDict(extra="forbid")

    items: list[GlobalDeploymentRead]
    total: int = Field(ge=0)
    limit: int = Field(
        default=DEFAULT_PAGE_SIZE,
        ge=MIN_PAGE_SIZE,
        le=MAX_PAGE_SIZE,
    )
    offset: int = Field(ge=0)


__all__ = [
    "DeploymentCreate",
    "DeploymentGlobalQuery",
    "DeploymentList",
    "DeploymentRead",
    "DeploymentStatusUpdate",
    "GlobalDeploymentList",
    "GlobalDeploymentRead",
]
