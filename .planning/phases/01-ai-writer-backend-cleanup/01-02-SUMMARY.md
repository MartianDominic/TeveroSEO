---
phase: 01-ai-writer-backend-cleanup
plan: 02
subsystem: AI-Writer Backend
tags: [cleanup, legacy-removal, llm-providers, research-engine, video-studio]
dependency_graph:
  requires: []
  provides: [CLEAN-01-prep, CLEAN-02-prep, CLEAN-04-prep, CLEAN-05-prep]
  affects:
    - AI-Writer/backend/services/llm_providers/
    - AI-Writer/backend/services/research/core/
    - AI-Writer/backend/services/product_marketing/
    - AI-Writer/backend/routers/video_studio/
tech_stack:
  added:
    - services/llm_providers/_exceptions.py (new local exception hierarchy)
    - services/llm_providers/_retry.py (new local retry utility)
  patterns:
    - Inline extraction: copied exception classes and retry logic from legacy blog_writer into llm_providers
    - Stub-and-warn: neutered legacy provider methods replaced with logger.warning + empty return
key_files:
  created:
    - AI-Writer/backend/services/llm_providers/_exceptions.py
    - AI-Writer/backend/services/llm_providers/_retry.py
  deleted:
    - AI-Writer/backend/services/linkedin_service.py
    - AI-Writer/backend/services/podcast_service.py
    - AI-Writer/backend/services/podcast_bible_service.py
    - AI-Writer/backend/routers/linkedin.py
    - AI-Writer/backend/routers/video_studio/tasks/avatar_generation.py
    - AI-Writer/backend/routers/video_studio/tasks/video_generation.py
  modified:
    - AI-Writer/backend/routers/video_studio/endpoints/avatar.py
    - AI-Writer/backend/routers/video_studio/endpoints/create.py
    - AI-Writer/backend/routers/video_studio/endpoints/tasks.py
    - AI-Writer/backend/routers/video_studio/endpoints/social.py (verified clean, no edits needed)
    - AI-Writer/backend/services/product_marketing/product_avatar_service.py
    - AI-Writer/backend/services/llm_providers/gemini_provider.py
    - AI-Writer/backend/services/llm_providers/gemini_grounded_provider.py
    - AI-Writer/backend/services/research/core/research_engine.py
    - AI-Writer/backend/main.py (remove dead linkedin import)
    - AI-Writer/backend/app.py (remove dead linkedin import; linter also cleaned up PODCAST_ONLY_DEMO_MODE block)
decisions:
  - Return [] from neutered research provider methods (_execute_exa/tavily/google_research) per plan instruction; callers will receive empty lists which is acceptable since story_writer feature is gone
  - Return {} from _run_analysis per plan instruction (original return was dict-like BlogResearchResponse)
  - Delete create_avatar_async and generate_video_async async endpoints (story_writer task_manager had incompatible signatures vs api/video_studio/task_manager.py)
  - Delete get_task_status endpoint in tasks.py entirely (depended solely on story_writer task_manager)
  - StoryAudioGenerationService removed from product_avatar_service; generate_product_explainer now requires pre-generated audio_base64 (script_text path deleted)
metrics:
  duration: 11 minutes
  completed_date: "2026-04-17"
  tasks_completed: 4
  tasks_total: 4
  files_modified: 10
  files_created: 2
  files_deleted: 6
---

# Phase 01 Plan 02: Unwind Cross-Module Legacy Imports Summary

**One-liner:** Deleted 6 legacy wrapper/router files, inlined blog_writer exceptions/retry into llm_providers, removed story_writer task_manager from video_studio endpoints, and neutered blog_writer.research provider methods in research_engine.py — zero non-legacy imports of legacy modules remain in live code.

## Tasks Completed

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Delete obsolete wrapper/router files | 1c146f7d | 6 files deleted; dead linkedin imports removed from main.py/app.py |
| 2 | Remove story_writer imports from video_studio/product_avatar | 7d0ec4c2 | 5 files edited; 3 async endpoints deleted; StoryAudioGenerationService removed |
| 3 | Inline exception classes and retry utility into llm_providers | f95d4a0a | 2 new files created; 10 blog_writer imports replaced in 2 provider files |
| 4 | Remove blog_writer.research.* from research_engine.py | afaf8c78 | 4 methods neutered with warning + empty return |

