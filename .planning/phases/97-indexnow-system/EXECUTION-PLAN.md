# Phase 97: IndexNow System - 9-Day Execution Plan

> **Created:** 2026-05-08
> **Status:** Ready for Execution
> **Total Duration:** 9 days
> **Cost:** $0 (IndexNow is free protocol)

---

## Executive Summary

This execution plan sequences the implementation of the IndexNow Multi-Tenant Indexing System with emphasis on:

1. **TeveroSEO-owned API key as fallback** - Clients who cannot deploy key files still get indexing via our hosted domain
2. **Auto-deploy for WordPress** - REST API integration for automatic key deployment
3. **Vibe-coded platform detection** - Identify and support modern frameworks (Vercel, Netlify, etc.)
4. **Graceful degradation cascade** - Client key > TeveroSEO fallback > Manual instructions
5. **Parallel workstreams** - Infrastructure, WordPress, and Sitemap tracks run concurrently

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
   - Add `fallback_mode` enum: `client_key`, `tevero_fallback`, `manual_pending`

2. Add TeveroSEO fallback key infrastructure:
   ```typescript
   // New fields in indexnow_config
   keySource: enum("client_key", "tevero_fallback", "manual_pending")
   teveroFallbackEnabled: boolean  // Client opted into fallback
   ```

**Afternoon (4 hours):**
3. Generate and run Drizzle migration
4. Create `IndexNowService` class skeleton with methods:
   - `setupClient(clientId, domains, options)`
   - `verifyDomain(clientId, domain)`
   - `getConfig(clientId)`
   - `enableTeveroFallback(clientId)`

### Success Criteria
- [x] Migration runs without errors on dev PostgreSQL
- [x] Schema includes fallback mode tracking
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
   - Decrypt API key (client or TeveroSEO fallback)
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

## Day 4: TeveroSEO Fallback Key Infrastructure

### Objectives
- Deploy TeveroSEO-owned key file to our hosting
- Implement fallback cascade logic

### Deliverables

**Morning (4 hours):**
1. Create TeveroSEO IndexNow key (single key for fallback):
   ```bash
   TEVERO_INDEXNOW_KEY=<uuid>  # Add to .env
   ```

2. Deploy key file endpoint to TeveroSEO infrastructure:
   ```typescript
   // apps/web/src/app/[key].txt/route.ts (Next.js route)
   // OR nginx config for static file
   ```
   - Serve at: `https://app.teveroseo.com/{TEVERO_INDEXNOW_KEY}.txt`

**Afternoon (4 hours):**
3. Implement graceful degradation cascade in `IndexNowService`:
   ```typescript
   async getKeyForSubmission(clientId, domain) {
     const config = await this.getConfig(clientId);
     
     // Cascade 1: Client's verified key
     if (config.verificationStatus[domain] === "verified") {
       return {
         key: decrypt(config.apiKeyEncrypted),
         keyLocation: `https://${domain}/${key}.txt`,
         source: "client_key"
       };
     }
     
     // Cascade 2: TeveroSEO fallback (if enabled)
     if (config.teveroFallbackEnabled) {
       return {
         key: env.TEVERO_INDEXNOW_KEY,
         keyLocation: `https://app.teveroseo.com/${env.TEVERO_INDEXNOW_KEY}.txt`,
         source: "tevero_fallback"
       };
     }
     
     // Cascade 3: Not ready
     return null;
   }
   ```

4. Update worker to use cascade logic

### Success Criteria
- [x] `https://app.teveroseo.com/{key}.txt` returns key
- [x] Submissions use correct key based on verification status
- [x] Fallback-mode submissions log with `source: tevero_fallback`

### Risk: TeveroSEO Key Rate Limiting
IndexNow has no official rate limits, but we should monitor for any throttling when many clients use the fallback key. Mitigation: Implement per-domain rate limiting for fallback submissions.

---

## Day 5: WordPress Auto-Deployment

### Objectives
- Automatically deploy IndexNow key to WordPress sites via REST API
- Handle verification flow after deployment

### Deliverables

**Morning (4 hours):**
1. Create WordPress deployer (`src/server/features/indexing/wordpress/WordPressIndexNowDeployer.ts`)
   - Store key via `wp_options` REST endpoint
   - Requires WordPress Application Password or JWT auth

2. Generate PHP snippet for `functions.php`:
   ```php
   add_action('init', function() {
       $key = get_option('tevero_indexnow_key');
       if ($key && $_SERVER['REQUEST_URI'] === "/{$key}.txt") {
           header('Content-Type: text/plain');
           echo $key;
           exit;
       }
   }, 1);
   ```

**Afternoon (4 hours):**
3. WordPress detection in setup flow:
   ```typescript
   async detectPlatform(domain) {
     // Check for wp-json endpoint
     // Check for wp-content paths
     // Check for WordPress meta tags
     return { platform: "wordpress", version: "6.x" };
   }
   ```

