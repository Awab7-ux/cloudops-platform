"""Authentication endpoints."""

from __future__ import annotations

import logging
import time

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import create_access_token, get_current_user
from app.core.config import Settings, get_settings
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse, UserRead
from app.services.user import UserService, get_user_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])
FAILED_LOGIN_DELAY_SECONDS = 0.25


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    service: UserService = Depends(get_user_service),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    """Authenticate credentials and issue a 30-minute-by-default token."""
    user = service.authenticate(payload.username, payload.password)
    if user is None:
        time.sleep(FAILED_LOGIN_DELAY_SECONDS)
        logger.warning(
            "Authentication failed: username_length=%d",
            len(payload.username),
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return TokenResponse(
        access_token=create_access_token(user, settings),
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.get("/me", response_model=UserRead)
def read_current_user(
    current_user: User = Depends(get_current_user),
) -> UserRead:
    """Return the current authenticated user's public profile."""
    return UserRead.model_validate(current_user)
