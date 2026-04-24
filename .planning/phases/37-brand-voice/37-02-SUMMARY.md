---
phase: 37-brand-voice
plan: 02
subsystem: voice-management
tags: [api, backend, server-actions, voice-profiles, protection-rules, templates]
dependency_graph:
  requires: [37-01]
  provides: [voice-api-layer]
  affects: [voice-ui, content-generation]
tech_stack:
  added:
    - TanStack Start file-based routing
    - Zod validation schemas
    - BullMQ voice analysis queue integration
  patterns:
    - RESTful API routes with TanStack Start
    - Server-side validation with Zod
    - Service layer pattern (VoiceProfileService, VoiceTemplateService, ProtectionRulesService)
    - Next.js server actions wrapping API calls
key_files:
  created:
    - open-seo-main/src/routes/api/seo/voice.$clientId.ts
    - open-seo-main/src/routes/api/seo/voice.$clientId.analyze.ts
    - open-seo-main/src/routes/api/seo/voice.$clientId.protection-rules.ts
    - open-seo-main/src/routes/api/seo/voice-templates.ts
  modified:
    - open-seo-main/src/server/features/voice/services/VoiceProfileService.ts
    - apps/web/src/lib/voiceApi.ts
    - apps/web/src/actions/voice.ts
decisions:
  - decision: Use TanStack Start createFileRoute pattern instead of h3 handlers
    rationale: Project uses TanStack Start file-based routing, not h3. Adapted plan to match existing pattern.
    impact: All routes follow consistent createFileRoute pattern with server.handlers
  - decision: Add upsert method to VoiceProfileService
    rationale: API routes need get-or-create pattern for profile management
    impact: Simplifies API logic - PUT/POST both call upsert
  - decision: Use separate git repos (open-seo-main and apps/web)
    rationale: Project structure has open-seo-main as separate git repository
    impact: Commits made in each repo separately
metrics:
  duration_minutes: 15
  tasks_completed: 3
  files_created: 4
  files_modified: 3
  commits: 2
  completed_date: 2026-04-24
---

# Phase 37 Plan 02: Voice API Layer Summary

**One-liner:** Complete API layer for voice management with profile CRUD, voice analysis queueing, protection rules, and template endpoints, plus Next.js server actions and typed API client.

## Overview

Created the complete API surface for voice management in open-seo-main and Next.js integration layer. Four RESTful endpoints handle voice profiles, voice analysis triggering, protection rules, and templates. Server actions in Next.js apps/web provide clean abstraction for UI components.

**Key achievement:** Voice Settings UI can now interact with real backend services instead of stubs.

## Tasks Completed

### Task 1: VoiceTemplateService (Already Complete)
**Status:** ✓ Completed by prior agent  
**Commit:** Already committed  
**Files:**
- `open-seo-main/src/server/features/voice/services/VoiceTemplateService.ts`
- `open-seo-main/src/server/features/voice/services/VoiceTemplateService.test.ts`

Service provides:
- `listAll()` - All templates ordered by name
- `listByIndustry(industry)` - Templates for specific industry
- `getById(id)` - Single template lookup
- `create(data)` - Create custom template
- `incrementUsage(id)` - Track template usage
- `delete(id)` - Delete custom template (blocks system templates)
- `seedSystemTemplates()` - Idempotent seeding of 8 industry templates

### Task 2: Voice API Routes
**Status:** ✓ Complete  
**Commit:** `9ffe9eb` (open-seo-main)  
**Files Created:**
- `open-seo-main/src/routes/api/seo/voice.$clientId.ts` - Profile CRUD
- `open-seo-main/src/routes/api/seo/voice.$clientId.analyze.ts` - Voice analysis trigger
- `open-seo-main/src/routes/api/seo/voice.$clientId.protection-rules.ts` - Protection rule CRUD
- `open-seo-main/src/routes/api/seo/voice-templates.ts` - Template listing

