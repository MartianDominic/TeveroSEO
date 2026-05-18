# Research 18: Existing Page Internal Link Optimization

> **Status:** Research Complete  
> **Agent:** 18 of 20  
> **Focus:** Crawl analysis, opportunity detection, anchor text recommendations, bulk optimization workflows, autopilot vs HITL decision points

---

## Executive Summary

Existing page internal link optimization requires a systematic approach: crawl the site to map current links, detect optimization opportunities (orphan pages, low-link pages, poor anchor text), generate recommendations, and execute bulk optimizations. The key architectural decision is determining which operations run on autopilot vs require human review.

**Key Finding:** TeveroSEO already has a robust schema foundation (`link-schema.ts`) with `linkGraph`, `pageLinks`, `orphanPages`, `linkOpportunities`, and `linkSuggestions` tables. This research focuses on the workflow layer that orchestrates these components.

---

## 1. Crawl Analysis to Map Current Links

### 1.1 Data Sources

| Source | Purpose | Frequency |
|--------|---------|-----------|
| **Site Crawl** | Extract all `<a>` tags with href, anchor text, position | Per audit |
| **GSC Integration** | Identify indexed pages, search traffic data | Daily sync |
| **Sitemap Parse** | Discover pages that may be orphaned | Per audit |
| **CMS API** (if available) | Get page metadata, publication dates | On-demand |

### 1.2 Link Extraction Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                      CRAWL ANALYSIS PIPELINE                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐                │
│  │   CRAWL    │───►│  EXTRACT   │───►│  CLASSIFY  │                │
│  │   PAGE     │    │   LINKS    │    │   LINKS    │                │
│  └────────────┘    └────────────┘    └────────────┘                │
│        │                 │                 │                        │
│        ▼                 ▼                 ▼                        │
│  Cheerio parse      source_url        position:                    │
│  DOM traversal      target_url        - body (contextual)          │
│  Handle JS render   anchor_text       - nav (navigation)           │
│                     anchor_context    - footer (sitewide)          │
│                                       - sidebar (widget)           │
│                                                                     │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐                │
│  │  COMPUTE   │───►│   STORE    │───►│  AGGREGATE │                │
│  │  METRICS   │    │   GRAPH    │    │   PAGE     │                │
│  └────────────┘    └────────────┘    └────────────┘                │
│        │                 │                 │                        │
│        ▼                 ▼                 ▼                        │
│  Click depth        link_graph        page_links                   │
│  PageRank flow      table             inbound/outbound             │
│  Anchor diversity                     metrics per page             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.3 Link Classification Attributes

From `link-schema.ts`, each link is classified by:

| Attribute | Values | SEO Impact |
|-----------|--------|------------|
| `position` | body, sidebar, footer, nav, header | Body links pass most value |
| `linkType` | contextual, nav, footer, sidebar, image | Contextual most valuable |
| `isFirstParagraph` | boolean | Above-fold links weighted higher |
| `isExactMatch` | boolean | Target keyword in anchor boosts rankings |
| `isBranded` | boolean | Brand anchors for homepage/about |
| `isDoFollow` | boolean | nofollow links don't pass PageRank |

### 1.4 Click Depth Calculation

```typescript
// BFS from homepage to calculate click depth
interface DepthResult {
  pageUrl: string;
  clickDepthFromHome: number;
  pathFromHome: string[]; // URLs in shortest path
}

// Target: Most important pages within 3 clicks
// Warning: Pages at depth 4+
// Critical: Pages at depth 6+ (near-orphan)
```

---

## 2. Opportunity Detection

### 2.1 Opportunity Types (from schema)

| Type | Detection Logic | Urgency Factor |
|------|-----------------|----------------|
| **orphan_rescue** | `inbound_total = 0` OR only nav/footer links | 1.0 (highest) |
| **link_velocity** | `inbound_body < 3` for important pages | 0.8 |
| **depth_reduction** | `click_depth_from_home > 3` | 0.7 |
| **anchor_diversity** | `inbound_exact_match = 0` for target keyword | 0.6 |

