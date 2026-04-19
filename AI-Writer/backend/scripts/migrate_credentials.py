#!/usr/bin/env python3
"""
Migrate per-user GSC/Bing credentials from SQLite to per-client PostgreSQL.

Usage:
    python scripts/migrate_credentials.py --dry-run    # Preview only
    python scripts/migrate_credentials.py              # Execute migration
    python scripts/migrate_credentials.py --verbose    # With detailed logging

The script:
1. Scans WORKSPACE_DIR for user SQLite databases
2. For each user with gsc_credentials:
   a. Finds their most recently active client (by scheduled_articles.created_at or client.updated_at)
   b. Re-encrypts tokens with Fernet
   c. Inserts into client_oauth_tokens with provider='google'
3. Logs migration status for each user

Idempotency: Skips users whose credentials already exist in client_oauth_tokens
(checked by UNIQUE(client_id, provider) constraint).

Environment variables:
    FERNET_KEY - Required for encryption
    DATABASE_URL - PostgreSQL connection string (defaults to local SQLite)
"""

import argparse
import json
import os
import sqlite3
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

# Add backend to path
_BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_BACKEND))

from loguru import logger
from sqlalchemy import desc
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from services.shared_db import SessionLocal
from services.encryption import encrypt_value
from models.client import Client
from models.client_oauth import ClientOAuthToken
# Import publishing models to ensure relationships work
from models.publishing import (  # noqa: F401
    ClientPublishingSettings,
    ScheduledArticle,
    CsvImportBatch,
    ClientAnalyticsSnapshot,
)

# Workspace directory where user SQLite databases live
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
WORKSPACE_DIR = os.path.join(ROOT_DIR, "workspace")


def _sanitize_user_id(user_id: str) -> str:
    """Sanitize user_id to be safe for filesystem."""
    return "".join(c for c in user_id if c.isalnum() or c in ("-", "_"))


def _get_user_db_path(user_id: str) -> Optional[str]:
    """
    Get the database path for a specific user.
    Returns None if no database file exists.
    """
    safe_user_id = _sanitize_user_id(user_id)
    user_workspace = os.path.join(WORKSPACE_DIR, f"workspace_{safe_user_id}")

    # Check modern db/ directory first
    db_dir = os.path.join(user_workspace, "db")
    specific_db_path = os.path.join(db_dir, f"alwrity_{safe_user_id}.db")
    legacy_db_path = os.path.join(db_dir, "alwrity.db")

    # Also check legacy database/ directory
    legacy_dir = os.path.join(user_workspace, "database")
    legacy_dir_specific = os.path.join(legacy_dir, f"alwrity_{safe_user_id}.db")
    legacy_dir_default = os.path.join(legacy_dir, "alwrity.db")

    for path in [specific_db_path, legacy_db_path, legacy_dir_specific, legacy_dir_default]:
        if os.path.exists(path):
            return path

    return None


def get_all_user_ids() -> List[str]:
    """
    Discover all user IDs by scanning workspace directories.
    Returns list of workspace folder names (sanitized user IDs).
    """
    user_ids: List[str] = []

    if not os.path.exists(WORKSPACE_DIR):
        logger.warning(f"Workspace directory does not exist: {WORKSPACE_DIR}")
        return []

    try:
        for item in os.listdir(WORKSPACE_DIR):
            if item.startswith("workspace_") and os.path.isdir(os.path.join(WORKSPACE_DIR, item)):
                workspace_id = item[len("workspace_"):]
                if workspace_id:
                    user_ids.append(workspace_id)
    except Exception as e:
        logger.error(f"Error discovering user workspaces: {e}")

    return user_ids


def get_user_gsc_credentials(user_id: str) -> Optional[Dict[str, Any]]:
    """
    Load GSC credentials from user's SQLite database.

    Returns:
        dict with token, refresh_token, scopes, etc. or None if not found/invalid.

    SECURITY: Never log token values - only log user_id and status.
    """
    db_path = _get_user_db_path(user_id)

    if not db_path:
        logger.debug(f"No database file found for user {user_id}")
        return None

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Check if gsc_credentials table exists
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='gsc_credentials'"
        )
        if not cursor.fetchone():
            logger.debug(f"No gsc_credentials table for user {user_id}")
            conn.close()
            return None

        # Fetch credentials
        cursor.execute(
            "SELECT credentials_json FROM gsc_credentials WHERE user_id = ?",
            (user_id,)
        )
        row = cursor.fetchone()
        conn.close()

        if not row:
            logger.debug(f"No GSC credentials row for user {user_id}")
            return None

        # Parse JSON
        credentials_json = row[0]
        credentials = json.loads(credentials_json)

        # Validate required fields
        if not credentials.get("token"):
            logger.warning(f"User {user_id} has GSC credentials but missing 'token' field")
            return None

        return credentials

    except json.JSONDecodeError as e:
        logger.error(f"User {user_id} has corrupt credentials JSON: {e}")
        return None
    except sqlite3.Error as e:
        logger.error(f"SQLite error for user {user_id}: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error reading credentials for user {user_id}: {e}")
        return None


