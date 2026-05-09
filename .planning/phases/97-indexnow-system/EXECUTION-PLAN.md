# Phase 97: IndexNow System - 9-Day Execution Plan

> **Created:** 2026-05-08
> **Updated:** 2026-05-08
> **Status:** Ready for Execution
> **Total Duration:** 9 days
> **Cost:** $0 (IndexNow is free protocol)

---

## Related Documents

- [SPEC.md](./SPEC.md) - Technical specification
- [ONBOARDING-INTEGRATION.md](./ONBOARDING-INTEGRATION.md) - CMS onboarding integration (NEW)
- [VIBE-CODED-PLATFORM-INTEGRATION.md](./VIBE-CODED-PLATFORM-INTEGRATION.md) - Vercel/Netlify integration
- [INDEXNOW-CMS-INTEGRATION-MATRIX.md](../../research/INDEXNOW-CMS-INTEGRATION-MATRIX.md) - Top 15 CMS analysis

---

## Executive Summary

This execution plan sequences the implementation of the IndexNow Multi-Tenant Indexing System with emphasis on:

1. **Zero Extra Steps** - IndexNow auto-configures during existing CMS connection onboarding
2. **Top 15 CMS Support** - WordPress, Shopify, Wix, Drupal, Joomla, Magento, and 9 more platforms
3. **IndexNowCapableAdapter Interface** - Platform adapters extended with IndexNow methods
4. **Native Plugin Detection** - Auto-detect Rank Math, SEOPress, Yoast for WordPress
5. **Graceful Degradation** - Native plugin > Auto-deploy > Cloudflare bypass > Manual instructions (pending queue until verified)
6. **Parallel workstreams** - Infrastructure, Platform Adapters, and Sitemap tracks run concurrently

---

## Day 1: Database Schema and Core Infrastructure

### Objectives
- Establish database foundation for IndexNow configuration and submission logging
- Set up encryption infrastructure reusing existing AES-256-GCM patterns

### Deliverables

**Morning (4 hours):**
1. Create Drizzle schema (`open-seo-main/src/db/indexnow-schema.ts`)
   - `indexnow_config` table with domains, verification status, statistics
   - `indexnow_submissions` table for audit trail
   - **Link to site_connections table** for onboarding integration
   - Add `key_source` enum: `client_key`, `plugin_native`, `manual_pending`

2. Schema fields for onboarding integration:
   ```typescript
   // New fields in indexnow_config
   connectionId: uuid("connection_id").references(() => siteConnections.id)
   keySource: enum("client_key", "plugin_native", "manual_pending")
   detectedPlugin: text("detected_plugin")  // e.g., "rankmath", "seopress"
   platformMetadata: jsonb("platform_metadata")  // automation score, method
   ```

**Afternoon (4 hours):**
3. Generate and run Drizzle migration
4. Create `IndexNowService` class skeleton with methods:
   - `setupClient(clientId, domains, options)`
   - `verifyDomain(clientId, domain)`
   - `getConfig(clientId)`
   - `getPendingUrls(clientId, domain)`

### Success Criteria
- [x] Migration runs without errors on dev PostgreSQL
- [x] Schema includes pending queue tracking
- [x] IndexNowService class compiles with TypeScript

### Parallel Workstream
**Sitemap Track (can start Day 1):**
- Review existing sitemap infrastructure in open-seo-main
- Identify integration points for lastmod updates

### Rollback Point
If migration fails: `drizzle-kit drop` and fix schema before proceeding.

---

## Day 2: BullMQ Queue and Worker Foundation

### Objectives
- Create the submission queue with proper retry/backoff configuration
- Build worker that processes batches and logs results

### Deliverables

**Morning (4 hours):**
1. Create queue definition (`src/server/queues/indexnow-queue.ts`)
   - Job data type: `IndexNowJobData { clientId, domain, urls[], triggerType, configId, keySource }`
   - Default options: 3 attempts, exponential backoff (30s, 60s, 120s)
   - Job retention: 500 completed, 1000 failed

2. Implement dual-endpoint fallback in worker:
   ```typescript
   const INDEXNOW_ENDPOINTS = [
     "https://api.indexnow.org/IndexNow",
     "https://www.bing.com/IndexNow",
   ];
   ```

