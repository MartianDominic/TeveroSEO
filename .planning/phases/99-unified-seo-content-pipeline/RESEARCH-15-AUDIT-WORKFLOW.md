# Research 15: SEO Audit Workflow

## Overview

This document covers the SEO audit workflow for Phase 99, including scheduled audits, on-demand audits, finding presentation with v6 severity dots, remediation tracking, and the fix-via-content-generation flow.

---

## 1. Audit Types

### 1.1 Scheduled Audits

**Existing Infrastructure** (`open-seo-main/src/db/schedule-schema.ts`):

```typescript
// Report schedules table supports cron-based automation
reportSchedules = pgTable("report_schedules", {
  id: uuid().primaryKey(),
  clientId: uuid().notNull(),
  cronExpression: text().notNull(),  // e.g., "0 6 * * 1" (Mondays 6am)
  timezone: text().notNull(),         // e.g., "Europe/Vilnius"
  reportType: text().notNull(),       // "monthly-seo", "weekly-summary"
  enabled: boolean().default(true),
  lastRun: timestamp(),
  nextRun: timestamp().notNull(),
});
```

**Phase 99 Extension** - Add audit-specific schedule types:

| Schedule Type | Cron Default | Description |
|---------------|--------------|-------------|
| `weekly-audit` | `0 2 * * 1` | Full site crawl every Monday 2am |
| `daily-priority` | `0 3 * * *` | Priority pages only (top 50 by traffic) |
| `post-publish` | Event-driven | Trigger 24h after content publish |

**Scheduler Worker Flow**:
1. `schedule-worker.ts` polls `nextRun <= NOW() AND enabled = true`
2. Enqueues audit job to `auditQueue` (BullMQ)
3. `audit-processor.ts` executes crawl + checks
4. Updates `lastRun`, calculates `nextRun` from cron

### 1.2 On-Demand Audits

**Trigger Points**:
- Manual: User clicks "Run Audit" button
- API: `POST /api/audit/run-checks` with URL list
- Post-publish hook: Content pipeline triggers after article save
- Chat command: "Audit this page" in general SEO chat

**Audit Config** (`open-seo-main/src/server/lib/audit/types.ts`):

```typescript
interface AuditConfig {
  maxPages: number;              // 10-10,000
  lighthouseStrategy: "auto" | "all" | "manual" | "none";
}
```

**On-Demand Flow**:
1. User/system triggers audit with URL(s)
2. Job added to `auditQueue` with priority (on-demand = high)
3. Page fetched via tiered scraping (Direct -> Webshare -> Geonode -> DataForSEO)
4. 109 checks run across Tier 1-4
5. Results stored in `page_findings` table
6. WebSocket notification pushed to UI

---

## 2. Audit Execution

### 2.1 Check Tiers

| Tier | Check Count | Weight | Focus |
|------|-------------|--------|-------|
| T1 | 68 | 20 pts | Technical basics, headings, meta, links |
| T2 | 21 | 10 pts | Content quality, readability, E-E-A-T |
| T3 | 13 | 10 pts | CWV, backlinks, engagement (API-dependent) |
| T4 | 7 | 4 pts | Topic clusters, differentiation |

**Scoring Algorithm** (from `scoring.ts`):
- Base: 60 points
- Variable: 44 points across tiers (weights above)
- Quality gates cap score for critical failures:
  - Missing H1: cap at 70
  - Duplicate content >60%: cap at 50
  - YMYL no author: cap at 60
  - CWV critical: cap at 75

**Known Issue** (SEO-02): Score can exceed 100 - needs normalization fix.

### 2.2 Page Analysis Output

```typescript
interface PageAnalysis {
  url: string;
  statusCode: number;
  title: string;
  metaDescription: string;
  canonical: string | null;
  h1s: string[];
  wordCount: number;
  images: Array<{ src: string | null; alt: string | null }>;
  internalLinks: string[];
  externalLinks: string[];
  hasStructuredData: boolean;
  responseTimeMs: number;
}
```

---

## 3. Finding Presentation (v6 Design System)

### 3.1 Severity Levels

