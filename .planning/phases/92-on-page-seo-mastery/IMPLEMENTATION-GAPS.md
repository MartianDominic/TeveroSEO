# Phase 92 Implementation Gaps vs SEO-AGI Spec

**Audit Date:** 2026-05-07  
**Spec Source:** `seobuild-onpage.md` (v1.7.0, 890 lines)  
**Auditors:** 5 Opus subagents with full codebase access

---

## Executive Summary

Phase 92 "On-Page SEO Mastery" implemented a **content auditing system** with 30 universal rules, 34 vertical-specific rules, and 7 quality gates. However, the SEO-AGI spec describes a **content generation verification system** with fundamentally different goals.

| Aspect | SEO-AGI Spec | Phase 92 Implementation |
|--------|--------------|------------------------|
| **Primary Purpose** | Verify generated content before delivery | Audit existing pages for SEO issues |
| **Scorecard** | 41-point output checklist | 30 universal + 34 vertical SEO rules |
| **Research** | Python scripts (research.py, gsc_pull.py) | TypeScript services, DataForSEO REST |
| **Off-Page** | Tributary Trust Protocol (Tier 1 assets) | Not in scope |
| **Content Types** | Listicles, comparisons, local service, airport | Business verticals (healthcare, legal, etc.) |

**Implementation Coverage:** ~40% of spec requirements

---

## 1. Quality Gates & Audit Filters

### 1.1 Reddit Test (Section 5A)

**Status:** PARTIAL  
**Location:** `QualityGateService.ts:209-297`

**Spec Requires 6 Specific Criteria (pass 3+):**
1. Hard number from official/overlooked source (capacity, square footage, wait time, frequency, volume)
2. Layout/navigation detail only someone familiar with the place would know
3. Cost comparison with real math (break-even calculation)
4. Schedule/operational detail with specifics (shuttle runs every X minutes; lot fills by Y time)
5. "The thing they moved/changed/broke" detail — something that changed recently
6. Real gotcha or failure mode with enough specificity that a reader thinks "that happened to me"

**What's Implemented:**
```typescript
// Generic LLM prompt in QualityGateService.ts
"Specific examples, numbers, or case studies; Domain expertise signals; 
Avoids generic advice; Includes contrarian or nuanced takes; Not AI-generated slop"
```

**Gap:** The prompt is generic. It does NOT enumerate the 6 specific criteria. A passing score could be achieved without any of the spec's requirements.

**Fix Required:**
```typescript
const REDDIT_TEST_CRITERIA = [
  { id: 'hard_number', pattern: /\d+\s*(sq\.?\s*ft|square feet|capacity|spaces|minute|hour|day|year|percent|%)/i },
  { id: 'layout_detail', keywords: ['terminal', 'gate', 'entrance', 'exit', 'floor', 'level', 'section'] },
  { id: 'cost_math', pattern: /\$\d+.*\$\d+|break.?even|cost.*\d+.*day|per day.*\$|total.*\$/i },
  { id: 'schedule_detail', pattern: /every\s+\d+\s*min|runs\s+(at|every)|fills\s+(by|at)\s+\d/i },
  { id: 'recent_change', keywords: ['recently', 'changed', 'moved', 'new', 'updated', 'as of', '2025', '2026'] },
  { id: 'gotcha', keywords: ['warning', 'careful', 'gotcha', 'mistake', 'learned', 'avoid', 'tip'] }
];
// Must pass 3+ of 6
```

---

### 1.2 Information Gain Test (Section 5D)

**Status:** IMPLEMENTED  
**Location:** `QualityGateService.ts:392-439`

**What's Implemented:**
- Embedding similarity comparison against SERP content
- Requires >= 40% uniqueness to pass
- Method: `evaluateInformationGain(content, serpContent[])`

**Gap:** Requires SERP content to be passed in externally. No automatic fetching.

---

### 1.3 Prove-It Details (Section 5B)

**Status:** PARTIAL  
**Location:** `QualityGateService.ts:454-492`

**Spec Requires 2+ Hard Operational Facts:**
- Capacity, frequency, fill rate, wait time, or distance measurements
- Break-even cost math showing when one option beats another
- Layout/navigation details that help someone who has never been there
- A recent change not yet reflected on most competing pages