**Afternoon (4 hours):**
3. Create worker (`src/server/workers/indexnow-worker.ts`)
   - Decrypt client API key (skip if domain pending verification)
   - Build payload with correct keyLocation based on key source
   - POST to endpoints with timeout handling
   - Log to `indexnow_submissions` table

4. Register worker in `worker-entry.ts`

### Success Criteria
- [x] Worker starts without errors
- [x] Manual queue.add() creates job visible in BullMQ dashboard
- [x] Worker processes job and logs to database

### Testing Checkpoint
```bash
# Add test job via Redis CLI
RPUSH "bull:indexnow-submit:wait" '{"data":{"clientId":"test","domain":"example.com","urls":["https://example.com/test"],"triggerType":"manual","configId":"test","keySource":"manual_pending"}}'
```
Verify job appears in worker logs (will fail IndexNow but should log correctly).

### Rollback Point
If worker crashes: Check BullMQ connection settings, verify Redis is accessible.

---

## Day 3: Redis Batching Layer and Scheduler

### Objectives
- Implement URL deduplication via Redis SETs
- Create flush scheduler that triggers queue jobs at correct delays

### Deliverables

**Morning (4 hours):**
1. Implement batching in `IndexNowService`:
   ```typescript
   async queueUrl(clientId, url, triggerType) {
     // SADD to pending set (auto-dedupes)
     // SETNX flush timer with priority-based delay
   }
   ```

2. Priority delays configuration:
   | Trigger | Priority | Delay |
   |---------|----------|-------|
   | publish | 0 | 30s |
   | manual | 0 | 30s |
   | update | 1 | 5min |
   | seo_fix | 2 | 1hr |
   | bulk | 2 | 1hr |

**Afternoon (4 hours):**
3. Create flush scheduler (`src/server/jobs/indexnow-scheduler.ts`)
   - Cron: every 30 seconds
   - Scan `indexnow:flush:*` keys
   - Flush batches where timestamp <= now
   - Split into 10,000 URL chunks per IndexNow spec

4. Create daily stats reset job (midnight UTC)

### Success Criteria
- [x] Queue same URL 5 times, only 1 appears in pending set
- [x] Scheduler flushes batch after delay expires
- [x] Stats reset at midnight UTC

### Testing Checkpoint
```typescript
// Test deduplication
await indexNowService.queueUrl("client-1", "https://example.com/page", "publish");
await indexNowService.queueUrl("client-1", "https://example.com/page", "publish"); // duplicate
// Redis should show 1 URL in set
```

### Rollback Point
If scheduler causes Redis memory issues: Add TTL to all keys, implement key cleanup.

---

## Day 4: Pending Queue and Verification Flow

### Objectives
- Implement pending URL queue for unverified domains
- Build verification status management
- NOTE: IndexNow protocol requires key file at each domain — no shared/fallback key possible

### Deliverables

**Morning (4 hours):**
1. Pending URL queue management:
   ```typescript
   // URLs queued while domain verification is pending
   async queuePendingUrl(clientId: string, domain: string, url: string) {
     const pendingKey = `indexnow:pending:${clientId}:${domain}`;
     await redis.sadd(pendingKey, url);
     await redis.expire(pendingKey, 86400 * 7); // 7 day TTL
   }
   
   async flushPendingOnVerification(clientId: string, domain: string) {
     const pendingKey = `indexnow:pending:${clientId}:${domain}`;
     const urls = await redis.smembers(pendingKey);
     if (urls.length > 0) {
       await this.queueBatch(clientId, domain, urls, "verification_flush");
       await redis.del(pendingKey);
     }
   }
   ```

2. Verification status transitions:
   ```typescript
   type VerificationStatus = "pending" | "verified" | "failed" | "native_handled";
   
   async updateVerificationStatus(clientId, domain, status) {
     await db.update(indexnowConfig)
       .set({ verificationStatus: { [domain]: status } })
       .where(eq(indexnowConfig.clientId, clientId));
     
     // On verification success, flush pending URLs
     if (status === "verified") {
       await this.flushPendingOnVerification(clientId, domain);
     }
   }
   ```

**Afternoon (4 hours):**
3. Key verification checker (cron job):
   ```typescript
   // Run every 15 minutes for pending domains
   async verifyPendingDomains() {
     const pending = await db.query.indexnowConfig.findMany({
       where: sql`verification_status->>'${domain}' = 'pending'`
     });
     
     for (const config of pending) {
       const verified = await this.checkKeyFile(domain, config.apiKey);
       if (verified) {
         await this.updateVerificationStatus(config.clientId, domain, "verified");
       }
     }
   }
   ```