**API Endpoints:**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/seo/voice/:clientId` | GET | Get voice profile for client |
| `/api/seo/voice/:clientId` | PUT | Update voice profile (upsert) |
| `/api/seo/voice/:clientId` | POST | Create/update voice profile (upsert) |
| `/api/seo/voice/:clientId/analyze` | POST | Queue voice analysis job |
| `/api/seo/voice/:clientId/protection-rules` | GET | List protection rules |
| `/api/seo/voice/:clientId/protection-rules` | POST | Create protection rule |
| `/api/seo/voice/:clientId/protection-rules` | DELETE | Delete protection rule (via ?ruleId) |
| `/api/seo/voice-templates` | GET | List templates (optional ?industry filter) |

**Pattern:** All routes use TanStack Start `createFileRoute` with `server.handlers` for GET/POST/PUT/DELETE.

**Validation:** Zod schemas validate all inputs (T-37-04 mitigation).

**Error Handling:** AppError for domain errors, proper HTTP status codes (400/403/404/500), comprehensive logging.

### Task 3: Next.js Server Actions and API Client
**Status:** ✓ Complete  
**Commit:** `6cc55ae84` (main repo)  
**Files Modified:**
- `apps/web/src/lib/voiceApi.ts` - Typed API client functions
- `apps/web/src/actions/voice.ts` - Server actions wrapping API calls

**API Client Functions:**
- `fetchVoiceProfile(clientId)` → `VoiceProfile | null`
- `updateVoiceProfile(clientId, data)` → `VoiceProfile`
- `triggerVoiceAnalysis(clientId, urls)` → `AnalyzeJobResult`
- `fetchProtectionRules(clientId)` → `ProtectionRule[]`
- `createProtectionRule(clientId, rule)` → `ProtectionRule`
- `deleteProtectionRule(clientId, ruleId)` → `void`
- `fetchVoiceTemplates(industry?)` → `VoiceTemplate[]`

**Server Actions:**
- `getVoiceProfile(clientId)`
- `saveVoiceProfile(clientId, data)`
- `analyzeVoice(clientId, urls)`
- `getProtectionRules(clientId)`
- `addProtectionRule(clientId, rule)`
- `removeProtectionRule(clientId, ruleId)`
- `getVoiceTemplates(industry?)`

All server actions are thin wrappers calling typed API client functions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added upsert method to VoiceProfileService**
- **Found during:** Task 2 (API route implementation)
- **Issue:** Plan referenced `voiceProfileService.upsert(clientId, data)` but service only had `create` and `update` methods
- **Fix:** Added `upsert` method that calls `getByClientId` → `update` if exists, else `create`
- **Files modified:** `open-seo-main/src/server/features/voice/services/VoiceProfileService.ts`
- **Commit:** `9ffe9eb`
- **Rationale:** Upsert pattern is critical for API to handle both creation and updates with single endpoint

**2. [Rule 2 - Adaptation] Changed h3 pattern to TanStack Start pattern**
- **Found during:** Task 2 (reviewing existing routes)
- **Issue:** Plan showed h3 `defineEventHandler` pattern, but project uses TanStack Start `createFileRoute`
- **Fix:** Adapted all routes to use `createFileRoute` with `server.handlers` for GET/POST/PUT/DELETE
- **Files modified:** All 4 route files
- **Commit:** `9ffe9eb`
- **Rationale:** Must match existing project routing architecture

**3. [Rule 2 - Type Alignment] Updated VoiceProfile and VoiceTemplate interfaces**
- **Found during:** Task 3 (API client implementation)
- **Issue:** Stub types missing `requiredPhrases`, `keywordPlacementRules`, `templateConfig`, `usageCount`
- **Fix:** Added missing fields to match actual schema and service responses
- **Files modified:** `apps/web/src/lib/voiceApi.ts`
- **Commit:** `6cc55ae84`
- **Rationale:** TypeScript types must match backend schema for type safety

## Verification

### Automated Checks
- ✓ All voice route files exist at correct paths
- ✓ VoiceProfileService.ts contains `async upsert` method
- ✓ voiceApi.ts exports all 7 API client functions
- ✓ actions/voice.ts contains "use server" directive
- ✓ All files use proper TypeScript types

### Manual Verification Required
- [ ] API endpoints return correct responses (requires running services)
- [ ] Voice analysis jobs queue correctly (requires Redis + worker)
- [ ] Protection rule validation works (requires integration test)
- [ ] Templates filter by industry correctly (requires seeded DB)

### Security Verification
- ✓ Zod validation on all inputs (T-37-04 mitigation)
- ✓ Client ID scoping in protection rules (T-37-05 mitigation)
- ✓ isSystem check prevents deleting system templates (T-37-06 mitigation)
- ✓ URL validation limits to 10 URLs (T-37-07 mitigation)

## Integration Points

**Upstream Dependencies:**
- Phase 37-01: Voice schema expansion (voiceProfiles, voiceTemplates, contentProtectionRules tables)
- VoiceProfileService, ProtectionRulesService, VoiceTemplateService (already implemented)
- voiceAnalysisQueue (BullMQ queue for async voice analysis)

**Downstream Consumers:**
- Phase 37-03: Voice Settings UI (uses server actions)
- Phase 37-04: Voice application in content generation (uses protection rules)
- Phase 37-05: Voice monitoring dashboard (uses audit log)

## Known Issues

**None.** All planned functionality implemented and committed.

## Next Steps

1. **Phase 37-03:** Build Voice Settings UI using these server actions
2. **Phase 37-04:** Implement voice compliance scoring and constraint building
3. **Phase 37-05:** Create voice monitoring and audit dashboard
4. **Integration testing:** Test full flow from UI → API → services → database

## Commits

| Repo | Commit | Message | Files |
|------|--------|---------|-------|
| open-seo-main | `9ffe9eb` | feat(37-02): add voice API routes | 5 files (4 created, 1 modified) |
| main | `6cc55ae84` | feat(37-02): implement voice server actions and API client | 2 files modified |

## Files Created

1. `open-seo-main/src/routes/api/seo/voice.$clientId.ts` - 175 lines
2. `open-seo-main/src/routes/api/seo/voice.$clientId.analyze.ts` - 90 lines
3. `open-seo-main/src/routes/api/seo/voice.$clientId.protection-rules.ts` - 165 lines
4. `open-seo-main/src/routes/api/seo/voice-templates.ts` - 50 lines

## Files Modified

1. `open-seo-main/src/server/features/voice/services/VoiceProfileService.ts` - Added upsert method (18 lines)
2. `apps/web/src/lib/voiceApi.ts` - Replaced stubs with real API calls (163 lines)
3. `apps/web/src/actions/voice.ts` - Replaced stubs with API client wrappers (50 lines)

## Threat Surface Changes

No new threats introduced. All mitigations from threat model (T-37-04 through T-37-07) implemented:
- T-37-04: Zod validation prevents injection attacks
- T-37-05: Client ID scoping prevents data leakage
- T-37-06: isSystem check prevents unauthorized template deletion
- T-37-07: URL validation limits analysis to 10 pages max

## Performance Considerations

- Voice analysis is async (queued via BullMQ) - no blocking API calls
- Protection rule queries scoped by profileId (indexed)
- Template listing uses orderBy on indexed name column
- All API responses use proper HTTP caching headers (via TanStack Start)

## Self-Check: PASSED

**Created files exist:**
```
✓ FOUND: open-seo-main/src/routes/api/seo/voice.$clientId.ts
✓ FOUND: open-seo-main/src/routes/api/seo/voice.$clientId.analyze.ts
✓ FOUND: open-seo-main/src/routes/api/seo/voice.$clientId.protection-rules.ts
✓ FOUND: open-seo-main/src/routes/api/seo/voice-templates.ts
```

**Commits exist:**
```
✓ FOUND: 9ffe9eb (open-seo-main)
✓ FOUND: 6cc55ae84 (main)
```

**Key exports verified:**
```
✓ VoiceProfileService.upsert exists
✓ voiceApi.ts exports fetchVoiceProfile, updateVoiceProfile, triggerVoiceAnalysis
✓ voiceApi.ts exports fetchProtectionRules, createProtectionRule, deleteProtectionRule
✓ voiceApi.ts exports fetchVoiceTemplates
✓ voice.ts exports all 7 server actions
```
