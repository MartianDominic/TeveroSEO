# TeveroSEO Comprehensive Critical/High Issue Audit
**Date:** 2026-04-29
**Audited by:** 20 Opus subagents in parallel

## Executive Summary

| Severity | Count | App-Breaking? |
|----------|-------|---------------|
| CRITICAL | 47 | Yes - prevent app from working |
| HIGH | 119 | Likely - cause failures in common flows |

### Top 5 Most Urgent Issues

1. **Authorization Bypass (7 CRITICAL)** - Any authenticated user can access ANY client's data via open-seo-main routes missing `requireClientAccess`
2. **Cascade Deletes (7 CRITICAL)** - Deleting an organization destroys entire data tree across 20+ tables with no recovery
3. **Missing API Endpoints (4 CRITICAL)** - Workspace membership, team metrics, client reassign, project-by-ID endpoints don't exist
4. **Fetch Without Timeout (5 CRITICAL)** - Multiple client-side fetch calls hang indefinitely on network issues
5. **Database N+1 Queries (3 CRITICAL)** - Keyword enrichment loops execute individual queries, causing production timeouts

---

## Audit Results by Domain

### 1. Authorization & Client Isolation (7 CRITICAL, 4 HIGH)

**CRITICAL: Missing client ownership validation in open-seo-main**

| File | Line | Impact |
|------|------|--------|
| `src/routes/api/clients/$clientId.reports.ts` | 29 | Any user can access ANY client's reports |
| `src/routes/api/clients/$clientId.drop-events.ts` | 27 | Any user can access ANY client's rank drops |
| `src/routes/api/clients/$clientId.alert-rules.ts` | 29 | Any user can CRUD alert rules for ANY client |
| `src/routes/api/clients/$clientId/goals/index.ts` | 31 | Any user can CRUD goals for ANY client |
| `src/routes/api/clients/$clientId/gsc.daily.ts` | 42 | Any user can access GSC metrics for ANY client |
| `src/routes/api/seo/voice.$clientId.preview.ts` | 42 | Any user can generate voice previews (consumes LLM credits) |
| `src/routes/api/seo/links/batch.apply-safe.ts` | 31 | Any user can apply link suggestions in bulk |

**Fix:** Add `requireClientAccess(authContext.userId, clientId)` after `requireApiAuth()` in all routes.

---

### 2. Data Integrity - Cascade Deletes (7 CRITICAL, 10 HIGH)

**CRITICAL: Destructive cascades with no recovery**

| Table | Cascade Source | Data Lost |
|-------|----------------|-----------|
| `clients` | organization.id | ALL child data (20+ tables) |
| `projects` | organization.id | Audits, keywords, briefs, link graphs |
| `audits` | project.id | Pages, findings, lighthouse, link analysis |
| `siteChanges` | client.id | SEO change history (rollback impossible) |
| `voiceProfiles` | client.id | Learned brand voice (expensive to regenerate) |
| `Client (AI-Writer)` | - | All articles, publishing history, analytics |
| `ScheduledArticle` | client.id | Generated content (potentially thousands $) |

**Fix:** Implement soft delete pattern with `is_deleted` + `deleted_at` timestamps.

---

### 3. API Contract Consistency (4 CRITICAL, 5 HIGH)

**CRITICAL: Missing backend endpoints**

| Frontend Location | Expected Endpoint | Status |
|-------------------|-------------------|--------|
| `lib/auth/action-auth.ts` | `GET /api/workspaces/{id}/membership` | MISSING |
| `actions/team/get-team-metrics.ts` | `GET /api/workspaces/{id}/team` | MISSING |
| `actions/team/get-team-metrics.ts` | `POST /api/workspaces/{id}/clients/{id}/reassign` | MISSING |
| `actions/seo/projects.ts` | `GET /api/seo/projects/{projectId}` | MISSING |

**HIGH: Wrong HTTP method helper in saved-views.ts**
- `createSavedViewWithConfig()`, `updateSavedViewWithConfig()`, `deleteSavedViewById()`, `setDefaultViewById()` all use `getFastApi()` which only supports GET.

---

### 4. External API Integration (5 CRITICAL, 5 HIGH)

**CRITICAL: Fetch without timeout (infinite hang risk)**

| File | Line | Impact |
|------|------|--------|
| `lib/audit/repositories/FindingsRepository.ts` | 176 | All findings API calls hang |
| `lib/api/schedules.ts` | 48 | All schedule operations hang |
| `lib/siteConnections.ts` | 45 | Platform detection, connections hang |
| `lib/auth/action-auth.ts` | 139 | Ownership validation hangs |
| `AI-Writer/.../wix/auth.py` | 50 | Wix OAuth hangs |

**Fix:** Use `fetchWithTimeout()` from `@/lib/fetch-with-timeout.ts` or add `AbortSignal.timeout(30000)`.

---

### 5. Database Schema Integrity (3 CRITICAL, 9 HIGH)

**CRITICAL: Type mismatches and table collisions**

| Issue | Location | Impact |
|-------|----------|--------|
| OAuth client_id TEXT→UUID migration | `alembic/0014b` + `0016` | Migration fails if invalid UUIDs |
| GSC table name collision | AI-Writer `gsc_snapshots` vs open-seo `seo_gsc_snapshots` | Wrong data if shared DB |
| GA4 table name collision | Same pattern | Wrong data if shared DB |

---

### 6. Database Query Patterns (3 CRITICAL, 10 HIGH)

**CRITICAL: N+1 causing production timeouts**

| File | Pattern | Impact |
|------|---------|--------|
| `KeywordEnrichmentService.ts:116` | UPDATE in for-loop | 1000 keywords = 1000 queries |
| `KeywordEnrichmentService.ts:150` | UPDATE in nested loop | Same |
| `KeywordDeduplicator.ts:55` | SELECT+INSERT per keyword | 2x queries per keyword |

