"""Response schemas for system endpoints.

These Pydantic models define the JSON shape of responses returned by the
system routes (``/``, ``/health``, ``/version``).  They serve as both
runtime validation and automatic OpenAPI documentation.
"""

from pydantic import BaseModel


# Pydantic model for GET / response (name, message).
class RootResponse(BaseModel):
    """Response body for ``GET /``.

    Attributes:
        name: The application name.
        message: A human-readable status message.
    """

    name: str
    message: str


# Pydantic model for GET /health response (status).
class HealthResponse(BaseModel):
    """Response body for ``GET /health``.

    Attributes:
        status: Health-check result, always ``"ok"`` for a running
            service.
    """

    status: str


# Pydantic model for GET /ready response (database status).
class ReadyResponse(BaseModel):
    """Response body for ``GET /ready``.

    Attributes:
        status: Database readiness result, ``"ready"`` on success.
    """

    status: str


# Pydantic model for GET /version response (name, version).
class VersionResponse(BaseModel):
    """Response body for ``GET /version``.

    Attributes:
        name: The application name.
        version: The semantic version string.
    """

    name: str
    version: str

