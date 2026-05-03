-- ============================================================================
-- Phase 67-02: Migration Scripts
-- migrate_voice_profiles.sql - Migrate voice profiles from open_seo and writing_personas from alwrity
-- ============================================================================
--
-- Prerequisites:
--   - Run 0001_create_tevero_base.sql first
--   - Run migrate_clients.sql first (for client_id FK references)
--   - shared_voice_profiles table must exist (from Drizzle schema push)
--
-- Data sources:
--   - open_seo.voice_profiles (client_id based, 40+ voice dimensions)
--   - alwrity.writing_personas (user_id based, linguistic fingerprint)
--
-- Strategy:
--   1. Create backups of both source tables
--   2. Migrate open_seo.voice_profiles as-is (client-level profiles)
--   3. Migrate alwrity.writing_personas with 'wp_' ID prefix to avoid collisions
--   4. Both client_id and user_id are nullable but CHECK ensures at least one is set
--
-- Rollback: Use scripts/db/rollback_voice_profiles.sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- Start migration tracking
-- ============================================================================

DO $$
DECLARE
    v_migration_id INTEGER;
    v_voice_profiles_count INTEGER := 0;
    v_writing_personas_count INTEGER := 0;
    v_platform_personas_count INTEGER := 0;
    v_total_count INTEGER := 0;
