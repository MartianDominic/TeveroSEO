# Research 20: Dead Link Detection & Replacement System

> **Status:** Research Complete  
> **Created:** 2026-05-11  
> **Agent:** 20 of 20 (Stream E: Internal Linking)  
> **Scope:** Internal dead link scanning, external link monitoring, link health tracking, replacement workflows, autopilot vs human-in-the-loop decision framework

---

## Executive Summary

Dead links (404s, timeouts, redirects to irrelevant pages) damage SEO through:
1. **Crawl budget waste** - Googlebot wastes crawls on dead endpoints
2. **Link equity loss** - PageRank flows into void instead of target pages
3. **User experience degradation** - Broken journeys increase bounce rate
4. **Trust signals** - Sites with dead links appear unmaintained

This system provides continuous monitoring, intelligent replacement suggestions, and a clear autopilot vs human-in-the-loop decision framework.

---

## 1. Link Types & Detection Strategies

### 1.1 Internal Dead Links

Links within the same domain that return non-200 status codes.

| Status | Classification | Action |
|--------|---------------|--------|
| 404 Not Found | Dead | Replace or remove |
| 410 Gone | Permanently dead | Remove |
| 301/302 Redirect | Degraded | Update to final URL |
| 500+ Server Error | Transient | Retry 3x over 24h, then flag |
| Timeout | Transient | Retry 3x, then flag |

**Detection Method:** Full site crawl (already implemented in audit system)

### 1.2 External Dead Links (Outbound)

Links to third-party domains that have died, changed, or become irrelevant.

| Status | Classification | Risk Level |
|--------|---------------|------------|
| 404/410 | Dead | High - remove or replace |
| 301 to unrelated | Hijacked | Critical - replace immediately |
| Domain parked | Dead | High - replace |
| Soft 404 (200 but error page) | Dead | Medium - manual review |
| SSL expired | Security risk | Medium - replace or remove |
| Paywall added | Degraded | Low - consider replacing |

**Detection Method:** HEAD requests with fallback to GET, scheduled monitoring

---

## 2. Database Schema

### 2.1 Link Health Tracking