| Severity | Color Token | Dot Count | Description |
|----------|-------------|-----------|-------------|
| Critical | `--error` | 5 dots | Blocks indexing/ranking |
| High | `--warning` | 4 dots | Major SEO impact |
| Medium | `--info` | 3 dots | Moderate impact |
| Low | `--text-3` | 2 dots | Minor optimization |
| Info | `--text-4` | 1 dot | Informational only |

### 3.2 Severity Dots Pattern (v6)

From `design-system-v6.md` Section 14.6:

```html
<div class="severity-dots">
  <span class="dot on"></span>
  <span class="dot on"></span>
  <span class="dot on"></span>
  <span class="dot"></span>
  <span class="dot"></span>
</div>
```

```css
.severity-dots {
  display: inline-flex;
  gap: 3px;
}
.severity-dots .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--surface-3);
}
.severity-dots .dot.on {
  background: var(--error);  /* or --warning, --info per severity */
}
```

**Rule**: Max 5 dots per cell. Beyond 5 issues, switch to numeric badge.

### 3.3 Audit Tiers Card (Dashboard)

```
+--------------------------------------------------+
| Audit Health           Score: 82/100             |
+--------------------------------------------------+
| Tier 1   [68/68]  ●●●●●                          |
| Tier 2   [19/21]  ●●●○○                          |
| Tier 3   [11/13]  ●●○○○                          |
| Tier 4   [5/7]    ●●●○○                          |
+--------------------------------------------------+
| 3 critical · 7 high · 12 medium    [View All ->] |
+--------------------------------------------------+
```

### 3.4 Findings Modal (v6 UI Pattern)

**Modal Structure**:

```
+----------------------------------------------------------+
| Page Audit: /blog/best-running-shoes          [X]        |
+----------------------------------------------------------+
| Score: 78/100   ●●●●○   Last run: 2h ago                 |
+----------------------------------------------------------+
| [Critical] [High] [Medium] [Low] [Passed]                |
+----------------------------------------------------------+
|                                                          |
| CRITICAL (2)                                             |
| +------------------------------------------------------+ |
| | Missing H1 Tag                          [Fix ->]     | |
| | No H1 element found on page. Add a single H1 that    | |
| | matches your target keyword.                         | |
| +------------------------------------------------------+ |
| | Duplicate Title Tag                     [Fix ->]     | |
| | Title matches 3 other pages. Unique titles improve   | |
| | click-through rates.                                 | |
| +------------------------------------------------------+ |
|                                                          |
| HIGH (4)                                                 |
| +------------------------------------------------------+ |
| | Missing Meta Description                [Fix ->]     | |
| | ...                                                  | |
+----------------------------------------------------------+
```

**v6 Modal CSS**:

```css
.findings-modal {
  max-width: 720px;
  border-radius: var(--radius-modal);  /* 14px */
  box-shadow: var(--shadow-lift);
  background: var(--surface);
}

.finding-card {
  padding: var(--space-5);
  border-bottom: 1px solid var(--hairline-2);
  transition: background var(--motion-fast);
}

.finding-card:hover {
  background: var(--surface-2);
}

.finding-card .fix-btn {
  opacity: 0;
  transition: opacity var(--motion-reveal);
}

.finding-card:hover .fix-btn {
  opacity: 1;
}
```

---

## 4. Remediation Tracking

### 4.1 Finding Status Flow

```
OPEN -> IN_PROGRESS -> FIXED -> VERIFIED
                   \-> DISMISSED (with reason)
                   \-> WONT_FIX (accepted risk)
```

### 4.2 Database Schema (Proposed)

