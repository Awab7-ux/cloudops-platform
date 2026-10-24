"""Tests for Application Pydantic request and response schemas."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.models.application import ApplicationStatus, Environment
from app.schemas.application import ApplicationCreate, ApplicationUpdate


# Verifies create names are stripped and default status is unknown.
def test_application_create_strips_name_and_defaults_status() -> None:
    """Create schema strips names and defaults status to unknown."""
    schema = ApplicationCreate(name="  Payments  ", environment=Environment.DEVELOPMENT)

    assert schema.name == "Payments"
    assert schema.status is ApplicationStatus.UNKNOWN


# Verifies whitespace-only names and name length boundaries.
def test_application_create_validates_name() -> None:
    """Create schema rejects blank names and accepts exactly 100 characters."""
    with pytest.raises(ValidationError):
        ApplicationCreate(name="   ", environment=Environment.DEVELOPMENT)

    ApplicationCreate(name="a" * 100, environment=Environment.DEVELOPMENT)
    with pytest.raises(ValidationError):
        ApplicationCreate(name="a" * 101, environment=Environment.DEVELOPMENT)


# Verifies description length boundaries and optionality.
def test_application_create_validates_description() -> None:
    """Create schema accepts 500 description characters and rejects 501."""
    ApplicationCreate(
        name="Payments",
        description="a" * 500,
        environment=Environment.DEVELOPMENT,
    )
    with pytest.raises(ValidationError):
        ApplicationCreate(
            name="Payments",
            description="a" * 501,
            environment=Environment.DEVELOPMENT,
        )


# Verifies enum values and unknown fields are rejected.
def test_application_create_rejects_invalid_enum_and_unknown_field() -> None:
    """Create schema rejects invalid enum values and extra fields."""
    with pytest.raises(ValidationError):
        ApplicationCreate(name="Payments", environment="qa")
    with pytest.raises(ValidationError):
        ApplicationCreate(
            name="Payments",
            environment=Environment.DEVELOPMENT,
            unexpected=True,
        )


# Verifies PATCH requires at least one explicitly supplied field.
def test_application_update_rejects_empty_body() -> None:
    """Update schema rejects an empty PATCH body."""
    with pytest.raises(ValidationError):
        ApplicationUpdate()


# Verifies nullable PATCH fields follow the public update contract.
def test_application_update_rejects_null_non_nullable_fields() -> None:
    """Update schema rejects null name, environment, and status values."""
    for field in ("name", "environment", "status"):
        with pytest.raises(ValidationError):
            ApplicationUpdate.model_validate({field: None})


# Verifies null description is represented as an explicit clear operation.
def test_application_update_description_null_is_explicit() -> None:
    """Update schema preserves description null in model_fields_set."""
    schema = ApplicationUpdate(description=None)

    assert schema.description is None
    assert schema.model_fields_set == {"description"}


# Verifies update names are stripped and unknown fields remain forbidden.
def test_application_update_strips_name_and_forbids_unknown_fields() -> None:
    """Update schema strips names and rejects extra fields."""
    schema = ApplicationUpdate(name="  Payments  ")
    assert schema.name == "Payments"

    with pytest.raises(ValidationError):
        ApplicationUpdate(name="Payments", unexpected=True)
