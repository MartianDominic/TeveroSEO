# RESEARCH-09: AI Content Generation Pipeline

> **Phase 99 Research Document**  
> **Focus**: Gemini 3.1 Pro integration, 500-token chunk architecture, QFO facet coverage, Reddit Test compliance, E-E-A-T signals  
> **Source**: `.planning/phases/92-on-page-seo-mastery/seobuild-onpage.md` (v1.7.0)

---

## 1. Executive Summary

The seobuild-onpage skill (v1.7.0) defines a comprehensive content generation framework optimized for both Google ranking AND LLM citation. Key innovations:

1. **500-token chunk architecture** for AI retrieval optimization
2. **Query Fan-Out (QFO) facet coverage** for multiplicative AI traffic
3. **Reddit Test** as primary quality gate
4. **Tributary Trust Protocol** for off-page entity corroboration
5. **41-point quality scorecard** with mandatory compliance

---

## 2. Gemini 3.1 Pro Integration

### 2.1 Model Assignment (from MODEL-REFERENCE.md)

| Task | Model | Cost |
|------|-------|------|
| Article generation | `gemini-3.1-pro` | $1.25/1M input, $5.00/1M output |
| Voice compliance checking | `gemini-3.1-pro` | $1.25/1M input |
| Translation (Lithuanian) | `gemini-3.1-pro` | $1.25/1M input |
| Fast tasks / fallback | `gemini-3.1-flash` | $0.075/1M input |

### 2.2 Why Gemini 3.1 Pro for Content

- **Best content quality** for long-form articles
- **Excellent Lithuanian language support** (critical for TeveroSEO)
- **Native grounding with Google Search** (can verify facts)
- **1M+ context window** (handles full research briefs + competitor analysis)

### 2.3 Integration Points

```
┌─────────────────────────────────────────────────────────────────┐
│                    Content Generation Flow                       │
├─────────────────────────────────────────────────────────────────┤
│  1. Research (DataForSEO/Ahrefs/SEMRush) → Competitive Brief    │
│  2. Brief → Gemini 3.1 Pro → 500-token Chunked Draft            │
│  3. Draft → Quality Scorecard (41 checks)                       │
│  4. If score < 33/41 → Gemini 3.1 Pro → Revision                │
│  5. Final → Tributary Generation (4+ Tier 1 assets)             │
└─────────────────────────────────────────────────────────────────┘
```

### 2.4 Prompt Architecture

Content generation prompts must include:
- Target keyword + semantic neighbors (from research)
- Word count range (competitive median)
- H2 target count (competitive median)
- PAA questions to answer
- Information gain target (what top 10 miss)
- ICP (Ideal Customer Persona) definition

---

## 3. 500-Token Chunk Architecture

### 3.1 Core Principle

Google's AI retrieves content in ~500-token (~375 word) chunks. LLMs chunk at ~600 words with ~300 word overlap. Every page must be structured to feed this pipeline.

### 3.2 Chunk Rules

| Rule | Implementation |
|------|----------------|
| **Question-Based H2s** | Every H2 matches a real search query or QFO follow-up question |
| **Entity-Based Headings** | Use entity names, NOT exact-match keywords in H2/H3/H4 |
| **Snippet Answer** | First 2-3 sentences after H2 = direct, concrete answer (no preamble) |
| **Contrast Statement** | Include X vs Y comparisons with numbers within chunk |
| **Self-Contained** | Never split tables across chunk boundaries |
| **Front-Load Strength** | Best content in first 3 chunks (AI may never reach buried material) |

### 3.3 Chunk Structure Template

```markdown
## [Entity-Based Question H2]

[Snippet Answer: 2-3 sentences, direct answer, no definitions]

[Contrast Statement: X costs $Y, Y costs $Z -- break-even at N days]

[Supporting Data: table, proof points, operational details]

[~375 words total, self-contained, single QFO facet]
```

### 3.4 Anti-Patterns (NEVER DO)

- Stack two H2s without 250+ words between them
- Split data tables across chunk boundaries
- Bury key recommendations in final chunks
- Combine two QFO facets in one chunk

---

## 4. Query Fan-Out (QFO) Facet Coverage

### 4.1 The QFO Traffic Model

**40% of future AI-mediated traffic arrives via query fan-out** -- AI breaking one user prompt into dozens of sub-queries. A page answering only the primary query gets retrieved for one facet. A page with multiple QFO facets gets retrieved for multiple sub-queries = multiplicative traffic.

### 4.2 Facet Design Principle

Each 500-token chunk targets ONE specific sub-query facet:

| Facet Type | Example Sub-Query |
|------------|-------------------|
| Cost facet | "What does FLL parking cost?" |
| Distance facet | "How far is the shuttle?" |
| Timing facet | "When does it fill up?" |
| Comparison facet | "Economy vs terminal garage?" |
| Process facet | "How do I book?" |
| Warning facet | "What are the gotchas?" |

