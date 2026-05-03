"""
Shared PostgreSQL engine for agency-wide data (clients, settings).

Completely separate from services/database.py which handles per-user SQLite.
Do NOT import or modify database.py.

Phase 67-03 additions:
  - TEVERO_DATABASE_URL support for consolidated database
  - get_tevero_db() for tevero connection pooling
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session, declarative_base
from loguru import logger
from typing import Generator, Optional

# Use DATABASE_URL from env (set in docker-compose.yml as
# postgresql://alwrity:${POSTGRES_PASSWORD}@db:5432/alwrity).
# Fall back to a local SQLite file for developer machines without Docker.
_DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "sqlite:///./alwrity_shared.db",
)

# SQLite needs check_same_thread=False; PostgreSQL does not need it.
_connect_args: dict = (
    {"check_same_thread": False} if _DATABASE_URL.startswith("sqlite") else {}
)

# Pool configuration differs between SQLite and PostgreSQL
if _DATABASE_URL.startswith("sqlite"):
    # SQLite doesn't support connection pooling the same way
    # Use StaticPool for SQLite to avoid threading issues
    from sqlalchemy.pool import StaticPool
    engine = create_engine(
        _DATABASE_URL,
        connect_args=_connect_args,
        poolclass=StaticPool,
    )
else:
    # PostgreSQL: Configure proper connection pool to prevent exhaustion
    engine = create_engine(
        _DATABASE_URL,
        connect_args=_connect_args,
        pool_pre_ping=True,  # Health check before using connection
        pool_size=10,  # Maintain 10 connections in pool
        max_overflow=20,  # Allow up to 20 additional connections under load
        pool_timeout=30,  # Wait 30s for available connection before error
        pool_recycle=1800,  # Recycle connections after 30 minutes
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Separate declarative base — NEVER mix with the per-user SQLite bases.
SharedBase = declarative_base()


def get_shared_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency that yields a SQLAlchemy Session for the shared database.

    Usage in route:
        db: Session = Depends(get_shared_db)
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ============================================================================
# Tevero Consolidated Database Connection (Phase 67-03)
# ============================================================================

_TEVERO_DATABASE_URL: Optional[str] = os.getenv("TEVERO_DATABASE_URL")

# Tevero engine and session factory (lazy initialized)
_tevero_engine = None
_TeveroSessionLocal = None


def _get_tevero_engine():
    """Get or create the tevero database engine."""
    global _tevero_engine

    if _tevero_engine is not None:
        return _tevero_engine

    if not _TEVERO_DATABASE_URL:
        return None

    # Tevero is always PostgreSQL
    _tevero_engine = create_engine(
        _TEVERO_DATABASE_URL,
        pool_pre_ping=True,
        pool_size=5,  # Smaller pool for shadow/migration writes
        max_overflow=10,
        pool_timeout=30,
        pool_recycle=1800,
    )
    logger.info("[shared_db] Tevero engine created")
    return _tevero_engine


def get_tevero_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency that yields a SQLAlchemy Session for the tevero database.

    Returns None if TEVERO_DATABASE_URL is not configured.

    Usage in route:
        db: Session = Depends(get_tevero_db)
    """
    global _TeveroSessionLocal

    engine = _get_tevero_engine()
    if engine is None:
        logger.warning("[shared_db] TEVERO_DATABASE_URL not set, cannot provide tevero session")
        yield None
        return

    if _TeveroSessionLocal is None:
        _TeveroSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    db = _TeveroSessionLocal()
    try:
        yield db
    finally:
        db.close()


def close_tevero_engine() -> None:
    """
    Close the tevero database engine.
    Call during application shutdown.
    """
    global _tevero_engine, _TeveroSessionLocal

    if _tevero_engine is not None:
        _tevero_engine.dispose()
        _tevero_engine = None
        _TeveroSessionLocal = None
        logger.info("[shared_db] Tevero engine closed")
