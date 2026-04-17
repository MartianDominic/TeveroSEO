---
phase: 01-ai-writer-backend-cleanup
plan: "01"
subsystem: ai-writer-backend
tags: [cleanup, legacy-removal, podcast-mode, router-registry, startup]
dependency_graph:
  requires: []
  provides: [clean-entry-points, clean-registry, clean-startup-scripts]
  affects: [AI-Writer/backend/app.py, AI-Writer/backend/main.py, AI-Writer/backend/alwrity_utils/router_manager.py, AI-Writer/backend/alwrity_utils/feature_registry.py, AI-Writer/backend/alwrity_utils/feature_profiles.py, AI-Writer/backend/logging_config.py, AI-Writer/backend/start_alwrity_backend.py]
tech_stack:
  added: []
  patterns: [no-feature-flag-branching]
key_files:
  created: []
  modified:
    - AI-Writer/backend/app.py
    - AI-Writer/backend/main.py
    - AI-Writer/backend/alwrity_utils/router_manager.py
    - AI-Writer/backend/alwrity_utils/feature_registry.py
    - AI-Writer/backend/alwrity_utils/feature_profiles.py
    - AI-Writer/backend/logging_config.py
    - AI-Writer/backend/start_alwrity_backend.py
  deleted:
    - AI-Writer/backend/start_linkedin_service.py
decisions:
  - Removed podcast-only demo mode branching entirely rather than leaving a stripped-down guard, since the feature is obsolete and the guard was the source of complexity
  - Kept video_generation_filter in logging_config.py but removed the story_writer clause; the filter still serves llm_providers.main_video_generation
  - linkedin_persona_service logger entry preserved — it belongs to the live persona module, not the legacy linkedin service
metrics:
  duration: "~15 minutes"
  completed: "2026-04-17T12:50:51Z"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 7
  files_deleted: 1
requirements:
  - CLEAN-06
---

# Phase 01 Plan 01: Legacy Router and Podcast-Mode Cleanup Summary

Removed all legacy router registrations, feature-registry entries, logger configurations, and podcast-only demo mode branching from the FastAPI entry points and startup scripts. Entry points now import cleanly with no references to blog_writer, podcast, youtube, story_writer, linkedin, or linkedin_image_generation packages.

## Tasks Completed

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Strip legacy router imports and podcast-only demo mode from app.py and main.py | 2db80b08 | Removed is_podcast_only_demo_mode(), PODCAST_ONLY_DEMO_MODE, all podcast/linkedin router imports and include_router calls, podcast_only_demo_mode health dict fields |
| 2 | Scrub legacy entries from router_manager, feature_registry, feature_profiles, logging_config | d47f84da | Removed 7 legacy router entries, stripped podcast/youtube/blog-writer feature tags, removed 4 legacy linkedin logger names, removed story_writer video_generation_service log filter clause |
| 3 | Clean startup scripts (start_alwrity_backend.py edit, start_linkedin_service.py delete) | 81247a8b | Removed podcast_only_demo_mode detection, removed story_writer.video_preflight import and both call sites, removed is_podcast branch, deleted start_linkedin_service.py |

## Verification Results

All seven modified files compile cleanly:
```
python3 -m py_compile app.py main.py alwrity_utils/router_manager.py \
  alwrity_utils/feature_registry.py alwrity_utils/feature_profiles.py \
  logging_config.py start_alwrity_backend.py
# exits 0
```

Zero legacy imports remain across all modified files:
- `from routers.linkedin` — 0 occurrences
- `from api.linkedin_image_generation` — 0 occurrences
- `from api.podcast` — 0 occurrences
- `from api.youtube` — 0 occurrences
- `from api.blog_writer` — 0 occurrences
- `from api.story_writer` — 0 occurrences
- `from services.story_writer` — 0 occurrences

`start_linkedin_service.py` deleted.

`linkedin_persona_service` logger entry preserved (live module, not legacy).

## Deviations from Plan

None — plan executed exactly as written.

The plan noted `app.py` had two `PODCAST_ONLY_DEMO_MODE = is_podcast_only_demo_mode()` assignments (lines ~60 and ~112) and multiple flavors of podcast-only guards (`if not is_podcast_only_demo_mode():`, `if PODCAST_ONLY_DEMO_MODE:`, `if is_podcast_only_demo_mode():`, `if not PODCAST_ONLY_DEMO_MODE:`). All were unwrapped: non-podcast code paths kept unconditionally, podcast-only branches and their else clauses deleted. The resulting app.py is substantially shorter (292 insertions, 487 deletions across tasks 1+3 combined).

## Known Stubs

None.

## Threat Flags

None. No new network endpoints, auth paths, or schema changes introduced — this plan only removes code.

## Self-Check: PASSED

All 7 modified files exist on disk. Deleted file confirmed gone. All 3 task commits verified present in AI-Writer git history.

| Check | Result |
|-------|--------|
| AI-Writer/backend/app.py | FOUND |
| AI-Writer/backend/main.py | FOUND |
| AI-Writer/backend/alwrity_utils/router_manager.py | FOUND |
| AI-Writer/backend/alwrity_utils/feature_registry.py | FOUND |
| AI-Writer/backend/alwrity_utils/feature_profiles.py | FOUND |
| AI-Writer/backend/logging_config.py | FOUND |
| AI-Writer/backend/start_alwrity_backend.py | FOUND |
| start_linkedin_service.py deleted | CONFIRMED |
| commit 2db80b08 (Task 1) | FOUND |
| commit d47f84da (Task 2) | FOUND |
| commit 81247a8b (Task 3) | FOUND |
