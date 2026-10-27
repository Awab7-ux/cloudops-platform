"""HTTP routes for the dashboard summary endpoint."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends

from app.schemas.summary import SummaryResponse
from app.services.summary import SummaryService, get_summary_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["summary"])


# Reads the computed dashboard summary for the current system state.
@router.get("/summary", response_model=SummaryResponse, status_code=200)
def read_summary(
    service: SummaryService = Depends(get_summary_service),
) -> SummaryResponse:
    """Return the derived dashboard summary for the application state.

    Args:
        service: Injected summary service with the current request clock.

    Returns:
        The current application, deployment, and log summary payload.
    """
    logger.debug("read_summary entry")
    response = service.get_summary()
    logger.debug("read_summary exit: generated_at=%s", response.generated_at.isoformat())
    return response
