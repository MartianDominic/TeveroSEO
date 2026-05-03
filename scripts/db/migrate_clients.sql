-- ============================================================================
-- Phase 67-02: Migration Scripts
-- migrate_clients.sql - Migrate clients from open_seo and alwrity to shared_clients
-- ============================================================================
--
-- Prerequisites:
--   - Run 0001_create_tevero_base.sql first
--   - shared_clients table must exist (from Drizzle schema push)
--
-- Data sources:
--   - open_seo.clients (primary source - has GSC OAuth, baseline metrics)
--   - alwrity.clients (secondary source - has CMS settings, brand voice)
--
-- Strategy:
--   1. Create backups of both source tables
--   2. Migrate open_seo.clients as primary (has more complete data)
--   3. Merge alwrity.clients for additional CMS/voice fields
--   4. Handle NULL workspace_id with ORPHAN_ prefix
--
-- Rollback: Use scripts/db/rollback_clients.sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- Start migration tracking
-- ============================================================================

DO $$
DECLARE
    v_migration_id INTEGER;
    v_open_seo_count INTEGER := 0;
    v_alwrity_count INTEGER := 0;
    v_merged_count INTEGER := 0;
    v_total_count INTEGER := 0;
BEGIN
    -- Check if migration already completed
    IF migration_completed('migrate_clients') THEN
        RAISE NOTICE 'Migration migrate_clients already completed, skipping.';
        RETURN;
    END IF;

    v_migration_id := migration_start('migrate_clients');

    BEGIN
        -- ====================================================================
        -- Create backup tables
        -- ====================================================================
        RAISE NOTICE 'Creating backup tables...';

        -- Backup open_seo clients (if table exists)
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'clients'
        ) THEN
            DROP TABLE IF EXISTS _backup_open_seo_clients;
            CREATE TABLE _backup_open_seo_clients AS
            SELECT *, NOW() AS backed_up_at FROM clients;
            GET DIAGNOSTICS v_open_seo_count = ROW_COUNT;
            RAISE NOTICE 'Backed up % rows from open_seo.clients', v_open_seo_count;
        ELSE
            RAISE NOTICE 'open_seo.clients table not found, skipping backup.';
        END IF;

        -- Backup alwrity clients (in alwrity schema)
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'alwrity' AND table_name = 'clients'
        ) THEN
            DROP TABLE IF EXISTS _backup_alwrity_clients;
            CREATE TABLE _backup_alwrity_clients AS
            SELECT *, NOW() AS backed_up_at FROM alwrity.clients;
            GET DIAGNOSTICS v_alwrity_count = ROW_COUNT;
            RAISE NOTICE 'Backed up % rows from alwrity.clients', v_alwrity_count;
        ELSE
            RAISE NOTICE 'alwrity.clients table not found, skipping backup.';
        END IF;

        -- ====================================================================
        -- Migrate from open_seo.clients (primary source)
        -- ====================================================================
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'clients'
        ) THEN
            RAISE NOTICE 'Migrating from open_seo.clients...';

            INSERT INTO shared_clients (
                id,
                workspace_id,
                name,
                domain,
                website_url,
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
                is_deleted,
                is_archived
            )
            SELECT
                -- UUID casting: open_seo uses text IDs, shared_clients uses UUID
                CASE
                    WHEN c.id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    THEN c.id::uuid
                    ELSE uuid_generate_v5(uuid_generate_v4(), c.id)
                END,
                -- Handle NULL workspace_id with ORPHAN_ prefix (HIGH-DB-001)
                COALESCE(c.workspace_id, 'ORPHAN_' || COALESCE(c.id::text, uuid_generate_v4()::text)),
                c.name,
                c.domain,
                NULL, -- website_url not in open_seo
                c.contact_email,
                c.contact_name,
                c.industry,
                COALESCE(c.status, 'onboarding'),
                c.converted_from_prospect_id,
                c.gsc_refresh_token,
                c.gsc_site_url,
                c.gsc_connected_at,
                c.kickoff_scheduled_at,
                c.kickoff_completed_at,
                c.onboarding_completed_at,
                c.baseline_metrics,
                c.target_keywords,
                c.preferred_language,
                c.country,
                COALESCE(c.created_at, NOW()),
                COALESCE(c.updated_at, NOW()),
                COALESCE(c.is_deleted, false),
                false -- is_archived defaults to false
            FROM clients c
            WHERE NOT EXISTS (
                SELECT 1 FROM shared_clients sc WHERE sc.id::text = c.id::text
            )
            ON CONFLICT (id) DO NOTHING;

            GET DIAGNOSTICS v_total_count = ROW_COUNT;
            RAISE NOTICE 'Migrated % rows from open_seo.clients', v_total_count;
        END IF;

        -- ====================================================================
        -- Merge from alwrity.clients (secondary source - CMS settings)
        -- ====================================================================
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'alwrity' AND table_name = 'clients'
        ) THEN
            RAISE NOTICE 'Merging from alwrity.clients...';

            -- First, insert alwrity clients that don't exist in shared_clients
            INSERT INTO shared_clients (
                id,
                workspace_id,
                name,
                domain,
                website_url,
                status,
                created_at,
                updated_at,
                is_deleted,
                is_archived
            )
            SELECT
                ac.id::uuid,
                -- Handle NULL workspace_id with ORPHAN_ prefix
                COALESCE(ac.workspace_id, 'ORPHAN_' || ac.id::text),
                ac.name,
                COALESCE(REGEXP_REPLACE(ac.website_url, '^https?://(www\.)?', ''), 'unknown.com'),
                ac.website_url,
                'active', -- alwrity clients are active
                COALESCE(ac.created_at, NOW()),
                COALESCE(ac.updated_at, NOW()),
                false,
                COALESCE(ac.is_archived, false)
            FROM alwrity.clients ac
            WHERE NOT EXISTS (
                SELECT 1 FROM shared_clients sc WHERE sc.id = ac.id
            )
            ON CONFLICT (id) DO NOTHING;

            GET DIAGNOSTICS v_merged_count = ROW_COUNT;
            RAISE NOTICE 'Inserted % new rows from alwrity.clients', v_merged_count;
            v_total_count := v_total_count + v_merged_count;

            -- Update existing shared_clients with alwrity CMS settings
            -- Match by workspace_id + name or by domain
            UPDATE shared_clients sc
            SET
                website_url = COALESCE(sc.website_url, ac.website_url),
                updated_at = NOW()
            FROM alwrity.clients ac
            LEFT JOIN alwrity.client_settings acs ON acs.client_id = ac.id
            WHERE (
                (sc.workspace_id = ac.workspace_id AND sc.name = ac.name)
                OR (sc.domain = REGEXP_REPLACE(ac.website_url, '^https?://(www\.)?', ''))
            )
            AND sc.website_url IS NULL;

            RAISE NOTICE 'Updated shared_clients with alwrity CMS settings';
        END IF;

        -- ====================================================================
        -- Update CMS settings from alwrity.client_settings
        -- ====================================================================
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'alwrity' AND table_name = 'client_settings'
        ) THEN
            RAISE NOTICE 'Merging CMS settings from alwrity.client_settings...';

            UPDATE shared_clients sc
            SET
                brand_voice = COALESCE(sc.brand_voice, acs.brand_voice),
                image_prompt_template = COALESCE(sc.image_prompt_template, acs.image_prompt_template),
                text_model_override = COALESCE(sc.text_model_override, acs.text_model_override),
                image_model_override = COALESCE(sc.image_model_override, acs.image_model_override),
                cms_type = COALESCE(sc.cms_type, acs.cms_type),
                webhook_url = COALESCE(sc.webhook_url, acs.webhook_url),
                wp_url = COALESCE(sc.wp_url, acs.wp_url),
                wp_username = COALESCE(sc.wp_username, acs.wp_username),
                -- Encrypted fields: Convert LargeBinary to Base64 text
                wp_app_password_encrypted = COALESCE(
                    sc.wp_app_password_encrypted,
                    ENCODE(acs.wp_app_password_encrypted, 'base64')
                ),
                shopify_store_url = COALESCE(sc.shopify_store_url, acs.shopify_store_url),
                shopify_api_key_encrypted = COALESCE(
                    sc.shopify_api_key_encrypted,
                    ENCODE(acs.shopify_api_key_encrypted, 'base64')
                ),
                wix_site_id = COALESCE(sc.wix_site_id, acs.wix_site_id),
                wix_blog_id = COALESCE(sc.wix_blog_id, acs.wix_blog_id),
                wix_api_key_encrypted = COALESCE(
                    sc.wix_api_key_encrypted,
                    ENCODE(acs.wix_api_key_encrypted, 'base64')
                ),
                updated_at = NOW()
            FROM alwrity.client_settings acs
            INNER JOIN alwrity.clients ac ON ac.id = acs.client_id
            WHERE sc.id = ac.id
            AND (
                sc.brand_voice IS NULL
                OR sc.cms_type IS NULL
                OR sc.wp_url IS NULL
                OR sc.shopify_store_url IS NULL
                OR sc.wix_site_id IS NULL
            );

            RAISE NOTICE 'Merged CMS settings from alwrity.client_settings';
        END IF;

        -- ====================================================================
        -- Validate migration
        -- ====================================================================
        SELECT COUNT(*) INTO v_total_count FROM shared_clients;
        RAISE NOTICE 'Total rows in shared_clients: %', v_total_count;

        -- Check for orphaned records
        PERFORM 1 FROM shared_clients WHERE workspace_id LIKE 'ORPHAN_%' LIMIT 1;
        IF FOUND THEN
            RAISE NOTICE 'WARNING: Some clients have ORPHAN_ workspace_id. Manual review required.';
        END IF;

        -- Complete migration tracking
        PERFORM migration_complete(v_migration_id, v_total_count);
        RAISE NOTICE 'Migration migrate_clients completed successfully.';

    EXCEPTION WHEN OTHERS THEN
        PERFORM migration_fail(v_migration_id, SQLERRM);
        RAISE;
    END;
END $$;

COMMIT;
