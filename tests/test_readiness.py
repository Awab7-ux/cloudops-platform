"""Tests for the database readiness endpoint."""

from __future__ import annotations

from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError


# GET /ready reports ready when the database query succeeds.
def test_ready_returns_ready_status(ready_client: TestClient) -> None:
    """A successful SELECT 1 returns the ready response."""
    response = ready_client.get("/ready", headers={"X-Request-ID": "ready-ok"})

    assert response.status_code == 200
    assert response.json() == {"status": "ready"}
    assert response.headers["x-request-id"] == "ready-ok"


# GET /ready hides database exception details and returns a safe 503.
def test_ready_returns_safe_unavailable_response(
    ready_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A failed SELECT 1 returns a safe 503 with the request ID."""
    failure_text = "database secret and SQL details"

    # Force the readiness query to fail without changing application wiring.
    def fail_execute(session: Session, statement: Any, *args: Any, **kwargs: Any) -> Any:
        """Raise a database error for the readiness query."""
        raise SQLAlchemyError(failure_text)

    monkeypatch.setattr(Session, "execute", fail_execute)

    response = ready_client.get(
        "/ready", headers={"X-Request-ID": "ready-failure"}
    )

    assert response.status_code == 503
    assert response.json() == {"detail": "database unavailable"}
    assert failure_text not in response.text
    assert response.headers["x-request-id"] == "ready-failure"


# Existing health behavior remains independent of database readiness.
def test_health_contract_is_unchanged(app: FastAPI) -> None:
    """GET /health still returns the original healthy response."""
    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

