"""Tests for Application repository data-access operations."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from sqlalchemy import Engine
from sqlalchemy.orm import Session

from app.domain.exceptions import ConflictError
from app.models.application import Application, ApplicationStatus, Environment
from app.repositories.application import ApplicationRepository


# Creates a model instance with the required application fields.
def _make_application(
    name: str,
    environment: Environment,
    status: ApplicationStatus = ApplicationStatus.UNKNOWN,
) -> Application:
    """Build an application fixture for repository tests.

    Args:
        name: Application name.
        environment: Application environment.
        status: Application status.

    Returns:
        An unsaved application model.
    """
    return Application(name=name, environment=environment, status=status)


# Verifies repository CRUD operations and name lookup.
def test_application_repository_crud(in_memory_engine: Engine) -> None:
    """Repository creates, reads, updates, and deletes applications."""
    with Session(in_memory_engine) as session:
        repository = ApplicationRepository(session)
        application = repository.add(
            _make_application("Payments", Environment.DEVELOPMENT)
        )

        assert repository.get(application.id) is application
        assert repository.get_by_name("Payments") is application

        application.description = "Updated"
        updated = repository.update(application)
        assert updated.description == "Updated"

        repository.delete(application)
        assert repository.get(application.id) is None


# Verifies filters apply to both rows and total count.
def test_application_repository_filters_and_total(in_memory_engine: Engine) -> None:
    """Repository filters by environment and status with matching totals."""
    with Session(in_memory_engine) as session:
        repository = ApplicationRepository(session)
        repository.add(_make_application("One", Environment.STAGING))
        repository.add(
            _make_application("Two", Environment.STAGING, ApplicationStatus.DEGRADED)
        )
        repository.add(_make_application("Three", Environment.PRODUCTION))

        items, total = repository.list(
            limit=50,
            offset=0,
            environment=Environment.STAGING,
            status=ApplicationStatus.DEGRADED,
        )

        assert total == 1
        assert [item.name for item in items] == ["Two"]


# Verifies equal timestamps use ascending ids as a deterministic tie-break.
def test_application_repository_ordering_tie_break(in_memory_engine: Engine) -> None:
    """Repository orders equal creation timestamps by ascending id."""
    with Session(in_memory_engine) as session:
        repository = ApplicationRepository(session)
        first = repository.add(_make_application("First", Environment.DEVELOPMENT))
        second = repository.add(_make_application("Second", Environment.DEVELOPMENT))
        equal_time = datetime(2026, 1, 1, tzinfo=timezone.utc)
        first.created_at = equal_time
        second.created_at = equal_time
        repository.update(first)
        repository.update(second)

        items, _ = repository.list(limit=50, offset=0)

        assert [item.id for item in items] == sorted(item.id for item in items)


# Verifies bounded pagination returns a page and total matching all rows.
def test_application_repository_pagination_bounds(in_memory_engine: Engine) -> None:
    """Repository paginates valid bounds and rejects invalid bounds."""
    with Session(in_memory_engine) as session:
        repository = ApplicationRepository(session)
        for name in ("One", "Two", "Three"):
            repository.add(_make_application(name, Environment.DEVELOPMENT))

        items, total = repository.list(limit=2, offset=1)
        assert len(items) == 2
        assert total == 3

        for limit, offset in ((0, 0), (201, 0), (1, -1)):
            with pytest.raises(ValueError):
                repository.list(limit=limit, offset=offset)


# Verifies a database uniqueness race becomes a safe domain conflict.
def test_application_repository_integrity_error_rolls_back(
    in_memory_engine: Engine,
) -> None:
    """Repository rolls back and raises ConflictError for duplicate names."""
    with Session(in_memory_engine) as session:
        repository = ApplicationRepository(session)
        repository.add(_make_application("Payments", Environment.DEVELOPMENT))

        with pytest.raises(ConflictError):
            repository.add(_make_application("Payments", Environment.STAGING))

        assert session.is_active
        assert repository.get_by_name("Payments") is not None


# Verifies repository pages order rows by newest explicit creation time first.
def test_application_repository_orders_newest_first(in_memory_engine: Engine) -> None:
    """Repository returns applications from newest to oldest."""
    timestamps = [
        datetime(2026, 1, 1, tzinfo=timezone.utc),
        datetime(2026, 1, 2, tzinfo=timezone.utc),
        datetime(2026, 1, 3, tzinfo=timezone.utc),
    ]
    with Session(in_memory_engine) as session:
        repository = ApplicationRepository(session)
        for name, timestamp in zip(("Oldest", "Middle", "Newest"), timestamps):
            repository.add(
                Application(
                    name=name,
                    environment=Environment.DEVELOPMENT,
                    created_at=timestamp,
                    updated_at=timestamp,
                )
            )

        items, total = repository.list(limit=50, offset=0)

    assert total == 3
    assert [item.name for item in items] == ["Newest", "Middle", "Oldest"]


# Verifies ascending IDs break ties for many identical creation timestamps.
def test_application_repository_tie_break_with_many_rows(
    in_memory_engine: Engine,
) -> None:
    """Repository orders five equal-time rows by ascending ID."""
    timestamp = datetime(2026, 1, 1, tzinfo=timezone.utc)
    with Session(in_memory_engine) as session:
        repository = ApplicationRepository(session)
        for number in range(5, 0, -1):
            application_id = f"00000000-0000-4000-8000-00000000000{number}"
            repository.add(
                Application(
                    id=application_id,
                    name=f"Application {number}",
                    environment=Environment.DEVELOPMENT,
                    created_at=timestamp,
                    updated_at=timestamp,
                )
            )

        items, total = repository.list(limit=50, offset=0)

    expected_ids = [
        f"00000000-0000-4000-8000-00000000000{number}"
        for number in range(1, 6)
    ]
    assert total == 5
    assert [item.id for item in items] == expected_ids


# Verifies page contents and total remain correct at and beyond the last page.
def test_application_repository_page_contents(in_memory_engine: Engine) -> None:
    """Repository returns the requested page and an empty final page."""
    with Session(in_memory_engine) as session:
        repository = ApplicationRepository(session)
        for number in range(1, 6):
            timestamp = datetime(2026, 1, number, tzinfo=timezone.utc)
            repository.add(
                Application(
                    name=f"Application {number}",
                    environment=Environment.DEVELOPMENT,
                    created_at=timestamp,
                    updated_at=timestamp,
                )
            )

        page, total = repository.list(limit=2, offset=2)
        final_page, final_total = repository.list(limit=2, offset=5)

    assert [item.name for item in page] == ["Application 3", "Application 2"]
    assert total == 5
    assert final_page == []
    assert final_total == 5