### 4.3 Implementation Checklist

- [ ] Each H2 section answers exactly ONE facet
- [ ] No chunk tries to answer two questions
- [ ] Facet label mentally assigned during writing
- [ ] Quality scorecard check #38: "Each 500-token chunk targets a distinct QFO facet?"

---

## 5. Reddit Test Compliance

### 5.1 The Test

> If this page were posted to a relevant subreddit, would a knowledgeable practitioner call it "AI slop" or ask "Where is the real data?"

### 5.2 Passing Requirements (3+ of 6)

| # | Requirement | Example |
|---|-------------|---------|
| 1 | Hard number from official/overlooked source | Capacity: 2,847 spaces |
| 2 | Layout/navigation detail only locals know | "Terminal 4 pickup moved to Level 2 after construction" |
| 3 | Cost comparison with real math | "5 days at $20 = $100; Uber round-trip ~$30; break-even = 2 days" |
| 4 | Schedule/operational detail with specifics | "Shuttle runs every 8 minutes; lot fills by 6 AM on cruise Saturdays" |
| 5 | "The thing they moved/changed/broke" detail | Recent change not on competitor pages |
| 6 | Real gotcha with specificity | "Cell phone lot closes at midnight -- stranded if flight delayed past then" |

### 5.3 Mandatory Prove-It Details

Every document requires **at least 2 hard operational facts**:
- Capacity, frequency, fill rate, wait time, distance measurements
- Break-even cost math
- Layout/navigation details for first-timers
- Recent changes not on competitor pages

### 5.4 Frontmatter Requirements

```yaml
reddit_test: "r/travel -- would pass: includes break-even math, terminal-specific tips, real pricing"
information_gain: "EV charging availability, cell phone lot capacity, terminal 7 construction impact"
```

---

## 6. E-E-A-T Signals Implementation

### 6.1 The Four Dimensions

| Signal | What to Include | Example |
|--------|-----------------|---------|
| **Experience** | Location-specific operational details | Terminal pickup spots, timing, traffic patterns |
| **Expertise** | Pricing comparisons with real numbers | Not "affordable" -- actual dollar amounts |
| **Authority** | Official source citations | "Broward County Aviation Department -- FLL Parking Rates" |
| **Trust** | Honest "Not For You" sections | Scenarios where this option is wrong |

### 6.2 Mandatory "Not For You" Block

Every page must include a section telling readers when this is a **bad fit**:
- Name the specific scenario
- Include at least one line competitors would never publish
- This is the ultimate trust signal

### 6.3 Entity / Knowledge Graph Signals

| Signal Type | Implementation |
|-------------|----------------|
| Full entity names | "Hartsfield-Jackson Atlanta International Airport" (not just "ATL") |
| Terminal entities | Terminal numbers/names as distinct entities |
| Operating authorities | Port Authority, airport authority names |
| Deep entity history | Founding dates, generational ownership ("third-generation family business") |
| Identity tags | "women-owned", "veteran-owned" (maps to GBP tags) |

### 6.4 Original Research Block (MANDATORY)

Every page requires a section framed as original research/data experiment:

```markdown
## Our 12-Point Analysis of FLL Garage Fill Rates

We tracked 30 days of off-site shuttle wait times and found...
[Methodology note, observation timeframe, specific data point]
```

**Rule**: Pages without original research block score max 20/41 on quality checklist.

---

## 7. Quality Scorecard (41 Checks)

### 7.1 Critical Checks for Phase 99

| # | Check | Weight |
|---|-------|--------|
| 1 | Information gain over top 10 Google results? | Critical |
| 2 | Would a knowledgeable Reddit commenter upvote this? | Critical |
| 5 | 2+ hard operational Prove-It facts? | Critical |
| 10 | "Not For You" block present? | Critical |
| 11 | Content structured for LLM extraction (500-token chunks)? | Critical |
| 25 | AI Summary Nugget (200-char) at top? | Critical |
| 26 | Original Research / Data Experiment block present? | Critical |
| 28 | Every claim validated against 2+ sources (Entity Consensus)? | Critical |
| 38 | Each 500-token chunk targets a distinct QFO facet? | Critical |

### 7.2 Minimum Score

**Pages scoring below 33/41 must be revised before delivery.**

### 7.3 AI Summary Nugget (Position Zero)

Every page opens with 200-character max fact-dense summary:

```html
<div class="ai-summary">
FLL airport parking: $20/day long-term, $36/day short-term, $10/day overflow (peak only). Off-site lots start at ~$6/day with shuttle. Rates effective Nov 2024.
</div>
```

**Why**: Perplexity, Gemini, ChatGPT extract shortest factual passage as "answer nugget" -- pre-built nugget increases citation probability.

---

## 8. Tributary Trust Protocol

### 8.1 Core Concept

Money page = estuary. Owned Tier 1 properties = tributaries feeding entity signal.

