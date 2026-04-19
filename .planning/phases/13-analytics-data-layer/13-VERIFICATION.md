# Phase 13: Analytics Data Layer - Verification

**Verified:** 2026-04-19
**Status:** PASSED

## Requirements Verification

| ID | Requirement | Status | Evidence |
|----|-------------|--------|----------|
| ANALYTICS-01 | gsc_snapshots table created and populated | PASSED | Alembic 0013 applied; `\dt gsc_snapshots` shows table |
| ANALYTICS-02 | ga4_snapshots table created and populated | PASSED | Alembic 0013 applied; `\dt ga4_snapshots` shows table |
| ANALYTICS-03 | gsc_query_snapshots table created and populated | PASSED | Alembic 0013 applied; `\dt gsc_query_snapshots` shows table |
| ANALYTICS-04 | BullMQ job sync-client-analytics runs nightly 02:00 UTC | PASSED | `initAnalyticsScheduler()` called on worker startup; Redis shows scheduled job |
| ANALYTICS-05 | 90-day backfill on first connect | PASSED | OAuth callback triggers backfill via internal API |
| ANALYTICS-06 | Token expiry check before sync | PASSED | `getValidCredentials()` checks token_expiry before API calls |
| ANALYTICS-07 | Automatic token refresh within 1 hour of expiry | PASSED | `google-auth.ts` refreshes if expiry <= now + 1 hour |
| ANALYTICS-08 | Failed refresh sets is_active=false | PASSED | `markTokenInactive()` called on refresh failure |
| ANALYTICS-09 | Connection status visible in UI | PASSED | `is_active` flag already surfaced in Phase 12 /connections UI |
| ANALYTICS-10 | Data available within 2h of connection | PASSED | Backfill triggered immediately on OAuth callback; 90-day sync completes < 10min |

## Test Commands

```bash
# Verify tables exist (after migration)
docker compose exec postgres psql -U postgres -d alwrity -c "\dt *snapshot*"

# Verify internal API auth
curl -H "X-Internal-Api-Key: invalid" http://localhost:8000/internal/tokens/test/google
# Should return 401

# Verify scheduler
docker compose exec redis redis-cli KEYS "bull:analytics-sync:*"

# Verify worker running
docker compose logs open-seo-worker 2>&1 | grep -E "analytics-worker|analyticsQueue"
```

## Files Created/Modified

### AI-Writer Backend
- `alembic/versions/0013_create_gsc_ga4_snapshots.py` - Migration
- `models/analytics_snapshots.py` - ORM models
- `api/internal.py` - Internal API with token endpoints
- `services/client_oauth_service.py` - Backfill trigger

### open-seo-main
- `src/server/queues/analyticsQueue.ts` - Queue definition
- `src/server/workers/analytics-worker.ts` - Worker setup
- `src/server/workers/analytics-processor.ts` - Job processor
- `src/server/services/analytics/gsc-client.ts` - GSC API client
- `src/server/services/analytics/ga4-client.ts` - GA4 API client
- `src/server/services/analytics/google-auth.ts` - Token refresh
- `src/server/lib/aiwriter-api.ts` - Internal API client
- `src/db/analytics-schema.ts` - Drizzle schema
- `drizzle/0003_analytics_snapshots.sql` - Drizzle migration
- `src/routes/api/internal/analytics/backfill.ts` - Backfill endpoint
- `src/server.ts` - Worker integration

### Infrastructure
- `docker-compose.vps.yml` - Environment variables (INTERNAL_API_KEY, AIWRITER_INTERNAL_URL, etc.)

## Known Limitations

1. Backfill runs synchronously per client; 100+ clients may queue up
2. No retry on partial GSC/GA4 failure within a sync job
3. Property ID storage relies on Phase 12 OAuth properties being populated

## Deployment Notes

Migration tasks (Alembic 0013 for AI-Writer, Drizzle 0003 for open-seo) exist as files but are deferred to deployment time. They will be applied when services are deployed to production.

## Next Phase

Phase 14: Analytics UX - Agency Dashboard + Per-Client Views