```typescript
// link-health-schema.ts
import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

/**
 * All outbound links (internal + external) with health status.
 * Updated on each audit + scheduled external checks.
 */
export const linkHealth = pgTable("link_health", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull(),
  
  // Source page
  sourceUrl: text("source_url").notNull(),
  sourcePageId: text("source_page_id"),
  
  // Target link
  targetUrl: text("target_url").notNull(),
  targetDomain: text("target_domain").notNull(),
  isInternal: boolean("is_internal").notNull(),
  
  // Link context
  anchorText: text("anchor_text"),
  position: text("position"), // 'body' | 'sidebar' | 'footer' | 'nav'
  paragraphIndex: integer("paragraph_index"),
  surroundingContext: text("surrounding_context"), // ~100 chars
  
  // Health status
  status: text("status").notNull().default("unknown"),
  // Statuses: 'healthy' | 'dead' | 'redirect' | 'timeout' | 'error' | 'unknown'
  httpStatus: integer("http_status"),
  redirectUrl: text("redirect_url"), // Final URL after redirects
  redirectChain: jsonb("redirect_chain").$type<string[]>(),
  
  // For soft 404 detection
  isSoft404: boolean("is_soft_404").default(false),
  pageTitle: text("page_title"),
  
  // Timing
  responseTimeMs: integer("response_time_ms"),
  
  // Check history
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  firstDeadAt: timestamp("first_dead_at", { withTimezone: true }),
  consecutiveFailures: integer("consecutive_failures").default(0),
  
  // Replacement
  replacementStatus: text("replacement_status").default("none"),
  // Statuses: 'none' | 'suggested' | 'approved' | 'applied' | 'rejected'
  replacementUrl: text("replacement_url"),
  replacementSuggestedAt: timestamp("replacement_suggested_at", { withTimezone: true }),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  
}, (table) => [
  index("ix_link_health_client").on(table.clientId),
  index("ix_link_health_source").on(table.sourceUrl),
  index("ix_link_health_target").on(table.targetUrl),
  index("ix_link_health_status").on(table.status),
  index("ix_link_health_internal").on(table.isInternal),
  index("ix_link_health_replacement").on(table.replacementStatus),
]);

/**
 * Suggested replacements for dead links.
 * Multiple suggestions per dead link, ranked by relevance.
 */
export const linkReplacements = pgTable("link_replacements", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull(),
  linkHealthId: text("link_health_id").notNull(), // FK to link_health
  
  // The dead link
  deadUrl: text("dead_url").notNull(),
  sourceUrl: text("source_url").notNull(),
  originalAnchorText: text("original_anchor_text"),
  
  // Suggested replacement
  replacementUrl: text("replacement_url").notNull(),
  replacementType: text("replacement_type").notNull(),
  // Types: 'archive' | 'internal' | 'alternative' | 'remove'
  
  // For 'archive' type
  archiveUrl: text("archive_url"), // web.archive.org URL
  archiveDate: timestamp("archive_date", { withTimezone: true }),
  
  // For 'internal' type
  internalPageId: text("internal_page_id"),
  
  // For 'alternative' type
  alternativeSource: text("alternative_source"), // How we found it
  
  // Scoring
  relevanceScore: number("relevance_score").notNull(), // 0-1
  confidenceScore: number("confidence_score").notNull(), // 0-1
  
  // Suggested anchor text (may differ from original)
  suggestedAnchorText: text("suggested_anchor_text"),
  anchorTextChange: text("anchor_text_change"), // 'keep' | 'update' | 'remove'
  
  // Auto-apply eligibility
  isAutoApplicable: boolean("is_auto_applicable").default(false),
  autoApplyReason: text("auto_apply_reason"),
  manualReviewReason: text("manual_review_reason"),
  
  // Status
  status: text("status").notNull().default("pending"),
  // Statuses: 'pending' | 'approved' | 'rejected' | 'applied' | 'failed'
  
  appliedAt: timestamp("applied_at", { withTimezone: true }),
  appliedChangeId: text("applied_change_id"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  
}, (table) => [
  index("ix_link_replacements_client").on(table.clientId),
  index("ix_link_replacements_health").on(table.linkHealthId),
  index("ix_link_replacements_status").on(table.status),
  index("ix_link_replacements_auto").on(table.isAutoApplicable),
]);

/**
 * External link monitoring schedule.
 * Tracks which external domains to check and how often.
 */
export const externalLinkMonitor = pgTable("external_link_monitor", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull(),
  
  domain: text("domain").notNull(),
  linkCount: integer("link_count").notNull(), // How many links to this domain
  
  // Check schedule
  checkFrequency: text("check_frequency").notNull(), // 'daily' | 'weekly' | 'monthly'
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  nextCheckAt: timestamp("next_check_at", { withTimezone: true }),
  
  // Domain health
  healthyLinks: integer("healthy_links").default(0),
  deadLinks: integer("dead_links").default(0),
  domainStatus: text("domain_status").default("healthy"),
  // Statuses: 'healthy' | 'degraded' | 'dead' | 'unknown'
  
  // Priority (high-authority domains checked more often)
  priority: text("priority").default("normal"), // 'high' | 'normal' | 'low'
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  
}, (table) => [
  index("ix_external_monitor_client").on(table.clientId),
  index("ix_external_monitor_domain").on(table.domain),
  index("ix_external_monitor_next_check").on(table.nextCheckAt),
]);
```

---

## 3. Detection Algorithms

### 3.1 Internal Dead Link Detection (During Audit)

