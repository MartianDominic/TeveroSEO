-- ============================================================================
-- Phase 67-02: Migration Scripts
-- rollback_voice_profiles.sql - Rollback voice profiles migration
-- ============================================================================
--
-- Purpose: Restore original voice tables from backups and clear shared_voice_profiles
--
-- Prerequisites:
--   - _backup_voice_profiles and/or _backup_writing_personas must exist
--   - This is a DESTRUCTIVE operation - data in shared_voice_profiles will be lost
--
-- Run order (reverse of migration):
--   1. rollback_voice_profiles.sql (this file - run first)
--   2. rollback_clients.sql (depends on this completing)
--
-- ============================================================================

BEGIN;

DO $$
DECLARE
    v_migration_id INTEGER;
    v_restored_voice_profiles INTEGER := 0;
    v_restored_writing_personas INTEGER := 0;
    v_restored_platform_personas INTEGER := 0;
    v_deleted_shared INTEGER := 0;
BEGIN
    -- ========================================================================
    -- Log rollback start
    -- ========================================================================
    INSERT INTO _migration_log (migration_name, status)
    VALUES ('rollback_voice_profiles', 'started')
    RETURNING id INTO v_migration_id;

    BEGIN
        RAISE NOTICE 'Starting rollback of voice profiles migration...';

        -- ====================================================================
        -- Delete migrated data from shared_voice_profiles
        -- ====================================================================
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'shared_voice_profiles'
        ) THEN
            DELETE FROM shared_voice_profiles;
            GET DIAGNOSTICS v_deleted_shared = ROW_COUNT;
            RAISE NOTICE 'Deleted % rows from shared_voice_profiles', v_deleted_shared;
        END IF;

        -- ====================================================================
        -- Restore voice_profiles from backup
        -- ====================================================================
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = '_backup_voice_profiles'
        ) THEN
            DROP TABLE IF EXISTS voice_profiles_old;

            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'voice_profiles'
            ) THEN
                ALTER TABLE voice_profiles RENAME TO voice_profiles_old;
            END IF;

            -- Recreate voice_profiles from backup (excluding backup metadata)
            CREATE TABLE voice_profiles AS
            SELECT
                id,
                client_id,
                voice_name,
                voice_status,
                mode,
                industry_template,
                primary_tone,
                tone_primary,
                tone_secondary,
                secondary_tones,
                formality_level,
                personality_traits,
                emotional_range,
                required_phrases,
                forbidden_phrases,
                jargon_level,
                industry_terms,
                acronym_policy,
                contraction_usage,
                sentence_length_avg,
                paragraph_length_avg,
                sentence_length_target,
                paragraph_length_target,
                list_preference,
                heading_style,
                cta_template,
                vocabulary_patterns,
                signature_phrases,
                keyword_density_tolerance,
                keyword_placement_rules,
                seo_vs_voice_priority,
                protected_sections,
                voice_blend_enabled,
                voice_blend_weight,
                voice_template_id,
                custom_instructions,
                ai_analysis_version,
                confidence_score,
                last_modified_by,
                analyzed_at,
                created_at,
                updated_at,
                is_archived
            FROM _backup_voice_profiles;

            GET DIAGNOSTICS v_restored_voice_profiles = ROW_COUNT;
            RAISE NOTICE 'Restored % rows to voice_profiles from backup', v_restored_voice_profiles;

            DROP TABLE IF EXISTS voice_profiles_old;
        ELSE
            RAISE NOTICE '_backup_voice_profiles not found, skipping restore.';
        END IF;

        -- ====================================================================
        -- Restore alwrity.writing_personas from backup
        -- ====================================================================
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = '_backup_writing_personas'
        ) THEN
            IF EXISTS (
                SELECT 1 FROM information_schema.schemata
                WHERE schema_name = 'alwrity'
            ) THEN
                DROP TABLE IF EXISTS alwrity.writing_personas_old;

                IF EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'alwrity' AND table_name = 'writing_personas'
                ) THEN
                    ALTER TABLE alwrity.writing_personas RENAME TO writing_personas_old;
                END IF;

                -- Recreate writing_personas from backup
                EXECUTE 'CREATE TABLE alwrity.writing_personas AS
                SELECT
                    id,
                    user_id,
                    persona_name,
                    archetype,
                    core_belief,
                    brand_voice_description,
                    linguistic_fingerprint,
                    platform_adaptations,
                    onboarding_session_id,
                    source_website_analysis,
                    source_research_preferences,
                    ai_analysis_version,
                    confidence_score,
                    analysis_date,
                    created_at,
                    updated_at,
                    is_active
                FROM _backup_writing_personas';

                GET DIAGNOSTICS v_restored_writing_personas = ROW_COUNT;
                RAISE NOTICE 'Restored % rows to alwrity.writing_personas from backup', v_restored_writing_personas;

                DROP TABLE IF EXISTS alwrity.writing_personas_old;
            ELSE
                RAISE NOTICE 'alwrity schema does not exist, skipping writing_personas restore.';
            END IF;
        ELSE
            RAISE NOTICE '_backup_writing_personas not found, skipping restore.';
        END IF;

        -- ====================================================================
        -- Restore alwrity.platform_personas from backup
        -- ====================================================================
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = '_backup_platform_personas'
        ) THEN
            IF EXISTS (
                SELECT 1 FROM information_schema.schemata
                WHERE schema_name = 'alwrity'
            ) THEN
                DROP TABLE IF EXISTS alwrity.platform_personas_old;

                IF EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'alwrity' AND table_name = 'platform_personas'
                ) THEN
                    ALTER TABLE alwrity.platform_personas RENAME TO platform_personas_old;
                END IF;

                -- Recreate platform_personas from backup
                EXECUTE 'CREATE TABLE alwrity.platform_personas AS
                SELECT
                    id,
                    writing_persona_id,
                    platform_type,
                    sentence_metrics,
                    lexical_features,
                    rhetorical_devices,
                    tonal_range,
                    stylistic_constraints,
                    content_format_rules,
                    engagement_patterns,
                    posting_frequency,
                    content_types,
                    platform_best_practices,
                    algorithm_considerations,
                    created_at,
                    updated_at,
                    is_active
                FROM _backup_platform_personas';

                GET DIAGNOSTICS v_restored_platform_personas = ROW_COUNT;
                RAISE NOTICE 'Restored % rows to alwrity.platform_personas from backup', v_restored_platform_personas;

                DROP TABLE IF EXISTS alwrity.platform_personas_old;
            ELSE
                RAISE NOTICE 'alwrity schema does not exist, skipping platform_personas restore.';
            END IF;
        ELSE
            RAISE NOTICE '_backup_platform_personas not found, skipping restore.';
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

        -- Mark the original migration as rolled back
        UPDATE _migration_log
        SET status = 'rolled_back'
        WHERE migration_name = 'migrate_voice_profiles'
        AND status = 'completed';

        RAISE NOTICE 'Rollback completed. Restored: voice_profiles=%, writing_personas=%, platform_personas=%, Deleted from shared=%',
            v_restored_voice_profiles, v_restored_writing_personas, v_restored_platform_personas, v_deleted_shared;

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
