---
phase: 01-ai-writer-backend-cleanup
plan: "04"
subsystem: ai-writer-backend
tags: [cleanup, legacy-removal, blog_writer, podcast, youtube, story_writer, linkedin]
dependency_graph:
  requires:
    - phase: 01-ai-writer-backend-cleanup
      plan: "01"
      provides: clean-entry-points (no router/startup references to deleted dirs)
    - phase: 01-ai-writer-backend-cleanup
      plan: "02"
      provides: no cross-module imports from legacy packages in live code
    - phase: 01-ai-writer-backend-cleanup
      plan: "03"
      provides: no legacy scripts/models referencing deleted dirs
  provides:
    - legacy-dirs-deleted (services and api directories physically removed)
    - clean-services-directory (blog_writer, podcast, youtube, story_writer, linkedin gone)
    - clean-api-directory (blog_writer, podcast, youtube, story_writer, linkedin_image_generation.py gone)
  affects:
    - AI-Writer/backend/services/ (five directories removed)
    - AI-Writer/backend/api/ (four directories + one file removed)
tech-stack:
  added: []
  patterns:
    - git-rm for tracked file deletion (physical rm -rf needed for pycache cleanup)
key-files:
  created: []
  modified:
    - AI-Writer/backend/api/__init__.py
  deleted:
    - AI-Writer/backend/services/blog_writer/ (44 tracked files)
    - AI-Writer/backend/services/podcast/ (2 tracked files)
    - AI-Writer/backend/services/youtube/ (4 tracked files)
    - AI-Writer/backend/services/story_writer/ (15 tracked files)
    - AI-Writer/backend/services/linkedin/ (17 tracked files)
    - AI-Writer/backend/api/blog_writer/ (5 tracked files)
    - AI-Writer/backend/api/podcast/ (12 tracked files)
    - AI-Writer/backend/api/youtube/ (7 tracked files)
    - AI-Writer/backend/api/story_writer/ (13 tracked files)
    - AI-Writer/backend/api/linkedin_image_generation.py (1 file)
key-decisions:
  - "Used git rm -r for tracked files then rm -rf for remaining pycache directories (git rm leaves untracked __pycache__ dirs on disk)"
  - "Removed dead _is_podcast branching from api/__init__.py as Rule 2 deviation — podcast mode was fully removed in Plan 01-01, making the guard dead code that would prevent onboarding endpoints from loading in a fresh environment"

patterns-established: []

requirements-completed: [CLEAN-01, CLEAN-02, CLEAN-03, CLEAN-04, CLEAN-05, CLEAN-06]

duration: ~8 minutes
completed: "2026-04-17"
---

# Phase 01 Plan 04: Legacy Service and API Directory Deletion Summary

**Physically removed 9 directories (82 service files + 47 API files) and 1 standalone file — all legacy blog_writer, podcast, youtube, story_writer, and linkedin code gone from AI-Writer backend.**

## Performance

- **Duration:** ~8 minutes
- **Started:** 2026-04-17T12:56:00Z
- **Completed:** 2026-04-17T13:04:07Z
- **Tasks:** 3 (Task 1 = verification only, Tasks 2-3 = deletion + commit)
- **Files deleted:** 130 tracked files (82 services + 47 api + 1 standalone)
- **Files modified:** 1 (api/__init__.py — dead code removal)

## Accomplishments

- All five legacy service directories removed: blog_writer, podcast, youtube, story_writer, linkedin (content-gen)
- All four legacy API directories removed: blog_writer, podcast, youtube, story_writer
- `linkedin_image_generation.py` router file deleted
- `services/persona/linkedin/` preserved (live persona module — unrelated to deleted content-gen linkedin)
- `models/blog_models.py` preserved (still imported by research_engine and parameter_optimizer)
- Pre-deletion safety checks confirmed zero live (non-legacy) imports of any deleted path

## Task Commits

Each task was committed atomically in the AI-Writer repository (`/home/dominic/Documents/TeveroSEO/AI-Writer`):

1. **Task 1: Pre-deletion safety check** — No commit (verification only, zero file changes)
2. **Task 2: Delete five legacy service directories** — `b2b94db7` (chore)
3. **Task 3: Delete four legacy API directories and linkedin_image_generation.py** — `be68d4bb` (chore)

## Files Deleted

### Services (82 tracked files across 5 directories)

| Directory | Approx files | Key contents |
|-----------|-------------|--------------|
| `backend/services/blog_writer/` | 44 | Full blog generation pipeline (exceptions/retry already inlined to llm_providers in Plan 02) |
| `backend/services/podcast/` | 2 | podcast + video_combination_service |
| `backend/services/youtube/` | 4 | planner, renderer, scene_builder |
| `backend/services/story_writer/` | 15 | story, audio, image, video generation services |
| `backend/services/linkedin/` | 17 | content_generator, image_generation, prompts, quality/research handlers |

### API Routes (47 tracked files across 4 directories + 1 file)