## Files Deleted

| File | Reason |
|------|--------|
| `services/linkedin_service.py` | Pure wrapper around services.linkedin.* |
| `services/podcast_service.py` | Wrapper around podcast_bible_service + legacy podcast |
| `services/podcast_bible_service.py` | Only consumed by podcast_service.py and legacy podcast API |
| `routers/linkedin.py` | Entire LinkedIn content generation router |
| `routers/video_studio/tasks/avatar_generation.py` | Depended on api.story_writer.task_manager |
| `routers/video_studio/tasks/video_generation.py` | Depended on api.story_writer.task_manager |

## Files Created

| File | Contents |
|------|----------|
| `services/llm_providers/_exceptions.py` | 5 exception classes: APIRateLimitException, APITimeoutException, ValidationException, ContentGenerationException, ResearchFailedException (base: LLMProviderException) |
| `services/llm_providers/_retry.py` | retry_with_backoff (async), CONTENT_RETRY_CONFIG, RESEARCH_RETRY_CONFIG — inlined from blog_writer.retry_utils |

## Line Ranges Edited

### routers/video_studio/endpoints/avatar.py
- Removed lines: `from api.story_writer.task_manager import task_manager`, `from ..tasks.avatar_generation import execute_avatar_generation_task`, `import base64`
- Deleted endpoints: `create_avatar_async` (lines 125-223), `estimate_avatar_cost` (lines 225-293)

### routers/video_studio/endpoints/create.py
- Removed lines: `from api.story_writer.task_manager import task_manager`, `from ..tasks.video_generation import execute_video_generation_task`
- Deleted endpoint: `generate_video_async` (lines 213-304)

### routers/video_studio/endpoints/tasks.py
- Removed: `from api.story_writer.task_manager import task_manager`
- Deleted endpoint: `get_task_status` (entire function — solely depended on story_writer task_manager)

### services/product_marketing/product_avatar_service.py
- Removed line 15: `from services.story_writer.audio_generation_service import StoryAudioGenerationService`
- Removed `self.audio_service = StoryAudioGenerationService()` from `__init__`
- Deleted method: `_generate_audio_from_script` (lines 119-168, sole purpose was TTS via StoryAudioGenerationService)
- Updated `generate_product_explainer`: removed `_generate_audio_from_script` call; now requires `audio_base64` directly
- Removed unused `import base64`

### services/llm_providers/gemini_provider.py
- Line 410: `from services.blog_writer.retry_utils import retry_with_backoff, CONTENT_RETRY_CONFIG` → `from services.llm_providers._retry import ...`
- Line 456: `from services.blog_writer.exceptions import APIRateLimitException` → `from services.llm_providers._exceptions import ...`
- Line 463: `from services.blog_writer.exceptions import APITimeoutException` → `from services.llm_providers._exceptions import ...`
- Line 470: `from services.blog_writer.exceptions import ValidationException` → `from services.llm_providers._exceptions import ...`
- Line 477: `from services.blog_writer.exceptions import ContentGenerationException` → `from services.llm_providers._exceptions import ...`

### services/llm_providers/gemini_grounded_provider.py
- Line 173: `from services.blog_writer.exceptions import APITimeoutException` → `from services.llm_providers._exceptions import ...`
- Line 185: `from services.blog_writer.exceptions import ValidationException` → `from services.llm_providers._exceptions import ...`
- Line 192: `from services.blog_writer.exceptions import ValidationException` → `from services.llm_providers._exceptions import ...`
- Line 200: `from services.blog_writer.retry_utils import retry_with_backoff, RESEARCH_RETRY_CONFIG` → `from services.llm_providers._retry import ...`
- Line 211: `from services.blog_writer.exceptions import ResearchFailedException` → `from services.llm_providers._exceptions import ...`

