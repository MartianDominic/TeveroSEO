"""
Unit tests for migration script: per-user GSC credentials to per-client PostgreSQL.

Test coverage:
- Test 1: User with GSC credentials and one active client -> migrated successfully
- Test 2: User with GSC credentials and multiple clients -> uses most recently active
- Test 3: User with no clients -> skipped with warning
- Test 4: User with invalid/corrupt credentials_json -> skipped with error log
- Test 5: Running migration twice -> second run skips already-migrated (idempotent)
- Test 6: Dry run mode -> logs but does not write to PostgreSQL

Run with:
    cd backend && pytest tests/test_migrate_credentials.py -v
"""

import json
import os
import sqlite3
import sys
import tempfile
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import patch

import pytest
from cryptography.fernet import Fernet
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# ---------------------------------------------------------------------------
# Path setup - backend/ must be on sys.path before importing project modules.
# ---------------------------------------------------------------------------
_BACKEND = Path(__file__).resolve().parent.parent
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

# Set a test Fernet key BEFORE importing any project modules that read env vars.
_TEST_FERNET_KEY = Fernet.generate_key().decode()
os.environ["FERNET_KEY"] = _TEST_FERNET_KEY
# Disable auth so we don't need Clerk keys during tests.
os.environ.setdefault("DISABLE_AUTH", "true")
os.environ.setdefault("ALWRITY_ENABLED_FEATURES", "core")

# ---------------------------------------------------------------------------
# Now import project modules after env setup
# ---------------------------------------------------------------------------
from services.shared_db import SharedBase
from services.encryption import encrypt_value, decrypt_value
from models.client import Client
# Import publishing models to register them with SQLAlchemy (Client has relationships to them)
from models.publishing import (  # noqa: F401
    ClientPublishingSettings,
    ScheduledArticle,
    CsvImportBatch,
    ClientAnalyticsSnapshot,
)
from models.client_oauth import ClientOAuthToken, ClientOAuthProperty, ClientConnectInvite

