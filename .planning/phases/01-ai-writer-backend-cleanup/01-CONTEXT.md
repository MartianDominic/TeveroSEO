# Phase 1: AI-Writer Backend Cleanup - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Remove all legacy non-agency service directories from the AI-Writer backend (`blog_writer`, `podcast`, `youtube`, `story_writer`, `linkedin`) and their corresponding API directories, leaving no broken imports, no references in API routes, and a cleanly-starting backend.

Working directory: `AI-Writer/`

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Delete legacy service directories, remove corresponding API routes, fix any remaining imports, verify with grep and pytest. Follow the existing 5 plans already created for this phase.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- 5 plans already exist in `.planning/phases/01-ai-writer-backend-cleanup/`
- Plans cover: Wave 1 (strip routers/entry points, wrapper services, legacy scripts/models), Wave 2 (delete directories), Wave 3 (verification)

### Established Patterns
- AI-Writer backend is Python/FastAPI
- Services under `AI-Writer/backend/services/`
- API routes under `AI-Writer/backend/api/`
- Legacy directories confirmed: `blog_writer`, `podcast`, `youtube`, `story_writer`, `linkedin` (both in services/ and api/)
- `linkedin_image_generation.py` also present in api/

### Integration Points
- `AI-Writer/backend/app.py` — main entry point, likely registers routers
- `AI-Writer/backend/api/` — router registration
- `AI-Writer/backend/services/` — service imports

</code_context>

<specifics>
## Specific Ideas

Requirements CLEAN-01 through CLEAN-07 are the acceptance criteria. All 5 plans already exist and cover the full cleanup in waves.

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.

</deferred>