**What's Implemented:**
```typescript
// Generic evidence patterns
const EVIDENCE_PATTERNS = [
  /\d+%/,           // percentages
  /\d{4}/,          // years
  /according to/i,  // citations
  /study|research/i // research mentions
];
```

**Gap:** Counts ANY number/percentage, not specifically operational facts. "Founded in 1995" passes but isn't a prove-it detail.

**Fix Required:**
```typescript
const OPERATIONAL_FACT_PATTERNS = [
  { type: 'capacity', pattern: /(\d+)\s*(spaces?|spots?|seats?|capacity|people|vehicles)/i },
  { type: 'frequency', pattern: /(every|each)\s*(\d+)\s*(minutes?|hours?)/i },
  { type: 'wait_time', pattern: /(\d+)\s*(minute|hour)\s*(wait|delay|queue)/i },
  { type: 'distance', pattern: /(\d+\.?\d*)\s*(miles?|km|feet|meters?|yards?)\s*(from|to|away)/i },
  { type: 'fill_rate', pattern: /(fills?|full|sold out)\s*(by|at|around)\s*(\d+|noon|midnight)/i },
  { type: 'cost_math', pattern: /\$\d+.*=.*\$\d+|\$\d+.*vs\.?\s*\$\d+/i }
];
// Must have 2+ distinct types
```

---

### 1.4 "Not For You" Block (Section 5C)

**Status:** IMPLEMENTED  
**Location:** `QualityGateService.ts:581-602`

**What's Implemented:**
- Pattern matching for "not for", "who this is for", "if you're looking for"
- Returns 100 if present, 70 if missing
- Always passes (bonus, not requirement)

**Gap:** Should be a hard requirement for commercial intent pages, not optional.

---

### 1.5 QDD Vulnerability Check (Section 5E)

**Status:** WRONG INTERPRETATION  
**Location:** `QualityGateService.ts:617-661`

**Spec Defines QDD as Opportunity Signal:**
> "If the top 10 results include UGC platforms (Instagram, Pinterest, Reddit, TikTok, Quora, YouTube)... Flag as: `QDD_SIGNAL: HIGH_CONFIDENCE_TAKEOVER`"

**What's Implemented:**
- Checks if content is too SIMILAR to SERP results (vulnerability)
- Flags content as vulnerable if > 90% similar

**Gap:** Completely different concept. Spec uses QDD to find OPPORTUNITIES (UGC in SERP = weak niche). Implementation checks for me-too content risk.

**Fix Required:**
```typescript
const UGC_DOMAINS = [
  'reddit.com', 'instagram.com', 'pinterest.com', 'tiktok.com',
  'quora.com', 'youtube.com', 'twitter.com', 'x.com', 'medium.com'
];

function detectQDDOpportunity(serpResults: SerpResult[]): QDDSignal {
  const ugcCount = serpResults.filter(r => 
    UGC_DOMAINS.some(domain => r.url.includes(domain))
  ).length;
  
  if (ugcCount >= 2) {
    return { signal: 'HIGH_CONFIDENCE_TAKEOVER', ugcCount, reason: 'UGC in top 10 indicates no authority page exists' };
  }
  return { signal: 'STANDARD', ugcCount };
}
```

---

### 1.6 41-Point Quality Scorecard (Section 14)

**Status:** NOT IMPLEMENTED  
**Location:** N/A

**Spec's 41-Point Checklist (for content generation verification):**

