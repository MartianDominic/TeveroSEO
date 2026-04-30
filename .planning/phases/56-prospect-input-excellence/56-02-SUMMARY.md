---
phase: 56-prospect-input-excellence
plan: 02
subsystem: prospects
tags: [ai-extraction, claude-api, conversation-parsing, platform-detection]
dependency_graph:
  requires: [56-01]
  provides: [prospect-extraction-service, extraction-api-endpoint]
  affects: [prospect-input-flow, ai-writer-integration]
tech_stack:
  added: [anthropic-sdk, zod-validation]
  patterns: [tdd-red-green, class-based-mocks, server-actions]
key_files:
  created:
    - open-seo-main/src/server/features/prospects/services/ConversationExtractor.ts
    - open-seo-main/src/server/features/prospects/services/ConversationExtractor.test.ts
    - open-seo-main/src/routes/api/prospects/extract.ts
  modified:
    - apps/web/src/app/(shell)/prospects/actions.ts
decisions:
  - "Use class-based mock pattern for Anthropic SDK (vi.hoisted + class MockAnthropic)"
  - "In-memory Map for rate limiting (50/day/workspace) with UTC midnight reset"
  - "Return confidence 0 for malformed AI responses instead of throwing"
  - "Platform detection non-blocking - continues if detection fails"
  - "Zod validation with 50KB content limit (T-56-05 mitigation)"
  - "Extract creates ExtractionResult + ExtractedProspectData with optional platform field"
metrics:
  duration_seconds: 304
  completed_date: 2026-04-30
  tasks_completed: 2
  files_created: 3
  files_modified: 1
  tests_added: 5
  commits: 2
---

# Phase 56 Plan 02: AI Extraction Service Summary

**One-liner:** Claude-powered conversation extraction with Zod validation, rate limiting, and platform detection for prospect intelligence.

## Objective Achievement

✅ **COMPLETE** - AI extraction pipeline fully implemented and tested.

Implemented the "paste anything, get brilliant insights" value proposition by creating a complete extraction service that processes conversation text, sales transcripts, or website context through Claude AI and returns structured business data with confidence scores.

**Working pipeline:** Frontend server action → API endpoint (rate limited) → ConversationExtractor service → Claude AI → Zod validation → Structured prospect data with platform detection.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | ConversationExtractor service with Claude integration | 1a295586f | ConversationExtractor.ts, ConversationExtractor.test.ts |
| 2 | API endpoint and server action for extraction | e4da4c594 | extract.ts, actions.ts |

## Implementation Details

### Task 1: ConversationExtractor Service (TDD)

**RED Phase:** Created 5 failing tests
- Extract business info from sales transcript
- Confidence score in valid range (0-100)
- Empty content validation
- Short content validation (<50 chars)
- Zod validation on malformed AI response

**GREEN Phase:** Implemented service
- Claude Sonnet 4 integration (`claude-sonnet-4-20250514`)
- Zod schema validation (ExtractionResultSchema)
- Input validation (50-50000 chars)
- Platform detection for website modes (optional)
- Graceful degradation on errors (confidence: 0)
- Comprehensive logging (warn/error levels)

**Mock Strategy:**
```typescript
const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
  },
}));
```

### Task 2: API Endpoint + Server Action

**API Endpoint:** `/api/prospects/extract`
- `createAPIFileRoute` pattern from TanStack Start
- Rate limiting: 50 extractions/day/workspace (T-56-04)
- In-memory Map with UTC midnight reset
- Zod validation with 50KB limit (T-56-05)
- Status codes: 429 (rate limit), 400 (validation), 500 (server error)

**Server Action:** `extractFromConversationAction`
- Wraps extraction endpoint with `postOpenSeo`
- Auth via `requireActionAuth()`
- Input validation with `extractFromConversationSchema`
- Error sanitization for client display
- Returns `ActionResult<ExtractionResult>`

**ExtractionResult Interface:**
```typescript
{
  businessName?: string;
  industry?: string;
  services?: string[];
  targetAudience?: string;
  keywords?: string[];
  location?: string;
  confidence: number;  // 0-100
  platform?: DetectionResult;  // Optional platform fingerprint
}
```

## Deviations from Plan

