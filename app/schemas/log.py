"""Pydantic schemas for validated log payloads and paginated responses."""

from __future__ import annotations

from datetime import datetime
import logging

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.pagination import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MIN_PAGE_SIZE
from app.models.log import LogLevel

logger = logging.getLogger(__name__)

MAX_LOG_MESSAGE_LENGTH: int = 2000
MAX_LOG_SOURCE_LENGTH: int = 100


# Defines the strict payload accepted when appending a new log row.
class LogCreate(BaseModel):
    """Request body for creating a new append-only log entry."""

    model_config = ConfigDict(extra="forbid")

    level: LogLevel = LogLevel.INFO
    message: str = Field(
        min_length=1,
        max_length=MAX_LOG_MESSAGE_LENGTH,
    )
    source: str | None = Field(
        default=None,
        min_length=1,
        max_length=MAX_LOG_SOURCE_LENGTH,
    )
    deployment_id: str | None = None

    # Tidies user input before the field-level length validation runs.
    @field_validator("message", mode="before")
    @classmethod
    def _normalize_message(cls, value: object) -> object:
        """Trim whitespace from a candidate log payload before validation.

        Args:
            value: Raw message body from the request.

        Returns:
            The stripped message candidate.
        """
        logger.debug("LogCreate._normalize_message entry")
        result = value.strip() if isinstance(value, str) else value
        logger.debug("LogCreate._normalize_message exit")
        return result

    # Strips caller-provided source names before validation.
    @field_validator("source", mode="before")
    @classmethod
    def _normalize_source(cls, value: object) -> object:
        """Trim and validate optional source names before persistence.

        Args:
            value: Raw source value from the request.

        Returns:
            The trimmed source candidate or the original value.
        """
        logger.debug("LogCreate._normalize_source entry")
        result = value.strip() if isinstance(value, str) else value
        logger.debug("LogCreate._normalize_source exit")
        return result


# Represents one persisted log row in a serialized API response.
class LogRead(BaseModel):
    """Serialized log row returned from the API."""

    model_config = ConfigDict(extra="forbid", from_attributes=True)

    id: str
    application_id: str
    deployment_id: str | None
    level: LogLevel
    message: str
    source: str | None
    created_at: datetime


# Defines the standard paginated response for log lists.
class LogList(BaseModel):
    """Paginated response body returned by log listing endpoints."""

    model_config = ConfigDict(extra="forbid")

    items: list[LogRead]
    total: int = Field(ge=0)
    limit: int = Field(
        default=DEFAULT_PAGE_SIZE,
        ge=MIN_PAGE_SIZE,
        le=MAX_PAGE_SIZE,
    )
    offset: int = Field(ge=0)


__all__ = ["LogCreate", "LogList", "LogRead"]