| # | Check | Phase 92 |
|---|-------|----------|
| 1 | Information gain over top 10 Google results? | ✅ T5-02 |
| 2 | Would a knowledgeable Reddit commenter upvote this? | ⚠️ Generic |
| 3 | Core answer in first 150 words? | ❌ |
| 4 | Fast-scan summary within first 200 words? | ❌ |
| 5 | 2+ hard operational Prove-It facts? | ⚠️ Generic evidence |
| 6 | At least one real HTML table (not bullet lists)? | ✅ R-16 |
| 7 | Every section doing a unique job (no repetition)? | ❌ |
| 8 | All specific numbers tagged with `{{VERIFY}}`? | ❌ |
| 9 | All citations specific and traceable? | ❌ |
| 10 | "Not For You" block present? | ✅ T5-04 |
| 11 | Content structured for LLM extraction (500-token chunks)? | ⚠️ Chunking exists |
| 12 | No banned phrases or patterns? | ❌ |
| 13 | Word count within competitive range? | ✅ R-10 |
| 14 | JSON-LD schema block included and matches page type? | ✅ R-23 |
| 15 | FAQ section with 3+ PAA questions answered? | ❌ |
| 16 | Hub/spoke internal links included? | ❌ |
| 17 | Title tag <60 chars with target keyword? | ✅ R-01, R-02 |
| 18 | Meta description <155 chars with value prop? | ✅ R-03 |
| 19 | Content inside site's core topical circle? | ❌ |
| 20 | `reddit_test` and `information_gain` in frontmatter? | ❌ |
| 21 | Single H1 tag only (no multiple H1s)? | ✅ R-04 |
| 22 | No exact-match keyword in meta description? | ❌ |
| 23 | No exact-match keyword stuffed in H2/H3/H4 tags? | ❌ |
| 24 | Image alt text descriptive, not keyword-stuffed? | ✅ R-14 |
| 25 | AI Summary Nugget (200-char) present at top? | ❌ |
| 26 | Original Research / Data Experiment block? | ❌ |
| 27 | Map-to-informational internal link (local)? | ❌ |
| 28 | Every claim validated against 2+ sources? | ❌ |
| 29 | Geographic specificity (neighborhoods, landmarks)? | ❌ |
| 30 | Core answer in first 3 chunks (click satisfaction)? | ❌ |
| 31 | Interactive element or tool (AI Overview defense)? | ❌ |
| 32 | No banned 2026 content patterns? | ❌ |
| 33 | Minimum 1,500 words substantive content? | ⚠️ R-10 checks min |
| 34 | FHASS compliance if applicable? | ⚠️ YMYL only |
| 35 | QDD check run — UGC flagged or cleared? | ❌ Wrong impl |
| 36 | Site vs Page audit — competitor type identified? | ❌ |
| 37 | Forensic EMQ ratio checked? | ❌ |
| 38 | Each chunk targets distinct QFO facet? | ❌ |
| 39 | ICP defined and content tailored? | ❌ |
| 40 | Deep entity history / identity tags? | ❌ |
| 41 | No keyword cannibalization with existing URLs? | ❌ |

**Coverage:** 12/41 (29%)

---

### 1.7 Entity Consensus Validation (Section 13, Step 8)

**Status:** NOT FOUND

**Spec Requires:**
> "Before finalizing, validate every factual claim against at least two other high-ranking sources for the same topic."

**Fix Required:**
```typescript
interface FactClaim {
  text: string;
  sources: string[];
  confidence: 'verified' | 'single_source' | 'unverified';
}

async function validateEntityConsensus(claims: FactClaim[], serpContent: string[]): Promise<ConsensusReport> {
  // For each claim, check if it appears in 2+ SERP sources
  // Flag unique claims as SOURCE_NEEDED unless they're original research
}
```

---

### 1.8 Forensic EMQ Check (Section 7)

**Status:** NOT FOUND

**Spec Requires:**
> "If 2 out of 3 contain the exact target keyword verbatim in H1: flag as `EMQ_REQUIRED: true`"

**Fix Required:**
```typescript
function checkCompetitorEMQ(serpResults: SerpResult[], targetKeyword: string): EMQFlag {
  const top3H1s = serpResults.slice(0, 3).map(r => r.h1);
  const emqCount = top3H1s.filter(h1 => 
    h1.toLowerCase().includes(targetKeyword.toLowerCase())
  ).length;
  
  return {
    emq_required: emqCount >= 2,
    emq_count: emqCount,
    top3_h1s: top3H1s
  };
}
```

---

## 2. Schema & Technical Markup

### 2.1 Required Schema Per Page Type

| Schema Type | Spec Section | Status | Location |
|-------------|--------------|--------|----------|
| FAQPage | §6 | ❌ NOT FOUND | No generator |
| HowTo | §6 | ❌ NOT FOUND | No generator |
| Product/Offer | §6 | ✅ IMPLEMENTED | SchemaGenerator.ts:167-203 |
| LocalBusiness | §6 | ✅ IMPLEMENTED | SchemaGenerator.ts:211-249 |
| BreadcrumbList | §6 | ⚠️ PARTIAL | Detection only, no generator |

