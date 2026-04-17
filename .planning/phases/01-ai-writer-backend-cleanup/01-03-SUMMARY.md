---
phase: 01-ai-writer-backend-cleanup
plan: "03"
subsystem: AI-Writer backend
tags: [cleanup, models, scripts, tests, legacy-removal]
dependency_graph:
  requires: []
  provides: [clean-model-registry, no-legacy-script-imports]
  affects: [services/database.py, models/, scripts/, tests/]
tech_stack:
  added: []
  patterns: [git-rm for tracked file deletion, force-add for gitignored test files]
key_files:
  created: []
  modified:
    - AI-Writer/backend/services/database.py
    - AI-Writer/backend/tests/test_clients.py
    - AI-Writer/backend/tests/test_no_import_time_mkdir.py
  deleted:
    - AI-Writer/backend/scripts/run_podcast_billing_sequence.py
    - AI-Writer/backend/scripts/create_podcast_tables.py
    - AI-Writer/backend/scripts/smoke_test_podcast_demo.py
    - AI-Writer/backend/scripts/verify_podcast_table.py
    - AI-Writer/backend/scripts/create_story_project_tables.py
    - AI-Writer/backend/models/linkedin_models.py
    - AI-Writer/backend/models/podcast_models.py
    - AI-Writer/backend/models/podcast_bible_models.py
    - AI-Writer/backend/models/story_models.py
    - AI-Writer/backend/models/story_project_models.py
decisions:
  - Replace ALWRITY_ENABLED_FEATURES="podcast" with "core" in test_clients.py to preserve isolation intent without relying on removed podcast mode
metrics:
  duration: ~15 minutes
  completed: 2026-04-17
  tasks_completed: 3
  tasks_total: 3
  files_modified: 3
  files_deleted: 10
requirements_satisfied: [CLEAN-06, CLEAN-07]
---

# Phase 01 Plan 03: Legacy Script and Model Cleanup Summary

Delete all legacy one-off scripts and model files whose only consumers are the five legacy packages slated for Wave 2 directory deletion, and update two non-legacy files that still reference them.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Delete legacy scripts and fix services/database.py | `5523cb5b` | 5 scripts deleted, database.py edited |
| 2 | Delete legacy model files (preserve blog_models.py) | `f1f73b29` | 5 model files deleted |
| 3 | Update test fixtures to drop podcast/youtube references | `2938de21` | test_clients.py, test_no_import_time_mkdir.py |

## Files Deleted

### Scripts (5 files)
- `AI-Writer/backend/scripts/run_podcast_billing_sequence.py` — podcast billing integration harness (imports api.podcast.*)
- `AI-Writer/backend/scripts/create_podcast_tables.py` — podcast DB migration (imports models.podcast_models)
- `AI-Writer/backend/scripts/smoke_test_podcast_demo.py` — podcast-only demo mode smoke tests
- `AI-Writer/backend/scripts/verify_podcast_table.py` — podcast schema verifier
- `AI-Writer/backend/scripts/create_story_project_tables.py` — story project DB migration (imports models.story_project_models)

### Models (5 files)
- `AI-Writer/backend/models/linkedin_models.py` — only consumed by legacy `services/linkedin_service.py`, `services/linkedin/`, and `routers/linkedin.py` (Wave 2 targets)
- `AI-Writer/backend/models/podcast_models.py` — only consumed by legacy `services/podcast_service.py` and `api/podcast/` (Wave 2 targets); import from `services/database.py` removed in Task 1
- `AI-Writer/backend/models/podcast_bible_models.py` — only consumed by `services/podcast_bible_service.py` and `api/podcast/handlers/` (Wave 2 targets)
- `AI-Writer/backend/models/story_models.py` — only consumed by `api/story_writer/routes/` and `api/podcast/handlers/audio.py` (Wave 2 targets)
- `AI-Writer/backend/models/story_project_models.py` — only consumed by `services/story_writer/story_project_service.py` (Wave 2 target)

## Files Edited

