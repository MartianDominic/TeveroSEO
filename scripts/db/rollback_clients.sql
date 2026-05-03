-- ============================================================================
-- Phase 67-02: Migration Scripts
-- rollback_clients.sql - Rollback clients migration
-- ============================================================================
--
-- Purpose: Restore original client tables from backups and clear shared_clients
--
-- Prerequisites:
--   - _backup_open_seo_clients and/or _backup_alwrity_clients must exist
--   - This is a DESTRUCTIVE operation - data in shared_clients will be lost
--
-- Run order (reverse of migration):
--   1. rollback_voice_profiles.sql (depends on shared_clients FK)
--   2. rollback_clients.sql (this file)
--
-- ============================================================================

BEGIN;

DO $$
DECLARE
    v_migration_id INTEGER;
    v_restored_open_seo INTEGER := 0;
    v_restored_alwrity INTEGER := 0;
    v_deleted_shared INTEGER := 0;
BEGIN
    -- ========================================================================
    -- Log rollback start
    -- ========================================================================
    INSERT INTO _migration_log (migration_name, status)
    VALUES ('rollback_clients', 'started')
    RETURNING id INTO v_migration_id;

    BEGIN
        RAISE NOTICE 'Starting rollback of clients migration...';

        -- ====================================================================
        -- Clear foreign key references first (voice_profiles)
        -- ====================================================================
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'shared_voice_profiles'
        ) THEN
            UPDATE shared_voice_profiles SET client_id = NULL
            WHERE client_id IS NOT NULL;
            RAISE NOTICE 'Cleared client_id references in shared_voice_profiles';
        END IF;

        -- ====================================================================
        -- Delete migrated data from shared_clients
        -- ====================================================================
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'shared_clients'
        ) THEN
            DELETE FROM shared_clients;
            GET DIAGNOSTICS v_deleted_shared = ROW_COUNT;
            RAISE NOTICE 'Deleted % rows from shared_clients', v_deleted_shared;
        END IF;

        -- ====================================================================
        -- Restore open_seo.clients from backup
        -- ====================================================================
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = '_backup_open_seo_clients'
        ) THEN
            -- Drop existing clients table if exists
            DROP TABLE IF EXISTS clients_old;

            -- Rename current clients to _old if it exists
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'clients'
            ) THEN
                ALTER TABLE clients RENAME TO clients_old;
            END IF;

            -- Recreate clients from backup (excluding backup metadata columns)
            CREATE TABLE clients AS
            SELECT
                id,
                workspace_id,
                name,
                domain,
                contact_email,
                contact_name,
                industry,
                status,
                converted_from_prospect_id,
                gsc_refresh_token,
                gsc_site_url,
                gsc_connected_at,
                kickoff_scheduled_at,
                kickoff_completed_at,
                onboarding_completed_at,
                baseline_metrics,
                target_keywords,
                preferred_language,
                country,
                created_at,
                updated_at,
                is_deleted
            FROM _backup_open_seo_clients;

            GET DIAGNOSTICS v_restored_open_seo = ROW_COUNT;
            RAISE NOTICE 'Restored % rows to open_seo.clients from backup', v_restored_open_seo;

            -- Drop the old table
            DROP TABLE IF EXISTS clients_old;
        ELSE
            RAISE NOTICE '_backup_open_seo_clients not found, skipping restore.';
        END IF;

        -- ====================================================================
        -- Restore alwrity.clients from backup
        -- ====================================================================
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'alwrity' AND table_name = '_backup_alwrity_clients'
        ) THEN
            -- Note: This restores to alwrity schema if it exists
            IF EXISTS (
                SELECT 1 FROM information_schema.schemata
                WHERE schema_name = 'alwrity'
            ) THEN
                DROP TABLE IF EXISTS alwrity.clients_old;

                IF EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'alwrity' AND table_name = 'clients'
                ) THEN
                    ALTER TABLE alwrity.clients RENAME TO clients_old;
                END IF;

                -- Recreate alwrity.clients from backup
                EXECUTE 'CREATE TABLE alwrity.clients AS
                SELECT
                    id,
                    name,
                    website_url,
                    workspace_id,
                    is_archived,
                    created_at,
                    updated_at
                FROM _backup_alwrity_clients';

                GET DIAGNOSTICS v_restored_alwrity = ROW_COUNT;
                RAISE NOTICE 'Restored % rows to alwrity.clients from backup', v_restored_alwrity;

                DROP TABLE IF EXISTS alwrity.clients_old;
            ELSE
                RAISE NOTICE 'alwrity schema does not exist, skipping restore.';
            END IF;
        ELSE
            RAISE NOTICE '_backup_alwrity_clients not found, skipping restore.';
        END IF;

        -- ====================================================================
        -- Update migration log
        -- ====================================================================
        UPDATE _migration_log
        SET
            status = 'completed',
            completed_at = NOW(),
            rows_affected = v_deleted_shared,
            duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000
        WHERE id = v_migration_id;

        -- Also mark the original migration as rolled back
        UPDATE _migration_log
        SET status = 'rolled_back'
        WHERE migration_name = 'migrate_clients'
        AND status = 'completed';

        RAISE NOTICE 'Rollback completed. Restored: open_seo=%, alwrity=%, Deleted from shared=%',
            v_restored_open_seo, v_restored_alwrity, v_deleted_shared;

    EXCEPTION WHEN OTHERS THEN
        UPDATE _migration_log
        SET
            status = 'failed',
            completed_at = NOW(),
            error_message = SQLERRM,
            duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000
        WHERE id = v_migration_id;
        RAISE;
    END;
END $$;

COMMIT;