4. Dashboard notification for pending verification

### Success Criteria
- [x] URLs queue when domain not yet verified
- [x] Pending URLs auto-flush on verification success
- [x] Verification cron checks pending domains every 15 min
- [x] Dashboard shows pending status with setup instructions

---

## Day 5: Platform Adapter IndexNow Integration

### Objectives
- Extend existing platform adapters with IndexNowCapableAdapter interface
- Implement WordPress, Shopify, and base adapter IndexNow methods
- Integrate with existing CMS connection onboarding flow

### Deliverables

**Morning (4 hours):**
1. Create IndexNowCapableAdapter interface (`src/server/features/connections/adapters/types.ts`):
   ```typescript
   interface IndexNowCapableAdapter extends PlatformAdapter {
     getIndexNowCapabilities(): IndexNowCapabilities;
     detectExistingIndexNow(connectionId: string): Promise<DetectionResult>;
     deployIndexNowKey(connectionId: string, apiKey: string): Promise<DeployResult>;
     verifyIndexNowKey(domain: string, apiKey: string): Promise<VerifyResult>;
   }
   ```

2. Extend BaseAdapter with default IndexNow methods:
   - Generic manual instructions
   - Key verification via HTTP fetch
   - Cloudflare detection helper

**Afternoon (4 hours):**
3. WordPress adapter IndexNow methods:
   - SEO plugin detection (Rank Math, SEOPress, Yoast, AIOSEO)
   - REST API namespace checking (`/wp-json/rankmath/v1/`)
   - Native plugin = auto-handled, no key deployment needed
   - Fallback to wp_options storage + PHP snippet

4. Shopify adapter IndexNow methods:
   - GraphQL `fileCreate` mutation for key file
   - `urlRedirectCreate` mutation for `/{key}.txt` redirect
   - Fallback to TinyIMG app recommendation

### Success Criteria
- [x] IndexNowCapableAdapter interface defined and documented
- [x] WordPress SEO plugins detected via REST API namespaces
- [x] Shopify key file + redirect created via GraphQL
- [x] Base adapter provides Cloudflare detection

### Testing Checkpoint
Test against staging sites:
1. WordPress with Rank Math → should detect native handling
2. WordPress without SEO plugin → should deploy key
3. Shopify store → should create file + redirect

### Rollback Point
If adapter methods fail: Connection still works, IndexNow shows manual instructions.

---

## Day 6: Onboarding Integration and Additional Adapters

### Objectives
- Integrate IndexNow into ConnectionOnboardingService
- Implement remaining platform adapters (Wix, Joomla, Drupal, Magento)
- Add Cloudflare Crawler Hints detection for fallback platforms

### Deliverables

**Morning (4 hours):**
1. ConnectionOnboardingService.onConnectionEstablished() hook:
   ```typescript
   async onConnectionEstablished(clientId, connectionId, platform) {
     const adapter = getAdapterForPlatform(platform);
     
     // 1. Check native support (SEO plugins)
     const existing = await adapter.detectExistingIndexNow(connectionId);
     if (existing.configured) {
       return { status: "native_handled", plugin: existing.plugin };
     }
     
     // 2. Attempt auto-deployment
     const result = await adapter.deployIndexNowKey(connectionId, apiKey);
     
     // 3. Return status for success screen
     return { status: result.success ? "configured" : "manual_required" };
   }
   ```

2. Update Connection Success Screen component:
   - Show IndexNow status inline (not separate wizard)
   - Collapsible manual instructions for unsupported platforms
   - Pending verification status indicator

**Afternoon (4 hours):**
3. Additional platform adapters:
   - **Wix**: Check Premium plan, native IndexNow enabled
   - **Joomla**: Detect Aimy IndexNow extension via REST API
   - **Drupal**: Detect Index Now module via JSON:API
   - **Magento**: Detect Webkul extension via REST API

4. Cloudflare Crawler Hints detection:
   - Check CF-Ray header for Cloudflare presence
   - Provide dashboard deep link for Crawler Hints toggle
   - Used as fallback for Squarespace, Webflow, Weebly, etc.

### Success Criteria
- [x] Connection success screen shows IndexNow status
- [x] No separate IndexNow wizard needed
- [x] Cloudflare detected and Crawler Hints offered
- [x] 6+ platform adapters with IndexNow support