### 8.2 Tier 1 Assets (Minimum 4 Required)

| Tier | Asset | Why |
|------|-------|-----|
| 1 | Google Sites | Google-hosted, near-instant indexing |
| 1 | Google Sheets (published) | Crawlable, schema-friendly for data |
| 1 | Medium | High DR, fast indexing, LLM scraped |
| 1 | Custom Subreddit (you moderate) | AI Overviews cite Reddit heavily |
| 1 | LinkedIn Articles | Authority signal, indexed |

### 8.3 Sequencing (CRITICAL)

1. Publish 4+ Tier 1 tributaries FIRST (or same-day as money page)
2. Wait for Google to index at least 2 tributaries
3. THEN publish money page
4. Add 1-2 more tributaries over 2-4 weeks

**Why**: "Inspector" layer checks third-party corroboration at index time. Money page without tributary network = low-trust.

---

## 9. Implementation for Phase 99

### 9.1 Content Generation Service Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                ContentGenerationService                          │
├─────────────────────────────────────────────────────────────────┤
│  Input:                                                          │
│    - Target keyword                                              │
│    - Client voice profile (40+ fields)                          │
│    - Competitive research brief                                  │
│                                                                  │
│  Processing:                                                     │
│    1. Build QFO facet outline (from PAA + research)             │
│    2. Generate 500-token chunks (Gemini 3.1 Pro)                │
│    3. Apply voice constraints (VoiceConstraintBuilder)          │
│    4. Run Reddit Test validation                                 │
│    5. Run 41-point quality scorecard                            │
│    6. Generate tributaries if commercial intent                  │
│                                                                  │
│  Output:                                                         │
│    - Chunked article (Markdown + YAML frontmatter)              │
│    - Quality score (must be >= 33/41)                           │
│    - Tributary briefs (4-6 per Tier 1 asset type)               │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 Gemini 3.1 Pro Prompt Template

```python
CONTENT_GENERATION_PROMPT = """
You are an elite GEO (Generative Engine Optimization) content writer.

## Target
- Keyword: {keyword}
- Search Intent: {intent}
- ICP: {icp_description}
- Word Count: {min_words}-{max_words}

## Research Data
{competitive_brief}

## Structural Requirements
1. AI Summary Nugget (200 chars max) at position zero
2. Opening answer in first 150 words
3. Fast-scan summary within first 200 words
4. 500-token chunks, each answering ONE QFO facet
5. Entity-based H2s (no exact-match keyword)
6. "Not For You" block required
7. Original Research block required

## Voice Profile
{voice_constraints}

## Quality Gates
- Reddit Test: Would r/{subreddit} upvote this?
- Information Gain: {info_gain_target}
- Minimum 2 Prove-It facts with {{VERIFY}} tags

Generate the article following the 500-token chunk architecture.
"""
```

### 9.3 Quality Gate Integration

```typescript
interface QualityGate {
  redditTest: boolean;       // 3+ of 6 criteria met
  informationGain: boolean;  // Contains data not in top 10
  proveItFacts: number;      // Minimum 2
  qfoFacetCoverage: number;  // Unique facets per chunk
  scorecard: number;         // Out of 41
}

const MINIMUM_SCORE = 33;
const AUTO_PUBLISH_SCORE = 37;  // Higher bar for auto-publish
```

---

## 10. Key Constraints for Phase 99

1. **Model Lock**: Use `gemini-3.1-pro` for ALL article generation -- no fallbacks to cheaper models
2. **Quality Gate**: Score >= 33/41 required, >= 37/41 for auto-publish (existing 80 threshold maps to ~37/41)
3. **Chunk Architecture**: Enforce 500-token chunks in generation prompts
4. **Reddit Test**: Validate before delivery -- reject "AI slop"
5. **Tributary Protocol**: Generate tributaries for commercial intent pages
6. **Entity Consensus**: Cross-validate claims against 2+ sources
7. **No Banned Patterns**: Enforce Section 9 "Never Do" list

---

## 11. Files to Reference

| File | Purpose |
|------|---------|
| `seobuild-onpage.md` | Complete skill specification (this research source) |
| `MODEL-REFERENCE.md` | Model selection matrix |
| `VoiceConstraintBuilder` | Voice profile enforcement |
| `quality-checklist.md` | Detailed 41-point scoring rubric |
| `schema-patterns.md` | JSON-LD templates by page type |

---

## 12. Open Questions for Discussion

1. **Tributary automation**: Should Phase 99 auto-generate tributary drafts, or flag for human review?
2. **Score threshold mapping**: Current 80-point quality gate vs. new 41-point scorecard -- calibration needed?
3. **Reddit Test automation**: Can we automate 3/6 criteria detection, or require human verification?
4. **QFO facet detection**: How to validate each chunk targets distinct facet programmatically?

---

*Research completed from seobuild-onpage.md v1.7.0 and MODEL-REFERENCE.md*
