"""Tests for SQLite foreign-key enforcement in database engines."""

from __future__ import annotations

from sqlalchemy import (
    Column,
    ForeignKey,
    Integer,
    MetaData,
    String,
    Table,
    select,
    text,
)

from app.db.session import create_db_engine


# Verifies SQLite engines enable foreign-key enforcement on connections.
def test_sqlite_foreign_keys_enabled() -> None:
    """SQLite connections report foreign-key enforcement as enabled."""
    engine = create_db_engine("sqlite://")
    try:
        with engine.connect() as connection:
            assert connection.scalar(text("PRAGMA foreign_keys")) == 1
    finally:
        engine.dispose()


# Verifies enabled SQLite foreign keys enforce parent-delete cascades.
def test_sqlite_foreign_key_cascade() -> None:
    """Deleting a parent removes its dependent child row."""
    metadata = MetaData()
    parents = Table(
        "fk_test_parents",
        metadata,
        Column("id", Integer, primary_key=True),
    )
    children = Table(
        "fk_test_children",
        metadata,
        Column("id", Integer, primary_key=True),
        Column(
            "parent_id",
            Integer,
            ForeignKey("fk_test_parents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        Column("value", String(20), nullable=False),
    )
    engine = create_db_engine("sqlite://")
    try:
        metadata.create_all(engine)
        with engine.begin() as connection:
            connection.execute(parents.insert().values(id=1))
            connection.execute(
                children.insert().values(id=1, parent_id=1, value="child")
            )
            connection.execute(parents.delete().where(parents.c.id == 1))
            remaining = connection.scalar(
                select(children.c.id).where(children.c.parent_id == 1)
            )
        assert remaining is None
    finally:
        metadata.drop_all(engine)
        engine.dispose()