```typescript
/**
 * Extract and verify internal links during site audit.
 * Runs as part of the existing crawl pipeline.
 */
async function checkInternalLinks(
  auditId: string,
  clientId: string,
  crawledPages: CrawledPage[]
): Promise<LinkHealthResult[]> {
  const results: LinkHealthResult[] = [];
  const urlStatusCache = new Map<string, number>();
  
  // Build set of all crawled URLs
  const crawledUrls = new Set(crawledPages.map(p => normalizeUrl(p.url)));
  
  for (const page of crawledPages) {
    for (const link of page.internalLinks) {
      const targetUrl = normalizeUrl(link.href);
      
      // Check if target was crawled
      if (crawledUrls.has(targetUrl)) {
        // Link is healthy (page exists in crawl)
        results.push({
          sourceUrl: page.url,
          targetUrl,
          isInternal: true,
          status: 'healthy',
          httpStatus: 200,
          anchorText: link.text,
          position: link.position,
        });
      } else {
        // Target not in crawl - could be dead or excluded
        // Verify with HEAD request
        const status = urlStatusCache.get(targetUrl) 
          ?? await checkUrlStatus(targetUrl);
        urlStatusCache.set(targetUrl, status);
        
        results.push({
          sourceUrl: page.url,
          targetUrl,
          isInternal: true,
          status: status === 200 ? 'healthy' : status === 404 ? 'dead' : 'redirect',
          httpStatus: status,
          anchorText: link.text,
          position: link.position,
        });
      }
    }
  }
  
  return results;
}
```

### 3.2 External Dead Link Detection (Scheduled)

```typescript
/**
 * Check external links on a schedule.
 * Batched by domain to avoid hammering single servers.
 */
async function checkExternalLinks(
  clientId: string,
  batchSize: number = 100
): Promise<void> {
  // Get domains due for checking
  const domainsToCheck = await db.select()
    .from(externalLinkMonitor)
    .where(and(
      eq(externalLinkMonitor.clientId, clientId),
      lte(externalLinkMonitor.nextCheckAt, new Date())
    ))
    .orderBy(externalLinkMonitor.priority)
    .limit(10);
  
  for (const domain of domainsToCheck) {
    // Get all links to this domain
    const links = await db.select()
      .from(linkHealth)
      .where(and(
        eq(linkHealth.clientId, clientId),
        eq(linkHealth.targetDomain, domain.domain),
        eq(linkHealth.isInternal, false)
      ))
      .limit(batchSize);
    
    // Rate limit: 1 request per 500ms to same domain
    for (const link of links) {
      const result = await checkUrlStatusWithRetry(link.targetUrl);
      
      await db.update(linkHealth)
        .set({
          status: result.status,
          httpStatus: result.httpStatus,
          redirectUrl: result.redirectUrl,
          isSoft404: result.isSoft404,
          responseTimeMs: result.responseTimeMs,
          lastCheckedAt: new Date(),
          consecutiveFailures: result.status === 'healthy' 
            ? 0 
            : link.consecutiveFailures + 1,
          firstDeadAt: result.status !== 'healthy' && !link.firstDeadAt
            ? new Date()
            : link.firstDeadAt,
        })
        .where(eq(linkHealth.id, link.id));
      
      await sleep(500); // Rate limit
    }
    
    // Update domain monitor
    await updateDomainHealth(domain.id);
  }
}

/**
 * Check URL status with retry logic.
 */
async function checkUrlStatusWithRetry(
  url: string,
  retries: number = 2
): Promise<LinkCheckResult> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const start = Date.now();
      
      // Try HEAD first (cheaper)
      let response = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: AbortSignal.timeout(10000),
        headers: {
          'User-Agent': 'TeveroSEO Link Checker/1.0',
        },
      });
      
      // Some servers don't support HEAD, fall back to GET
      if (response.status === 405) {
        response = await fetch(url, {
          method: 'GET',
          redirect: 'follow',
          signal: AbortSignal.timeout(15000),
          headers: {
            'User-Agent': 'TeveroSEO Link Checker/1.0',
          },
        });
      }
      
      const responseTimeMs = Date.now() - start;
      
      // Check for soft 404
      let isSoft404 = false;
      if (response.status === 200) {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('text/html')) {
          const html = await response.text();
          isSoft404 = detectSoft404(html);
        }
      }
      
      return {
        status: response.status === 200 && !isSoft404 ? 'healthy' : 
                response.status === 404 || response.status === 410 ? 'dead' :
                response.status >= 300 && response.status < 400 ? 'redirect' :
                response.status >= 500 ? 'error' : 'dead',
        httpStatus: response.status,
        redirectUrl: response.redirected ? response.url : null,
        isSoft404,
        responseTimeMs,
      };
    } catch (error) {
      if (attempt === retries) {
        return {
          status: 'timeout',
          httpStatus: null,
          redirectUrl: null,
          isSoft404: false,
          responseTimeMs: null,
        };
      }
      await sleep(1000 * (attempt + 1)); // Exponential backoff
    }
  }
}

/**
 * Detect soft 404 pages (200 status but error content).
 */
function detectSoft404(html: string): boolean {
  const lowerHtml = html.toLowerCase();
  
  // Common soft 404 patterns
  const patterns = [
    'page not found',
    'page doesn\'t exist',
    'page does not exist',
    'no longer available',
    'has been removed',
    'has been deleted',
    'content not found',
    '404 error',
    'oops! we couldn\'t find',
    'sorry, this page',
    'the page you requested',
    'this page has moved',
  ];
  
  return patterns.some(pattern => lowerHtml.includes(pattern));
}
```