**HIGH: No LIMIT on queries**
- `FindingsRepository.ts` - 4 methods unbounded
- `ProjectRepository.ts` - listProjects unbounded
- Multiple other repositories

---

### 7. CI/CD Pipeline (2 CRITICAL, 6 HIGH)

**CRITICAL: Tests silently ignored in deploy**

| Workflow | Line | Issue |
|----------|------|-------|
| `deploy-ai-writer.yml` | 67 | `pytest ... || true` - tests can fail |
| `deploy-vps.yml` | 74 | `pnpm test ... || true` - tests can fail |

**HIGH: No rollback mechanism**
- All 4 deploy workflows lack automatic rollback on health check failure.

---

### 8. Error Handling Patterns (0 CRITICAL, 17 HIGH)

**Key patterns:**
- Bulk operations in ArticleLibraryPage silently swallow partial failures
- voice.ts functions return null/empty on errors (indistinguishable from "no data")
- Empty catch blocks in intelligence/prediction functions

---

### 9. TypeScript Type Safety (3 CRITICAL, 15 HIGH)

**CRITICAL: Array access without bounds check**

| File | Line | Issue |
|------|------|-------|
| `SparklineChart.tsx` | 83 | `data[0].value` without length check |
| `BatchRevertDialog.tsx` | 87 | `categories[0]` could be empty |
| `KeywordAggregationService.ts` | 154 | `result[0].clientId` without empty check |

**HIGH: Unsafe type assertions**
- 15 instances of `as Type` without Zod validation on API responses

---

### 10. Cross-Platform Integration (3 CRITICAL, 6 HIGH)

**CRITICAL: Docker internal hostname fallbacks**

| File | Fallback URL | Problem |
|------|--------------|---------|
| `api/reports/[id]/download/route.ts` | `http://open-seo:3001` | Fails outside Docker |
| `api/prospects/[id]/report/route.ts` | `http://open-seo:3001` | Fails outside Docker |
| `api/clients/[clientId]/branding/logo/route.ts` | `http://open-seo:3001` | Fails outside Docker |

---

### 11. Environment Configuration (2 CRITICAL, 14 HIGH)

**CRITICAL: Undocumented required vars**
- `NEXT_PUBLIC_METRICS_WS_URL` - WebSocket URL for real-time SEO metrics
- `ALWRITY_DATABASE_URL` - Cross-service dependency not in apps/web

**HIGH: 14 production-required vars marked optional in .env.example**

---

### 12. Async/Promise Patterns (1 CRITICAL, 14 HIGH)

**CRITICAL: Exception silently swallowed**
- `sif_integration_service.py:726` - `except Exception: pass` loses database alert failures

**HIGH: 10 fetch() calls without timeout, 3 fire-and-forget asyncio.create_task without error callback**

---

### 13. Authentication Flow (0 CRITICAL, 7 HIGH)

| Issue | Location | Impact |
|-------|----------|--------|
| Stale JWT role claims | `global-settings/route.ts` | Revoked users keep access until JWT expires |
| Agency model too permissive | `clients.py:682` | ALL authenticated users access ALL clients |
| Query token auth deprecated | `auth_middleware.py:370` | Tokens leak via logs/referrer |
| 5-min auth cache | `authz.ts:76` | Removed users keep access 5 mins |

---

### 14. Input Validation (0 CRITICAL, 8 HIGH)

| Issue | Location | Risk |
|-------|----------|------|
| Missing body validation | `api/articles/[id]/route.ts POST` | Malformed data to backend |
| Minimal domain validation | `detect-platform.ts` | SSRF potential |
| No length constraints | `brainstorm.py` | DoS via token exhaustion |

---

### 15. Resource Management (0 CRITICAL, 4 HIGH)

| Issue | Location | Risk |
|-------|----------|------|
| Pubsub stops reconnecting | `redis/pubsub.ts` | Returns null after 10 retries |
| Cleanup interval at module load | `connection-manager.ts` | No shutdown handler |
| DLQ initial setTimeout not tracked | `dlq.ts` | Can't cancel on early shutdown |
| Lock auto-extend race | `distributed-lock.ts` | Interval may race with completion |

---

### 16. Build Configuration (0 CRITICAL, 6 HIGH)

- `@types/node` version mismatch with vite peer requirements
- `@vitejs/plugin-react` requires vite 8.x, project has 7.x
- `@testing-library/react-hooks` deprecated for React 18+
- `pillow` CVEs blocked by moviepy dependency

---

## Clean Audits (No Issues)

| Domain | Status |
|--------|--------|
| RSC Boundaries | 233 TSX files checked, all compliant |
| File System Security | All operations protected |
| Redis/Queue System | Well-implemented with DLQ, retry, backpressure |
| Dependency Security (npm) | 0 vulnerabilities |

---

## Recommended Fix Priority

### Phase 1: Security (Immediate)
1. Add `requireClientAccess` to all open-seo-main client routes
2. Fix cascade deletes with soft delete pattern
3. Create missing API endpoints

### Phase 2: Reliability (This Week)
4. Add timeouts to all fetch() calls
5. Fix N+1 database queries
6. Remove `|| true` from CI test commands

### Phase 3: Stability (This Sprint)
7. Fix type safety issues (bounds checks, Zod validation)
8. Fix Docker hostname fallbacks
9. Document required environment variables
10. Implement rollback in deploy workflows

---

## Files Consolidated

Previously 31 audit files were scattered at project root. Now archived to:
```
docs/audits/archive-2026-04-28/
```

Only essential root files remain: `CLAUDE.md`, `DEPLOY.md`
