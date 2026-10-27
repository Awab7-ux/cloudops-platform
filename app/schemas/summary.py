"""Pydantic schemas for the summary endpoint payload."""

from __future__ import annotations

from datetime import datetime
import logging

from pydantic import BaseModel, ConfigDict, Field

logger = logging.getLogger(__name__)


# Summarizes the application counts and enum totals for the dashboard overview.
class ApplicationSummary(BaseModel):
    """Counts for applications grouped by status and environment."""

    model_config = ConfigDict(extra="forbid")

    total: int = Field(ge=0)
    by_status: dict[str, int]
    by_environment: dict[str, int]


# Summarizes deployment lifecycle totals and the recent 24h window.
class DeploymentSummary(BaseModel):
    """Deployment counts for lifecycle groups and recency window."""

    model_config = ConfigDict(extra="forbid")

    total: int = Field(ge=0)
    by_status: dict[str, int]
    last_24h: int = Field(ge=0)


# Summarizes the global log counts and 24h error footprint.
class LogSummary(BaseModel):
    """Global log totals and error-rate summary."""

    model_config = ConfigDict(extra="forbid")

    total: int = Field(ge=0)
    errors_last_24h: int = Field(ge=0)


# Represents one recent failed deployment in the summary response.
class RecentFailedDeployment(BaseModel):
    """A failed deployment summary item for the recent-failures list."""

    model_config = ConfigDict(extra="forbid")

    id: str
    application_id: str
    application_name: str
    commit_sha: str | None
    status: str
    finished_at: datetime | None


# Serializes the computed summary payload returned by the dashboard API.
class SummaryResponse(BaseModel):
    """Metadata form for the summary dashboard payload."""

    model_config = ConfigDict(extra="forbid")

    applications: ApplicationSummary
    deployments: DeploymentSummary
    logs: LogSummary
    recent_failed_deployments: list[RecentFailedDeployment]
    generated_at: datetime