### 2.2 Orphan Page Detection

```sql
-- Pages in sitemap/GSC but no internal links
SELECT p.url, p.title, p.monthly_traffic
FROM audit_pages p
LEFT JOIN (
  SELECT target_url, COUNT(*) as link_count
  FROM link_graph
  WHERE audit_id = $1 AND position = 'body'
  GROUP BY target_url
) lg ON p.url = lg.target_url
WHERE p.audit_id = $1
  AND (lg.link_count IS NULL OR lg.link_count = 0)
ORDER BY p.monthly_traffic DESC NULLS LAST;
```

### 2.3 Low-Link Page Detection

```sql
-- Important pages with insufficient internal links
SELECT pl.page_url, pl.inbound_body, ap.monthly_traffic, ap.target_keyword
FROM page_links pl
JOIN audit_pages ap ON pl.page_id = ap.id
WHERE pl.audit_id = $1
  AND pl.inbound_body < 3
  AND ap.monthly_traffic > 100  -- Only pages with traffic potential
ORDER BY ap.monthly_traffic DESC;
```

### 2.4 Anchor Text Analysis

```sql
-- Pages lacking exact-match anchors
SELECT 
  pl.page_url,
  pl.unique_anchors,
  pl.inbound_exact_match,
  ap.target_keyword,
  pl.top_anchors
FROM page_links pl
JOIN audit_pages ap ON pl.page_id = ap.id
WHERE pl.audit_id = $1
  AND ap.target_keyword IS NOT NULL
  AND pl.inbound_exact_match = 0
ORDER BY ap.monthly_traffic DESC;
```

### 2.5 Opportunity Scoring Formula

```typescript
function calculateOpportunityScore(page: PageMetrics): number {
  const weights = {
    orphanPenalty: 40,      // +40 if orphan
    depthPenalty: 20,       // +20 if depth > 3
    linkDeficit: 25,        // up to 25 based on link count vs benchmark
    anchorDiversity: 15,    // +15 if no exact match anchor
  };

  let score = 0;
  
  if (page.inboundBody === 0) score += weights.orphanPenalty;
  if (page.clickDepth > 3) score += weights.depthPenalty;
  
  const benchmarkLinks = 5;
  const deficit = Math.max(0, benchmarkLinks - page.inboundBody);
  score += (deficit / benchmarkLinks) * weights.linkDeficit;
  
  if (page.inboundExactMatch === 0 && page.targetKeyword) {
    score += weights.anchorDiversity;
  }
  
  return Math.min(100, score);
}
```

---

## 3. Anchor Text Recommendations

### 3.1 Anchor Text Strategy

| Anchor Type | Target Distribution | Use Case |
|-------------|---------------------|----------|
| **Exact Match** | 20-30% | Target keyword for ranking |
| **Partial Match** | 30-40% | Keyword variations |
| **Branded** | 10-15% | Homepage, about page |
| **Generic** | 10-15% | "Learn more", "Read more" |
| **URL/Naked** | 5-10% | Citations, references |

### 3.2 Anchor Text Generation

