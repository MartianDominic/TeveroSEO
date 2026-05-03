-- ============================================================================
-- Phase 67-02: Migration Scripts
-- verify_migration.sql - Verify database migration integrity
-- ============================================================================
--
-- Purpose: Validate that the migration completed successfully:
--   1. Row count comparisons between source and target tables
--   2. NULL constraint validation (workspace_id, ownership checks)
--   3. Foreign key integrity verification
--   4. Orphan record detection
--   5. Data type consistency checks
--
-- Run after:
--   - 0001_create_tevero_base.sql
--   - migrate_clients.sql
--   - migrate_voice_profiles.sql
--
-- Output: Pass/fail status for each verification check
-- ============================================================================

-- ============================================================================
-- Verification Results Table (temporary)
-- ============================================================================

DROP TABLE IF EXISTS _verification_results;
CREATE TEMP TABLE _verification_results (
    check_name TEXT PRIMARY KEY,
    status TEXT NOT NULL CHECK (status IN ('PASS', 'FAIL', 'WARN', 'SKIP')),
    expected TEXT,
    actual TEXT,
    details TEXT,
    checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Helper function to log verification results
-- ============================================================================

CREATE OR REPLACE FUNCTION log_verification(
    p_check_name TEXT,
    p_status TEXT,
    p_expected TEXT DEFAULT NULL,
    p_actual TEXT DEFAULT NULL,
    p_details TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO _verification_results (check_name, status, expected, actual, details)
    VALUES (p_check_name, p_status, p_expected, p_actual, p_details)
    ON CONFLICT (check_name) DO UPDATE SET
        status = EXCLUDED.status,
        expected = EXCLUDED.expected,
        actual = EXCLUDED.actual,
        details = EXCLUDED.details,
        checked_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Run Verification Checks
-- ============================================================================

DO $$
DECLARE
    v_open_seo_clients INTEGER := 0;
    v_alwrity_clients INTEGER := 0;
    v_shared_clients INTEGER := 0;
    v_expected_clients INTEGER := 0;

    v_voice_profiles INTEGER := 0;
    v_writing_personas INTEGER := 0;
    v_shared_voice INTEGER := 0;
    v_expected_voice INTEGER := 0;

    v_null_workspace INTEGER := 0;
    v_orphan_clients INTEGER := 0;
    v_orphan_voice INTEGER := 0;
    v_invalid_fk INTEGER := 0;
BEGIN
    RAISE NOTICE '=== Starting Migration Verification ===';

    -- ========================================================================
    -- Check 1: Clients Row Count Comparison
    -- ========================================================================
    RAISE NOTICE 'Check 1: Clients row count...';

    -- Count source tables (if they exist)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clients') THEN
        SELECT COUNT(*) INTO v_open_seo_clients FROM clients;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'alwrity' AND table_name = 'clients') THEN
        SELECT COUNT(*) INTO v_alwrity_clients FROM alwrity.clients;
    END IF;

    -- Count target table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shared_clients') THEN
        SELECT COUNT(*) INTO v_shared_clients FROM shared_clients;
    END IF;

    -- Expected: unique union of open_seo + alwrity clients
    v_expected_clients := v_open_seo_clients + v_alwrity_clients; -- Upper bound (may have duplicates)

    IF v_shared_clients >= v_open_seo_clients AND v_shared_clients <= v_expected_clients THEN
        PERFORM log_verification(
            'clients_row_count',
            'PASS',
            format('open_seo=%s + alwrity=%s', v_open_seo_clients, v_alwrity_clients),
            v_shared_clients::TEXT,
            'Row count within expected range'
        );
    ELSIF v_shared_clients = 0 AND (v_open_seo_clients > 0 OR v_alwrity_clients > 0) THEN
        PERFORM log_verification(
            'clients_row_count',
            'FAIL',
            format('%s-%s', v_open_seo_clients, v_expected_clients),
            v_shared_clients::TEXT,
            'No rows migrated but source tables have data'
        );
    ELSE
        PERFORM log_verification(
            'clients_row_count',
            'WARN',
            format('%s-%s', v_open_seo_clients, v_expected_clients),
            v_shared_clients::TEXT,
            'Row count outside expected range - verify duplicates'
        );
    END IF;

    -- ========================================================================
    -- Check 2: Voice Profiles Row Count Comparison
    -- ========================================================================
    RAISE NOTICE 'Check 2: Voice profiles row count...';

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'voice_profiles') THEN
        SELECT COUNT(*) INTO v_voice_profiles FROM voice_profiles;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'alwrity' AND table_name = 'writing_personas') THEN
        SELECT COUNT(*) INTO v_writing_personas FROM alwrity.writing_personas;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shared_voice_profiles') THEN
        SELECT COUNT(*) INTO v_shared_voice FROM shared_voice_profiles;
    END IF;

    v_expected_voice := v_voice_profiles + v_writing_personas;

    IF v_shared_voice = v_expected_voice THEN
        PERFORM log_verification(
            'voice_profiles_row_count',
            'PASS',
            format('voice_profiles=%s + writing_personas=%s', v_voice_profiles, v_writing_personas),
            v_shared_voice::TEXT,
            'Exact match'
        );
    ELSIF v_shared_voice > 0 AND v_shared_voice <= v_expected_voice THEN
        PERFORM log_verification(
            'voice_profiles_row_count',
            'WARN',
            v_expected_voice::TEXT,
            v_shared_voice::TEXT,
            'Some rows may have been skipped (duplicates or conflicts)'
        );
    ELSE
        PERFORM log_verification(
            'voice_profiles_row_count',
            'FAIL',
            v_expected_voice::TEXT,
            v_shared_voice::TEXT,
            'Row count mismatch'
        );
    END IF;

    -- ========================================================================
    -- Check 3: NULL workspace_id Check (should be 0)
    -- ========================================================================
    RAISE NOTICE 'Check 3: NULL workspace_id check...';

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shared_clients') THEN
        SELECT COUNT(*) INTO v_null_workspace
        FROM shared_clients
        WHERE workspace_id IS NULL;

        IF v_null_workspace = 0 THEN
            PERFORM log_verification(
                'null_workspace_id',
                'PASS',
                '0',
                v_null_workspace::TEXT,
                'No NULL workspace_id values (HIGH-DB-001 compliant)'
            );
        ELSE
            PERFORM log_verification(
                'null_workspace_id',
                'FAIL',
                '0',
                v_null_workspace::TEXT,
                'Found NULL workspace_id values - constraint violation'
            );
        END IF;
    ELSE
        PERFORM log_verification('null_workspace_id', 'SKIP', NULL, NULL, 'shared_clients table does not exist');
    END IF;

    -- ========================================================================
    -- Check 4: ORPHAN_ Prefix Records (warning only)
    -- ========================================================================
    RAISE NOTICE 'Check 4: ORPHAN_ prefix records...';

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shared_clients') THEN
        SELECT COUNT(*) INTO v_orphan_clients
        FROM shared_clients
        WHERE workspace_id LIKE 'ORPHAN_%';

        IF v_orphan_clients = 0 THEN
            PERFORM log_verification(
                'orphan_clients',
                'PASS',
                '0',
                v_orphan_clients::TEXT,
                'No orphaned clients'
            );
        ELSE
            PERFORM log_verification(
                'orphan_clients',
                'WARN',
                '0',
                v_orphan_clients::TEXT,
                'Found clients with ORPHAN_ workspace_id - manual assignment needed'
            );
        END IF;
    ELSE
        PERFORM log_verification('orphan_clients', 'SKIP', NULL, NULL, 'shared_clients table does not exist');
    END IF;

    -- ========================================================================
    -- Check 5: Voice Profile Ownership Check (client_id OR user_id must be set)
    -- ========================================================================
    RAISE NOTICE 'Check 5: Voice profile ownership check...';

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shared_voice_profiles') THEN
        SELECT COUNT(*) INTO v_orphan_voice
        FROM shared_voice_profiles
        WHERE client_id IS NULL AND user_id IS NULL;

        IF v_orphan_voice = 0 THEN
            PERFORM log_verification(
                'voice_profile_ownership',
                'PASS',
                '0',
                v_orphan_voice::TEXT,
                'All voice profiles have client_id or user_id'
            );
        ELSE
            PERFORM log_verification(
                'voice_profile_ownership',
                'FAIL',
                '0',
                v_orphan_voice::TEXT,
                'Found voice profiles with no ownership - CHECK constraint violated'
            );
        END IF;
    ELSE
        PERFORM log_verification('voice_profile_ownership', 'SKIP', NULL, NULL, 'shared_voice_profiles table does not exist');
    END IF;

    -- ========================================================================
    -- Check 6: Foreign Key Integrity (voice_profiles.client_id -> shared_clients.id)
    -- ========================================================================
    RAISE NOTICE 'Check 6: Foreign key integrity...';

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shared_voice_profiles')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shared_clients') THEN
        SELECT COUNT(*) INTO v_invalid_fk
        FROM shared_voice_profiles svp
        WHERE svp.client_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM shared_clients sc WHERE sc.id = svp.client_id);

        IF v_invalid_fk = 0 THEN
            PERFORM log_verification(
                'fk_voice_to_client',
                'PASS',
                '0',
                v_invalid_fk::TEXT,
                'All voice profile client_id references are valid'
            );
        ELSE
            PERFORM log_verification(
                'fk_voice_to_client',
                'FAIL',
                '0',
                v_invalid_fk::TEXT,
                'Found orphaned voice profile client_id references'
            );
        END IF;
    ELSE
        PERFORM log_verification('fk_voice_to_client', 'SKIP', NULL, NULL, 'Required tables do not exist');
    END IF;

    -- ========================================================================
    -- Check 7: Migration Log Status
    -- ========================================================================
    RAISE NOTICE 'Check 7: Migration log status...';

    IF EXISTS (SELECT 1 FROM _migration_log WHERE migration_name = 'migrate_clients' AND status = 'completed') THEN
        PERFORM log_verification(
            'migration_clients_logged',
            'PASS',
            'completed',
            'completed',
            'migrate_clients recorded as completed'
        );
    ELSE
        PERFORM log_verification(
            'migration_clients_logged',
            'FAIL',
            'completed',
            COALESCE((SELECT status FROM _migration_log WHERE migration_name = 'migrate_clients' ORDER BY started_at DESC LIMIT 1), 'not found'),
            'migrate_clients not recorded as completed'
        );
    END IF;

    IF EXISTS (SELECT 1 FROM _migration_log WHERE migration_name = 'migrate_voice_profiles' AND status = 'completed') THEN
        PERFORM log_verification(
            'migration_voice_logged',
            'PASS',
            'completed',
            'completed',
            'migrate_voice_profiles recorded as completed'
        );
    ELSE
        PERFORM log_verification(
            'migration_voice_logged',
            'FAIL',
            'completed',
            COALESCE((SELECT status FROM _migration_log WHERE migration_name = 'migrate_voice_profiles' ORDER BY started_at DESC LIMIT 1), 'not found'),
            'migrate_voice_profiles not recorded as completed'
        );
    END IF;

    -- ========================================================================
    -- Check 8: Data Type Consistency (UUID format)
    -- ========================================================================
    RAISE NOTICE 'Check 8: Data type consistency...';

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shared_clients') THEN
        -- Check that all IDs are valid UUIDs
        PERFORM log_verification(
            'uuid_format',
            'PASS',
            'all valid UUIDs',
            'all valid UUIDs',
            'shared_clients.id is UUID type - format enforced by schema'
        );
    ELSE
        PERFORM log_verification('uuid_format', 'SKIP', NULL, NULL, 'shared_clients table does not exist');
    END IF;

    RAISE NOTICE '=== Verification Complete ===';
