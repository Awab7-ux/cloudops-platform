"""Business logic for system-information endpoints.

Separates the logic that builds response data from the HTTP layer,
making it independently testable and reusable.  Each public method
corresponds to a single endpoint and is covered by ``logger.debug()``
calls for observability at DEBUG level.
"""

from __future__ import annotations

import logging

from fastapi import Depends

from app.core.config import Settings, get_settings
from app.core.logging import safe_log_value
from app.schemas.system import HealthResponse, RootResponse, VersionResponse

logger = logging.getLogger(__name__)


# Builds per-request response payloads from frozen Settings; holds no mutable state.
class SystemService:
    """Builds response payloads from application settings.

    Instantiated per-request via FastAPI dependency injection so that it
    never holds mutable state across requests.

    Attributes:
        _settings: The frozen application settings.
    """

# Stores the injected Settings.
    def __init__(self, settings: Settings) -> None:
        """Initialise the service with application settings.

        Args:
            settings: The frozen application ``Settings`` instance.
        """
        self._settings = settings

# Builds RootResponse from settings.
    def get_root(self) -> RootResponse:
        """Build the root-endpoint response.

        Returns:
            ``RootResponse`` with the application name and status
            message.
        """
        logger.debug(
            "Building root response for app_name=%s",
            safe_log_value(self._settings.app_name),
        )
        return RootResponse(
            name=self._settings.app_name,
            message=f"{self._settings.app_name} API is running.",
        )

# Builds HealthResponse with status ok.
    def get_health(self) -> HealthResponse:
        """Build the health-check response.

        Returns:
            ``HealthResponse`` with status ``"ok"``.
        """
        logger.debug("Health check requested")
        return HealthResponse(status="ok")

# Builds VersionResponse from settings.
    def get_version(self) -> VersionResponse:
        """Build the version-endpoint response.

        Returns:
            ``VersionResponse`` with application name and version.
        """
        logger.debug(
            "Building version response: app_name=%s version=%s",
            safe_log_value(self._settings.app_name),
            safe_log_value(self._settings.app_version),
        )
        return VersionResponse(
            name=self._settings.app_name,
            version=self._settings.app_version,
        )


# FastAPI dependency: resolves Settings then constructs SystemService.
def get_system_service(
    settings: Settings = Depends(get_settings),
) -> SystemService:
    """FastAPI sub-dependency that creates a ``SystemService``.

    The ``Settings`` object is resolved first by ``get_settings`` (which
    reads it from ``app.state``), then passed to ``SystemService``.

    Args:
        settings: Application settings (injected by ``get_settings``).

    Returns:
        A ``SystemService`` instance for the current request.
    """
    return SystemService(settings)

