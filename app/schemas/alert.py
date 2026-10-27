"""Pydantic schemas for the derived alert list endpoint."""

from __future__ import annotations

from datetime import datetime
import logging

from pydantic import BaseModel, ConfigDict, Field

from app.models.alert import AlertSeverity, AlertType

logger = logging.getLogger(__name__)


# Represents one derived alert entry after aggregation and ordering.
class AlertItem(BaseModel):
    """Instance of one derived operational alert."""

    model_config = ConfigDict(extra="forbid")

    id: str
    type: AlertType
    severity: AlertSeverity
    application_id: str
    application_name: str
    deployment_id: str | None = None
    message: str
    since: datetime


# Represents the sorted and paginated alert list response.
class AlertList(BaseModel):
    """Paginated payload for the derived alert feed."""

    model_config = ConfigDict(extra="forbid")

    items: list[AlertItem]
    total: int = Field(ge=0)
    limit: int = Field(ge=1, le=200)
    offset: int = Field(ge=0)
    generated_at: datetime
