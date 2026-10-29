"""Pydantic schemas for the Applications API contract."""

from __future__ import annotations

from datetime import datetime
import logging
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.application import ApplicationStatus, Environment
from app.models.deployment import DeploymentStatus

logger = logging.getLogger(__name__)

MAX_APPLICATION_NAME_LENGTH: int = 100
MAX_APPLICATION_DESCRIPTION_LENGTH: int = 500
MAX_APPLICATION_IMAGE_LENGTH: int = 255
MIN_APPLICATION_PORT: int = 1
MAX_APPLICATION_PORT: int = 65535
MIN_APPLICATION_REPLICAS: int = 0
MAX_APPLICATION_REPLICAS: int = 1000
MIN_APPLICATION_PAGE_SIZE: int = 1
MAX_APPLICATION_PAGE_SIZE: int = 200


# Strips application names before Pydantic applies length constraints.
def _strip_application_name(value: object) -> object:
    """Strip surrounding whitespace from a candidate application name.

    Args:
        value: Raw value supplied for an application name.

    Returns:
        The stripped string when ``value`` is a string; otherwise the raw value.
    """
    logger.debug(
        "_strip_application_name entry: value_type=%s",
        type(value).__name__,
    )
    result = value.strip() if isinstance(value, str) else value
    logger.debug(
        "_strip_application_name exit: value_type=%s value_len=%d",
        type(result).__name__,
        len(result) if isinstance(result, str) else 0,
    )
    return result


# Trims an optional image reference before field constraints are applied.
def _strip_application_image(value: object) -> object:
    """Trim surrounding whitespace from an image reference candidate.

    Args:
        value: Raw value supplied for an application image.

    Returns:
        The trimmed string when ``value`` is a string; otherwise the raw value.
    """
    logger.debug(
        "_strip_application_image entry: value_type=%s",
        type(value).__name__,
    )
    result = value.strip() if isinstance(value, str) else value
    logger.debug(
        "_strip_application_image exit: value_type=%s value_len=%d",
        type(result).__name__,
        len(result) if isinstance(result, str) else 0,
    )
    return result


# Defines the validated payload for creating an application.
class ApplicationCreate(BaseModel):
    """Request body for creating an application.

    Attributes:
        name: Exact, stripped application name.
        description: Optional application description.
        port: Optional container port.
        image: Optional container image reference.
        replicas: Optional desired replica count.
        environment: Deployment environment.
        status: Initial operational status.
    """

    model_config = ConfigDict(extra="forbid")

    name: str = Field(
        min_length=1,
        max_length=MAX_APPLICATION_NAME_LENGTH,
    )
    description: str | None = Field(
        default=None,
        max_length=MAX_APPLICATION_DESCRIPTION_LENGTH,
    )
    port: int | None = Field(
        default=None,
        ge=MIN_APPLICATION_PORT,
        le=MAX_APPLICATION_PORT,
    )
    image: str | None = Field(
        default=None,
        min_length=1,
        max_length=MAX_APPLICATION_IMAGE_LENGTH,
        pattern=r"^\S+$",
    )
    replicas: int | None = Field(
        default=None,
        ge=MIN_APPLICATION_REPLICAS,
        le=MAX_APPLICATION_REPLICAS,
    )
    environment: Environment
    status: ApplicationStatus = ApplicationStatus.UNKNOWN

    # Normalizes names before applying the declared length constraints.
    @field_validator("name", mode="before")
    @classmethod
    def _normalize_name(cls, value: object) -> object:
        """Strip whitespace from a create request name.

        Args:
            value: Raw name value from the request body.

        Returns:
            The normalized name candidate.
        """
        logger.debug("ApplicationCreate._normalize_name entry")
        result = _strip_application_name(value)
        logger.debug("ApplicationCreate._normalize_name exit")
        return result

    # Normalizes image references before applying their declared constraints.
    @field_validator("image", mode="before")
    @classmethod
    def _normalize_image(cls, value: object) -> object:
        """Strip surrounding whitespace from a create image reference.

        Args:
            value: Raw image value from the request body.

        Returns:
            The normalized image candidate.
        """
        logger.debug("ApplicationCreate._normalize_image entry")
        result = _strip_application_image(value)
        logger.debug("ApplicationCreate._normalize_image exit")
        return result


