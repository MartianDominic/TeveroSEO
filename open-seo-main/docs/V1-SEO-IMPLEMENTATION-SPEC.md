# V1 SEO Implementation Specification

> **Purpose:** Unified actionable spec for V1 agency SEO platform. Synthesized from elite practitioner playbooks, 2026 ranking research, and compass artifact.
>
> **Scope:** What we check, what we fix, and how we measure success.
>
> **Goal:** Fully autonomous SEO pipeline. Client connects → system optimizes → rankings improve.

---

## Table of Contents

0. [The Autonomous Pipeline](#0-the-autonomous-pipeline)
1. [How Content Ranks in 2026](#1-how-content-ranks-in-2026)
2. [On-Page SEO Methodology](#2-on-page-seo-methodology)
3. [Technical SEO Requirements](#3-technical-seo-requirements)
4. [Platform-Specific Checklists](#4-platform-specific-checklists)
5. [Scoring & Quality Gates](#5-scoring--quality-gates)

---

## 0. The Autonomous Pipeline

### Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AUTONOMOUS SEO PIPELINE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PHASE 1          PHASE 2          PHASE 3          PHASE 4                 │
│  ─────────        ─────────        ─────────        ─────────               │
│  Connect          Discover         Analyze          Execute                  │
│                                                                              │
│  ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐               │
│  │ Client  │────▶│  Site   │────▶│ Keyword │────▶│ Auto-Fix│               │
│  │ Onboard │     │  Scan   │     │ Mapping │     │  Pages  │               │
│  └─────────┘     └─────────┘     └─────────┘     └─────────┘               │
│       │               │               │               │                     │
│       ▼               ▼               ▼               ▼                     │
│  ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐               │
│  │Technical│────▶│  Page   │────▶│Page-KW  │────▶│ Publish │               │
│  │  Fixes  │     │Inventory│     │ Mapping │     │ Content │               │
│  └─────────┘     └─────────┘     └─────────┘     └─────────┘               │
│                                                                              │
│  Automated ◀──────────────────────────────────────────────▶ Automated       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Phase 1: Client Connected

**Trigger:** Agency adds client, provides site access

**Step 1.1: Platform Detection & Connection**
```
Input:  Client domain + credentials
Process:
  1. Detect platform (WordPress, Shopify, Wix, custom)
  2. Establish API connection
  3. Verify write permissions
  4. Store encrypted credentials
Output: site_connection record with capabilities
```

**Step 1.2: Auto-Fix Technical SEO (Immediate)**

These run automatically on connection - no analysis needed:

| Fix | What | How |
|-----|------|-----|
| Social links | Add/verify OG tags, Twitter cards | Inject meta tags |
| NAP consistency | Ensure Name/Address/Phone matches | Update footer, schema |
| Schema foundation | Add Organization, WebSite schema | Inject JSON-LD |
| Sitemap | Create/submit if missing | Generate + GSC API |
| Robots.txt | Verify/create | Write file |
| Canonical tags | Add self-referencing | Inject link tags |
| HTTPS redirect | Force HTTPS if available | .htaccess or config |

```typescript
// Runs immediately after connection verified
async function runImmediateFixes(connection: SiteConnection) {
  const fixes = [
    checkAndFixOGTags(connection),
    checkAndFixTwitterCards(connection),
    checkAndFixOrganizationSchema(connection),
    checkAndFixSitemap(connection),
    checkAndFixRobotsTxt(connection),
    checkAndFixCanonicals(connection),
    checkAndFixHTTPS(connection),
  ];
  
  return Promise.all(fixes);
}
```

**Output:** Technical foundation in place, tracked for revert

---

### Phase 2: Site Discovery (Token-Efficient)

**Goal:** Understand the site without burning tokens on huge crawls

**Step 2.1: Get Page Count First**
```typescript
async function discoverSiteSize(domain: string) {
  // Method 1: Sitemap parsing (free, fast)
  const sitemapUrls = await parseSitemap(`${domain}/sitemap.xml`);
  
  // Method 2: site: search count (free, approximate)
  const indexedCount = await getIndexedPageCount(domain);
  
  // Method 3: GSC if connected (accurate)
  const gscCount = await getGSCPageCount(domain);
  
  return {
    sitemapPages: sitemapUrls.length,
    indexedPages: indexedCount,
    gscPages: gscCount,
    recommended: Math.min(sitemapUrls.length, 50) // Start with 50 max
  };
}
```

**Step 2.2: Smart Page Selection (Max 50 First Pass)**

```typescript
interface PagePriority {
  url: string;
  priority: number;
  reason: string;
}

async function selectPriorityPages(domain: string, limit: number = 50): Promise<PagePriority[]> {
  const pages: PagePriority[] = [];
  
  // Tier 1: Homepage (always)
  pages.push({ url: '/', priority: 100, reason: 'homepage' });
  
  // Tier 2: Top traffic pages from GSC (if connected)
  const topTraffic = await getTopTrafficPages(domain, 20);
  topTraffic.forEach(p => pages.push({ 
    url: p.url, 
    priority: 90, 
    reason: `${p.clicks} clicks/month` 
  }));
  
  // Tier 3: Pages ranking 11-20 (low-hanging fruit)
  const almostRanking = await getPagesRanking11to20(domain, 15);
  almostRanking.forEach(p => pages.push({ 
    url: p.url, 
    priority: 85, 
    reason: `position ${p.position} for "${p.keyword}"` 
  }));
  
  // Tier 4: Key service/product pages from sitemap
  const servicePages = await identifyServicePages(domain, 10);
  servicePages.forEach(p => pages.push({ 
    url: p.url, 
    priority: 80, 
    reason: 'service/product page' 
  }));
  
  // Tier 5: Recent content (last 30 days)
  const recentContent = await getRecentContent(domain, 5);
  recentContent.forEach(p => pages.push({ 
    url: p.url, 
    priority: 70, 
    reason: 'recent content' 
  }));
  
  // Dedupe and limit
  return dedupeByUrl(pages).slice(0, limit);
}
```

**Step 2.3: Lightweight Page Analysis**

For each selected page, gather data WITHOUT AI (pure parsing):

```typescript
interface PageAnalysis {
  url: string;
  
  // Extracted from HTML (no AI cost)
  title: string;
  metaDescription: string;
  h1: string;
  h2s: string[];
  wordCount: number;
  internalLinks: number;
  externalLinks: number;
  images: { src: string; alt: string | null }[];
  schema: object[];
  
  // From GSC (no AI cost)
  topKeywords: { keyword: string; position: number; clicks: number }[];
  
  // Calculated scores (no AI cost)
  technicalScore: number;  // Based on 107 checks
  issues: Finding[];       // What's wrong
}
```

**Output:** `page_inventory` table with all 50 pages analyzed

---

### Phase 3: Keyword Analysis & Page Mapping

**Step 3.1: Aggregate Keywords**

Sources (no AI needed):
- GSC: What keywords already drive traffic
- DataForSEO: Keyword suggestions for niche
- Competitor analysis: What competitors rank for
- Prospect phase data: If already researched

```typescript
interface KeywordData {
  keyword: string;
  searchVolume: number;
  difficulty: number;
  currentPosition: number | null;  // From GSC
  currentUrl: string | null;       // Which page ranks
  intent: 'informational' | 'commercial' | 'transactional' | 'navigational';
  priority: number;                // Calculated
}
```

**Step 3.2: Map Keywords to Pages**

Decision logic (no AI needed):

```typescript
function mapKeywordToPage(keyword: KeywordData, pages: PageAnalysis[]): PageMapping {
  // Already ranking? Keep that page
  if (keyword.currentUrl && keyword.currentPosition <= 20) {
    return { 
      keyword: keyword.keyword, 
      targetUrl: keyword.currentUrl, 
      action: 'optimize',
      reason: `Already position ${keyword.currentPosition}`
    };
  }
  
  // Find best existing page match
  const bestMatch = pages
    .map(p => ({
      page: p,
      relevance: calculateRelevance(keyword, p) // Title/H1/content overlap
    }))
    .sort((a, b) => b.relevance - a.relevance)[0];
  
  if (bestMatch.relevance > 0.6) {
    return {
      keyword: keyword.keyword,
      targetUrl: bestMatch.page.url,
      action: 'optimize',
      reason: `Best match (${Math.round(bestMatch.relevance * 100)}% relevant)`
    };
  }
  
  // No good match - flag for new content
  return {
    keyword: keyword.keyword,
    targetUrl: null,
    action: 'create',
    reason: 'No existing page matches'
  };
}
```

**Output:** `keyword_page_mapping` table

```
| Keyword              | Target URL           | Action   | Priority |
|----------------------|----------------------|----------|----------|
| barrel sauna         | /products/barrel     | optimize | 95       |
| sauna heater 9kw     | /products/heaters    | optimize | 88       |
| how to install sauna | null                 | create   | 72       |
| outdoor sauna ideas  | /blog/outdoor-ideas  | optimize | 70       |
```

---

### Phase 4: Auto-Fix Pages

**Step 4.1: Run 107 Checks on Target Pages**

```typescript
async function analyzeAndFix(mapping: KeywordPageMapping) {
  const targetUrl = mapping.targetUrl;
  const targetKeyword = mapping.keyword;
  
  // Run all 107 checks
  const findings = await runAllChecks(targetUrl, targetKeyword);
  
  // Categorize by fixability
  const autoFixable = findings.filter(f => f.autoEditable && f.effort === 'low');
  const aiAssisted = findings.filter(f => f.autoEditable && f.effort === 'medium');
  const manual = findings.filter(f => !f.autoEditable);
  
  return { autoFixable, aiAssisted, manual };
}
```

**Step 4.2: Apply Auto-Fixes (No AI, No Approval Needed)**

These are safe, deterministic fixes:

| Fix Type | Example | Risk |
|----------|---------|------|
| Add `<strong>` to keyword | Wrap first occurrence | None |
| Add missing alt text | Descriptive based on filename | None |
| Add width/height to images | From actual dimensions | None |
| Fix heading hierarchy | Demote H3 under H2 | None |
| Add BreadcrumbList schema | Generate from URL path | None |
| Add canonical tag | Self-referencing | None |
| Add loading="lazy" | To below-fold images | None |

```typescript
async function applyAutoFixes(page: PageAnalysis, findings: Finding[]) {
  const safeFixTypes = [
    'keyword_in_strong',
    'image_alt_missing',
    'image_dimensions',
    'heading_hierarchy',
    'breadcrumb_schema',
    'canonical_tag',
    'lazy_loading',
    'meta_description_length',  // Truncate if too long
  ];
  
  const safeFixes = findings.filter(f => 
    safeFixTypes.includes(f.checkId) && f.autoEditable
  );
  
  for (const fix of safeFixes) {
    await applyFix(fix);
    await recordChange(fix);  // For revert
  }
  
  return safeFixes.length;
}
```

**Step 4.3: Flag for Review (AI-Assisted or Manual)**

Things we DON'T auto-fix without approval:

| Issue | Why Not Auto-Fix |
|-------|------------------|
| Content too short (300 → 2000 words) | Massive change, needs human review |
| Reading level too high | AI rewrite changes voice |
| Missing internal links | Need to choose targets |
| Title tag complete rewrite | Brand implications |
| H1 complete rewrite | Might affect branding |

```typescript
interface FlaggedIssue {
  page: string;
  issue: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  suggestedFix: string;
  estimatedImpact: string;
  requiresAI: boolean;
}

// These get surfaced to user dashboard
const flaggedIssues: FlaggedIssue[] = [
  {
    page: '/products/barrel-sauna',
    issue: 'Content only 450 words (competitors avg 1,800)',
    severity: 'high',
    suggestedFix: 'Expand with sections on: installation, maintenance, sizing',
    estimatedImpact: '+15 points',
    requiresAI: true
  }
];
```

---

### Phase 5: Content Publishing (When Needed)

**Trigger:** Keyword mapped to `action: 'create'`

**Step 5.1: Content Brief Generation**

```typescript
interface ContentBrief {
  targetKeyword: string;
  secondaryKeywords: string[];
  searchIntent: string;
  
  // From competitor analysis (no AI)
  competitorWordCounts: number[];
  targetWordCount: number;
  requiredH2s: string[];  // Common across top 10
  
  // From PAA/SERP (no AI)
  questionsToAnswer: string[];
  
  // Voice settings (from client profile)
  voiceMode: 'preservation' | 'application' | 'best_practices';
  voiceProfile: VoiceProfile | null;
}
```

**Step 5.2: Content Generation (AI)**

```typescript
async function generateContent(brief: ContentBrief): Promise<GeneratedContent> {
  const content = await aiGenerate({
    type: 'seo_article',
    brief,
    constraints: {
      wordCount: brief.targetWordCount,
      readingLevel: 9,
      keywordDensity: 0.8,
      includeH2s: brief.requiredH2s,
      answerQuestions: brief.questionsToAnswer,
      voice: brief.voiceProfile
    }
  });
  
  // Run 107 checks on generated content BEFORE publishing
  const findings = await runAllChecks(content);
  
  // Auto-fix any issues in generated content
  const fixedContent = await applyAutoFixes(content, findings);
  
  return fixedContent;
}
```

**Step 5.3: Publish & Verify**

```typescript
async function publishContent(content: GeneratedContent, platform: SiteConnection) {
  // 1. Publish via platform adapter
  const result = await platform.createPage({
    title: content.title,
    content: content.body,
    slug: content.slug,
    status: 'draft'  // Start as draft
  });
  
  // 2. Add schema, meta tags
  await platform.updateMeta(result.id, content.meta);
  await platform.addSchema(result.id, content.schema);
  
  // 3. Verify rendering
  const rendered = await fetchRenderedPage(result.url);
  const checks = await runAllChecks(rendered);
  
  // 4. If checks pass, publish
  if (checks.score >= 80) {
    await platform.updateStatus(result.id, 'published');
    await submitToGSC(result.url);
  } else {
    // Flag for review
    await flagForReview(result, checks);
  }
}
```

---

### The Complete Autonomous Loop

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AUTONOMOUS SEO LOOP                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  DAILY                                                                       │
│  ─────                                                                       │
│  • Check GSC for ranking changes                                             │
│  • Check CWV for performance issues                                          │
│  • Run 107 checks on top 10 traffic pages                                    │
│  • Auto-fix any new issues (safe fixes only)                                 │
│                                                                              │
│  WEEKLY                                                                      │
│  ──────                                                                      │
│  • Expand analysis to next 50 pages                                          │
│  • Update keyword rankings                                                   │
│  • Identify new keyword opportunities                                        │
│  • Generate content briefs for gaps                                          │
│  • Report to agency dashboard                                                │
│                                                                              │
│  MONTHLY                                                                     │
│  ───────                                                                     │
│  • Full site re-scan (if <500 pages)                                        │
│  • Competitor position tracking                                              │
│  • Content freshness audit                                                   │
│  • ROI calculation                                                           │
│                                                                              │
│  TRIGGERED                                                                   │
│  ─────────                                                                   │
│  • Traffic drop >20% → Investigate + alert                                   │
│  • Ranking drop >5 positions → Check + suggest fixes                         │
│  • New competitor in top 5 → Gap analysis                                    │
│  • CWV fails → Auto-fix if possible, alert if not                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Token Budget Strategy

| Operation | Token Cost | Frequency | Monthly Cost (100 clients) |
|-----------|------------|-----------|---------------------------|
| Technical SEO fixes | 0 | Once | $0 |
| Page parsing (50 pages) | 0 | Weekly | $0 |
| Keyword analysis | 0 | Weekly | $0 |
| 107 checks | 0 | Daily | $0 |
| Auto-fixes | 0 | Daily | $0 |
| AI content brief | ~500 | As needed | Variable |
| AI content generation | ~2,000 | As needed | Variable |
| AI content rewrites | ~1,000 | Flagged only | Variable |

**Key Insight:** 90% of the pipeline is token-free. AI only used for:
1. Content generation (new pages)
2. Content rewrites (flagged issues)
3. Voice-aware optimizations

---

### What Makes This Worth Millions

| Feature | Competitors | Us |
|---------|-------------|-----|
| Site audit | Manual trigger | Continuous |
| Fix suggestions | List of issues | One-click fix |
| Implementation | "Here's what to do" | We do it |
| Content | "You need more words" | We write it |
| Monitoring | Separate tool | Built-in |
| Revert | None | Granular |
| Voice preservation | None | Full system |
| Token efficiency | N/A | 90% free |

**Revenue Math:**
- 100 agencies × $500/month = $50k MRR
- 500 agencies × $500/month = $250k MRR
- 1000 agencies × $500/month = $500k MRR

Each agency manages 10-50 clients. We're the engine behind all of them.

---

## 1. How Content Ranks in 2026

### 1.1 The Three-Layer Pipeline (DOJ-Confirmed)

Google's ranking operates in three confirmed layers:

| Layer | Function | Key Signals |
|-------|----------|-------------|
| **Retrieval** | Culls candidate set | BM25 + embeddings + `siteFocusScore` (topical authority) |
| **NavBoost** | Reorders by engagement | 13-month click memory, Chrome data, dwell time |
| **ML Rankers** | Final adjustments | RankBrain, DeepRank, RankEmbed BERT |

### 1.2 What Wins Rankings

**Must-Haves:**
- First-hand experience + original data/photography
- Named, credentialed authors (73% of top YMYL results show author credentials)
- Consistent publishing (>=1 new post/month + >=5 refreshes/year)
- Clean UX with Core Web Vitals passing
- Tight topical clusters (15-25 spokes triggers authority)

**What Loses Rankings:**
- Thin affiliate content
- Paraphrased/commodity content
- Scaled AI without human value-add
- Aggressive ad monetization
- Weak brand entity signals

### 1.3 Word Count Targets

| Query Type | Target Range |
|------------|--------------|
| Head term informational | 1,800-3,000 words |
| Long-tail informational | 1,200-2,000 words |
| Local/service area | 800-1,500 words |
| Comparison | 1,500-2,500 words |
| How-to/tutorial | 1,000-1,800 words |
| Listicle | 1,500-2,500 words |
| Commercial/product | 600-1,500 words |

**Key Finding:** Word count has **zero confirmed direct ranking weight**. Score only relative to competitor range. Flag if >15% above top-5 average (padding) or <15% below competitor minimum (coverage gap).

### 1.4 Content Structure Template

```
INTRODUCTION (0-100 words)
├── Hook sentence
├── Direct answer passage (30-40 words) ← Featured snippet target
├── What-you-will-learn preview
└── Primary keyword in first 100 words (2x = bonus)

BODY
├── H2: Section + secondary keyword
│   ├── 30-40 word extractive answer immediately after H2
│   ├── H3: Subsection (2-4 per H2 max)
│   └── Pattern interrupt every 200-300 words
├── H2: Section + secondary keyword
│   └── ...
└── H2: FAQ Section (PAA questions as H2s)

CONCLUSION (100-200 words)
├── Recap key takeaways in direct answer form
└── CTA to related hub/pillar page
```

### 1.5 Internal Linking Strategy

**Zyppy 23M Links Study Findings:**

| Internal Links to URL | Traffic Impact |
|-----------------------|----------------|
| 0-4 links | Baseline (avg 2 clicks from Google) |
| **40-44 links** | **4x more traffic** (peak zone) |
| 45-50+ links | Effect reverses |
| **>=1 exact-match anchor** | **5x more traffic** |

**Rules:**
- Minimum 3, maximum 10 contextual in-content links per article
- "Link high and tight" - first couple of paragraphs
- At least one exact-match internal anchor per important page
- Keep all pages within 3 clicks from homepage
- Body links > sidebar > footer priority

**Anchor Text Distribution (Matt Diggity):**
- 50% Exact Match
- 25% URL/Branded
- 25% Miscellaneous

---

## 2. On-Page SEO Methodology

### 2.1 Kyle Roof's Core Finding (US Patent #10,540,263 B1)

> "If you put your keyword in URL + title + H1 + body paragraph tags, you've done **60-70% of on-page SEO**."

**Factor Groups (400+ controlled tests):**

| Group | Factors | Weight |
|-------|---------|--------|
| **A (Highest)** | Meta title, body content, URL, H1 | ~60-70% combined |
| **B (Mid)** | H2, H3, H4, anchor text | Moderate |
| **C (Lower)** | Bold, italic, image alt | Minor |
| **D (None)** | Schema (ranking), Open Graph, meta keywords | Negligible for ranking |

### 2.2 Title Tag Optimization

| Attribute | Requirement |
|-----------|-------------|
| Length | **50-60 characters** / <=575 pixels |
| Keyword position | **First 30 characters** preferred |
| Formula | `Primary keyword + differentiator/benefit + brand (optional)` |
| Power words | "Best", "Complete", "Ultimate", "[2026]" |

**Example:** `Personal Injury Lawyer NYC | Free Consultation | ClaimRise`

### 2.3 Meta Description

| Attribute | Requirement |
|-----------|-------------|
| Length | **140-160 characters** (120 for mobile) |
| Content | Primary keyword + value prop + CTA |
| Note | Google rewrites ~70%, but optimize anyway for CTR |

### 2.4 Heading Hierarchy

**H1 Rules:**
- **Exactly ONE** per page
- **40-70 characters**
- Close variant of title tag (Roof: identical always wins)
- Must contain primary keyword

**H2 Rules:**
- Count = top-5 competitor average +10-15%
- Realistic range: 5-12 H2s for informational
- Primary keyword in **first H2** and **last H2**
- Each H2 followed by **30-40 word extractive answer**

**H3/H4 Rules:**
- H3s nested under H2s only
- 2-4 H3s per H2 max
- Diminishing weight H4-H6

### 2.5 Primary Keyword Placement Checklist

| Location | Requirement | Score |
|----------|-------------|-------|
| URL slug | Exact/close variant, lowercase, hyphens, 3-5 words | /1 |
| Title tag | In first 60 characters | /1 |
| H1 | Single H1, close variant of title | /1 |
| First 100 words | At least once; 2x = bonus | /1 |
| First `<p>` tag | Must be in paragraph, not div/span | /1 |
| At least one H2 | First H2 preferred | /1 |
| Last H2/conclusion | Reinforcement | /1 |

**Scoring:** 7 = Excellent / 5-6 = Good / 3-4 = Needs work / <3 = Fail (P1)

### 2.6 Secondary HTML Signals

- [ ] Primary keyword in at least one `<strong>` or `<b>` tag
- [ ] Primary keyword in at least one `<a>` anchor text (internal link)
- [ ] Primary keyword in at least one `<a title="">` attribute
- [ ] Primary keyword in at least one `<img alt="">` attribute

### 2.7 Keyword Density

- **No universal optimum** - match competitor average ±1 standard deviation
- Flag if >3% (over-optimization risk)
- Think density **within HTML regions**, not page-wide

### 2.8 NLP/Entity Optimization

**Entity Coverage Process:**
1. Run target page through Google NLP API
2. Extract entities with salience >= 0.05
3. Run top-10 SERP pages through same process
4. Compute coverage percentage

**Scoring:**
- >= 80% coverage: 5/5
- 60-79%: 4/5
- 40-59%: 3/5
- 20-39%: 2/5
- <20%: 1/5

**Quality Gate:** Score >=60% of top-10 SERP entities required before publish

### 2.9 Schema Markup

**Required by Page Type:**

| Page Type | Required Schema |
|-----------|-----------------|
| Blog/Article | Article + Person (author) + Organization + BreadcrumbList |
| Product | Product + Offer + AggregateRating + BreadcrumbList |
| Local business | LocalBusiness + PostalAddress + OpeningHoursSpecification |
| FAQ page | FAQPage (government/health only) + BreadcrumbList |

**Article Schema Required Fields:**
- `headline`, `author` (Person), `datePublished`, `dateModified`, `publisher`, `image`

**Deprecated Schema to Remove:**
- HowTo (deprecated Sep 13, 2023)
- FAQPage (restricted to gov/health Aug 2023)
- Sitelinks SearchBox (deprecated Nov 2024)

---

## 3. Technical SEO Requirements

### 3.1 Core Web Vitals Thresholds

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| **LCP** | <=2.5s | 2.5-4.0s | >4.0s |
| **INP** | <=200ms | 200-500ms | >500ms |
| **CLS** | <=0.1 | 0.1-0.25 | >0.25 |

**Ranking Impact (Dec 2025 data):**
- LCP >3s = **-23% traffic**
- INP >300ms = mobile ranking decline
- **43% of sites fail the 200ms INP threshold**

**Gating Rule:** Any CWV metric in "Poor" = overall SEO score capped at 75/100

### 3.2 Crawlability Checklist

| Signal | Requirement | Score |
|--------|-------------|-------|
| HTTP status | 200 (not 301, 302, 404, 410) | /1 |
| robots.txt | Not blocked | /1 |
| Meta robots | No `noindex` | /1 |
| Canonical | Self-referential, absolute URL | /1 |
| Sitemap | Page appears with accurate `lastmod` | /1 |
| HTTPS | Valid certificate, no mixed content | /1 |

**Gating Rule:** Any `noindex` or robots.txt block = P1 fix before all else

### 3.3 Mobile-First Requirements

**Googlebot Smartphone is the ONLY indexing crawler** (July 5, 2024 final rollout)

- [ ] Page renders on 375px viewport without horizontal scroll
- [ ] Tap targets >= 48x48px
- [ ] Text >= 16px on mobile
- [ ] H1 + intro visible above fold on mobile
- [ ] No interstitials before main content

### 3.4 URL Structure

| Rule | Requirement |
|------|-------------|
| Case | All lowercase |
| Separator | Hyphens (not underscores) |
| Length | 3-5 words with keyword |
| Depth | Max 2 subfolders (`/blog/keyword-phrase/`) |
| Stability | Never change URLs on ranking pages |

### 3.5 Image Optimization

| Attribute | Requirement |
|-----------|-------------|
| Format | WebP or AVIF (flag JPG/PNG without next-gen) |
| Loading | `loading="lazy"` on below-fold images |
| Dimensions | Explicit `width` and `height` attributes |
| Alt text | Descriptive, not keyword-stuffed |
| Filename | Lowercase, hyphenated, descriptive |
| Minimum | 3 images per 1,500 words, 1 original (non-stock) |

### 3.6 Indexation

- Self-referential canonical on every indexable page
- Sitemap `lastmod` must match schema `dateModified`
- Submit new URLs via Search Console URL Inspection
- Flag duplicate versions (www vs non-www, HTTP vs HTTPS, trailing slash)

---

## 4. Platform-Specific Checklists

### 4.1 React SPA / Next.js

| Check | Requirement |
|-------|-------------|
| SSR/SSG | Critical content (H1, body, schema) in raw HTML response |
| Hydration | No client-only rendering of SEO-critical elements |
| Schema | Inject in `<head>` via SSR, not client-side JS |
| Routing | Clean URLs with proper canonical handling |
| Sitemap | Auto-generated with all routes |

**Risk:** AI crawlers (GPTBot, ClaudeBot) don't render JavaScript - content in `<div>` soup is invisible to them.

### 4.2 WordPress

| Check | Requirement |
|-------|-------------|
| SEO Plugin | Yoast or RankMath configured |
| Sitemap | Auto-submitted to GSC |
| Caching | Page caching enabled (WP Rocket, LiteSpeed) |
| Images | WebP conversion plugin active |
| Schema | Plugin-managed, validate with Rich Results Test |

### 4.3 Shopify

| Check | Requirement |
|-------|-------------|
| Theme | 2.0 theme with proper heading structure |
| URL structure | Handle-based, no auto-generated parameters |
| Product schema | Validate Offer, availability, price |
| Collection pages | Unique descriptions, not boilerplate |
| Image optimization | Shopify CDN + lazy loading |

### 4.4 Multilingual Sites

| Check | Requirement |
|-------|-------------|
| Structure | Subdirectories on .com (`/lt/`, `/en/`) |
| Hreflang | Bidirectional, self-referencing, x-default set |
| Implementation | `<link>` elements or sitemap XML (not JSON-LD) |
| Internal links | Stay within same language version |
| Canonical | Self-referencing per language version |

---

## 5. Scoring & Quality Gates

### 5.1 On-Page Score (40 points max)

| Category | Max Points |
|----------|------------|
| Primary keyword placement (7 locations) | 14 |
| Title tag optimization | 6 |
| Heading structure | 8 |
| Secondary HTML signals | 4 |
| Internal linking | 8 |

### 5.2 Content Quality Score (25 points max)

| Category | Max Points |
|----------|------------|
| Information gain (original data, case studies) | 10 |
| E-E-A-T signals | 8 |
| Readability (Flesch-Kincaid <= Grade 9) | 4 |
| Engagement (hook, value density) | 3 |

**Quality Gate:** Content quality <13/25 = DO NOT PUBLISH

### 5.3 Technical Score (10 points max)

| Category | Max Points |
|----------|------------|
| Core Web Vitals | 4 |
| Crawlability | 3 |
| Mobile-first | 3 |

### 5.4 Competitive Thresholds

| Competition Level | Overall Min | On-Page | Content | Technical |
|-------------------|-------------|---------|---------|-----------|
| Low (KD <15) | 70 | 28/40 | 17/25 | 8/10 |
| Medium (KD 15-40) | 80 | 32/40 | 20/25 | 9/10 |
| High/YMYL (KD >40) | 88 | 36/40 | 23/25 | 10/10 |

### 5.5 Hard Gates (P1 - Fix Immediately)

1. **CWV "Poor"** on any metric → caps score at 75
2. **`noindex`** or robots.txt block → emergency fix
3. **No author signal** on YMYL content → block publication
4. **Content quality <13/25** → do not publish
5. **Entity coverage <60%** → revise before publish

---

## Appendix A: Quick Reference Numbers

| Element | Specification |
|---------|---------------|
| Title tag | 50-60 chars / <=575 px |
| Meta description | 140-160 chars (120 mobile) |
| H1 | 40-70 chars, exactly 1 per page |
| Extractive answer | 30-40 words after each H2 |
| Keyword in first X words | 100 words |
| Internal links per article | 3-10 contextual |
| Peak internal link zone | 40-44 links to URL |
| LCP | <=2.5s (poor >4.0s) |
| INP | <=200ms (poor >500ms) |
| CLS | <=0.1 (poor >0.25) |
| Click depth | <=3 from homepage |
| Content refresh | Every 6 months minimum |
| Topical cluster size | 15-25 spokes for authority |

---

## Appendix B: Deprecated/Retired Features (2024-2026)

| Feature | Status | Date |
|---------|--------|------|
| HowTo schema | Fully deprecated | Sep 13, 2023 |
| FAQPage schema | Restricted to gov/health | Aug 8, 2023 |
| FID metric | Replaced by INP | Mar 12, 2024 |
| Desktop-first indexing | Fully retired | Jul 5, 2024 |
| Sitelinks SearchBox | Deprecated | Nov 21, 2024 |
| BreadcrumbList (mobile) | Visually removed (still recommended) | Jan 2025 |
| Course Info schema | Retired | Jun 12, 2025 |

---

## Appendix C: Internal Linking Automation

> **Full Design:** `.planning/design/internal-linking-automation-system.md`

### C.1 Why Internal Linking Matters

**Zyppy 23M Links Study Findings:**

| Internal Links to URL | Traffic Impact |
|-----------------------|----------------|
| 0-4 links | Baseline |
| **40-44 links** | **4x more traffic** (peak zone) |
| 45-50+ links | Effect reverses |
| **≥1 exact-match anchor** | **5x more traffic** |

### C.2 System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    INTERNAL LINKING AUTOMATION ENGINE                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PHASE 1           PHASE 2            PHASE 3           PHASE 4             │
│  ─────────         ─────────          ─────────         ─────────           │
│  Graph Build       Opportunity        Suggestion        Execution           │
│                    Detection          Generation                            │
│                                                                              │
│  ┌──────────┐     ┌──────────┐      ┌──────────┐      ┌──────────┐         │
│  │  Crawl   │────▶│ Analyze  │─────▶│ Generate │─────▶│ Auto-Fix │         │
│  │  Links   │     │  Gaps    │      │ Targets  │      │ or Flag  │         │
│  └──────────┘     └──────────┘      └──────────┘      └──────────┘         │
│       │                │                 │                 │                │
│       ▼                ▼                 ▼                 ▼                │
│  link_graph       link_opps        link_suggest      site_changes          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### C.3 Data Model

```typescript
// Core tables
linkGraph: {
  sourceUrl, targetUrl, anchorText, anchorTextLower,
  position: 'body' | 'nav' | 'sidebar' | 'footer',
  paragraphIndex, isFirstParagraph, isDoFollow,
  isExactMatch, isBranded, isUrl
}

pageLinks: {
  pageUrl, inboundTotal, inboundBody, inboundExactMatch,
  outboundTotal, clickDepthFromHome, linkScore, opportunityScore
}

orphanPages: {
  pageUrl, discoverySource, monthlyTraffic, status
}

keywordCannibalization: {
  keyword, competingPages[], severity, recommendedPrimary
}
```

### C.4 Opportunity Detection (Token-Free)

All detection is rule-based — **zero AI tokens required**:

| Detection Type | Method | When to Trigger |
|----------------|--------|-----------------|
| **Orphan rescue** | `inboundTotal = 0` | Critical priority |
| **Keyword mention** | Text search: keyword in content, no link exists | High priority |
| **Link velocity** | `inboundTotal < 40` | Medium priority |
| **Missing exact-match** | `inboundExactMatch = 0` | High priority |
| **Click depth violation** | BFS from homepage, depth > 3 | Medium priority |
| **Anchor diversity** | Distribution skewed from 50/25/25 target | Low priority |

```typescript
// Example: Keyword mention detection (no AI)
async function detectKeywordMentionOpportunities(auditId: string) {
  for (const sourcePage of allPages) {
    const content = await getPageTextContent(sourcePage.url);
    const contentLower = content.toLowerCase();
    
    for (const [keyword, targets] of keywordTargets) {
      // Skip if this page is the target
      if (targets.some(t => t.url === sourcePage.url)) continue;
      
      // Check if keyword appears in content
      if (!contentLower.includes(keyword)) continue;
      
      // Check if already linked
      const existingLink = await checkExistingLink(sourcePage.url, targets);
      if (existingLink) continue;
      
      // Found opportunity! Keyword mentioned but not linked
      await createOpportunity({
        sourceUrl: sourcePage.url,
        targetUrl: targets[0].url,
        opportunityType: 'keyword_match',
        relevanceScore: 0.9,
      });
    }
  }
}
```

### C.5 Target Selection Algorithm

```typescript
function rankLinkTargets(sourceUrl: string): TargetCandidate[] {
  const candidates = [];
  
  for (const page of allPages) {
    if (alreadyLinked(sourceUrl, page.url)) continue;
    
    let score = 0;
    const reasons = [];
    
    // Factor 1: Needs links (25% weight)
    const linkDeficit = Math.max(0, 40 - page.inboundTotal);
    score += (linkDeficit / 40) * 0.25;
    if (linkDeficit > 30) reasons.push(`Needs ${linkDeficit} more links`);
    
    // Factor 2: Missing exact-match anchor (20% weight)
    if (page.inboundExactMatch === 0) {
      score += 0.2;
      reasons.push('Missing exact-match anchor');
    }
    
    // Factor 3: Orphan page (30% weight)
    if (page.inboundTotal === 0) {
      score += 0.3;
      reasons.push('Orphan page');
    }
    
    // Factor 4: High click depth (15% weight)
    if (page.clickDepthFromHome > 3) {
      score += 0.15;
      reasons.push(`Click depth: ${page.clickDepthFromHome}`);
    }
    
    // Factor 5: Topical relevance (20% weight)
    const overlap = computeKeywordOverlap(sourceKeywords, page.keywords);
    score += overlap * 0.2;
    
    candidates.push({ page, score, reasons });
  }
  
  return candidates.sort((a, b) => b.score - a.score);
}
```

### C.6 Anchor Text Selection

**Target Distribution:** 50% exact-match / 25% branded / 25% misc

```typescript
function selectAnchorText(options: AnchorOptions): AnchorResult {
  const { targetKeyword, brandName, currentDistribution, sourceContent } = options;
  
  // Calculate what type we need more of
  const total = sum(Object.values(currentDistribution));
  const currentExactRatio = total > 0 ? currentDistribution.exactMatch / total : 0;
  
  let preferredType: 'exact_match' | 'branded' | 'misc';
  if (currentExactRatio < 0.5 && targetKeyword) {
    preferredType = 'exact_match';
  } else if (currentDistribution.branded / total < 0.25) {
    preferredType = 'branded';
  } else {
    preferredType = 'misc';
  }
  
  // Try to find preferred anchor in existing content
  const contentLower = sourceContent.toLowerCase();
  
  if (preferredType === 'exact_match' && targetKeyword) {
    if (contentLower.includes(targetKeyword.toLowerCase())) {
      return { text: targetKeyword, type: 'exact_match', confidence: 0.95 };
    }
  }
  
  if (preferredType === 'branded' && brandName) {
    if (contentLower.includes(brandName.toLowerCase())) {
      return { text: brandName, type: 'branded', confidence: 0.9 };
    }
  }
  
  // Fallback to title-based anchor
  return { text: targetTitle.slice(0, 50), type: 'misc', confidence: 0.6 };
}
```

### C.7 Auto-Fix Rules

**Safe to auto-insert when ALL conditions met:**

| Condition | Requirement |
|-----------|-------------|
| Insertion method | `wrap_existing` only (no new content) |
| Confidence | ≥ 85% |
| Anchor exists in content | Yes (already there, just wrap with link) |
| Target indexable | Yes |
| Target not cannibalized | Not competing for same keyword |
| Source page total links | < 10 |
| Links in same paragraph | < 3 |
| User setting | Auto-linking enabled |

**Flag for human review:**

| Situation | Reason |
|-----------|--------|
| Insert new sentence | Changes content significantly |
| Low confidence (<85%) | Uncertain suggestion |
| First paragraph placement | High-value, needs review |
| Cross-category link | May not be relevant |
| Cannibalization risk | Could worsen SEO |

### C.8 Link Velocity Control

```typescript
const LINK_VELOCITY_LIMITS = {
  // Per-page limits
  maxNewLinksPerPage: 3,        // Per day
  maxTotalLinksPerPage: 10,     // Ever
  maxLinksPerParagraph: 2,
  
  // Per-site limits
  maxNewLinksPerDay: 50,
  maxNewLinksPerWeek: 200,
  
  // Timing
  minDaysBetweenPageEdits: 7,
  maxPagesEditedPerDay: 20,
};

async function checkLinkVelocity(clientId: string, sourceUrl: string): Promise<boolean> {
  const pageLinksToday = await countLinksAddedToday(sourceUrl);
  if (pageLinksToday >= LINK_VELOCITY_LIMITS.maxNewLinksPerPage) {
    return false; // Page at daily limit
  }
  
  const siteLinksToday = await countSiteLinksToday(clientId);
  if (siteLinksToday >= LINK_VELOCITY_LIMITS.maxNewLinksPerDay) {
    return false; // Site at daily limit
  }
  
  return true;
}
```

### C.9 Cannibalization Detection

```typescript
async function detectCannibalization(clientId: string): Promise<void> {
  // Get keyword -> page mappings from GSC
  const keywordPages = await getGSCKeywordPages(clientId);
  
  // Group by keyword
  const groups = groupBy(keywordPages, 'keyword');
  
  for (const [keyword, pages] of groups) {
    if (pages.length < 2) continue;
    
    // Multiple pages ranking = potential cannibalization
    const competing = pages.filter(p => p.position <= 100);
    if (competing.length < 2) continue;
    
    // Determine severity by position gap
    const positionDiff = competing[1].position - competing[0].position;
    const severity = 
      positionDiff < 5 ? 'critical' :
      positionDiff < 10 ? 'high' :
      positionDiff < 20 ? 'medium' : 'low';
    
    // Recommend primary (most clicks)
    const recommended = maxBy(competing, 'clicks');
    
    await saveCannibalization({ keyword, competing, severity, recommended });
  }
}
```

### C.10 Token Efficiency

| Operation | Method | Token Cost |
|-----------|--------|------------|
| Link graph building | Cheerio HTML parsing | **0** |
| Click depth analysis | BFS algorithm | **0** |
| Orphan detection | SQL query | **0** |
| Keyword mention scan | Text search | **0** |
| Anchor text selection | Rule-based | **0** |
| Cannibalization detection | GSC data analysis | **0** |
| Velocity tracking | SQL queries | **0** |
| **Optional: Natural sentence generation** | AI | ~500/month |
| **Optional: Dashboard summaries** | AI | ~2,000/month |

**Total: 99%+ of operations are token-free.**

### C.11 Integration with Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AUTONOMOUS SEO PIPELINE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Phase 2: Site Discovery                                                     │
│  └─> Link graph built from crawl data                                       │
│                                                                              │
│  Phase 4: Auto-Fix Pages                                                     │
│  └─> Internal link opportunities detected                                    │
│  └─> Safe links auto-inserted (wrap_existing, confidence ≥85%)              │
│  └─> Complex suggestions flagged for review                                  │
│                                                                              │
│  Phase 5: Content Publishing                                                 │
│  └─> New content includes 3-10 internal links                               │
│  └─> At least 1 exact-match anchor required                                 │
│  └─> Orphan pages prioritized as link targets                               │
│                                                                              │
│  Daily Loop                                                                  │
│  └─> Check for new orphan pages                                             │
│  └─> Apply queued link suggestions (respecting velocity limits)             │
│                                                                              │
│  Weekly Loop                                                                 │
│  └─> Full link graph rebuild                                                │
│  └─> Cannibalization re-check                                               │
│  └─> Click depth audit                                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### C.12 Success Metrics

| Metric | Target | Frequency |
|--------|--------|-----------|
| Orphan pages | 0 | Weekly |
| Avg inbound links/page | 40-44 | After each audit |
| Pages with exact-match anchor | 100% | After each audit |
| Max click depth | ≤3 | After each audit |
| Link suggestions accepted | >80% | Ongoing |
| Auto-fix success rate | >95% | Ongoing |
| Traffic increase (linked pages) | +20% | 30-day comparison |
