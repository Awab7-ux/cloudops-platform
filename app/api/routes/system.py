"""System endpoint routes: root, health, and version.

This module handles only HTTP concerns — request parsing, response
serialisation, and status codes.  All business logic is delegated to
``SystemService`` via FastAPI's ``Depends`` mechanism.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.schemas.system import HealthResponse, RootResponse, VersionResponse
from app.services.system import SystemService, get_system_service

router = APIRouter(tags=["system"])


@router.get("/", response_model=RootResponse, status_code=200)
def read_root(
    service: SystemService = Depends(get_system_service),
) -> RootResponse:
    """Return basic service information.

    Args:
        service: Injected ``SystemService`` instance.

    Returns:
        ``RootResponse`` with the service name and a running message.
    """
    return service.get_root()


@router.get("/health", response_model=HealthResponse, status_code=200)
def read_health(
    service: SystemService = Depends(get_system_service),
) -> HealthResponse:
    """Return the service health status.

    Args:
        service: Injected ``SystemService`` instance.

    Returns:
        ``HealthResponse`` with status ``"ok"``.
    """
    return service.get_health()


@router.get("/version", response_model=VersionResponse, status_code=200)
def read_version(
    service: SystemService = Depends(get_system_service),
) -> VersionResponse:
    """Return the service name and version.

    Args:
        service: Injected ``SystemService`` instance.

    Returns:
        ``VersionResponse`` with the service name and version.
    """
    return service.get_version()