# Defines the optional, explicit payload for updating an application.
class ApplicationUpdate(BaseModel):
    """Request body for partially updating an application.

    Attributes:
        name: Optional replacement name.
        description: Optional replacement or explicit clear value.
        environment: Optional replacement environment.
        status: Optional replacement status.
        port: Optional replacement or explicit clear value.
        image: Optional replacement or explicit clear value.
        replicas: Optional replacement or explicit clear value.
    """

    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=MAX_APPLICATION_NAME_LENGTH,
    )
    description: str | None = Field(
        default=None,
        max_length=MAX_APPLICATION_DESCRIPTION_LENGTH,
    )
    environment: Environment | None = None
    status: ApplicationStatus | None = None
    port: int | None = Field(
        default=None,
        ge=MIN_APPLICATION_PORT,
        le=MAX_APPLICATION_PORT,
    )
    image: str | None = Field(
        default=None,
        min_length=1,
        max_length=MAX_APPLICATION_IMAGE_LENGTH,
        pattern=r"^\S+$",
    )
    replicas: int | None = Field(
        default=None,
        ge=MIN_APPLICATION_REPLICAS,
        le=MAX_APPLICATION_REPLICAS,
    )

    # Normalizes names before applying the declared length constraints.
    @field_validator("name", mode="before")
    @classmethod
    def _normalize_name(cls, value: object) -> object:
        """Strip whitespace from an update request name.

        Args:
            value: Raw name value from the request body.

        Returns:
            The normalized name candidate.
        """
        logger.debug("ApplicationUpdate._normalize_name entry")
        result = _strip_application_name(value)
        logger.debug("ApplicationUpdate._normalize_name exit")
        return result

    # Normalizes image references before applying their declared constraints.
    @field_validator("image", mode="before")
    @classmethod
    def _normalize_image(cls, value: object) -> object:
        """Strip surrounding whitespace from an update image reference.

        Args:
            value: Raw image value from the request body.

        Returns:
            The normalized image candidate.
        """
        logger.debug("ApplicationUpdate._normalize_image entry")
        result = _strip_application_image(value)
        logger.debug("ApplicationUpdate._normalize_image exit")
        return result

    # Enforces explicit-field semantics for PATCH requests.
    @model_validator(mode="after")
    def _validate_update_fields(self) -> Self:
        """Require one field and reject null non-nullable update fields.

        Returns:
            This validated update model.

        Raises:
            ValueError: If no field is provided or a non-nullable field is null.
        """
        logger.debug(
            "ApplicationUpdate._validate_update_fields entry: field_count=%d",
            len(self.model_fields_set),
        )
        # WHY: model_fields_set distinguishes omitted description from explicit null,
        # allowing PATCH callers to clear an existing description intentionally.
        if not self.model_fields_set:
            raise ValueError("at least one field must be provided")
        non_nullable_fields = {"name", "environment", "status"}
        if any(
            field in self.model_fields_set and getattr(self, field) is None
            for field in non_nullable_fields
        ):
            raise ValueError("name, environment, and status cannot be null")
        logger.debug("ApplicationUpdate._validate_update_fields exit: valid=%s", True)
        return self


# Defines the complete serialized representation of an application.
class ApplicationRead(BaseModel):
    """Response body for one application.

    Attributes:
        id: UUID4 string identifier.
        name: Exact stored application name.
        description: Optional application description.
        port: Optional container port.
        image: Optional container image reference.
        replicas: Optional desired replica count.
        environment: Deployment environment.
        status: Operational status.
        created_at: UTC creation timestamp.
        updated_at: UTC last-update timestamp.
        latest_deployment_version: Version of the newest deployment, if any.
        latest_deployment_status: Status of the newest deployment, if any.
        latest_deployment_at: Best available timestamp for the newest deployment.
    """

    model_config = ConfigDict(extra="forbid", from_attributes=True)

    id: str
    name: str
    description: str | None
    port: int | None = None
    image: str | None = None
    replicas: int | None = None
    environment: Environment
    status: ApplicationStatus
    created_at: datetime
    updated_at: datetime
    # WHY: deployment summaries are server-derived and never accepted on requests.
    latest_deployment_version: str | None = None
    latest_deployment_status: DeploymentStatus | None = None
    latest_deployment_at: datetime | None = None


# Defines the paginated serialized representation of applications.
class ApplicationList(BaseModel):
    """Response body for a paginated application list.

    Attributes:
        items: Applications on the requested page.
        total: Number of applications matching the filters.
        limit: Requested page size.
        offset: Number of matching records skipped.
    """

    model_config = ConfigDict(extra="forbid")

    items: list[ApplicationRead]
    total: int = Field(ge=0)
    limit: int = Field(
        ge=MIN_APPLICATION_PAGE_SIZE,
        le=MAX_APPLICATION_PAGE_SIZE,
    )
    offset: int = Field(ge=0)


__all__ = [
    "ApplicationCreate",
    "ApplicationList",
    "ApplicationRead",
    "ApplicationUpdate",
]
