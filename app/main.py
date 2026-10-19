"""HTTP API for the first phase of CloudOps Platform."""

import os

from fastapi import FastAPI
from pydantic import BaseModel


DEFAULT_APP_NAME = "CloudOps Platform"
DEFAULT_APP_VERSION = "0.1.0"


class RootResponse(BaseModel):
    name: str
    message: str


class HealthResponse(BaseModel):
    status: str


class VersionResponse(BaseModel):
    name: str
    version: str


def _environment_setting(name: str, default: str) -> str:
    """Read a non-empty setting from the environment, otherwise use its default."""
    value = os.getenv(name)
    return value.strip() if value and value.strip() else default


def create_app() -> FastAPI:
    """Create the API using the current process environment."""
    app_name = _environment_setting("APP_NAME", DEFAULT_APP_NAME)
    app_version = _environment_setting("APP_VERSION", DEFAULT_APP_VERSION)

    app = FastAPI(title=app_name, version=app_version)

    @app.get("/", response_model=RootResponse, status_code=200)
    def read_root() -> RootResponse:
        return RootResponse(
            name=app_name,
            message=f"{app_name} API is running.",
        )

    @app.get("/health", response_model=HealthResponse, status_code=200)
    def read_health() -> HealthResponse:
        return HealthResponse(status="ok")

    @app.get("/version", response_model=VersionResponse, status_code=200)
    def read_version() -> VersionResponse:
        return VersionResponse(name=app_name, version=app_version)

    return app


app = create_app()
