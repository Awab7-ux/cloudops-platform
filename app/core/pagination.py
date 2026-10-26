"""Shared pagination contracts used across API schemas and repositories."""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

DEFAULT_PAGE_SIZE: int = 50
MIN_PAGE_SIZE: int = 1
MAX_PAGE_SIZE: int = 200


# Validates shared list-pagination bounds before a SQL query executes.
def validate_pagination(limit: int, offset: int) -> None:
    """Validate a requested ``limit`` and ``offset`` pair.

    Args:
        limit: Number of rows the caller requests.
        offset: Number of rows to skip before the page begins.

    Raises:
        ValueError: If the page size or offset falls outside the supported range.
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