---

## 4. Replacement Suggestion System

### 4.1 Replacement Sources (Priority Order)

1. **Internal Pages** - Best option, keeps link equity on-site
2. **Wayback Machine Archive** - Preserves original reference
3. **Alternative External Source** - Equivalent resource
4. **Remove Link** - Last resort, preserves UX

### 4.2 Replacement Generation

```typescript
/**
 * Generate replacement suggestions for a dead link.
 */
async function generateReplacementSuggestions(
  deadLink: LinkHealth,
  clientId: string
): Promise<LinkReplacement[]> {
  const suggestions: LinkReplacement[] = [];
  
  // 1. Try to find internal replacement
  const internalMatch = await findInternalReplacement(deadLink, clientId);
  if (internalMatch) {
    suggestions.push({
      ...internalMatch,
      replacementType: 'internal',
      isAutoApplicable: internalMatch.confidenceScore >= 0.85,
      autoApplyReason: internalMatch.confidenceScore >= 0.85 
        ? 'High-confidence internal match' 
        : null,
    });
  }
  
  // 2. Check Wayback Machine
  const archiveMatch = await findArchiveVersion(deadLink.targetUrl);
  if (archiveMatch) {
    suggestions.push({
      replacementUrl: archiveMatch.archiveUrl,
      replacementType: 'archive',
      archiveUrl: archiveMatch.archiveUrl,
      archiveDate: archiveMatch.date,
      relevanceScore: 0.9, // Archives are highly relevant (same content)
      confidenceScore: 0.7, // But may be outdated
      isAutoApplicable: false, // Always manual review for archives
      manualReviewReason: 'Archive content may be outdated',
    });
  }
  
  // 3. Search for alternative external sources
  // (Uses keyword extraction from anchor text + context)
  const alternativeMatch = await findAlternativeSource(deadLink);
  if (alternativeMatch) {
    suggestions.push({
      ...alternativeMatch,
      replacementType: 'alternative',
      isAutoApplicable: false, // Always manual review for external
      manualReviewReason: 'External replacement requires editorial review',
    });
  }
  
  // 4. Always offer "remove link" option
  suggestions.push({
    replacementUrl: '',
    replacementType: 'remove',
    relevanceScore: 0,
    confidenceScore: 1.0,
    anchorTextChange: 'remove',
    isAutoApplicable: false,
    manualReviewReason: 'Removal requires editorial decision',
  });
  
  return suggestions;
}

/**
 * Find internal page that could replace dead external link.
 */
async function findInternalReplacement(
  deadLink: LinkHealth,
  clientId: string
): Promise<InternalReplacementMatch | null> {
  // Extract keywords from anchor text and context
  const keywords = extractKeywords(
    `${deadLink.anchorText} ${deadLink.surroundingContext}`
  );
  
  if (keywords.length === 0) return null;
  
  // Search internal pages for keyword matches
  const candidates = await db.select()
    .from(auditPages)
    .innerJoin(pageLinks, eq(pageLinks.pageId, auditPages.id))
    .where(eq(auditPages.clientId, clientId))
    .limit(100);
  
  // Score candidates by keyword relevance
  const scored = candidates.map(candidate => {
    const pageKeywords = extractKeywords(
      `${candidate.audit_pages.title} ${candidate.audit_pages.metaDescription}`
    );
    
    const overlap = computeKeywordOverlap(
      new Set(keywords),
      new Set(pageKeywords)
    );
    
    return {
      pageId: candidate.audit_pages.id,
      url: candidate.audit_pages.url,
      title: candidate.audit_pages.title,
      relevanceScore: overlap,
      confidenceScore: overlap > 0.5 ? 0.85 : overlap > 0.3 ? 0.7 : 0.5,
    };
  });
  
  // Return best match if above threshold
  const best = scored.sort((a, b) => b.relevanceScore - a.relevanceScore)[0];
  
  if (best && best.relevanceScore >= 0.3) {
    return {
      replacementUrl: best.url,
      internalPageId: best.pageId,
      relevanceScore: best.relevanceScore,
      confidenceScore: best.confidenceScore,
      suggestedAnchorText: deadLink.anchorText, // Keep original
      anchorTextChange: 'keep',
    };
  }
  
  return null;
}

/**
 * Check Wayback Machine for archived version.
 */
async function findArchiveVersion(url: string): Promise<ArchiveMatch | null> {
  try {
    const response = await fetch(
      `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`
    );
    const data = await response.json();
    
    if (data.archived_snapshots?.closest) {
      return {
        archiveUrl: data.archived_snapshots.closest.url,
        date: new Date(data.archived_snapshots.closest.timestamp),
      };
    }
    
    return null;
  } catch {
    return null;
  }
}
```