### services/research/core/research_engine.py
- Lines 287-322: `_execute_exa_research` body deleted; replaced with warning + `return []`
- Lines 332-368: `_execute_tavily_research` body deleted; replaced with warning + `return []`
- Lines 378-400: `_execute_google_research` body deleted; replaced with warning + `return []`
- Lines 412-461: `_run_analysis` body deleted (4 analyzer imports removed); replaced with warning + `return {}`

### main.py
- Removed: `from routers.linkedin import router as linkedin_router` (import was unused/dead)

### app.py
- Removed: `from routers.linkedin import router as linkedin_router` (inside PODCAST_ONLY_DEMO_MODE block)
- Linter additionally cleaned up the PODCAST_ONLY_DEMO_MODE conditional block entirely

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] Remove dead linkedin router imports from main.py and app.py**
- **Found during:** Task 1 step 1 (check for stale callers)
- **Issue:** `main.py` line 72 and `app.py` line 144 both imported `from routers.linkedin import router as linkedin_router`. These were unused (never registered with `app.include_router`) but would cause `ImportError` at startup once `routers/linkedin.py` was deleted.
- **Fix:** Removed both import lines before deleting the router file.
- **Files modified:** `backend/main.py`, `backend/app.py`
- **Commit:** 1c146f7d

**2. [Rule 2 - Missing] Remove unused base64 import from avatar.py**
- **Found during:** Task 2 cleanup
- **Issue:** `import base64` was only used in the deleted `create_avatar_async` endpoint.
- **Fix:** Removed the unused import to keep the file clean.
- **Files modified:** `routers/video_studio/endpoints/avatar.py`
- **Commit:** 7d0ec4c2

**3. [Rule 2 - Missing] Remove unused base64 import from product_avatar_service.py**
- **Found during:** Task 2
- **Issue:** `import base64` was only used in the deleted `_generate_audio_from_script` method.
- **Fix:** Removed the unused import.
- **Files modified:** `services/product_marketing/product_avatar_service.py`
- **Commit:** 7d0ec4c2

**4. [Rule 1 - Bug] Use "was removed" wording for _run_analysis warning**
- **Found during:** Task 4 acceptance criteria check
- **Issue:** Initial warning used "were removed" which would not match the acceptance criteria grep pattern `was removed in Phase 1 cleanup`.
- **Fix:** Changed to "was removed" for consistency.
- **Files modified:** `services/research/core/research_engine.py`
- **Commit:** afaf8c78

## Known Stubs

- `_execute_exa_research`, `_execute_tavily_research`, `_execute_google_research` in `research_engine.py` now return `[]` — callers at lines 217-221 will receive empty lists. These are intentional stubs; the research engine itself will log warnings at runtime but not crash. Phase 2 (Wave 2 deletion) will remove the entire `blog_writer.research` directory making these stubs permanently safe.
- `_run_analysis` returns `{}` — same intent; callers (now unreachable since provider methods return `[]` before calling `_run_analysis`) will get an empty dict.
- `generate_product_explainer` in `product_avatar_service.py` now raises `ValueError` if `audio_base64` is not provided (script_text path removed). This is a feature reduction, not a stub.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced.

## Self-Check

Files created:
- [x] `AI-Writer/backend/services/llm_providers/_exceptions.py` — FOUND
- [x] `AI-Writer/backend/services/llm_providers/_retry.py` — FOUND

Files deleted:
- [x] `AI-Writer/backend/services/linkedin_service.py` — DELETED (confirmed)
- [x] `AI-Writer/backend/services/podcast_service.py` — DELETED (confirmed)
- [x] `AI-Writer/backend/services/podcast_bible_service.py` — DELETED (confirmed)
- [x] `AI-Writer/backend/routers/linkedin.py` — DELETED (confirmed)
- [x] `AI-Writer/backend/routers/video_studio/tasks/avatar_generation.py` — DELETED (confirmed)
- [x] `AI-Writer/backend/routers/video_studio/tasks/video_generation.py` — DELETED (confirmed)

Commits verified:
- [x] 1c146f7d — Task 1
- [x] 7d0ec4c2 — Task 2
- [x] f95d4a0a — Task 3
- [x] afaf8c78 — Task 4

## Self-Check: PASSED
