"""SQLAlchemy declarative base shared by application models."""

from sqlalchemy.orm import DeclarativeBase


# Provides the metadata registry used to create application tables.
class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models."""