---

## 5. AUTOPILOT vs HUMAN-IN-THE-LOOP Decision Framework

### 5.1 Critical Question Answer

**Should replacements be auto-applied or require human confirmation?**

**Answer: Hybrid approach with clear rules.**

| Scenario | Decision | Rationale |
|----------|----------|-----------|
| Internal redirect (301/302) | AUTOPILOT | Safe, just updating to final URL |
| Internal 404 with high-confidence internal match | AUTOPILOT | Same-site, high relevance |
| External redirect to related content | HUMAN | May have changed meaning |
| External 404 with internal replacement | HUMAN | Editorial decision |
| External 404 with archive replacement | HUMAN | Content may be outdated |
| External 404 with alternative source | HUMAN | Requires vetting new source |
| Any link removal | HUMAN | Content strategy decision |
| Cannibalized keyword target | HUMAN | SEO strategy decision |

### 5.2 Auto-Apply Eligibility Rules

```typescript
interface AutoApplyRules {
  // AUTOPILOT conditions (ALL must be true)
  autopilot: {
    // Link type
    isInternalLink: true;
    replacementType: 'internal' | 'redirect_update';
    
    // Confidence
    confidenceScore: number; // >= 0.85
    relevanceScore: number;  // >= 0.7
    
    // Context preservation
    anchorTextChange: 'keep' | 'minor_update';
    
    // No conflicts
    targetNotInCannibalization: true;
    sourceNotRecentlyEdited: true; // > 7 days
    
    // Settings
    clientAutoFixEnabled: true;
  };
  
  // HUMAN-IN-THE-LOOP triggers (ANY triggers manual review)
  humanReview: [
    'isExternalLink',
    'replacementType === "archive"',
    'replacementType === "alternative"',
    'replacementType === "remove"',
    'confidenceScore < 0.85',
    'anchorTextChange === "significant"',
    'targetInCannibalizationSet',
    'clientAutoFixDisabled',
  ];
}

function determineApplyMode(
  replacement: LinkReplacement,
  settings: ClientSettings
): 'autopilot' | 'human' {
  // External links always need human review
  if (!replacement.isInternal) return 'human';
  
  // Removals always need human review
  if (replacement.replacementType === 'remove') return 'human';
  
  // Archives always need human review (may be outdated)
  if (replacement.replacementType === 'archive') return 'human';
  
  // Low confidence needs human review
  if (replacement.confidenceScore < 0.85) return 'human';
  if (replacement.relevanceScore < 0.7) return 'human';
  
  // Significant anchor text changes need review
  if (replacement.anchorTextChange === 'significant') return 'human';
  
  // Check client settings
  if (!settings.autoDeadLinkFix) return 'human';
  
  // Internal redirect updates are safe
  if (replacement.replacementType === 'redirect_update') return 'autopilot';
  
  // High-confidence internal replacement is safe
  if (
    replacement.replacementType === 'internal' &&
    replacement.confidenceScore >= 0.85 &&
    replacement.relevanceScore >= 0.7
  ) {
    return 'autopilot';
  }
  
  return 'human';
}
```