None - plan executed exactly as written.

## Security Mitigations (Threat Model)

| Threat ID | Mitigation | Implementation |
|-----------|------------|----------------|
| T-56-04 | DoS via extraction spam | `checkRateLimit()` - 50/day/workspace, in-memory Map |
| T-56-05 | Tampering via large payloads | Zod schema with `.max(50000)` on content/contextNotes |
| T-56-06 | Information disclosure | Generic error messages, logger for internal details, no API key exposure |
| T-56-07 | Spoofing | `requireAuthenticatedContext()` validates session before processing |

## Key Features

1. **AI-Powered Extraction**
   - Claude API with structured JSON output
   - Confidence scoring (0-100)
   - Handles sales transcripts, emails, meeting notes

2. **Platform Detection**
   - Automatic detection for website modes
   - Non-blocking (continues on failure)
   - Integrates `PlatformDetector` service

3. **Robust Validation**
   - Input: 50-50000 char range
   - Output: Zod schema validation
   - Graceful degradation on malformed AI responses

4. **Rate Limiting**
   - 50 extractions/day/workspace
   - UTC midnight reset
   - HTTP 429 on limit exceeded

5. **Test Coverage**
   - 5 test cases (all passing)
   - Mock Anthropic SDK with class pattern
   - Edge cases: empty content, short content, invalid JSON

## Known Stubs

None - all functionality fully implemented.

## Threat Flags

None - no new security-relevant surface outside documented threat model.

## Dependencies

**Requires:**
- Phase 56-01 (Input mode selector, schema foundation)
- Anthropic SDK (`@anthropic-ai/sdk`)
- PlatformDetector service (Phase 31)
- AppError error handling (existing)

**Provides:**
- `extractFromConversation()` function
- `ConversationExtractor` namespace export
- `/api/prospects/extract` endpoint
- `extractFromConversationAction()` server action
- `ExtractionResult` + `ExtractedProspectData` types

**Affects:**
- Prospect input flow (enables "paste anything" UX)
- AI-Writer integration (voice + content generation)
- Quick Check feature (uses extraction for initial data)

## Files Modified

**Created (3):**
- `open-seo-main/src/server/features/prospects/services/ConversationExtractor.ts` (192 lines)
- `open-seo-main/src/server/features/prospects/services/ConversationExtractor.test.ts` (134 lines)
- `open-seo-main/src/routes/api/prospects/extract.ts` (110 lines)

**Modified (1):**
- `apps/web/src/app/(shell)/prospects/actions.ts` (+74 lines)

## Testing

**Unit Tests:** 5/5 passing
- ✅ Extract business info from sales transcript
- ✅ Confidence score in valid range
- ✅ Throws on empty content
- ✅ Throws on content too short
- ✅ Validates AI response with Zod schema

**Test Strategy:**
- TDD (RED → GREEN)
- Class-based Anthropic mock
- Hoisted mock functions via `vi.hoisted()`
- Comprehensive edge case coverage

## Next Steps

1. **UI Integration (56-03):** Wire extraction action to ConversationInput component
2. **CSV Import (56-04):** Bulk prospect creation from parsed CSV
3. **Entry Manager (56-05):** Unified entry management UI with extraction triggers

## Self-Check: PASSED

**Files Exist:**
- ✅ `/home/dominic/Documents/TeveroSEO/open-seo-main/src/server/features/prospects/services/ConversationExtractor.ts`
- ✅ `/home/dominic/Documents/TeveroSEO/open-seo-main/src/server/features/prospects/services/ConversationExtractor.test.ts`
- ✅ `/home/dominic/Documents/TeveroSEO/open-seo-main/src/routes/api/prospects/extract.ts`

**Commits Exist:**
- ✅ `1a295586f` - test(56-02): add failing tests for ConversationExtractor (RED)
- ✅ `e4da4c594` - feat(56-02): add extraction API endpoint and server action

**Tests Pass:**
- ✅ All 5 tests passing in ConversationExtractor.test.ts

**Code Quality:**
- ✅ Exports match acceptance criteria
- ✅ Security mitigations implemented
- ✅ Error handling comprehensive
- ✅ No console.log statements
- ✅ Immutable patterns used