```typescript
pageFindings = pgTable("page_findings", {
  id: uuid().primaryKey(),
  pageId: uuid().notNull(),
  auditId: uuid().notNull(),
  checkId: text().notNull(),       // e.g., "T1-08"
  severity: text().notNull(),      // critical, high, medium, low, info
  status: text().default("open"),  // open, in_progress, fixed, verified, dismissed
  
  // Finding details
  title: text().notNull(),
  description: text(),
  recommendation: text(),
  currentValue: text(),            // What we found
  expectedValue: text(),           // What it should be
  
  // Remediation tracking
  assignedTo: uuid(),
  fixedAt: timestamp(),
  fixedBy: uuid(),
  fixMethod: text(),               // manual, auto_content, auto_technical
  verifiedAt: timestamp(),
  
  // Dismissal tracking
  dismissedAt: timestamp(),
  dismissedBy: uuid(),
  dismissReason: text(),
  
  createdAt: timestamp().defaultNow(),
  updatedAt: timestamp().defaultNow(),
});
```

### 4.3 Remediation Timeline

```
+----------------------------------------------------------+
| Remediation History: Missing Meta Description            |
+----------------------------------------------------------+
| [May 11] Finding detected during scheduled audit         |
| [May 11] Auto-assigned to Content Team                   |
| [May 12] Status: In Progress (Marcus L.)                 |
| [May 12] Fix applied via content regeneration            |
| [May 13] Re-audit verified: PASSED                       |
+----------------------------------------------------------+
```

---

## 5. Fix via Content Generation

### 5.1 Auto-Fixable Findings

| Finding | Fix Method | Automation Level |
|---------|------------|------------------|
| Missing meta description | Generate from content | Full auto |
| Thin content (<300 words) | Expand with AI | Semi-auto (review) |
| Missing H1 | Extract from title/content | Full auto |
| Missing alt text | Generate from image context | Semi-auto |
| Low readability | Simplify sentences | Semi-auto |
| Missing schema | Generate JSON-LD | Full auto |
| Keyword stuffing | Rewrite naturally | Semi-auto |

### 5.2 Content Fix Flow

```
Finding Detected
      |
      v
+------------------+
| Is Auto-Fixable? |
+------------------+
      |
  Yes |          No
      v           v
+----------+  +------------------+
| Generate |  | Create Task for  |
| Fix      |  | Manual Review    |
+----------+  +------------------+
      |
      v
+------------------+
| Quality Gate     |
| Score >= 80?     |
+------------------+
      |
  Yes |          No
      v           v
+----------+  +------------------+
| Auto-    |  | Queue for Human  |
| Apply    |  | Review           |
+----------+  +------------------+
      |
      v
+------------------+
| Re-audit Page    |
+------------------+
      |
      v
+------------------+
| Verify Fixed     |
+------------------+
```

### 5.3 Fix Generation Examples

**Missing Meta Description**:

```typescript
async function fixMissingMetaDescription(pageId: string): Promise<FixResult> {
  const page = await getPage(pageId);
  const content = await getPageContent(pageId);
  
  // Generate meta description using Gemini 3.1 Pro
  const metaDescription = await generateMetaDescription({
    title: page.title,
    content: content.bodyText.substring(0, 2000),
    targetKeyword: page.targetKeyword,
    maxLength: 155,
  });
  
  // Validate quality
  const score = await scoreMetaDescription(metaDescription, page.targetKeyword);
  
  if (score < 80) {
    return { status: "needs_review", generated: metaDescription, score };
  }
  
  // Apply fix
  await updatePageMeta(pageId, { metaDescription });
  
  // Trigger re-audit
  await queuePageAudit(pageId, { priority: "high" });
  
  return { status: "applied", generated: metaDescription, score };
}
```

**Thin Content Expansion**:

```typescript
async function fixThinContent(pageId: string): Promise<FixResult> {
  const page = await getPage(pageId);
  const currentWordCount = page.wordCount;
  const targetWordCount = Math.max(800, currentWordCount * 2);
  
  // Get client voice profile
  const voice = await getClientVoice(page.clientId);
  
  // Generate expanded content
  const expandedContent = await expandContent({
    currentContent: page.content,
    targetWordCount,
    voice,
    preserveSections: true,
    addSections: ["FAQ", "Key Takeaways"],
  });
  
  // Quality gate
  const auditResult = await prePublishAudit(expandedContent);
  
  if (auditResult.score < 80) {
    return { 
      status: "needs_review", 
      generated: expandedContent,
      auditScore: auditResult.score,
      issues: auditResult.findings,
    };
  }
  
  return { status: "ready_to_apply", generated: expandedContent };
}
```