### 5.3 Escalation Paths

```
AUTOPILOT PATH:
  Dead link detected
       |
       v
  Generate replacement suggestions
       |
       v
  Check auto-apply eligibility
       |
       v
  [Eligible] --> Apply immediately --> Log in site_changes --> Done
       |
  [Not eligible] --> Queue for human review
       

HUMAN-IN-THE-LOOP PATH:
  Dead link detected
       |
       v
  Generate replacement suggestions (multiple options)
       |
       v
  Add to review queue
       |
       v
  User reviews in Link Health dashboard
       |
       v
  [Approve] --> Apply change --> Log --> Done
       |
  [Reject] --> Mark as ignored --> Done
       |
  [Custom] --> User provides URL --> Apply --> Done
```

---

## 6. v6-Compliant Review Table Design

### 6.1 Link Health Review Table

Following design-system-v6.md principles:
- Ghost-edge shadows on cards (no borders)
- Hover-to-reveal secondary actions
- Status pills with semantic colors
- One editorial moment (dead link count)

```html
<!-- Link Health Review Table -->
<section class="card link-health-card">
  <div class="card-head">
    <svg class="ic"><!-- link-broken icon --></svg>
    <span class="title">Dead Links</span>
    <span class="meta">
      <span class="sep">·</span>
      <span class="t-mono">12 requiring action</span>
    </span>
    <div class="grow"></div>
    <a class="action" href="#">
      Run scan
      <svg class="arrow"><!-- → --></svg>
    </a>
  </div>
  
  <!-- Review Table -->
  <div class="link-review-table">
    <div class="link-review-head">
      <span class="col-status">Status</span>
      <span class="col-source">Source Page</span>
      <span class="col-dead">Dead Link</span>
      <span class="col-replacement">Suggested Replacement</span>
      <span class="col-confidence">Confidence</span>
      <span class="col-actions">Actions</span>
    </div>
    
    <!-- Row: External 404 - needs human review -->
    <div class="link-review-row" data-status="dead">
      <div class="col-status">
        <span class="status-pill error">DEAD</span>
      </div>
      <div class="col-source">
        <a href="/blog/sauna-guide" class="t-mono">/blog/sauna-guide</a>
      </div>
      <div class="col-dead">
        <span class="dead-url t-mono">example.com/old-resource</span>
        <span class="dead-anchor t-small">"best practices guide"</span>
      </div>
      <div class="col-replacement">
        <div class="replacement-options">
          <label class="replacement-option selected">
            <input type="radio" name="replace-1" checked>
            <span class="option-type">Internal</span>
            <span class="option-url t-mono">/resources/guide</span>
          </label>
          <label class="replacement-option">
            <input type="radio" name="replace-1">
            <span class="option-type">Archive</span>
            <span class="option-url t-mono">web.archive.org/...</span>
          </label>
          <label class="replacement-option">
            <input type="radio" name="replace-1">
            <span class="option-type">Remove</span>
          </label>
        </div>
      </div>
      <div class="col-confidence">
        <span class="confidence-badge high">92%</span>
      </div>
      <div class="col-actions">
        <button class="btn-approve">Apply</button>
        <button class="btn-reject ghost">Ignore</button>
      </div>
    </div>
    
    <!-- Row: Internal redirect - auto-applicable -->
    <div class="link-review-row" data-status="redirect" data-auto="true">
      <div class="col-status">
        <span class="status-pill warning">REDIRECT</span>
        <span class="auto-badge">AUTO</span>
      </div>
      <div class="col-source">
        <a href="/products/heaters" class="t-mono">/products/heaters</a>
      </div>
      <div class="col-dead">
        <span class="dead-url t-mono">/old-heater-page</span>
        <span class="redirect-arrow">→</span>
        <span class="redirect-target t-mono">/products/electric-heaters</span>
      </div>
      <div class="col-replacement">
        <span class="auto-replacement">
          Update to final URL
        </span>
      </div>
      <div class="col-confidence">
        <span class="confidence-badge high">100%</span>
      </div>
      <div class="col-actions">
        <span class="auto-applied t-small">Auto-applied</span>
      </div>
    </div>
  </div>
  
  <div class="card-foot">
    <span>Last scan: <span class="t-mono">2h ago</span></span>
    <div class="grow"></div>
    <button class="btn-primary">
      Apply 8 Safe Changes
      <kbd>A</kbd>
    </button>
  </div>
</section>
```