BEGIN
    -- Check if migration already completed
    IF migration_completed('migrate_voice_profiles') THEN
        RAISE NOTICE 'Migration migrate_voice_profiles already completed, skipping.';
        RETURN;
    END IF;

    v_migration_id := migration_start('migrate_voice_profiles');

    BEGIN
        -- ====================================================================
        -- Create backup tables
        -- ====================================================================
        RAISE NOTICE 'Creating backup tables...';

        -- Backup open_seo voice_profiles (if table exists)
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'voice_profiles'
        ) THEN
            DROP TABLE IF EXISTS _backup_voice_profiles;
            CREATE TABLE _backup_voice_profiles AS
            SELECT *, NOW() AS backed_up_at FROM voice_profiles;
            GET DIAGNOSTICS v_voice_profiles_count = ROW_COUNT;
            RAISE NOTICE 'Backed up % rows from voice_profiles', v_voice_profiles_count;
        ELSE
            RAISE NOTICE 'voice_profiles table not found, skipping backup.';
        END IF;

        -- Backup alwrity writing_personas
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'alwrity' AND table_name = 'writing_personas'
        ) THEN
            DROP TABLE IF EXISTS _backup_writing_personas;
            CREATE TABLE _backup_writing_personas AS
            SELECT *, NOW() AS backed_up_at FROM alwrity.writing_personas;
            GET DIAGNOSTICS v_writing_personas_count = ROW_COUNT;
            RAISE NOTICE 'Backed up % rows from alwrity.writing_personas', v_writing_personas_count;

            -- Also backup platform_personas
            DROP TABLE IF EXISTS _backup_platform_personas;
            CREATE TABLE _backup_platform_personas AS
            SELECT *, NOW() AS backed_up_at FROM alwrity.platform_personas;
            GET DIAGNOSTICS v_platform_personas_count = ROW_COUNT;
            RAISE NOTICE 'Backed up % rows from alwrity.platform_personas', v_platform_personas_count;
        ELSE
            RAISE NOTICE 'alwrity.writing_personas table not found, skipping backup.';
        END IF;

        -- ====================================================================
        -- Migrate from open_seo.voice_profiles
        -- ====================================================================
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'voice_profiles'
        ) THEN
            RAISE NOTICE 'Migrating from voice_profiles...';

            INSERT INTO shared_voice_profiles (
                id,
                client_id,
                user_id,
                voice_name,
                persona_name,
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
                is_archived,
                is_active
            )
            SELECT
                vp.id,
                -- Map client_id to shared_clients UUID
                CASE
                    WHEN vp.client_id IS NOT NULL AND EXISTS (
                        SELECT 1 FROM shared_clients sc WHERE sc.id::text = vp.client_id::text
                    )
                    THEN (SELECT sc.id FROM shared_clients sc WHERE sc.id::text = vp.client_id::text LIMIT 1)
                    ELSE NULL
                END,
                NULL, -- user_id not in voice_profiles
                vp.voice_name,
                NULL, -- persona_name from alwrity
                COALESCE(vp.voice_status, 'draft')::shared_voice_status,
                COALESCE(vp.mode, 'best_practices'),
                vp.industry_template,
                COALESCE(vp.primary_tone, 'professional')::shared_primary_tone,
                vp.tone_primary,
                vp.tone_secondary,
                vp.secondary_tones,
                vp.formality_level,
                vp.personality_traits,
                vp.emotional_range,
                vp.required_phrases,
                vp.forbidden_phrases,
                vp.jargon_level,
                vp.industry_terms,
                vp.acronym_policy,
                vp.contraction_usage,
                vp.sentence_length_avg,
                vp.paragraph_length_avg,
                vp.sentence_length_target,
                vp.paragraph_length_target,
                vp.list_preference,
                vp.heading_style,
                vp.cta_template,
                vp.vocabulary_patterns,
                vp.signature_phrases,
                vp.keyword_density_tolerance,
                vp.keyword_placement_rules,
                vp.seo_vs_voice_priority,
                vp.protected_sections,
                COALESCE(vp.voice_blend_enabled, false),
                vp.voice_blend_weight,
                vp.voice_template_id,
                vp.custom_instructions,
                vp.ai_analysis_version,
                vp.confidence_score,
                vp.last_modified_by,
                vp.analyzed_at,
                COALESCE(vp.created_at, NOW()),
                COALESCE(vp.updated_at, NOW()),
                COALESCE(vp.is_archived, false),
                true -- is_active defaults to true
            FROM voice_profiles vp
            WHERE NOT EXISTS (
                SELECT 1 FROM shared_voice_profiles svp WHERE svp.id = vp.id
            )
            ON CONFLICT (id) DO NOTHING;

            GET DIAGNOSTICS v_total_count = ROW_COUNT;
            RAISE NOTICE 'Migrated % rows from voice_profiles', v_total_count;
        END IF;

        -- ====================================================================
        -- Migrate from alwrity.writing_personas (with wp_ prefix)
        -- ====================================================================
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'alwrity' AND table_name = 'writing_personas'
        ) THEN
            RAISE NOTICE 'Migrating from alwrity.writing_personas with wp_ prefix...';

            INSERT INTO shared_voice_profiles (
                id,
                client_id,
                user_id,
                voice_name,
                persona_name,
                voice_status,
                mode,
                archetype,
                core_belief,
                brand_voice_description,
                primary_tone,
                linguistic_fingerprint,
                platform_adaptations,
                onboarding_session_id,
                source_website_analysis,
                source_research_preferences,
                ai_analysis_version,
                confidence_score,
                analyzed_at,
                created_at,
                updated_at,
                is_archived,
                is_active
            )
            SELECT
                -- Prefix with 'wp_' to avoid ID collisions (integer -> text)
                'wp_' || wp.id::text,
                NULL, -- client_id not in writing_personas
                wp.user_id, -- writing_personas are user-level
                NULL, -- voice_name from open_seo
                wp.persona_name,
                'active'::shared_voice_status, -- writing_personas don't have status
                'best_practices',
                wp.archetype,
                wp.core_belief,
                wp.brand_voice_description,
                'professional'::shared_primary_tone, -- default
                wp.linguistic_fingerprint,
                -- Convert platform_personas to platform_adaptations array
                (
                    SELECT COALESCE(
                        jsonb_agg(
                            jsonb_build_object(
                                'platformType', pp.platform_type,
                                'sentenceMetrics', pp.sentence_metrics,
                                'lexicalFeatures', pp.lexical_features,
                                'rhetoricalDevices', pp.rhetorical_devices,
                                'tonalRange', pp.tonal_range,
                                'stylisticConstraints', pp.stylistic_constraints
                            )
                        ),
                        '[]'::jsonb
                    )
                    FROM alwrity.platform_personas pp
                    WHERE pp.writing_persona_id = wp.id
                ),
                wp.onboarding_session_id,
                wp.source_website_analysis,
                wp.source_research_preferences,
                wp.ai_analysis_version,
                CASE
                    WHEN wp.confidence_score IS NOT NULL
                    THEN (wp.confidence_score * 100)::integer -- Convert 0-1 to 0-100
                    ELSE NULL
                END,
                wp.analysis_date,
                COALESCE(wp.created_at, NOW()),
                COALESCE(wp.updated_at, NOW()),
                NOT COALESCE(wp.is_active, true), -- is_archived = NOT is_active
                COALESCE(wp.is_active, true)
            FROM alwrity.writing_personas wp
            WHERE NOT EXISTS (
                SELECT 1 FROM shared_voice_profiles svp WHERE svp.id = 'wp_' || wp.id::text
            )
            ON CONFLICT (id) DO NOTHING;

            GET DIAGNOSTICS v_writing_personas_count = ROW_COUNT;
            RAISE NOTICE 'Migrated % rows from alwrity.writing_personas', v_writing_personas_count;
            v_total_count := v_total_count + v_writing_personas_count;
        END IF;

        -- ====================================================================
        -- Validate migration
        -- ====================================================================
        SELECT COUNT(*) INTO v_total_count FROM shared_voice_profiles;
        RAISE NOTICE 'Total rows in shared_voice_profiles: %', v_total_count;

        -- Check for orphaned profiles (no client_id AND no user_id)
        -- This shouldn't happen due to CHECK constraint, but verify
        PERFORM 1 FROM shared_voice_profiles
        WHERE client_id IS NULL AND user_id IS NULL
        LIMIT 1;
        IF FOUND THEN
            RAISE EXCEPTION 'ERROR: Found voice profiles with both client_id and user_id NULL. CHECK constraint violated.';
        END IF;

        -- Complete migration tracking
        PERFORM migration_complete(v_migration_id, v_total_count);
        RAISE NOTICE 'Migration migrate_voice_profiles completed successfully.';

    EXCEPTION WHEN OTHERS THEN
        PERFORM migration_fail(v_migration_id, SQLERRM);
        RAISE;
    END;
END $$;

COMMIT;