**Fix Required:**
```typescript
// Add to SchemaGenerator.ts

export function generateFAQPageSchema(faqs: FAQ[]): string {
  const schema: WithContext<FAQPage> = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(faq => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer
      }
    }))
  };
  return JSON.stringify(schema, null, 2);
}

export function generateHowToSchema(steps: HowToStep[]): string {
  const schema: WithContext<HowTo> = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    step: steps.map((step, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: step.name,
      text: step.text,
      image: step.image
    }))
  };
  return JSON.stringify(schema, null, 2);
}

export function generateBreadcrumbSchema(items: BreadcrumbItem[]): string {
  const schema: WithContext<BreadcrumbList> = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url
    }))
  };
  return JSON.stringify(schema, null, 2);
}
```

---

### 2.2 RDFa / Microdata Inline Markup

**Status:** NOT FOUND

**Spec Requires (Section 6):**
> "Embed semantic data directly inline using RDFa or Microdata (`<span>` tags). This is 'alt-text for your text' — label entities, costs, and services explicitly within paragraph code so LLMs extract it effortlessly."

**Fix Required:**
```typescript
// New file: utils/RDFaGenerator.ts

export function wrapWithRDFa(text: string, type: RDFaType, properties: Record<string, string>): string {
  const propsStr = Object.entries(properties)
    .map(([key, value]) => `property="${value}"`)
    .join(' ');
  
  return `<span vocab="https://schema.org/" typeof="${type}" ${propsStr}>${text}</span>`;
}

// Usage:
// wrapWithRDFa("$45/day", "Offer", { price: "45", priceCurrency: "USD" })
// → <span vocab="https://schema.org/" typeof="Offer" property="price">$45/day</span>
```

---

### 2.3 AI Summary Nugget

**Status:** NOT FOUND

**Spec Requires (Section 8):**
> "Every page must open with a 200-character (max) fact-dense summary block designed for LLM scrapers to cite as a consensus source."

**Example from spec:**
```html
<div class="ai-summary">
FLL airport parking: $20/day long-term, $36/day short-term, $10/day overflow (peak only). 
Off-site lots start at ~$6/day with shuttle. Rates effective Nov 2024.
</div>
```

**Fix Required:**
```typescript
// New rule in universal.ts

{
  id: "R-31",
  name: "AI Summary Nugget",
  description: "Page has AI-extractable summary in first 200 chars",
  category: "content",
  weight: 8,
  evaluate: (ctx) => {
    const aiSummary = ctx.$('.ai-summary, [data-ai-summary], .tldr, .summary').first();
    if (aiSummary.length > 0) {
      const text = aiSummary.text().trim();
      if (text.length <= 200 && /\d/.test(text)) { // Has numbers
        return { score: 100, details: `AI summary found: ${text.substring(0, 50)}...` };
      }
    }
    return { score: 0, details: "No AI summary nugget found" };
  }
}
```

---

## 3. 500-Token Chunk Architecture

### 3.1 Implemented Features

| Feature | Status | Location |
|---------|--------|----------|
| Token counting (cl100k_base) | ✅ | ChunkExtractor.ts:66-74 |
| Token score [400-600] | ✅ | ChunkExtractor.ts:190-207 |
| Chunk position tracking | ✅ | ChunkExtractor.ts:340,359 |
| Parent heading association | ✅ | ChunkExtractor.ts:353-357 |
| Self-containment (dangling refs) | ⚠️ | ChunkExtractor.ts:216-235 |
| Heading alignment score | ✅ | ChunkExtractor.ts:245-280 |
| Fact density | ⚠️ STUB | Returns 0 |

### 3.2 Missing Features

#### Question-Based H2 Validation

**Spec Requires:**
> "Every H2 must match a real search query or a 'Query Fan-Out' question"