### 6.2 CSS Tokens (v6 Compliant)

```css
/* Link Health Review Table */
.link-review-table {
  display: flex;
  flex-direction: column;
}

.link-review-head,
.link-review-row {
  display: grid;
  grid-template-columns: 100px minmax(140px, 1.2fr) minmax(180px, 1.5fr) minmax(200px, 2fr) 80px 140px;
  gap: 14px;
  padding: 14px 28px;
}

.link-review-head {
  font-size: var(--type-small);
  color: var(--text-3);
  font-weight: 500;
  letter-spacing: 0.04em;
  font-variant-caps: all-small-caps;
  border-bottom: 1px solid var(--hairline-2);
}

.link-review-row {
  border-top: 1px solid var(--hairline-3);
  transition: background var(--motion-fast);
}

.link-review-row:hover {
  background: var(--surface-2);
}

/* Status indicators */
.status-pill.error {
  background: var(--error-soft);
  color: var(--error);
}

.status-pill.warning {
  background: var(--warning-soft);
  color: var(--warning);
}

.auto-badge {
  font-size: 10px;
  padding: 2px 5px;
  background: var(--accent-soft);
  color: var(--accent);
  border-radius: 3px;
  font-weight: 600;
  letter-spacing: 0.06em;
  margin-left: 6px;
}

/* Confidence badges */
.confidence-badge {
  font-family: var(--font-display);
  font-size: var(--num-tiny);
  font-variant-numeric: tabular-nums lining-nums;
}

.confidence-badge.high {
  color: var(--success);
}

.confidence-badge.medium {
  color: var(--warning);
}

.confidence-badge.low {
  color: var(--error);
}

/* Replacement options */
.replacement-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.replacement-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: var(--radius-input);
  cursor: pointer;
  transition: background var(--motion-fast);
}

.replacement-option:hover {
  background: var(--surface-2);
}

.replacement-option.selected {
  background: var(--accent-soft);
}

.replacement-option input[type="radio"] {
  accent-color: var(--accent);
}
```

---

## 7. Monitoring Schedule

### 7.1 Check Frequency by Link Type

| Link Type | Frequency | Rationale |
|-----------|-----------|-----------|
| Internal links | Every audit (weekly) | Caught during crawl |
| High-authority external | Weekly | Important references |
| Normal external | Monthly | Balance coverage vs cost |
| Low-priority external | Quarterly | Footer/sidebar links |

### 7.2 Priority Scoring for External Domains