### Parallel Workstream
**Sitemap Track (continues from Day 1):**
- Implement `SitemapService.updateLastmod()` method
- Integrate with IndexNow queue to update lastmod on submission

---

## Day 7: Trigger Integration (AI-Writer + open-seo-main)

### Objectives
- Replace deprecated Google Indexing API hooks with IndexNow
- Add triggers for publish, update, and SEO fix events

### Deliverables

**Morning (4 hours):**
1. AI-Writer integration (`backend/services/auto_publish_executor.py`):
   ```python
   async def _submit_to_indexnow(self, article, published_url):
       async with httpx.AsyncClient() as client:
           await client.post(
               f"{settings.OPEN_SEO_API_URL}/api/indexnow/queue",
               json={
                   "clientId": str(article.client_id),
                   "url": published_url,
                   "triggerType": "publish"
               },
               headers={"X-Internal-Key": settings.INTERNAL_API_KEY}
           )
   ```

2. Replace `_submit_to_gsc()` calls with `_submit_to_indexnow()`

**Afternoon (4 hours):**
3. open-seo-main API endpoints:
   - `POST /api/indexnow/queue` - Internal queue endpoint
   - `POST /api/indexnow/submit` - Manual bulk submit (authenticated)
   - `GET /api/indexnow/config` - Get client config
   - `POST /api/indexnow/setup` - Initialize IndexNow
   - `POST /api/indexnow/verify` - Verify domain

4. SEO fix trigger in `SeoFixService`:
   ```typescript
   async applyFix(siteId, pageUrl, fix) {
     await this.executeFix(fix);
     await indexNowService.queueUrl(clientId, pageUrl, "seo_fix");
   }
   ```

### Success Criteria
- [x] Article publish in AI-Writer triggers IndexNow queue
- [x] SEO fix application triggers IndexNow queue
- [x] Manual submission via API works

### Testing Checkpoint
1. Publish article in AI-Writer staging
2. Verify Redis pending set updated
3. Wait for scheduler flush
4. Verify submission logged to database

### Rollback Point
If AI-Writer integration breaks publish flow: IndexNow queue errors are non-blocking (try/except wrapper).

---

## Day 8: Dashboard UI Components

### Objectives
- Build user-facing IndexNow management interface
- Provide visibility into submission history and status

### Deliverables

**Morning (4 hours):**
1. IndexNow Status Card (`apps/web/src/features/indexing/components/IndexNowStatusCard.tsx`):
   - Enabled/disabled badge
   - Domain verification status per domain
   - Statistics: today, this week, all time
   - Last error display

2. Setup Wizard (`IndexNowSetupWizard.tsx`):
   - Step 1: Add domains
   - Step 2: Platform detection
   - Step 3: Auto-deploy or manual instructions
   - Step 4: Verification
   - Step 5: View pending queue status

**Afternoon (4 hours):**
3. Submission History Table (`IndexNowSubmissionHistory.tsx`):
   - Time, domain, URL count, trigger type, status
   - Filter by success/failure
   - Pagination

4. Manual Submit Form:
   - Textarea for bulk URLs (one per line)
   - Validation feedback
   - Submit button with loading state

### Success Criteria
- [x] Status card shows real data from API
- [x] Setup wizard completes full onboarding flow
- [x] History table loads and paginates correctly

### Testing Checkpoint
Manual walkthrough of complete user journey:
1. New client setup via wizard
2. WordPress auto-deploy or manual instructions
3. Verify domain
4. Publish content
5. View in history table

---

## Day 9: Testing, Verification, and Documentation

### Objectives
- End-to-end testing of complete system
- Verify IndexNow submissions actually reach search engines
- Document operational procedures

### Deliverables

**Morning (4 hours):**
1. Integration test suite:
   ```typescript
   describe("IndexNow System", () => {
     it("queues URL on publish");
     it("batches multiple URLs");
     it("uses client key when verified");
     it("falls back to TeveroSEO key");
     it("logs submission to database");
     it("retries on failure");
   });
   ```

2. E2E test with real IndexNow submission:
   - Use test domain with verified key
   - Submit URL to IndexNow
   - Verify 200/202 response
   - Check Bing Webmaster Tools for submission (manual verification)

**Afternoon (4 hours):**
3. Operational documentation:
   - Runbook for common issues
   - Monitoring alerts setup
   - Key rotation procedure

