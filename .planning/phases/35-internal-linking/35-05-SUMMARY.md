# Plan 35-05 Summary: Cannibalization Detection & Link Health Dashboard

**Status:** Complete
**Completed:** 2026-04-23
**Verified By:** User (human verification approved)

## Tasks Completed

### Task 1: Cannibalization Detection Service
- **keywordCannibalization table** added to link-schema.ts with severity, competing pages
- **CannibalizationService** detects when multiple pages compete for same keyword
- Severity levels: critical (<5 position gap), high (<10), medium (<20), low (>=20)
- Recommends primary page based on clicks, then position
- `isTargetCannibalized()` checks if URL is in active conflict
- 11 tests passing

### Task 2: API Routes for Link Operations
Created 7 API routes in `src/routes/api/seo/links/`:

| Route | Method | Purpose |
|-------|--------|---------|
| `/health/$clientId` | GET | Overview metrics, distribution, opportunities |
| `/opportunities/$clientId` | GET | Paginated opportunities with filters |
| `/opportunities/$id/approve` | POST | Approve an opportunity |
| `/opportunities/$id/reject` | POST | Reject an opportunity |
| `/cannibalization/$clientId` | GET | Active cannibalization issues |
| `/suggestions/$id/apply` | POST | Apply a link suggestion |
| `/batch/apply-safe` | POST | Batch apply auto-applicable suggestions |

- All routes require authentication via `requireApiAuth`
- 5 API tests passing

### Task 3: Link Health Dashboard UI
Created `apps/web/src/app/(shell)/clients/[clientId]/seo/[projectId]/links/page.tsx`:

- **Overview Cards:** Total Pages, Orphan Pages, Avg Links/Page, Deep Pages
- **Link Distribution Chart:** Bar chart showing links per page buckets
- **Opportunities Table:** Priority-sorted with approve/reject actions
- Uses @tanstack/react-query for data fetching
- Uses @tevero/ui components (Card, Badge, Table, Button)

## Test Results

```bash
# All linking tests
npx vitest run src/server/features/linking/ src/routes/api/seo/links/
# 44 passed, 1 skipped (45 total)

# Service breakdown
# - VelocityService: 9 tests
# - LinkSuggestionService: 9 tests (1 skipped)
# - LinkApplyService: 11 tests
# - CannibalizationService: 11 tests
# - Health API: 5 tests
```

## Files Created/Modified

**Created:**
- `src/server/features/linking/services/CannibalizationService.ts`
- `src/server/features/linking/services/CannibalizationService.test.ts`
- `src/routes/api/seo/links/health.$clientId.ts`
- `src/routes/api/seo/links/health.$clientId.test.ts`
- `src/routes/api/seo/links/opportunities.$clientId.ts`
- `src/routes/api/seo/links/opportunities.$id.approve.ts`
- `src/routes/api/seo/links/opportunities.$id.reject.ts`
- `src/routes/api/seo/links/cannibalization.$clientId.ts`
- `src/routes/api/seo/links/suggestions.$id.apply.ts`
- `src/routes/api/seo/links/batch.apply-safe.ts`
- `apps/web/src/app/(shell)/clients/[clientId]/seo/[projectId]/links/page.tsx`

**Modified:**
- `src/server/features/linking/index.ts` - Added CannibalizationService exports

## Human Verification

**Status:** Approved (2026-04-23)

Verified:
- Overview cards render correctly
- Distribution chart displays
- Opportunity list with approve/reject actions
- API endpoints return expected responses
