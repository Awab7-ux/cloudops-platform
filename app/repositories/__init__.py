"""Data-access repositories for the CloudOps Platform application."""

from app.repositories.application import ApplicationRepository
from app.repositories.deployment import DeploymentRepository

__all__ = ["ApplicationRepository", "DeploymentRepository"]
