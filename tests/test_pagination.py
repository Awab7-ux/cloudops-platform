"""Tests for shared repository pagination validation."""

from __future__ import annotations

import pytest

from app.repositories.pagination import validate_pagination


# Verifies invalid page sizes use the established validation message.
@pytest.mark.parametrize("limit", (0, 201))
def test_validate_pagination_rejects_invalid_limits(limit: int) -> None:
    """Reject page sizes below one or above two hundred."""
    with pytest.raises(
        ValueError,
        match="limit is outside the supported range",
    ):
        validate_pagination(limit, 0)


# Verifies supported page sizes and offsets are accepted.
@pytest.mark.parametrize("limit", (1, 200))
@pytest.mark.parametrize("offset", (0,))
def test_validate_pagination_accepts_valid_values(limit: int, offset: int) -> None:
    """Accept the inclusive page-size bounds and zero offset."""
    validate_pagination(limit, offset)


# Verifies negative offsets use the established validation message.
def test_validate_pagination_rejects_negative_offset() -> None:
    """Reject a negative offset before SQL execution."""
    with pytest.raises(ValueError, match="offset cannot be negative"):
        validate_pagination(50, -1)