4. Auto-verification after deployment:
   - Deploy key to wp_options
   - Wait 5 seconds
   - Attempt verification
   - If fails, show PHP snippet instructions

### Success Criteria
- [x] WordPress sites detected with >90% accuracy
- [x] Key stored in wp_options via REST API
- [x] Auto-verification passes when endpoint active

### Testing Checkpoint
Test against staging WordPress site (e.g., dev.clientsite.com):
1. Store key via REST API
2. Verify endpoint works
3. Submit test URL to IndexNow

### Rollback Point
If WordPress REST API fails: Fall back to showing manual instructions.

---

## Day 6: Platform Detection and Vibe-Coded Support

### Objectives
- Detect modern platforms (Vercel, Netlify, Cloudflare Pages)
- Provide platform-specific deployment instructions

### Deliverables

**Morning (4 hours):**
1. Platform detection system:
   ```typescript
   interface PlatformInfo {
     platform: "wordpress" | "vercel" | "netlify" | "cloudflare" | "custom" | "unknown";
     canAutoKey: boolean;  // Can we auto-deploy?
     instructions?: string;
   }
   
   async detectPlatform(domain) {
     // Headers analysis: x-vercel-id, x-nf-request-id, cf-ray
     // DNS CNAME analysis
     // Response patterns
   }
   ```

2. Platform-specific instructions:
   - **Vercel**: Add `public/{key}.txt` file, redeploy
   - **Netlify**: Add `static/{key}.txt` or `_redirects` rule
   - **Cloudflare Pages**: Add `public/{key}.txt`
   - **Custom/VPS**: Upload file to web root

**Afternoon (4 hours):**
3. Instruction generator component:
   ```typescript
   function generateInstructions(platform, apiKey) {
     switch (platform) {
       case "vercel":
         return `Create file: public/${apiKey}.txt with content: ${apiKey}`;
       case "netlify":
         return `Create file: static/${apiKey}.txt with content: ${apiKey}`;
       // ...
     }
   }
   ```

4. Dashboard UI for platform-specific setup wizard

### Success Criteria
- [x] Platform detected for 80%+ of sites
- [x] Platform-specific instructions displayed
- [x] TeveroSEO fallback offered when manual setup required

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
   - Step 5: Enable TeveroSEO fallback (optional)

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
   - [ ] TeveroSEO fallback key accessible
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
| TeveroSEO fallback key abuse | Low | High | Per-domain rate limiting for fallback |
| Redis memory exhaustion | Low | High | TTL on all keys, batching limits |
| Platform detection inaccuracy | Medium | Low | Default to "unknown" with generic instructions |
| AI-Writer integration breaks publish | Medium | High | Non-blocking try/except, async fire-and-forget |

---

## Dependencies Graph

```
Day 1 (Schema + Service)
    |
    +---> Day 2 (Queue + Worker)
    |         |
    |         +---> Day 3 (Batching + Scheduler)
    |                   |
    |                   +---> Day 7 (Triggers)
    |
    +---> Day 4 (TeveroSEO Fallback)
    |
    +---> Day 5 (WordPress) ---> Day 6 (Platform Detection)
    |
    +---> Day 6 (Sitemap lastmod) [parallel track]
              |
              +---> Day 8 (Dashboard)
                        |
                        +---> Day 9 (Testing)
```

---

## Parallel Execution Opportunities

**Days 1-3:** Infrastructure foundation (sequential, critical path)

**Days 4-6:** Three parallel tracks possible:
- Track A: TeveroSEO fallback (Day 4) + Triggers (partial Day 7)
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
| Fallback usage | < 30% | Fallback submissions / total |
| Dashboard availability | 99.9% | Uptime monitoring |

---

## Environment Variables Required

```bash
# Encryption (existing)
PAYMENT_ENCRYPTION_KEY=<32-byte-base64>

# Cross-service auth
INTERNAL_API_KEY=<random-string>

# TeveroSEO fallback key
TEVERO_INDEXNOW_KEY=<uuid>

# Optional tuning
INDEXNOW_DEFAULT_DELAY_PUBLISH=30
INDEXNOW_DEFAULT_DELAY_UPDATE=300
INDEXNOW_DEFAULT_DELAY_SEO_FIX=3600
```

---

## Conclusion

This 9-day execution plan delivers a complete IndexNow system with:

1. **Core value:** Free, instant indexing for Bing, Yandex, Naver, Seznam
2. **Graceful degradation:** Client key > TeveroSEO fallback > Manual
3. **Automation:** WordPress auto-deploy, platform-specific instructions
4. **Observability:** Dashboard, history, statistics
5. **Resilience:** Dual endpoints, retry logic, circuit breakers

The critical path runs through Days 1-3 (infrastructure). Days 4-6 can be parallelized with multiple developers. Days 7-9 integrate and validate the complete system.

**Total estimated effort:** 9 developer-days (72 hours)
**Potential parallel speedup:** 6-7 days with 2 developers
