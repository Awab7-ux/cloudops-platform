"""Pydantic schemas for authentication endpoints."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.user import UserRole


class LoginRequest(BaseModel):
    """Username and password submitted to the login endpoint."""

    model_config = ConfigDict(extra="forbid")

    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("password")
    @classmethod
    def validate_password_bytes(cls, password: str) -> str:
        if len(password.encode("utf-8")) > 72:
            raise ValueError("Password must contain at most 72 UTF-8 bytes")
        return password


class TokenResponse(BaseModel):
    """Short-lived bearer token response."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int


class UserRead(BaseModel):
    """Public user information returned by /auth/me."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    role: UserRole
    is_active: bool
    created_at: datetime