| Path | Approx files | Key contents |
|------|-------------|--------------|
| `backend/api/blog_writer/` | 5 | router.py, task_manager.py, seo_analysis.py |
| `backend/api/podcast/` | 12 | router.py + 9 handlers (audio, video, script, avatar, etc.) |
| `backend/api/youtube/` | 7 | router.py, task_manager.py, 4 handlers |
| `backend/api/story_writer/` | 13 | router.py, task_manager.py, 7 routes, utils |
| `backend/api/linkedin_image_generation.py` | 1 | Single-file LinkedIn image gen router |

## Files Modified

### `backend/api/__init__.py`
- **Removed:** `import os`, `_is_podcast` check, entire `if _is_podcast: ... else:` branching block
- **Result:** Onboarding endpoints always imported unconditionally (podcast mode was eliminated in Plan 01-01)
- **Compiles:** `python3 -m py_compile api/__init__.py` exits 0

## Preserved (Explicitly Confirmed)

- `AI-Writer/backend/services/persona/linkedin/` — live persona module, unrelated to deleted content-gen linkedin: **PRESERVED**
- `AI-Writer/backend/models/blog_models.py` — exports ResearchSource, ResearchConfig, ResearchProvider, ResearchMode for research_engine and parameter_optimizer: **PRESERVED**

## Decisions Made

- Used `git rm -r` for tracked file deletions, then `rm -rf` for residual `__pycache__` directories (git rm removes tracked files but leaves untracked directories on disk, causing `test ! -e` checks to fail)
- Removed dead `_is_podcast` branching from `api/__init__.py` — the guard was a leftover from Plan 01-01's podcast-mode removal; keeping it would have left onboarding endpoints in an `if/else` block gated on a feature flag that no longer exists

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Remove dead _is_podcast guard from api/__init__.py**
- **Found during:** Task 3 (inspect api/__init__.py before deletion)
- **Issue:** `api/__init__.py` still had `_is_podcast = os.getenv("ALWRITY_ENABLED_FEATURES", "").strip().lower() == "podcast"` and wrapped the onboarding endpoint imports in `if _is_podcast: __all__ = [] else: from .onboarding_endpoints import ...`. Podcast mode was fully removed in Plan 01-01; this guard was dead code that kept the `import os` dependency and created a confusing conditional import path.
- **Fix:** Removed `import os`, the `_is_podcast` assignment, and the `if/else` block; onboarding endpoints now imported unconditionally.
- **Files modified:** `backend/api/__init__.py`
- **Verification:** `python3 -m py_compile api/__init__.py` exits 0; no legacy re-exports present
- **Committed in:** `be68d4bb` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 - missing critical cleanup)
**Impact on plan:** Auto-fix was required to leave `api/__init__.py` in a correct state; the dead podcast-mode guard would have been a maintenance hazard. No scope creep.

## Issues Encountered

- `git rm -r` stages deletions and removes files from git tracking, but `__pycache__` directories (already untracked) remain on disk, keeping parent directories alive. This caused `test ! -e services/blog_writer` checks to fail after `git rm`. Resolved by running `rm -rf` on each directory after committing the git rm changes.

## Known Stubs

None — this plan only deleted files and cleaned up one dead code block. No new code written.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. This plan only removes code.

## Self-Check

### Files Deleted (verified absent)

| Check | Result |
|-------|--------|
| `test ! -e AI-Writer/backend/services/blog_writer` | PASS |
| `test ! -e AI-Writer/backend/services/podcast` | PASS |
| `test ! -e AI-Writer/backend/services/youtube` | PASS |
| `test ! -e AI-Writer/backend/services/story_writer` | PASS |
| `test ! -e AI-Writer/backend/services/linkedin` | PASS |
| `test ! -e AI-Writer/backend/api/blog_writer` | PASS |
| `test ! -e AI-Writer/backend/api/podcast` | PASS |
| `test ! -e AI-Writer/backend/api/youtube` | PASS |
| `test ! -e AI-Writer/backend/api/story_writer` | PASS |
| `test ! -f AI-Writer/backend/api/linkedin_image_generation.py` | PASS |

### Files Preserved (verified present)

| Check | Result |
|-------|--------|
| `test -d AI-Writer/backend/services/persona/linkedin` | PASS |
| `test -f AI-Writer/backend/models/blog_models.py` | PASS |

### Commits Verified

| Commit | Description |
|--------|-------------|
| `b2b94db7` | Task 2: Delete five legacy service directories |
| `be68d4bb` | Task 3: Delete four legacy API directories and linkedin_image_generation.py |

### Zero-Import Verification

| Check | Result |
|-------|--------|
| Non-legacy code imports from services.(blog_writer\|podcast\|youtube\|story_writer) | 0 matches |
| Non-legacy code imports from services.linkedin (excl. persona) | 0 matches |
| Non-legacy code imports from api.(blog_writer\|podcast\|youtube\|story_writer\|linkedin_image_generation) | 0 matches |
| Any code imports from routers.linkedin | 0 matches |

## Self-Check: PASSED

---
*Phase: 01-ai-writer-backend-cleanup*
*Completed: 2026-04-17*