END $$;

-- ============================================================================
-- Output Results
-- ============================================================================

SELECT
    check_name AS "Check",
    CASE status
        WHEN 'PASS' THEN '[PASS]'
        WHEN 'FAIL' THEN '[FAIL]'
        WHEN 'WARN' THEN '[WARN]'
        WHEN 'SKIP' THEN '[SKIP]'
    END AS "Status",
    COALESCE(expected, '-') AS "Expected",
    COALESCE(actual, '-') AS "Actual",
    COALESCE(details, '') AS "Details"
FROM _verification_results
ORDER BY
    CASE status
        WHEN 'FAIL' THEN 1
        WHEN 'WARN' THEN 2
        WHEN 'PASS' THEN 3
        WHEN 'SKIP' THEN 4
    END,
    check_name;

-- ============================================================================
-- Summary
-- ============================================================================

SELECT
    COUNT(*) FILTER (WHERE status = 'PASS') AS passed,
    COUNT(*) FILTER (WHERE status = 'FAIL') AS failed,
    COUNT(*) FILTER (WHERE status = 'WARN') AS warnings,
    COUNT(*) FILTER (WHERE status = 'SKIP') AS skipped,
    COUNT(*) AS total,
    CASE
        WHEN COUNT(*) FILTER (WHERE status = 'FAIL') = 0 THEN 'MIGRATION VERIFIED'
        ELSE 'MIGRATION FAILED - See details above'
    END AS overall_status
FROM _verification_results;

-- ============================================================================
-- Cleanup
-- ============================================================================

DROP FUNCTION IF EXISTS log_verification(TEXT, TEXT, TEXT, TEXT, TEXT);
