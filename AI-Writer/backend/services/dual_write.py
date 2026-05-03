"""
Dual-write module for database consolidation.
Phase 67-03: Cutover

Implements shadow write pattern for zero-downtime migration:
  - Primary write (blocking): writes to current database
  - Shadow write (fire-and-forget): writes to tevero consolidated database

Environment variables:
  - SHADOW_WRITE_ENABLED: Set to 'true' to enable shadow writes
  - TEVERO_DATABASE_URL: Connection string for consolidated database

Requirements:
  - HIGH-DB-003: Zero-downtime cutover
  - MED-DB-007: Feature flag controlled migration
"""

import asyncio
import os
from typing import Any, Dict, Optional
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine
from sqlalchemy.exc import SQLAlchemyError
from loguru import logger

# Feature flag for shadow writes
SHADOW_WRITE_ENABLED = os.getenv("SHADOW_WRITE_ENABLED", "false").lower() == "true"

# Tevero database URL for consolidated database
TEVERO_DATABASE_URL = os.getenv("TEVERO_DATABASE_URL")

# Cached async engine for tevero database
_tevero_engine: Optional[AsyncEngine] = None


def _get_async_url(url: str) -> str:
    """Convert sync database URL to async URL."""
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    return url


def get_tevero_engine() -> Optional[AsyncEngine]:
    """
    Get or create async engine for tevero database.

    Returns None if TEVERO_DATABASE_URL is not set.
    """
    global _tevero_engine

    if not TEVERO_DATABASE_URL:
        return None

    if _tevero_engine is None:
        async_url = _get_async_url(TEVERO_DATABASE_URL)
        _tevero_engine = create_async_engine(
            async_url,
            pool_size=5,  # Smaller pool for shadow writes
            max_overflow=5,
            pool_timeout=10,
            pool_recycle=1800,
            echo=False,
        )
        logger.info("[dual-write] Tevero async engine created")

    return _tevero_engine


async def close_tevero_engine() -> None:
    """
    Close the tevero database engine.
    Call during application shutdown.
    """
    global _tevero_engine

    if _tevero_engine is not None:
        await _tevero_engine.dispose()
        _tevero_engine = None
        logger.info("[dual-write] Tevero engine closed")


async def shadow_write_client(client_data: Dict[str, Any]) -> None:
    """
    Fire-and-forget shadow write to tevero database.

    Writes client data to shared_clients table in consolidated database.
    Does not block the primary operation - errors are logged and ignored.

    Args:
        client_data: Dictionary with client fields matching shared_clients schema
    """
    if not SHADOW_WRITE_ENABLED:
        return

    if not TEVERO_DATABASE_URL:
        logger.warning("[dual-write] TEVERO_DATABASE_URL not set, skipping shadow write")
        return

    try:
        engine = get_tevero_engine()
        if engine is None:
            return

        # Build insert statement
        columns = list(client_data.keys())
        placeholders = [f":{col}" for col in columns]

        insert_sql = text(f"""
            INSERT INTO shared_clients ({", ".join(columns)})
            VALUES ({", ".join(placeholders)})
            ON CONFLICT (id) DO UPDATE SET
            {", ".join(f"{col} = EXCLUDED.{col}" for col in columns if col != "id")}
        """)

        async with engine.begin() as conn:
            await conn.execute(insert_sql, client_data)

        logger.info("[dual-write] Shadow write client successful")

    except SQLAlchemyError as e:
        # Fire-and-forget: log error but don't raise
        logger.error(f"[dual-write] Shadow write failed: {e}")
    except Exception as e:
        logger.error(f"[dual-write] Shadow write unexpected error: {e}")


async def shadow_update_client(client_id: str, update_data: Dict[str, Any]) -> None:
    """
    Fire-and-forget shadow update to tevero database.

    Updates client data in shared_clients table in consolidated database.
    Does not block the primary operation - errors are logged and ignored.

    Args:
        client_id: The client UUID to update
        update_data: Dictionary with fields to update
    """
    if not SHADOW_WRITE_ENABLED:
        return

    if not TEVERO_DATABASE_URL:
        logger.warning("[dual-write] TEVERO_DATABASE_URL not set, skipping shadow update")
        return

    try:
        engine = get_tevero_engine()
        if engine is None:
            return

        # Build update statement
        set_clauses = [f"{col} = :{col}" for col in update_data.keys()]
        update_data["id"] = client_id

        update_sql = text(f"""
            UPDATE shared_clients
            SET {", ".join(set_clauses)}, updated_at = NOW()
            WHERE id = :id
        """)

        async with engine.begin() as conn:
            await conn.execute(update_sql, update_data)

        logger.info("[dual-write] Shadow update client successful")

    except SQLAlchemyError as e:
        logger.error(f"[dual-write] Shadow update failed: {e}")
    except Exception as e:
        logger.error(f"[dual-write] Shadow update unexpected error: {e}")


def fire_and_forget_shadow_write(client_data: Dict[str, Any]) -> None:
    """
    Synchronous wrapper for fire-and-forget shadow write.

    Creates a background task that doesn't block the current thread.
    Use this from sync code paths.

    Args:
        client_data: Dictionary with client fields matching shared_clients schema
    """
    if not SHADOW_WRITE_ENABLED:
        return

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # Schedule as background task
            asyncio.create_task(shadow_write_client(client_data))
        else:
            # Run synchronously if no event loop
            loop.run_until_complete(shadow_write_client(client_data))
    except RuntimeError:
        # No event loop - create one for this operation
        asyncio.run(shadow_write_client(client_data))


def fire_and_forget_shadow_update(client_id: str, update_data: Dict[str, Any]) -> None:
    """
    Synchronous wrapper for fire-and-forget shadow update.

    Creates a background task that doesn't block the current thread.
    Use this from sync code paths.

    Args:
        client_id: The client UUID to update
        update_data: Dictionary with fields to update
    """
    if not SHADOW_WRITE_ENABLED:
        return

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(shadow_update_client(client_id, update_data))
        else:
            loop.run_until_complete(shadow_update_client(client_id, update_data))
    except RuntimeError:
        asyncio.run(shadow_update_client(client_id, update_data))


def is_shadow_write_enabled() -> bool:
    """Check if shadow write is enabled."""
    return SHADOW_WRITE_ENABLED