**Fix Required:**
```typescript
const QUESTION_PATTERNS = [
  /^(what|how|why|when|where|who|which|can|does|is|are|should|will|do)\s/i,
  /\?$/,
  /^(best|top|guide|tips|ways|steps|how to)/i
];

function isQuestionBasedH2(h2Text: string, paaQuestions?: string[]): boolean {
  // Check if H2 matches question pattern
  if (QUESTION_PATTERNS.some(p => p.test(h2Text))) return true;
  
  // Check if H2 matches any PAA question
  if (paaQuestions?.some(q => 
    similarity(h2Text.toLowerCase(), q.toLowerCase()) > 0.7
  )) return true;
  
  return false;
}
```

#### Snippet Answer Detection

**Spec Requires:**
> "The first 2-3 sentences immediately following any H2 must be a direct, concrete answer to that heading. No preamble. No definitions."

**Fix Required:**
```typescript
const PREAMBLE_PATTERNS = [
  /^(in today's|when it comes to|as we all know|it's important to)/i,
  /^(the term|by definition|according to the dictionary)/i,
  /^(many people|some experts|studies show that)/i  // vague
];

function hasSnippetAnswer(postH2Text: string): SnippetAnalysis {
  const sentences = postH2Text.split(/[.!?]+/).slice(0, 3);
  const firstSentence = sentences[0]?.trim() || '';
  
  // Check for preamble
  if (PREAMBLE_PATTERNS.some(p => p.test(firstSentence))) {
    return { hasSnippet: false, reason: 'Starts with preamble' };
  }
  
  // Check for concrete answer signals
  const hasNumbers = /\d/.test(firstSentence);
  const hasSpecifics = /(is|are|costs?|takes?|requires?)\s+\w+/.test(firstSentence);
  
  return {
    hasSnippet: hasNumbers || hasSpecifics,
    reason: hasNumbers ? 'Contains specific numbers' : 'Needs more specificity'
  };
}
```

#### Contrast Statement Detection (X vs Y)

**Spec Requires:**
> "Within the chunk, include explicit X vs. Y comparisons with numbers"

**Fix Required:**
```typescript
const CONTRAST_PATTERNS = [
  /(\$\d+).*(?:vs\.?|versus|compared to|while|but|whereas).*(\$\d+)/i,
  /(\d+\s*(?:min|hour|day|mile)).*(?:vs\.?|versus|compared to).*(\d+\s*(?:min|hour|day|mile))/i,
  /(option \w+|choice \w+).*(?:vs\.?|costs?|takes?).*(\d+)/i
];

function hasContrastStatement(chunkText: string): ContrastAnalysis {
  for (const pattern of CONTRAST_PATTERNS) {
    const match = chunkText.match(pattern);
    if (match) {
      return { hasContrast: true, comparison: match[0] };
    }
  }
  return { hasContrast: false };
}
```

#### QFO Facet Labeling

**Spec Requires:**
> "Each 500-token chunk must function as a standalone answer to a specific sub-query... design each chunk with a mental 'facet label': this chunk answers 'What does it cost?', this chunk answers 'How far is the shuttle?'"

**Fix Required:**
```typescript
const QFO_FACETS = [
  { id: 'cost', patterns: [/cost|price|\$|pay|fee|rate/i], question: 'What does it cost?' },
  { id: 'time', patterns: [/how long|duration|takes?\s+\d|minutes?|hours?/i], question: 'How long does it take?' },
  { id: 'location', patterns: [/where|located|address|terminal|gate|entrance/i], question: 'Where is it?' },
  { id: 'schedule', patterns: [/when|hours|open|close|runs?|every\s+\d/i], question: 'When is it available?' },
  { id: 'process', patterns: [/how to|steps?|process|book|reserve|sign up/i], question: 'How do I do it?' },
  { id: 'comparison', patterns: [/vs\.?|versus|better|worse|compared|difference/i], question: 'How does it compare?' },
  { id: 'requirements', patterns: [/need|require|must|should|eligible/i], question: 'What do I need?' },
  { id: 'warnings', patterns: [/avoid|careful|warning|don't|mistake|gotcha/i], question: 'What should I avoid?' }
];

function labelChunkFacet(chunkText: string): FacetLabel {
  const scores = QFO_FACETS.map(facet => ({
    facet,
    score: facet.patterns.filter(p => p.test(chunkText)).length
  }));
  
  const best = scores.sort((a, b) => b.score - a.score)[0];
  if (best.score > 0) {
    return { facetId: best.facet.id, question: best.facet.question, confidence: best.score };
  }
  return { facetId: 'general', question: 'General information', confidence: 0 };
}
```

