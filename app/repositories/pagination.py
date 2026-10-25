"""Shared validation for repository list pagination."""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

DEFAULT_PAGE_SIZE: int = 50
MIN_PAGE_SIZE: int = 1
MAX_PAGE_SIZE: int = 200


# Validates common repository pagination values before SQL execution.
def validate_pagination(limit: int, offset: int) -> None:
    """Validate the shared page-size and offset bounds.

    Args:
        limit: Number of rows requested.
        offset: Number of matching rows to skip.

    Raises:
        ValueError: If either pagination value is outside the supported bounds.
    """
    logger.debug(
        "validate_pagination entry: limit=%d offset=%d",
        limit,
        offset,
    )
    if limit < MIN_PAGE_SIZE or limit > MAX_PAGE_SIZE:
        logger.debug("validate_pagination exit: valid=%s", False)
        raise ValueError("limit is outside the supported range")
    if offset < 0:
        logger.debug("validate_pagination exit: valid=%s", False)
        raise ValueError("offset cannot be negative")
    logger.debug("validate_pagination exit: valid=%s", True)