```typescript
interface AnchorRecommendation {
  anchorText: string;
  anchorType: 'exact' | 'partial' | 'branded' | 'generic';
  confidence: number;  // 0.0-1.0
  reason: string;
}

function generateAnchorRecommendations(
  targetPage: PageData,
  sourcePage: PageData,
  existingAnchors: AnchorDistribution
): AnchorRecommendation[] {
  const recommendations: AnchorRecommendation[] = [];
  
  // 1. Check if exact match is needed
  if (existingAnchors.exactMatchPercent < 20 && targetPage.targetKeyword) {
    recommendations.push({
      anchorText: targetPage.targetKeyword,
      anchorType: 'exact',
      confidence: 0.9,
      reason: 'Target page lacks exact-match anchors (current: ' + 
              existingAnchors.exactMatchPercent + '%)'
    });
  }
  
  // 2. Check for partial match variations
  const variations = generateKeywordVariations(targetPage.targetKeyword);
  for (const variation of variations) {
    if (!existingAnchors.usedAnchors.includes(variation.toLowerCase())) {
      recommendations.push({
        anchorText: variation,
        anchorType: 'partial',
        confidence: 0.7,
        reason: 'Adds anchor diversity'
      });
    }
  }
  
  // 3. Find matching text in source content
  const textMatches = findMatchingText(sourcePage.content, targetPage);
  for (const match of textMatches) {
    recommendations.push({
      anchorText: match.text,
      anchorType: 'partial',
      confidence: match.relevanceScore,
      reason: 'Natural text match found in source content'
    });
  }
  
  return recommendations;
}
```

### 3.3 Over-Optimization Detection

```typescript
interface OverOptimizationWarning {
  keyword: string;
  exactMatchPercent: number;
  recommendation: string;
}

function detectOverOptimization(anchors: AnchorDistribution): OverOptimizationWarning[] {
  const warnings: OverOptimizationWarning[] = [];
  
  // Flag if exact match exceeds 40%
  if (anchors.exactMatchPercent > 40) {
    warnings.push({
      keyword: anchors.topExactMatchKeyword,
      exactMatchPercent: anchors.exactMatchPercent,
      recommendation: 'Reduce exact-match anchors to avoid penalty. ' +
                     'Use partial match variations instead.'
    });
  }
  
  return warnings;
}
```

---

## 4. Bulk Optimization Workflows

### 4.1 Workflow States

```
┌─────────┐    ┌──────────┐    ┌──────────┐    ┌─────────┐    ┌─────────┐
│ PENDING │───►│ ACCEPTED │───►│ QUEUED   │───►│ APPLIED │───►│ VERIFIED│
└─────────┘    └──────────┘    └──────────┘    └─────────┘    └─────────┘
     │              │               │               │
     ▼              ▼               ▼               ▼
  Generated     Human/Auto      In BullMQ       CMS API        Re-crawl
  by system     approval        queue           executed       confirms
```

### 4.2 Bulk Operations

| Operation | Description | Max Batch Size |
|-----------|-------------|----------------|
| **Bulk Accept** | Accept multiple suggestions at once | 100 |
| **Bulk Reject** | Reject suggestions with reason | 100 |
| **Bulk Apply** | Execute accepted suggestions | 50 (rate limited) |
| **Bulk Revert** | Undo applied changes | 50 |

### 4.3 Application Methods

```typescript
type InsertionMethod = 'wrap_existing' | 'append_sentence' | 'inject_paragraph';

interface ApplicationPlan {
  suggestionId: string;
  method: InsertionMethod;
  
  // For wrap_existing
  existingTextMatch?: string;
  replacementHtml?: string;
  
  // For append_sentence
  newSentence?: string;
  insertAfterParagraph?: number;
  
  // For inject_paragraph
  newParagraph?: string;
  insertAfterHeading?: string;
}
```

### 4.4 CMS Integration Points

| CMS | API Method | Rate Limit |
|-----|------------|------------|
| **WordPress** | REST API v2 `/wp/v2/posts/{id}` | 10 req/s |
| **Webflow** | CMS API `/collections/{id}/items` | 60 req/min |
| **Contentful** | Content Management API | 10 req/s |
| **Custom** | Webhook with page URL + HTML diff | Configurable |

---

## 5. Autopilot vs Human-in-the-Loop Decision Points

### 5.1 Decision Matrix