#### Table Boundary Detection

**Spec Requires:**
> "Never split a data table across chunk boundaries"

**Fix Required:**
```typescript
function validateTableBoundaries($: CheerioAPI, chunks: SemanticChunk[]): TableBoundaryViolation[] {
  const violations: TableBoundaryViolation[] = [];
  
  $('table').each((i, table) => {
    const tableText = $(table).text();
    const tableStart = /* find position in full text */;
    const tableEnd = tableStart + tableText.length;
    
    // Check if table spans multiple chunks
    const containingChunks = chunks.filter(chunk => 
      chunk.startOffset < tableEnd && chunk.endOffset > tableStart
    );
    
    if (containingChunks.length > 1) {
      violations.push({
        tableIndex: i,
        spansChunks: containingChunks.map(c => c.id),
        severity: 'high'
      });
    }
  });
  
  return violations;
}
```

---

## 4. Vertical-Specific Rules

### 4.1 Implemented Verticals

| Vertical | Rules | Status |
|----------|-------|--------|
| Healthcare | 7 | ✅ IMPLEMENTED |
| Legal | 6 | ✅ IMPLEMENTED |
| Financial | 6 | ✅ IMPLEMENTED |
| Ecommerce | 8 | ✅ IMPLEMENTED |
| SaaS | 7 | ✅ IMPLEMENTED |
| Real Estate | 0 | ⚠️ Declared, empty |
| Home Services | 0 | ⚠️ Declared, empty |
| Hospitality | 0 | ⚠️ Declared, empty |
| Education | 0 | ⚠️ Declared, empty |
| Professional | 0 | ⚠️ Declared, empty |
| Manufacturing | 0 | ⚠️ Declared, empty |
| Nonprofit | 0 | ⚠️ Declared, empty |
| General | 0 | ⚠️ Declared, empty |

### 4.2 Missing Content-Type Verticals

The spec defines rules by **content type**, not business vertical:

| Content Type | Spec Section | Status |
|--------------|--------------|--------|
| Airport/Parking/Transportation | §10 | ❌ NOT FOUND |
| Local Service Pages | §10 | ❌ NOT FOUND |
| Listicles | §10 | ❌ NOT FOUND |
| Comparison/Pricing Pages | §10 | ❌ NOT FOUND |
| GBP/Ask Maps Optimization | §10 | ❌ NOT FOUND |

#### Airport/Transportation Rules (from spec)

```typescript
// rules/transportation.ts

export const TRANSPORTATION_RULES: RuleDefinition[] = [
  {
    id: "V-TRANS-01",
    name: "Terminal-to-facility mapping",
    description: "Lists which airlines operate from which terminals and best parking options",
    evaluate: (ctx) => {
      const hasTerminalInfo = /terminal\s*\d|concourse\s*[a-z]/i.test(ctx.text);
      const hasAirlineMapping = /(delta|united|american|southwest).*terminal/i.test(ctx.text);
      return { score: (hasTerminalInfo && hasAirlineMapping) ? 100 : 0 };
    }
  },
  {
    id: "V-TRANS-02", 
    name: "Capacity/availability context",
    description: "Mentions parking capacity, fill rates, or availability",
    evaluate: (ctx) => {
      const hasCapacity = /(\d+)\s*(spaces?|spots?|capacity)/i.test(ctx.text);
      const hasFillRate = /(fills?|full|sold out)\s*(by|at|around)/i.test(ctx.text);
      return { score: (hasCapacity || hasFillRate) ? 100 : 50 };
    }
  },
  {
    id: "V-TRANS-03",
    name: "Rideshare/transit break-even math",
    description: "Calculates when parking beats Uber/transit",
    evaluate: (ctx) => {
      const hasBreakEven = /break.?even|(\d+)\s*days?.*\$|uber.*\$\d+|\$\d+.*uber/i.test(ctx.text);
      return { score: hasBreakEven ? 100 : 0 };
    }
  },
  {
    id: "V-TRANS-04",
    name: "Shuttle operational details",
    description: "Frequency, hours, and reliability of shuttle service",
    evaluate: (ctx) => {
      const hasShuttleFreq = /shuttle.*every\s*\d+|every\s*\d+.*shuttle/i.test(ctx.text);
      const hasShuttleHours = /shuttle.*(hours|open|close|\d+\s*(am|pm))/i.test(ctx.text);
      return { score: (hasShuttleFreq || hasShuttleHours) ? 100 : 0 };
    }
  },
  {
    id: "V-TRANS-05",
    name: "Peak-day warnings",
    description: "Names specific days or events that cause fill-ups",
    evaluate: (ctx) => {
      const hasPeakWarning = /(thanksgiving|christmas|cruise ship|game day|concert|holiday)/i.test(ctx.text);
      const hasSpecificDay = /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?\s*(fill|busy|crowded)/i.test(ctx.text);
      return { score: (hasPeakWarning || hasSpecificDay) ? 100 : 0 };
    }
  }
];
```