4. Final verification checklist:
   - [ ] Database tables exist and indexed
   - [ ] Worker processing jobs
   - [ ] Scheduler flushing batches
   - [ ] WordPress auto-deploy works
   - [ ] Pending queue flushes on verification
   - [ ] Dashboard shows data
   - [ ] AI-Writer triggers working

### Success Criteria
- [x] All integration tests pass
- [x] Real IndexNow submission returns 200/202
- [x] Dashboard shows submission in history
- [x] No errors in logs for 1 hour

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| IndexNow endpoint downtime | Low | Medium | Dual-endpoint fallback (api.indexnow.org + bing.com) |
| WordPress REST API auth failures | Medium | Medium | Fall back to manual instructions |
| Pending queue overflow | Low | Medium | 7-day TTL on pending URLs, max 10K per domain |
| Redis memory exhaustion | Low | High | TTL on all keys, batching limits |
| Platform detection inaccuracy | Medium | Low | Default to "unknown" with generic instructions |
| AI-Writer integration breaks publish | Medium | High | Non-blocking try/except, async fire-and-forget |

---

## Dependencies Graph

```
Day 1 (Schema + Service + connection_id linkage)
    |
    +---> Day 2 (Queue + Worker)
    |         |
    |         +---> Day 3 (Batching + Scheduler)
    |                   |
    |                   +---> Day 7 (Triggers)
    |
    +---> Day 4 (Pending Queue + Verification)
    |
    +---> Day 5 (IndexNowCapableAdapter + WordPress/Shopify)
    |         |
    |         +---> Day 6 (Onboarding Integration + More Adapters)
    |
    +---> Day 6 (Sitemap lastmod) [parallel track]
              |
              +---> Day 8 (Dashboard - simplified, inline status)
                        |
                        +---> Day 9 (Testing + Migration Service)
```

---

## Parallel Execution Opportunities

**Days 1-3:** Infrastructure foundation (sequential, critical path)

**Days 4-6:** Three parallel tracks possible:
- Track A: Pending Queue (Day 4) + Triggers (partial Day 7)
- Track B: WordPress (Day 5) + Platform detection (Day 6)
- Track C: Sitemap lastmod integration

**Days 7-8:** Integration and UI (depends on Days 1-6)

**Day 9:** Testing (depends on all)

---

## Success Metrics (Post-Launch)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Submission success rate | > 98% | `success=true / total` |
| Queue latency (publish) | < 60s | Time from publish to IndexNow POST |
| WordPress auto-deploy rate | > 70% | Auto-deploy success / WordPress clients |
| Verification rate | > 80% | Verified domains / total domains |
| Dashboard availability | 99.9% | Uptime monitoring |

---

## Environment Variables Required

```bash
# Encryption (existing)
PAYMENT_ENCRYPTION_KEY=<32-byte-base64>

# Cross-service auth
INTERNAL_API_KEY=<random-string>

# Pending queue TTL (days)
INDEXNOW_PENDING_TTL_DAYS=7

# Optional tuning
INDEXNOW_DEFAULT_DELAY_PUBLISH=30
INDEXNOW_DEFAULT_DELAY_UPDATE=300
INDEXNOW_DEFAULT_DELAY_SEO_FIX=3600
```

---

## Conclusion

This 9-day execution plan delivers a complete IndexNow system with:

1. **Zero Extra Steps:** IndexNow auto-configures during CMS connection onboarding
2. **Top 15 CMS Support:** WordPress, Shopify, Wix, Drupal, Joomla, Magento, and more
3. **Native Plugin Detection:** Auto-detect Rank Math, SEOPress, Yoast (WordPress handles IndexNow)
4. **Graceful Degradation:** Native plugin > Auto-deploy > Cloudflare bypass > Manual (pending queue until verified)
5. **Observability:** Inline status in connection screen, history table, statistics
6. **Resilience:** Dual endpoints, retry logic, circuit breakers

The critical path runs through Days 1-3 (infrastructure). Days 4-6 can be parallelized with multiple developers. Days 7-9 integrate and validate the complete system.

**Key Integration:** IndexNowCapableAdapter interface extends existing platform adapters, ensuring IndexNow is configured automatically when users connect their CMS.

**Total estimated effort:** 9 developer-days (72 hours)
**Potential parallel speedup:** 6-7 days with 2 developers
