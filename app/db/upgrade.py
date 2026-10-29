"""Small additive SQLite schema upgrades for existing local databases."""

from __future__ import annotations

import logging

from sqlalchemy import Engine
from sqlalchemy.engine import Connection

from app.core.logging import safe_log_value

logger = logging.getLogger(__name__)

SQLITE_ADDITIVE_COLUMNS: tuple[tuple[str, str, str], ...] = (
    ("applications", "port", "INTEGER"),
    ("applications", "image", "VARCHAR(255)"),
    ("applications", "replicas", "INTEGER"),
    ("deployments", "branch", "VARCHAR(100)"),
    ("deployments", "initiator", "VARCHAR(100)"),
)


# Returns current column names for one fixed application table.
def _sqlite_column_names(connection: Connection, table_name: str) -> set[str]:
    """Read a SQLite table's current column names.

    Args:
        connection: Connection to the live SQLite database.
        table_name: Fixed table name from ``SQLITE_ADDITIVE_COLUMNS``.

    Returns:
        Names currently present in the table.
    """
    logger.debug(
        "_sqlite_column_names entry: table=%s",
        safe_log_value(table_name),
    )
    # WHY: PRAGMA reads the live schema because create_all does not alter tables.
    rows = connection.exec_driver_sql(f"PRAGMA table_info({table_name})").all()
    names = {str(row[1]) for row in rows}
    logger.debug(
        "_sqlite_column_names exit: table=%s column_count=%d",
        safe_log_value(table_name),
        len(names),
    )
    return names


# Adds missing nullable columns to an existing SQLite schema.
def upgrade_sqlite_schema(engine: Engine) -> int:
    """Add the optional design fields when an older SQLite schema is present.

    Args:
        engine: Configured SQLAlchemy engine used by the application.

    Returns:
        Number of nullable columns added during this invocation.

    Raises:
        Exception: If SQLite cannot inspect or alter the live schema.
    """
    logger.debug(
        "upgrade_sqlite_schema entry: dialect=%s",
        safe_log_value(engine.dialect.name),
    )
    if engine.dialect.name != "sqlite":
        logger.debug("upgrade_sqlite_schema exit: added_column_count=%d", 0)
        return 0

    added_column_count = 0
    try:
        with engine.begin() as connection:
            for table_name, column_name, column_type in SQLITE_ADDITIVE_COLUMNS:
                current_columns = _sqlite_column_names(connection, table_name)
                if column_name in current_columns:
                    logger.debug(
                        "upgrade_sqlite_schema column_present: table=%s column=%s",
                        safe_log_value(table_name),
                        safe_log_value(column_name),
                    )
                    continue
                # WHY: every new column is nullable and has no default, preserving rows.
                connection.exec_driver_sql(
                    f"ALTER TABLE {table_name} "
                    f"ADD COLUMN {column_name} {column_type}"
                )
                added_column_count += 1
                logger.debug(
                    "upgrade_sqlite_schema column_added: table=%s column=%s",
                    safe_log_value(table_name),
                    safe_log_value(column_name),
                )
    except Exception as exc:
        # WHY: log only the exception type so database paths and values stay private.
        logger.error(
            "SQLite additive schema upgrade failed: exception_type=%s",
            safe_log_value(type(exc).__name__),
        )
        raise

    logger.debug(
        "upgrade_sqlite_schema exit: added_column_count=%d",
        added_column_count,
    )
    return added_column_count