#### Listicle Rules (from spec)

```typescript
// rules/listicle.ts

export const LISTICLE_RULES: RuleDefinition[] = [
  {
    id: "V-LIST-01",
    name: "Items substantively different",
    description: "Each listicle item has unique differentiating content",
    evaluate: (ctx) => {
      // Extract list items, compare similarity
      const items = ctx.$('h2, h3').map((_, el) => ctx.$(el).next('p').text()).get();
      // Check pairwise similarity < 0.7
    }
  },
  {
    id: "V-LIST-02",
    name: "Item format complete",
    description: "Each item has: name, best for, why listed, differentiator, tradeoff",
    evaluate: (ctx) => {
      const hasFormat = /best for|why|differentiator|tradeoff|downside/i.test(ctx.text);
      return { score: hasFormat ? 100 : 50 };
    }
  },
  {
    id: "V-LIST-03",
    name: "Strongest items first",
    description: "Best recommendations appear early in the list",
    evaluate: (ctx) => {
      // Check if "best" or "top pick" appears in first 30% of content
    }
  },
  {
    id: "V-LIST-04",
    name: "Large lists segmented",
    description: "Lists with 10+ items are grouped by category",
    evaluate: (ctx) => {
      const itemCount = ctx.$('h2, h3').length;
      const hasSegments = ctx.$('[class*="category"], [class*="segment"], h2:contains("Best")').length > 1;
      return { score: (itemCount < 10 || hasSegments) ? 100 : 50 };
    }
  }
];
```

---

## 5. Data Layer & Research Infrastructure

### 5.1 Research Scripts

| Script | Spec Section | Status |
|--------|--------------|--------|
| research.py | §0 | ❌ NOT FOUND |
| gsc_pull.py | §0 | ⚠️ TypeScript client exists |
| tributary_gen.py | §11A | ❌ NOT FOUND |

### 5.2 MCP Tool Integration

| Tool | Status |
|------|--------|
| Ahrefs MCP | ❌ CSV import only |
| SEMRush MCP | ❌ CSV import only |
| DataForSEO MCP | ⚠️ REST API, not MCP |

### 5.3 Tributary Trust Protocol (Section 11A)

**Status:** COMPLETELY UNIMPLEMENTED

The Tributary Trust Protocol is an off-page strategy for entity consensus:

1. **Tier 1 Assets** (must have 4+):
   - Google Sites
   - Google Sheets (published)
   - Medium articles
   - Custom Subreddit (moderated)
   - LinkedIn Articles

2. **Companion Content Rule:**
   - Each tributary covers 1-2 QFO facets in depth
   - Same entity names, numbers, citations
   - Links back to money page
   - Cross-links to other tributaries

3. **Sequencing:**
   - Tributaries publish BEFORE money page
   - Wait for 2+ tributaries to index
   - Then publish money page

**This is entirely out of scope for on-page auditing** but is a major component of the SEO-AGI spec.

---

## 6. Forensic SEO Protocols

### 6.1 Site vs Page Audit

**Status:** NOT FOUND

**Spec Requires:**
> "When research shows that 2 of the top 3 ranking URLs are from generalist domains with no dedicated topical silo, flag as: `NICHE_PIVOT_OPPORTUNITY: true`"