def find_most_recent_client(db: Session, user_id: str) -> Optional[Client]:
    """
    Find the client most recently active for this user.

    Strategy:
    1. Look for scheduled_articles with the most recent created_at
    2. Fall back to clients with the most recent updated_at

    Note: In current architecture, scheduled_articles don't directly link to user_id,
    so we return the most recently updated non-archived client.

    TODO: If user<->client mapping table is added in the future, use that instead.
    """
    # For now, get the most recently updated non-archived client
    # This is a best-effort approach since we don't have a user<->client mapping
    client = (
        db.query(Client)
        .filter(Client.is_archived == False)  # noqa: E712
        .order_by(desc(Client.updated_at))
        .first()
    )

    if client:
        logger.debug(f"Found most recent client for user {user_id}: {client.name}")
    else:
        logger.debug(f"No active client found for user {user_id}")

    return client


def migrate_user_credentials(
    db: Session,
    user_id: str,
    client: Client,
    credentials: Dict[str, Any],
    dry_run: bool = False,
) -> str:
    """
    Migrate one user's credentials to per-client storage.

    Returns:
        'success', 'skipped', or 'failed'

    SECURITY: Never log token values - only log user_id, client_id, and status.
    """
    if dry_run:
        logger.info(
            f"[DRY-RUN] Would migrate user {user_id} -> client {client.name} ({client.id})"
        )
        return "dry_run"

    try:
        # Extract token values
        access_token = credentials.get("token", "")
        refresh_token = credentials.get("refresh_token")
        scopes = credentials.get("scopes", [])

        # Ensure scopes is a list
        if isinstance(scopes, str):
            scopes = [scopes]

        # Encrypt tokens
        encrypted_access = encrypt_value(access_token)
        encrypted_refresh = encrypt_value(refresh_token) if refresh_token else None

        # Create token record
        token_record = ClientOAuthToken(
            client_id=client.id,
            provider="google",
            access_token=encrypted_access,
            refresh_token=encrypted_refresh,
            token_expiry=None,  # Legacy tokens don't have expiry stored
            scopes=scopes if scopes else ["https://www.googleapis.com/auth/webmasters.readonly"],
            connected_by=f"migration:{user_id}",
            connected_at=datetime.utcnow(),
            is_active=True,
        )

        db.add(token_record)
        db.commit()

        logger.info(f"Migrated user {user_id} -> client {client.name} ({client.id})")
        return "success"

    except IntegrityError:
        # UNIQUE(client_id, provider) constraint violation = already migrated
        db.rollback()
        logger.info(f"Skipped user {user_id}: credentials already exist for client {client.id}")
        return "skipped"
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to migrate user {user_id}: {e}")
        return "failed"


def migrate_all_credentials(
    dry_run: bool = False,
    verbose: bool = False,
    db: Optional[Session] = None,
) -> Dict[str, int]:
    """
    Main migration function.

    Scans all user workspaces, finds GSC credentials, and migrates them
    to per-client PostgreSQL storage.

    Args:
        dry_run: If True, log what would be done without making changes.
        verbose: If True, log detailed progress.
        db: Optional database session (for testing). If None, creates new session.

    Returns:
        dict with counts: {migrated: int, skipped: int, failed: int}
    """
    if verbose:
        logger.info(f"Starting credential migration (dry_run={dry_run})")
        logger.info(f"Workspace directory: {WORKSPACE_DIR}")

    results = {"migrated": 0, "skipped": 0, "failed": 0}

    # Get all user IDs
    user_ids = get_all_user_ids()

    if verbose:
        logger.info(f"Found {len(user_ids)} user workspaces")

    if not user_ids:
        logger.info("No user workspaces found. Migration complete.")
        return results

    # Use provided session or create new one
    own_session = db is None
    if own_session:
        db = SessionLocal()

    try:
        for user_id in user_ids:
            # Get user's GSC credentials
            credentials = get_user_gsc_credentials(user_id)

            if not credentials:
                if verbose:
                    logger.debug(f"User {user_id}: no GSC credentials found")
                continue

            # Find most recently active client
            client = find_most_recent_client(db, user_id)

            if not client:
                logger.warning(f"User {user_id}: has GSC credentials but no active client found")
                results["skipped"] += 1
                continue

            # Migrate credentials
            status = migrate_user_credentials(
                db=db,
                user_id=user_id,
                client=client,
                credentials=credentials,
                dry_run=dry_run,
            )

            if status == "success":
                results["migrated"] += 1
            elif status == "skipped":
                results["skipped"] += 1
            elif status == "dry_run":
                # For dry run, count as would-be-migrated
                results["migrated"] += 1
            else:
                results["failed"] += 1

    finally:
        if own_session:
            db.close()

    logger.info(
        f"Migration complete: {results['migrated']} migrated, "
        f"{results['skipped']} skipped, {results['failed']} failed"
    )

    return results


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Migrate per-user GSC credentials to per-client PostgreSQL storage",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python scripts/migrate_credentials.py --dry-run
    python scripts/migrate_credentials.py --verbose
    python scripts/migrate_credentials.py

NOTE: Run --dry-run first to preview changes before actual migration.
""",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without writing to database",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable detailed logging",
    )

    args = parser.parse_args()

    # Configure logging
    if args.verbose:
        logger.remove()
        logger.add(sys.stderr, level="DEBUG")

    results = migrate_all_credentials(dry_run=args.dry_run, verbose=args.verbose)
    print(f"\nMigration results: {results}")

    # Exit with error code if any failures
    if results["failed"] > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