### 5.4 Bulk Fix Operations

```
+----------------------------------------------------------+
| Bulk Fix: 12 pages with missing meta descriptions        |
+----------------------------------------------------------+
| [x] /blog/post-1     Generated: "Learn how to..."        |
| [x] /blog/post-2     Generated: "Discover the..."        |
| [ ] /blog/post-3     SKIPPED: Has partial description    |
| [x] /blog/post-4     Generated: "Complete guide..."      |
+----------------------------------------------------------+
| Preview Score: 87/100 average                            |
+----------------------------------------------------------+
| [Cancel]                    [Apply All (9)] [Review (3)] |
+----------------------------------------------------------+
```

---

## 6. Integration Points

### 6.1 With General SEO Chat (Phase 98)

Chat commands trigger audit workflows:

| Command | Action |
|---------|--------|
| "Audit this page" | On-demand single-page audit |
| "What's wrong with /blog/x" | Show findings for URL |
| "Fix the meta description" | Generate + apply fix |
| "Show critical issues" | Filter dashboard to critical |
| "Schedule weekly audits" | Configure audit schedule |

### 6.2 With Content Pipeline

```
Content Created
      |
      v
Pre-Publish Audit (Tier 1-2 checks)
      |
  Score >= 80?
      |
  Yes |          No
      v           v
Auto-Publish    Block + Show Findings
      |
      v
Post-Publish Audit (24h later, full Tier 1-4)
      |
      v
Track Regressions
```

### 6.3 With Client Portal

- Read-only audit results for clients
- Severity dots on client dashboard
- Downloadable PDF reports
- Trend charts (score over time)

---

## 7. Known Issues (from Agent 11 Review)

| ID | Severity | Issue | Impact |
|----|----------|-------|--------|
| SEO-02 | HIGH | Score can exceed 100 (no normalization) | Confuses quality gate |
| SEO-05 | HIGH | Tier 3/4 stubs return `passed: true` | Inflates scores |
| SEO-12 | MEDIUM | `extractText()` mutates shared Cheerio DOM | Breaks subsequent checks |
| SEO-17 | HIGH | Quality gate (score >= 80) not enforced | Auto-publish bypassed |

**Required Fixes Before Phase 99**:
1. Normalize score to max 100
2. Skipped checks return `passed: false` or exclude from scoring
3. Clone Cheerio DOM before mutation
4. Implement quality gate enforcement in content pipeline

---

## 8. Implementation Checklist

### Database
- [ ] Add `audit_schedules` table (extend `report_schedules`)
- [ ] Add `page_findings` table with status tracking
- [ ] Add `finding_history` table for timeline
- [ ] Migrate existing audit results

### Backend
- [ ] Create `AuditScheduleService` with cron support
- [ ] Add `FindingService` for remediation tracking
- [ ] Implement `ContentFixService` for auto-fixes
- [ ] Add WebSocket notifications for audit completion
- [ ] Integrate with content pipeline quality gate

### Frontend
- [ ] Build `FindingsModal` with v6 severity dots
- [ ] Build `AuditTiersCard` for dashboard
- [ ] Build `RemediationTimeline` component
- [ ] Build `BulkFixPanel` for batch operations
- [ ] Add audit schedule configuration UI

### Chat Integration
- [ ] Add audit intents to chat router
- [ ] Implement "audit this page" command
- [ ] Implement "fix X" commands
- [ ] Show inline findings in chat responses

---

## 9. References

- Design System: `.planning/design/design-system-v6.md` (Section 14.6 severity dots)
- Agent 11 Review: `/AGENT_11_SEO_AUDIT_REVIEW.md`
- Audit Types: `open-seo-main/src/server/lib/audit/types.ts`
- Schedule Schema: `open-seo-main/src/db/schedule-schema.ts`
- Audit Workers: `open-seo-main/src/server/workers/audit-*.ts`
- Check Implementations: `open-seo-main/src/server/lib/audit/checks/`