```typescript
function calculateDomainPriority(
  domain: string,
  linkCount: number,
  positions: string[]
): 'high' | 'normal' | 'low' {
  // High priority: many links or body/first-paragraph placement
  if (linkCount >= 10) return 'high';
  if (positions.some(p => p === 'body' || p === 'first-paragraph')) return 'high';
  
  // Low priority: footer/sidebar only
  if (positions.every(p => p === 'footer' || p === 'sidebar')) return 'low';
  
  return 'normal';
}
```

---

## 8. Integration Points

### 8.1 With Existing Audit System

```
Site Audit Pipeline
       |
       v
+------------------+
| Crawl Phase      |  <-- Already extracts internal/external links
+------------------+
       |
       v
+------------------+
| Link Health      |  <-- NEW: Check status of all links
| Check            |
+------------------+
       |
       v
+------------------+
| Dead Link        |  <-- NEW: Generate replacement suggestions
| Analysis         |
+------------------+
       |
       v
+------------------+
| Audit Findings   |  <-- Dead links appear as findings
+------------------+
```

### 8.2 With Internal Linking System

The dead link system feeds into the internal linking system:

1. When external link dies, check if internal replacement exists
2. Internal replacement suggestions go through internal linking validation
3. Orphan pages may be suggested as replacements (dual benefit)

### 8.3 With Site Changes System

All link replacements create `site_changes` records:

```typescript
{
  changeType: 'link_replacement',
  category: 'links',
  field: 'content',
  beforeValue: '<a href="dead-url">anchor</a>',
  afterValue: '<a href="replacement-url">anchor</a>',
  triggeredBy: 'audit' | 'manual',
  metadata: {
    deadUrl: '...',
    replacementType: 'internal' | 'archive' | 'alternative' | 'remove',
    confidenceScore: 0.92,
  }
}
```

---

## 9. Cost Analysis

### 9.1 Token Usage

| Operation | AI Requirement | Token Cost |
|-----------|---------------|------------|
| Internal link detection | None | 0 |
| External link checking | None | 0 |
| Soft 404 detection | None (pattern matching) | 0 |
| Internal replacement matching | None (keyword overlap) | 0 |
| Wayback Machine lookup | None (API call) | 0 |
| Alternative source finding | Optional (web search) | ~500/search |
| Replacement summarization | Optional | ~100/summary |

**Core system: 0 tokens**
**Optional AI enhancement: ~600 tokens per dead link with alternative search**

### 9.2 API Costs

| Service | Cost | Usage |
|---------|------|-------|
| Wayback Machine API | Free | Unlimited |
| HEAD requests | Bandwidth only | ~1KB per check |
| DataForSEO (if needed) | Per-request | Only for competitive analysis |

---

## 10. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Dead links detected | 100% | Audit coverage |
| Time to detect | < 7 days | From link death to detection |
| Auto-apply accuracy | > 99% | No incorrect auto-fixes |
| Human review queue | < 50 items | Manageable backlog |
| Replacement acceptance rate | > 85% | User accepts suggestions |
| Mean time to fix | < 14 days | From detection to resolution |
| External link health | > 95% | Healthy external links |

---

## 11. Implementation Priority

### Phase 1: Detection (Week 1)
- Schema creation
- Internal dead link detection during audit
- External link extraction

### Phase 2: External Monitoring (Week 2)
- Scheduled external link checks
- Domain health tracking
- Soft 404 detection

### Phase 3: Replacement Suggestions (Week 3)
- Internal replacement matching
- Wayback Machine integration
- Suggestion ranking

### Phase 4: Auto-Apply System (Week 4)
- Eligibility rules engine
- Integration with site_changes
- Revert capability

### Phase 5: Review UI (Week 5)
- v6-compliant review table
- Batch actions
- Keyboard shortcuts

### Phase 6: Monitoring & Alerts (Week 6)
- Domain health degradation alerts
- Weekly dead link digest
- GSC integration for 404 detection

---

*Research complete: 2026-05-11*