### AI-Writer/backend/services/database.py
- **Removed line 32:** `from models.podcast_models import PodcastProject` (2-line block including comment)
- File compiles cleanly with `python3 -m py_compile`
- No other `PodcastProject` or `podcast_models` references remain in this file

### AI-Writer/backend/tests/test_clients.py
- **Lines 42-44 replaced:** Removed podcast-mode comment + `os.environ.setdefault("ALWRITY_ENABLED_FEATURES", "podcast")`, replaced with `os.environ.setdefault("ALWRITY_ENABLED_FEATURES", "core")` to preserve test isolation intent without relying on removed podcast mode
- File compiles cleanly

### AI-Writer/backend/tests/test_no_import_time_mkdir.py
- **Removed 4 entries** from `STARTUP_MODULES` list:
  - `"backend/api/youtube/router.py"`
  - `"backend/api/youtube/handlers/avatar.py"`
  - `"backend/api/youtube/handlers/images.py"`
  - `"backend/api/youtube/handlers/audio.py"`
- These files are Wave 2 deletion targets; removing them prevents test breakage when Wave 2 executes
- File compiles cleanly

## Intentionally Preserved

- `AI-Writer/backend/models/blog_models.py` — **KEPT**: exports `ResearchSource`, `ResearchConfig`, `ResearchProvider`, `ResearchMode` which are imported by non-legacy code:
  - `services/research/core/research_engine.py` (lines 40, 465)
  - `services/research/core/parameter_optimizer.py` (line 31)

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written, with one minor variation:

**[Rule 2 - Missing critical functionality] test_clients.py: use "core" instead of deleting env var**
- **Found during:** Task 3
- **Issue:** Plan said delete lines 42-44 OR replace with `"core"` if it accomplishes same isolation. Reviewing the test file, the env var is set before any project module imports to prevent heavy `api/__init__.py` loading. Simply deleting it could cause test failures if `"core"` mode skips the same heavy paths.
- **Fix:** Replaced with `os.environ.setdefault("ALWRITY_ENABLED_FEATURES", "core")` — preserves isolation intent without podcast dependency.
- **Files modified:** `AI-Writer/backend/tests/test_clients.py`
- **Commit:** `2938de21`

**[Rule 3 - Blocking issue] Test files gitignored in AI-Writer repo**
- **Found during:** Task 3 commit
- **Issue:** AI-Writer's `.gitignore` excludes `tests/` and `test_*.py`, so `git add` refused to stage the files.
- **Fix:** Used `git add -f` to force-add the already-tracked test files.
- **Files modified:** N/A (staging only)
- **Commit:** `2938de21`

## Known Stubs

None — this plan only deleted files and removed imports; no new code was written.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Self-Check: PASSED

- `test ! -f AI-Writer/backend/scripts/run_podcast_billing_sequence.py` → FOUND (deleted)
- `test ! -f AI-Writer/backend/scripts/create_podcast_tables.py` → FOUND (deleted)
- `test ! -f AI-Writer/backend/scripts/smoke_test_podcast_demo.py` → FOUND (deleted)
- `test ! -f AI-Writer/backend/scripts/verify_podcast_table.py` → FOUND (deleted)
- `test ! -f AI-Writer/backend/scripts/create_story_project_tables.py` → FOUND (deleted)
- `test ! -f AI-Writer/backend/models/linkedin_models.py` → FOUND (deleted)
- `test ! -f AI-Writer/backend/models/podcast_models.py` → FOUND (deleted)
- `test ! -f AI-Writer/backend/models/podcast_bible_models.py` → FOUND (deleted)
- `test ! -f AI-Writer/backend/models/story_models.py` → FOUND (deleted)
- `test ! -f AI-Writer/backend/models/story_project_models.py` → FOUND (deleted)
- `test -f AI-Writer/backend/models/blog_models.py` → FOUND (preserved)
- `python3 -m py_compile services/database.py` → exits 0
- `python3 -m py_compile tests/test_clients.py tests/test_no_import_time_mkdir.py` → exits 0
- Commits `5523cb5b`, `f1f73b29`, `2938de21` → verified in git log