**Fix Required:**
```typescript
const GENERALIST_DOMAINS = [
  'forbes.com', 'nerdwallet.com', 'bankrate.com', 'ahrefs.com',
  'hubspot.com', 'investopedia.com', 'thebalance.com'
];

function detectNichePivot(serpResults: SerpResult[]): NichePivotSignal {
  const top3 = serpResults.slice(0, 3);
  const generalistCount = top3.filter(r => 
    GENERALIST_DOMAINS.some(d => r.url.includes(d))
  ).length;
  
  return {
    niche_pivot_opportunity: generalistCount >= 2,
    generalist_count: generalistCount,
    recommendation: generalistCount >= 2 
      ? 'Build hub + 5 spoke pages for site-level topicality'
      : 'Standard single-page approach'
  };
}
```

### 6.2 CVR Modeling (Orcas One Study)

**Status:** NOT FOUND

**Spec Provides CVR Data:**

| Position | Avg CTR | Avg CVR (commercial) |
|----------|---------|---------------------|
| 1 | ~28% | 3-5% |
| 2-3 | ~12% | 2-4% |
| 4-10 | ~3-8% | 1-3% |
| AI Overview | Variable | 4-8% |

**Fix Required:**
```typescript
const ORCAS_ONE_CVR = {
  1: { ctr: 0.28, cvr: 0.04 },
  2: { ctr: 0.12, cvr: 0.03 },
  3: { ctr: 0.10, cvr: 0.03 },
  4: { ctr: 0.08, cvr: 0.02 },
  5: { ctr: 0.06, cvr: 0.02 },
  // ... through 10
};

function estimateTrafficValue(
  keyword: string, 
  volume: number, 
  targetPosition: number,
  avgOrderValue: number
): TrafficValueEstimate {
  const model = ORCAS_ONE_CVR[targetPosition] || ORCAS_ONE_CVR[10];
  const estimatedClicks = volume * model.ctr;
  const estimatedConversions = estimatedClicks * model.cvr;
  const estimatedValue = estimatedConversions * avgOrderValue;
  
  return {
    keyword,
    volume,
    targetPosition,
    estimatedClicks,
    estimatedConversions,
    monthlyValue: estimatedValue
  };
}
```

---

## 7. Recommended Phase 92.5 Scope

### Priority 1: Quality Gate Fixes (2-3 days)
- [ ] Reddit Test: Add 6 specific criteria checking
- [ ] Prove-It Details: Add operational fact type detection
- [ ] QDD: Fix to detect UGC opportunity, not similarity
- [ ] Add Entity Consensus Validation service

### Priority 2: Missing Schema Generators (1-2 days)
- [ ] FAQPage schema generator
- [ ] HowTo schema generator
- [ ] BreadcrumbList schema generator
- [ ] RDFa inline markup utilities

### Priority 3: Chunk Quality Analysis (2-3 days)
- [ ] Question-Based H2 validation
- [ ] Snippet Answer detection
- [ ] Contrast Statement detection
- [ ] QFO Facet labeling
- [ ] Table boundary validation

### Priority 4: Content-Type Verticals (2-3 days)
- [ ] Transportation/Airport rules
- [ ] Listicle rules
- [ ] Comparison page rules
- [ ] Local service rules

### Priority 5: Forensic SERP Audit (1-2 days)
- [ ] Site vs Page audit
- [ ] EMQ Ratio check
- [ ] CVR modeling

### Out of Scope (requires separate phase)
- Tributary Trust Protocol (off-page strategy)
- Python research scripts (use TypeScript services)
- MCP tool integration (use existing REST APIs)

---

## Appendix: File Locations

| Component | File |
|-----------|------|
| Quality Gates | `services/QualityGateService.ts` |
| Rule Engine | `services/RuleEngineService.ts` |
| Universal Rules | `rules/universal.ts` |
| Vertical Rules | `rules/*.ts` |
| Chunk Extractor | `utils/ChunkExtractor.ts` |
| Entity Extractor | `utils/EntityExtractor.ts` |
| Schema Generator | `utils/SchemaGenerator.ts` |
| Vertical Classifier | `services/VerticalClassifier.ts` |
| Types | `types.ts` |