| Operation | Autopilot | HITL | Decision Criteria |
|-----------|-----------|------|-------------------|
| **Link Discovery** | YES | - | Always automatic during crawl |
| **Opportunity Detection** | YES | - | Algorithmic, no judgment needed |
| **Suggestion Generation** | YES | - | AI-generated, scored automatically |
| **Suggestion Approval** | CONDITIONAL | YES | Based on confidence threshold |
| **Link Application** | CONDITIONAL | YES | Based on risk assessment |
| **Anchor Text Selection** | CONDITIONAL | YES | Based on confidence + page importance |
| **Revert Changes** | - | YES | Always requires human confirmation |

### 5.2 Autopilot Eligibility Criteria

```typescript
interface AutopilotEligibility {
  suggestionId: string;
  isEligible: boolean;
  reasons: string[];
}

function checkAutopilotEligibility(
  suggestion: LinkSuggestion,
  targetPage: PageData,
  clientSettings: ClientSettings
): AutopilotEligibility {
  const reasons: string[] = [];
  let isEligible = true;
  
  // 1. Confidence threshold
  if (suggestion.anchorConfidence < 0.8) {
    isEligible = false;
    reasons.push(`Anchor confidence ${suggestion.anchorConfidence} < 0.8 threshold`);
  }
  
  // 2. Score threshold
  if (suggestion.score < 70) {
    isEligible = false;
    reasons.push(`Score ${suggestion.score} < 70 threshold`);
  }
  
  // 3. Page importance (high-traffic pages need review)
  if (targetPage.monthlyTraffic > 1000) {
    isEligible = false;
    reasons.push(`High-traffic page (${targetPage.monthlyTraffic}/mo) requires review`);
  }
  
  // 4. Client autopilot setting
  if (!clientSettings.enableAutopilotLinking) {
    isEligible = false;
    reasons.push('Client has autopilot disabled');
  }
  
  // 5. Method safety
  if (suggestion.insertionMethod === 'inject_paragraph') {
    isEligible = false;
    reasons.push('Paragraph injection requires human review');
  }
  
  return { suggestionId: suggestion.id, isEligible, reasons };
}
```

### 5.3 HITL Review Interface Requirements

```
┌─────────────────────────────────────────────────────────────────────┐
│                    LINK SUGGESTION REVIEW                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ SOURCE: /blog/best-practices-2024                           │   │
│  │ TARGET: /services/seo-audit                                 │   │
│  │ ANCHOR: "comprehensive SEO audit"                           │   │
│  │ SCORE: 87/100    CONFIDENCE: 0.92                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─ PREVIEW ────────────────────────────────────────────────────┐  │
│  │ Before:                                                       │  │
│  │ "...conduct a comprehensive SEO audit to identify issues..."  │  │
│  │                                                               │  │
│  │ After:                                                        │  │
│  │ "...conduct a <a href="/services/seo-audit">comprehensive    │  │
│  │ SEO audit</a> to identify issues..."                         │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─ REASONS ────────────────────────────────────────────────────┐  │
│  │ - Target page is orphaned (0 body links)                      │  │
│  │ - Exact match anchor needed (current: 0%)                     │  │
│  │ - Natural text match found in source                          │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  [ ACCEPT ]  [ REJECT ]  [ EDIT ANCHOR ]  [ SKIP ]                 │
│                                                                     │
│  ┌─ BULK ACTIONS ───────────────────────────────────────────────┐  │
│  │ [ ] Select all (47 pending)                                   │  │
│  │ [ Accept All High-Confidence ]  [ Reject All Low-Score ]      │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.4 Escalation Path

```typescript
type EscalationLevel = 'autopilot' | 'review_queue' | 'manual_alert' | 'blocked';

interface EscalationRule {
  condition: string;
  level: EscalationLevel;
  notifyRoles: string[];
}

