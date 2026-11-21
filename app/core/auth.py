"""JWT creation and FastAPI authentication dependencies."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Callable

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_session
from app.models.user import User, UserRole
from app.repositories.user import UserRepository

_bearer_scheme = HTTPBearer(auto_error=False)
_WRITE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})


def create_access_token(user: User, settings: Settings) -> str:
    """Create a short-lived HS256 access token for a user."""
    now = datetime.now(timezone.utc)
    claims = {
        "sub": user.id,
        "role": user.role.value,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(claims, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> User:
    """Validate the bearer token and resolve its active user."""
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise unauthorized
    try:
        claims = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["exp", "sub", "role"]},
        )
    except jwt.InvalidTokenError:
        raise unauthorized from None
    subject = claims.get("sub")
    role = claims.get("role")
    if (
        not isinstance(subject, str)
        or not isinstance(role, str)
        or role not in {item.value for item in UserRole}
    ):
        raise unauthorized
    user = UserRepository(session).get_by_id(subject)
    if user is None or not user.is_active or user.role.value != role:
        raise unauthorized
    return user


def require_role(role: UserRole | str) -> Callable[..., User]:
    """Return a dependency that requires the specified user role."""
    expected_role = UserRole(role)

    def role_dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role != expected_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return role_dependency


def require_route_access(
    request: Request,
    current_user: User = Depends(get_current_user),
) -> User:
    """Allow authenticated reads and require admin for all write methods."""
    if request.method in _WRITE_METHODS:
        return require_role(UserRole.ADMIN)(current_user)
    return current_user
