"""
Alembic env.py for the AI-Writer shared database.

Phase 67-01: Schema Design (Database Consolidation)

ORM Boundary:
  - SQLAlchemy/Alembic owns: content_* tables
  - Drizzle owns: shared_*, seo_*, biz_*, analytics_* tables

This configuration uses include_object to filter tables so Alembic
only manages content_* tables and skips Drizzle-owned namespaces.

Does NOT touch the per-user SQLite databases managed by services/database.py.
"""

import os
import sys
from pathlib import Path
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

# Add backend/ to sys.path so we can import project modules.
_BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

# Import SharedBase (which has Client and ClientSettings registered on it
# once models/client.py is imported).
from services.shared_db import SharedBase  # noqa: E402
import models.client  # noqa: E402  — registers Client + ClientSettings on SharedBase
from models.global_settings import GlobalSettings  # noqa: F401  — registers on SharedBase

# Phase 6+ models — imported once created in Phase 7
# import models.publishing  # noqa: F401

# Alembic Config object.
config = context.config

# Override sqlalchemy.url from environment, falling back to SQLite for local dev.
_database_url = os.getenv("DATABASE_URL", "sqlite:///./alwrity_shared.db")
config.set_main_option("sqlalchemy.url", _database_url)

# Interpret logging config from alembic.ini.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = SharedBase.metadata


# ORM Boundary: Table prefixes owned by Drizzle (skip in Alembic)
DRIZZLE_OWNED_PREFIXES = (
    "shared_",      # Unified client/voice tables
    "seo_",         # SEO audit, analytics, checks
    "biz_",         # Business/prospect pipeline
    "analytics_",   # Analytics snapshots
)

# Tables explicitly owned by SQLAlchemy/Alembic
SQLALCHEMY_OWNED_PREFIXES = (
    "content_",     # Content generation tables
)


def include_object(obj, name, type_, reflected, compare_to):
    """
    Filter function for Alembic autogenerate.

    Returns True if the object should be managed by Alembic.
    Returns False if the object is owned by Drizzle and should be skipped.

    Phase 67-01: ORM boundary enforcement.
    """
    if type_ == "table":
        # Skip tables owned by Drizzle
        if name.startswith(DRIZZLE_OWNED_PREFIXES):
            return False

        # Explicitly include content_* tables
        if name.startswith(SQLALCHEMY_OWNED_PREFIXES):
            return True

        # For legacy tables without namespace prefix, include them
        # These will be migrated to namespaced versions in future phases
        return True

    # Include all non-table objects (indexes, constraints, etc.)
    return True


def run_migrations_offline() -> None:
    """Run migrations in offline mode (no DB connection needed)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations with a live DB connection."""
    # SQLite needs check_same_thread=False.
    connect_args = (
        {"check_same_thread": False}
        if _database_url.startswith("sqlite")
        else {}
    )
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args=connect_args,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_object=include_object,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
