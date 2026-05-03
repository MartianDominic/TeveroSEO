"""
SQLAlchemy reflection models for Drizzle-owned tables.
Phase 67-01: Schema Design (Database Consolidation)

These models use SQLAlchemy's table reflection to read schemas from tables
that are owned and migrated by Drizzle ORM. This allows AI-Writer to
query shared_clients and shared_voice_profiles without duplicating schema
definitions.

ORM Boundary:
  - Drizzle owns: shared_*, seo_*, biz_*, analytics_* tables (migrations)
  - SQLAlchemy owns: content_* tables (migrations)
  - SQLAlchemy reflects: shared_* tables (read-only schema)

Usage:
    from models.shared_models import SharedClient, SharedVoiceProfile, get_reflected_tables

    # In a route or service:
    db: Session = Depends(get_shared_db)
    clients = db.query(SharedClient).filter_by(workspace_id=workspace_id).all()
"""

from typing import Optional
from sqlalchemy import Table, MetaData, inspect
from sqlalchemy.orm import Session
from loguru import logger

from services.shared_db import engine

# Metadata for reflected tables
# Use a separate metadata instance to avoid conflicts with ORM-defined tables
_reflected_metadata = MetaData()

# Table cache to avoid repeated reflection
_table_cache: dict[str, Table] = {}


def _get_reflected_table(table_name: str) -> Optional[Table]:
    """
    Get a reflected Table object for a Drizzle-owned table.

    Uses caching to avoid repeated reflection calls which are expensive.

    Args:
        table_name: Name of the table to reflect (e.g., 'shared_clients')

    Returns:
        SQLAlchemy Table object or None if table doesn't exist
    """
    if table_name in _table_cache:
        return _table_cache[table_name]

    try:
        # Check if table exists before reflecting
        inspector = inspect(engine)
        if table_name not in inspector.get_table_names():
            logger.warning(f"Table {table_name} does not exist yet - may need migration")
            return None

        # Reflect the table schema from the database
        table = Table(
            table_name,
            _reflected_metadata,
            autoload_with=engine,
        )
        _table_cache[table_name] = table
        logger.debug(f"Reflected table: {table_name}")
        return table

    except Exception as e:
        logger.error(f"Failed to reflect table {table_name}: {e}")
        return None


def get_reflected_tables() -> dict[str, Optional[Table]]:
    """
    Get all Drizzle-owned tables that AI-Writer needs to access.

    Returns:
        Dict mapping table names to reflected Table objects
    """
    tables = {
        "shared_clients": _get_reflected_table("shared_clients"),
        "shared_voice_profiles": _get_reflected_table("shared_voice_profiles"),
        "seo_gsc_daily_snapshots": _get_reflected_table("seo_gsc_daily_snapshots"),
        "seo_ga4_daily_snapshots": _get_reflected_table("seo_ga4_daily_snapshots"),
    }
    return tables


def clear_reflection_cache() -> None:
    """
    Clear the table reflection cache.

    Call this after schema migrations to ensure fresh reflection.
    """
    global _table_cache
    _table_cache = {}
    _reflected_metadata.clear()
    logger.info("Cleared SQLAlchemy reflection cache")


# ---------------------------------------------------------------------------
# Convenience accessors for commonly used tables
# These are lazy-loaded to avoid reflection errors during module import
# ---------------------------------------------------------------------------

class SharedClient:
    """
    Accessor for the shared_clients table (Drizzle-owned).

    This is not an ORM model - it provides a Table object for raw queries.
    Use with session.execute() or session.query().

    Example:
        from models.shared_models import SharedClient

        # Raw query
        result = db.execute(
            SharedClient.table.select().where(
                SharedClient.table.c.workspace_id == workspace_id
            )
        )

        # Or with text
        from sqlalchemy import select
        stmt = select(SharedClient.table).where(
            SharedClient.table.c.workspace_id == workspace_id
        )
        clients = db.execute(stmt).fetchall()
    """

    _table: Optional[Table] = None

    @classmethod
    @property
    def table(cls) -> Table:
        """Get the reflected shared_clients table."""
        if cls._table is None:
            cls._table = _get_reflected_table("shared_clients")
        if cls._table is None:
            raise RuntimeError(
                "shared_clients table not found. "
                "Run Drizzle migrations first: pnpm db:migrate"
            )
        return cls._table

    @classmethod
    def exists(cls) -> bool:
        """Check if the shared_clients table exists."""
        return _get_reflected_table("shared_clients") is not None


class SharedVoiceProfile:
    """
    Accessor for the shared_voice_profiles table (Drizzle-owned).

    This is not an ORM model - it provides a Table object for raw queries.
    Use with session.execute() or session.query().

    Example:
        from models.shared_models import SharedVoiceProfile

        # Get voice profile for a client
        stmt = select(SharedVoiceProfile.table).where(
            SharedVoiceProfile.table.c.client_id == client_id
        )
        profile = db.execute(stmt).fetchone()
    """

    _table: Optional[Table] = None

    @classmethod
    @property
    def table(cls) -> Table:
        """Get the reflected shared_voice_profiles table."""
        if cls._table is None:
            cls._table = _get_reflected_table("shared_voice_profiles")
        if cls._table is None:
            raise RuntimeError(
                "shared_voice_profiles table not found. "
                "Run Drizzle migrations first: pnpm db:migrate"
            )
        return cls._table

    @classmethod
    def exists(cls) -> bool:
        """Check if the shared_voice_profiles table exists."""
        return _get_reflected_table("shared_voice_profiles") is not None


class SeoGscDailySnapshot:
    """
    Accessor for the seo_gsc_daily_snapshots table (Drizzle-owned).

    Provides read access to GSC analytics data stored by open-seo-main.
    """

    _table: Optional[Table] = None

    @classmethod
    @property
    def table(cls) -> Table:
        """Get the reflected seo_gsc_daily_snapshots table."""
        if cls._table is None:
            cls._table = _get_reflected_table("seo_gsc_daily_snapshots")
        if cls._table is None:
            raise RuntimeError(
                "seo_gsc_daily_snapshots table not found. "
                "Run Drizzle migrations first: pnpm db:migrate"
            )
        return cls._table

    @classmethod
    def exists(cls) -> bool:
        """Check if the seo_gsc_daily_snapshots table exists."""
        return _get_reflected_table("seo_gsc_daily_snapshots") is not None


class SeoGa4DailySnapshot:
    """
    Accessor for the seo_ga4_daily_snapshots table (Drizzle-owned).

    Provides read access to GA4 analytics data stored by open-seo-main.
    """

    _table: Optional[Table] = None

    @classmethod
    @property
    def table(cls) -> Table:
        """Get the reflected seo_ga4_daily_snapshots table."""
        if cls._table is None:
            cls._table = _get_reflected_table("seo_ga4_daily_snapshots")
        if cls._table is None:
            raise RuntimeError(
                "seo_ga4_daily_snapshots table not found. "
                "Run Drizzle migrations first: pnpm db:migrate"
            )
        return cls._table

    @classmethod
    def exists(cls) -> bool:
        """Check if the seo_ga4_daily_snapshots table exists."""
        return _get_reflected_table("seo_ga4_daily_snapshots") is not None


# Export all public classes and functions
__all__ = [
    "SharedClient",
    "SharedVoiceProfile",
    "SeoGscDailySnapshot",
    "SeoGa4DailySnapshot",
    "get_reflected_tables",
    "clear_reflection_cache",
]
