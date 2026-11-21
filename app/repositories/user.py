"""SQLAlchemy repository for user persistence."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.user import User


class UserRepository:
    """Read and persist user rows through a request-scoped session."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def get_by_id(self, user_id: str) -> User | None:
        """Find a user by its primary key."""
        return self._session.get(User, user_id)

    def get_by_username(self, username: str) -> User | None:
        """Find a user by its exact username."""
        return self._session.scalar(select(User).where(User.username == username))

    def count(self) -> int:
        """Return the number of registered users."""
        return int(self._session.scalar(select(func.count()).select_from(User)) or 0)

    def add(self, user: User) -> User:
        """Persist and refresh a new user."""
        self._session.add(user)
        self._session.commit()
        self._session.refresh(user)
        return user