# Import the migration module (will fail in RED phase - expected)
from scripts.migrate_credentials import (
    get_user_gsc_credentials,
    find_most_recent_client,
    migrate_user_credentials,
    migrate_all_credentials,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def pg_session():
    """
    Yield a fresh in-memory SQLite session for each test (simulating PostgreSQL).
    Creates all SharedBase tables, yields session, then tears down.
    """
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SharedBase.metadata.create_all(engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        SharedBase.metadata.drop_all(engine)


@pytest.fixture()
def mock_user_data_dir(tmp_path):
    """
    Create a temporary directory structure that mimics USER_DATA_DIR.
    Returns the path to the workspace directory.
    """
    workspace_dir = tmp_path / "workspace"
    workspace_dir.mkdir()
    return workspace_dir


@pytest.fixture()
def sqlite_user_db(mock_user_data_dir):
    """
    Factory fixture that creates SQLite user databases with gsc_credentials table.
    Returns a function to create user DBs.
    """
    def _create_user_db(user_id: str, credentials_json: dict = None):
        user_workspace = mock_user_data_dir / f"workspace_{user_id}"
        user_workspace.mkdir(exist_ok=True)
        db_dir = user_workspace / "db"
        db_dir.mkdir(exist_ok=True)
        db_path = db_dir / f"alwrity_{user_id}.db"

        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()

        # Create gsc_credentials table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS gsc_credentials (
                user_id TEXT PRIMARY KEY,
                credentials_json TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        if credentials_json is not None:
            cursor.execute(
                "INSERT INTO gsc_credentials (user_id, credentials_json) VALUES (?, ?)",
                (user_id, json.dumps(credentials_json))
            )

        conn.commit()
        conn.close()
        return db_path

    return _create_user_db


@pytest.fixture()
def sample_client(pg_session):
    """Create a sample client for FK references."""
    client = Client(
        id=uuid.uuid4(),
        name="Test Client",
        website_url="https://testclient.com",
    )
    pg_session.add(client)
    pg_session.commit()
    pg_session.refresh(client)
    return client


@pytest.fixture()
def valid_gsc_credentials():
    """Return valid GSC credentials JSON structure."""
    return {
        "token": "ya29.test_access_token_abc123",
        "refresh_token": "1//test_refresh_token_xyz",
        "token_uri": "https://oauth2.googleapis.com/token",
        "client_id": "test_client_id.apps.googleusercontent.com",
        "client_secret": "test_client_secret",
        "scopes": ["https://www.googleapis.com/auth/webmasters.readonly"],
    }


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestMigrateUserWithOneClient:
    """Test 1: User with GSC credentials and one active client -> migrated successfully."""

    def test_user_with_one_client_migrated(
        self, pg_session, mock_user_data_dir, sqlite_user_db, sample_client, valid_gsc_credentials
    ):
        """User with GSC credentials and one active client is migrated successfully."""
        user_id = "user_single_client"

        # Create user SQLite DB with credentials
        sqlite_user_db(user_id, valid_gsc_credentials)

        # Create a scheduled article to link user to client (most recently active)
        article = ScheduledArticle(
            id=uuid.uuid4(),
            client_id=sample_client.id,
            title="Test Article",
            status="draft",
        )
        pg_session.add(article)
        pg_session.commit()

        # Mock the workspace directory
        with patch("scripts.migrate_credentials.WORKSPACE_DIR", str(mock_user_data_dir)):
            # Run migration
            result = migrate_all_credentials(dry_run=False, verbose=True)

        # Verify migration result
        assert result["migrated"] >= 1

        # Verify credentials were stored in PostgreSQL
        token = pg_session.query(ClientOAuthToken).filter_by(
            client_id=sample_client.id,
            provider="google"
        ).first()

        assert token is not None
        assert token.is_active is True
        assert token.connected_by == f"migration:{user_id}"

        # Verify tokens are encrypted and decryptable
        assert isinstance(token.access_token, bytes)
        decrypted_access = decrypt_value(token.access_token)
        assert decrypted_access == valid_gsc_credentials["token"]


class TestMigrateUserWithMultipleClients:
    """Test 2: User with GSC credentials and multiple clients -> uses most recently active."""

    def test_user_with_multiple_clients_uses_most_recent(
        self, pg_session, mock_user_data_dir, sqlite_user_db, valid_gsc_credentials
    ):
        """User with multiple clients is migrated to the most recently active one."""
        user_id = "user_multi_client"

        # Create user SQLite DB with credentials
        sqlite_user_db(user_id, valid_gsc_credentials)

        # Create two clients
        old_client = Client(
            id=uuid.uuid4(),
            name="Old Client",
            website_url="https://oldclient.com",
        )
        new_client = Client(
            id=uuid.uuid4(),
            name="New Client",
            website_url="https://newclient.com",
        )
        pg_session.add_all([old_client, new_client])
        pg_session.commit()

        # Create articles with different timestamps
        old_article = ScheduledArticle(
            id=uuid.uuid4(),
            client_id=old_client.id,
            title="Old Article",
            status="published",
            created_at=datetime.utcnow() - timedelta(days=30),
        )
        new_article = ScheduledArticle(
            id=uuid.uuid4(),
            client_id=new_client.id,
            title="New Article",
            status="draft",
            created_at=datetime.utcnow() - timedelta(hours=1),  # More recent
        )
        pg_session.add_all([old_article, new_article])
        pg_session.commit()

        # Mock the workspace directory
        with patch("scripts.migrate_credentials.WORKSPACE_DIR", str(mock_user_data_dir)):
            result = migrate_all_credentials(dry_run=False, verbose=True)

        # Verify credentials were stored against the NEWER client
        token = pg_session.query(ClientOAuthToken).filter_by(
            client_id=new_client.id,
            provider="google"
        ).first()

        assert token is not None, "Token should be stored against newer client"

        # Verify OLD client has no token
        old_token = pg_session.query(ClientOAuthToken).filter_by(
            client_id=old_client.id,
            provider="google"
        ).first()

        assert old_token is None, "Old client should not have a token"


class TestMigrateUserWithNoClients:
    """Test 3: User with no clients -> skipped with warning."""

    def test_user_with_no_clients_skipped(
        self, pg_session, mock_user_data_dir, sqlite_user_db, valid_gsc_credentials
    ):
        """User with GSC credentials but no clients is skipped with warning."""
        user_id = "user_no_clients"

        # Create user SQLite DB with credentials
        sqlite_user_db(user_id, valid_gsc_credentials)

        # Mock the workspace directory (no clients created in pg_session)
        with patch("scripts.migrate_credentials.WORKSPACE_DIR", str(mock_user_data_dir)):
            result = migrate_all_credentials(dry_run=False, verbose=True)

        # Verify user was skipped
        assert result["skipped"] >= 1

        # Verify no tokens were created
        tokens = pg_session.query(ClientOAuthToken).all()
        assert len(tokens) == 0


class TestMigrateUserWithCorruptCredentials:
    """Test 4: User with invalid/corrupt credentials_json -> skipped with error log."""

    def test_user_with_corrupt_credentials_skipped(
        self, pg_session, mock_user_data_dir, sample_client
    ):
        """User with corrupt credentials JSON is skipped with error log."""
        user_id = "user_corrupt_creds"

        # Create user workspace with corrupt credentials manually
        user_workspace = mock_user_data_dir / f"workspace_{user_id}"
        user_workspace.mkdir(exist_ok=True)
        db_dir = user_workspace / "db"
        db_dir.mkdir(exist_ok=True)
        db_path = db_dir / f"alwrity_{user_id}.db"

        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS gsc_credentials (
                user_id TEXT PRIMARY KEY,
                credentials_json TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        # Insert corrupt JSON (not valid JSON)
        cursor.execute(
            "INSERT INTO gsc_credentials (user_id, credentials_json) VALUES (?, ?)",
            (user_id, "not valid json {{{")
        )
        conn.commit()
        conn.close()

        # Create a scheduled article to link user to client
        article = ScheduledArticle(
            id=uuid.uuid4(),
            client_id=sample_client.id,
            title="Test Article",
            status="draft",
        )
        pg_session.add(article)
        pg_session.commit()

        # Mock the workspace directory
        with patch("scripts.migrate_credentials.WORKSPACE_DIR", str(mock_user_data_dir)):
            result = migrate_all_credentials(dry_run=False, verbose=True)

        # Verify user was marked as failed
        assert result["failed"] >= 1

        # Verify no tokens were created for this user
        tokens = pg_session.query(ClientOAuthToken).all()
        assert len(tokens) == 0


class TestMigrationIdempotency:
    """Test 5: Running migration twice -> second run skips already-migrated (idempotent)."""

    def test_migration_is_idempotent(
        self, pg_session, mock_user_data_dir, sqlite_user_db, sample_client, valid_gsc_credentials
    ):
        """Running migration twice does not duplicate data."""
        user_id = "user_idempotent"

        # Create user SQLite DB with credentials
        sqlite_user_db(user_id, valid_gsc_credentials)

        # Create a scheduled article to link user to client
        article = ScheduledArticle(
            id=uuid.uuid4(),
            client_id=sample_client.id,
            title="Test Article",
            status="draft",
        )
        pg_session.add(article)
        pg_session.commit()

        # Mock the workspace directory
        with patch("scripts.migrate_credentials.WORKSPACE_DIR", str(mock_user_data_dir)):
            # First migration run
            result1 = migrate_all_credentials(dry_run=False, verbose=True)

            # Second migration run
            result2 = migrate_all_credentials(dry_run=False, verbose=True)

        # First run should migrate
        assert result1["migrated"] >= 1

        # Second run should skip (already exists due to UNIQUE constraint)
        assert result2["skipped"] >= 1

        # Verify only ONE token exists
        tokens = pg_session.query(ClientOAuthToken).filter_by(
            client_id=sample_client.id,
            provider="google"
        ).all()
        assert len(tokens) == 1


class TestDryRunMode:
    """Test 6: Dry run mode -> logs but does not write to PostgreSQL."""

    def test_dry_run_does_not_write(
        self, pg_session, mock_user_data_dir, sqlite_user_db, sample_client, valid_gsc_credentials
    ):
        """Dry run mode logs but does not write to PostgreSQL."""
        user_id = "user_dry_run"

        # Create user SQLite DB with credentials
        sqlite_user_db(user_id, valid_gsc_credentials)

        # Create a scheduled article to link user to client
        article = ScheduledArticle(
            id=uuid.uuid4(),
            client_id=sample_client.id,
            title="Test Article",
            status="draft",
        )
        pg_session.add(article)
        pg_session.commit()

        # Mock the workspace directory
        with patch("scripts.migrate_credentials.WORKSPACE_DIR", str(mock_user_data_dir)):
            result = migrate_all_credentials(dry_run=True, verbose=True)

        # Dry run should report what WOULD be migrated
        # (could be 0 or 1 depending on implementation - but should not write)

        # Verify NO tokens were created in PostgreSQL
        tokens = pg_session.query(ClientOAuthToken).all()
        assert len(tokens) == 0, "Dry run should not create any tokens"
