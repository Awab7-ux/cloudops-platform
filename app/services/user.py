"""User account and password-authentication services."""

from __future__ import annotations

import secrets

import bcrypt
from fastapi import Depends
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.models.user import User, UserRole
from app.repositories.user import UserRepository

_DUMMY_PASSWORD_HASH = bcrypt.hashpw(secrets.token_bytes(32), bcrypt.gensalt())


def hash_password(password: str) -> str:
    """Hash a password with bcrypt without exposing it in logs."""
    encoded = password.encode("utf-8")
    if not encoded or len(encoded) > 72:
        raise ValueError("Password must contain 1 to 72 UTF-8 bytes")
    return bcrypt.hashpw(encoded, bcrypt.gensalt()).decode("ascii")


class UserService:
    """Coordinate user account creation and credential verification."""

    def __init__(self, repository: UserRepository) -> None:
        self._repository = repository

    def create_user(
        self,
        username: str,
        password: str,
        role: UserRole = UserRole.VIEWER,
    ) -> User:
        """Create a user after validating its credentials."""
        normalized_username = username.strip()
        if not normalized_username or len(normalized_username) > 100:
            raise ValueError("Username must contain 1 to 100 characters")
        return self._repository.add(
            User(
                username=normalized_username,
                password_hash=hash_password(password),
                role=role,
                is_active=True,
            )
        )

    def authenticate(self, username: str, password: str) -> User | None:
        """Return an active user only when the supplied password matches."""
        user = self._repository.get_by_username(username)
        candidate = password.encode("utf-8")
        if len(candidate) > 72:
            candidate = candidate[:72]
            user = None
        password_hash = (
            user.password_hash.encode("ascii") if user is not None else _DUMMY_PASSWORD_HASH
        )
        password_matches = bcrypt.checkpw(candidate, password_hash)
        if user is None or not user.is_active or not password_matches:
            return None
        return user


def get_user_service(session: Session = Depends(get_session)) -> UserService:
    """Build the user service for the current request session."""
    return UserService(UserRepository(session))