const escalationRules: EscalationRule[] = [
  {
    condition: 'score >= 70 AND confidence >= 0.8 AND traffic < 1000',
    level: 'autopilot',
    notifyRoles: []
  },
  {
    condition: 'score >= 50 AND confidence >= 0.6',
    level: 'review_queue',
    notifyRoles: ['seo_manager']
  },
  {
    condition: 'targetPage is money_page OR traffic > 5000',
    level: 'manual_alert',
    notifyRoles: ['seo_manager', 'client_owner']
  },
  {
    condition: 'overOptimizationRisk OR cannibalizationDetected',
    level: 'blocked',
    notifyRoles: ['seo_manager', 'client_owner']
  }
];
```

---

## 6. Implementation Priorities

### 6.1 What Exists (from link-schema.ts)

- `linkGraph` table - stores all link relationships
- `pageLinks` table - aggregated metrics per page
- `orphanPages` table - orphan detection and tracking
- `linkOpportunities` table - opportunity storage with types
- `linkSuggestions` table - AI recommendations with scores
- `keywordCannibalization` table - competing page detection

### 6.2 What Needs to Be Built

| Component | Priority | Complexity |
|-----------|----------|------------|
| **Crawl → linkGraph extraction** | P0 | Medium |
| **Click depth BFS calculator** | P0 | Low |
| **Opportunity detection queries** | P0 | Low |
| **Anchor recommendation engine** | P1 | Medium |
| **Autopilot eligibility checker** | P1 | Low |
| **Bulk operations API** | P1 | Medium |
| **HITL review UI** | P1 | High |
| **CMS integration adapters** | P2 | High |
| **Revert/undo mechanism** | P2 | Medium |

### 6.3 API Endpoints Needed

```typescript
// Opportunity APIs
GET  /api/clients/{id}/link-opportunities
GET  /api/clients/{id}/orphan-pages
GET  /api/clients/{id}/low-link-pages

// Suggestion APIs
GET  /api/clients/{id}/link-suggestions
POST /api/clients/{id}/link-suggestions/bulk-accept
POST /api/clients/{id}/link-suggestions/bulk-reject
POST /api/clients/{id}/link-suggestions/bulk-apply

// Analysis APIs
GET  /api/clients/{id}/anchor-analysis/{pageUrl}
GET  /api/clients/{id}/click-depth-report
GET  /api/clients/{id}/link-health-dashboard
```

---

## 7. Key Recommendations

### 7.1 Autopilot Settings Per Client

```typescript
interface ClientLinkingSettings {
  enableAutopilotLinking: boolean;
  autopilotConfidenceThreshold: number;  // default: 0.8
  autopilotScoreThreshold: number;       // default: 70
  autopilotMaxTraffic: number;           // default: 1000
  protectedPages: string[];              // URLs that always need review
  preferredAnchorDistribution: {
    exactMatch: number;    // default: 25%
    partialMatch: number;  // default: 35%
    branded: number;       // default: 15%
    generic: number;       // default: 15%
    naked: number;         // default: 10%
  };
}
```

### 7.2 Batch Processing Strategy

- Run opportunity detection nightly after crawl completes
- Generate suggestions in batches of 100 pages
- Queue autopilot-eligible suggestions for automatic application
- Send daily digest of pending HITL items to client/SEO manager

### 7.3 Safety Mechanisms

1. **Dry Run Mode** - Preview all changes before applying
2. **Rollback Tracking** - Store original HTML in `site_changes` table
3. **Rate Limiting** - Max 50 changes per hour per client
4. **Anomaly Detection** - Alert if >10% of links break after changes
5. **A/B Testing** - Optional hold-out group to measure impact

---

## Document References

- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/db/link-schema.ts` - Schema definitions
- `/home/dominic/Documents/TeveroSEO/.planning/phases/99-unified-seo-content-pipeline/PHASE-99-MASTER-SPEC.md` - Parent spec
- `/home/dominic/Documents/TeveroSEO/.planning/design/v7-master-design-architecture.md` - Autonomy/control patterns

---

*Research complete. Ready for integration into Phase 99 implementation plan.*
