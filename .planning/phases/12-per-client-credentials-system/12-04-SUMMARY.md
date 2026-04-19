---
phase: 12-per-client-credentials-system
plan: 04
subsystem: backend
tags: [migration, sqlite, postgresql, fernet, encryption, cli, tdd]

# Dependency graph
requires:
  - phase: 12-03
    provides: OAuth connection UI, clientOAuth API wiring
provides:
  - Migration script for per-user SQLite credentials to per-client PostgreSQL
  - Dry-run mode for safe preview before execution
  - Idempotent execution (safe to run multiple times)
  - Audit trail via connected_by field
affects: [13-analytics-data-layer]

# Tech tracking
tech-stack:
  added: []
  patterns: [dependency-injection-for-tests, workspace-directory-discovery, fernet-re-encryption]

key-files:
  created:
    - AI-Writer/backend/scripts/migrate_credentials.py
    - AI-Writer/backend/tests/test_migrate_credentials.py
  modified: []

key-decisions:
  - "Test session injection via optional db parameter for test isolation"
  - "WORKSPACE_DIR discovery pattern: scan workspace_* directories for user SQLite DBs"
  - "connected_by format: 'migration:{user_id}' for audit trail"
  - "Most recently updated non-archived client used when user->client mapping unavailable"
  - "Fernet re-encryption of tokens before PostgreSQL storage"

patterns-established:
  - "Migration script pattern: dry-run mode, verbose logging, CLI interface"
  - "Idempotency via UNIQUE constraint on (client_id, provider)"
  - "Test fixtures: sqlite_user_db factory, mock_user_data_dir temp directory"

requirements-completed: [CREDS-10]

# TDD Gate Compliance
tdd-gates:
  red: 43f0b992
  green: f56b3077
  refactor: null

# Metrics
duration: 25min
completed: 2026-04-19
---

# Phase 12 Plan 04: Credential Migration Script Summary

**One-time migration script for per-user GSC credentials from SQLite to per-client PostgreSQL with TDD, dry-run mode, and idempotency**

## Performance

- **Duration:** 25 min
- **Started:** 2026-04-19T09:30:00Z
- **Completed:** 2026-04-19T09:55:00Z
- **Tasks:** 4 (3 auto + 1 human-verify checkpoint)
- **Files created:** 2

## Accomplishments
- Migration script at AI-Writer/backend/scripts/migrate_credentials.py with CLI interface
- Dry-run mode (--dry-run) for safe preview without database writes
- Verbose mode (--verbose) for detailed logging during execution
- Idempotent: UNIQUE(client_id, provider) constraint prevents duplicates on re-run
- Audit trail: connected_by field stores 'migration:{user_id}' for traceability
- 6 unit tests covering all edge cases (RED/GREEN TDD flow completed)

## Task Commits

Each task was committed atomically following TDD:

1. **Task 1: Create unit tests (RED)** - `43f0b992` (test)
2. **Task 2: Create migration script** - `b5b8ef65` (feat)
3. **Task 3: Run tests (GREEN)** - `f56b3077` (fix)
4. **Task 4: Human verification** - checkpoint approved

## Files Created

- `AI-Writer/backend/scripts/migrate_credentials.py` - Migration script with:
  - CLI interface (--dry-run, --verbose flags)
  - WORKSPACE_DIR scanning for user SQLite databases
  - Fernet re-encryption of tokens
  - connected_by audit trail
  - Idempotent upsert via UNIQUE constraint
  
- `AI-Writer/backend/tests/test_migrate_credentials.py` - Unit tests covering:
  - User with one client -> migrated successfully
  - User with multiple clients -> uses most recently active
  - User with no clients -> skipped with warning
  - User with corrupt credentials -> skipped with error log
  - Running twice -> second run skips (idempotent)
  - Dry run mode -> logs but does not write

## Decisions Made

- **Test session injection:** Migration function accepts optional `db` parameter for test isolation (avoids real database during tests)
- **Workspace discovery:** Scans `workspace/workspace_*` directories to find user SQLite databases
- **Client selection:** Uses most recently updated non-archived client (best-effort since user->client mapping table not available)
- **Encryption:** Tokens re-encrypted with Fernet before PostgreSQL storage; never logged

## TDD Gate Compliance

- RED gate commit: `43f0b992` - test(12-04): add failing tests for credential migration script
- GREEN gate commit: `f56b3077` - fix(12-04): pass test session to migration for dependency injection
- REFACTOR gate: Not needed (clean implementation)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test session dependency injection**
- **Found during:** Task 3 (GREEN phase)
- **Issue:** Tests failed because migration script created its own database session, not using the test's in-memory database
- **Fix:** Added optional `db` parameter to `migrate_all_credentials()` function to allow test session injection
- **Files modified:** AI-Writer/backend/scripts/migrate_credentials.py
- **Verification:** All 6 tests now pass
- **Committed in:** f56b3077

---

**Total deviations:** 1 auto-fixed (1 blocking issue)
**Impact on plan:** Standard TDD iteration - test failure in GREEN phase required implementation fix.

## Issues Encountered
None - TDD flow worked as expected. RED phase tests failed, implementation was written, GREEN phase passed after session injection fix.

## User Setup Required

Before running migration in production:
1. Ensure `FERNET_KEY` environment variable is set (same key used for encryption)
2. Ensure `DATABASE_URL` environment variable points to PostgreSQL
3. Run `--dry-run` first to preview changes
4. Coordinate maintenance window for actual migration

## Next Phase Readiness

- Migration script ready for production use
- Phase 12 complete: per-client credentials system fully implemented
- Phase 13 (Analytics Data Layer) can proceed: credentials now available per-client for GSC/GA4 sync

## Self-Check: PASSED

- [x] AI-Writer/backend/scripts/migrate_credentials.py - FOUND
- [x] AI-Writer/backend/tests/test_migrate_credentials.py - FOUND
- [x] Commit 43f0b992 - FOUND
- [x] Commit b5b8ef65 - FOUND
- [x] Commit f56b3077 - FOUND

---
*Phase: 12-per-client-credentials-system*
*Completed: 2026-04-19*
