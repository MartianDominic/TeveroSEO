# Phase 92: On-Page SEO Mastery - Context & Decisions

**Status:** Research Complete
**Created:** 2026-05-06
**Goal:** Apply research-backed on-page SEO rules to rank every page - no guesswork, no outdated tactics

---

## Executive Summary

Phase 92 integrates the SEO-AGI 41-point quality scorecard into TeveroSEO's existing 109-check audit system, adding a new Tier 5 for advanced AI/quality checks. The phase introduces 4 new services, 29 new checks, and a vertical classification system that loads industry-specific rules dynamically.

**Key Deliverables:**
- 41-point SEO-AGI scorecard integration (78% already covered, 22% new)
- 7 quality gates (Reddit Test, Information Gain, Prove-It Details, etc.)
- 500-token chunk architecture for LLM retrieval optimization
- Vertical classification with 12 industry rule packs
- Topical authority measurement and gap analysis
- Intelligent internal linking with semantic matching

**Token Optimization:** 74% reduction via vertical classification ($0.13 vs $0.50 per 1000 pages)

---

## Architecture Decisions

### Decision 1: Tier 5 vs Embedded in Existing Tiers

**Chosen:** New Tier 5 (Content Quality Intelligence)

| Aspect | Pros | Cons |
|--------|------|------|
| Separation | Clean opt-in, no impact on existing audits | More complex check runner |
| Scoring | Independent score, combinable with base | New scoring formula |
| Backward compat | Existing clients unaffected | Configuration overhead |

**Rationale:** Clients can adopt Phase 92 features gradually without affecting existing workflows.

### Decision 2: LLM for Quality Gates vs Rule-Based

**Chosen:** Hybrid (embedding similarity + LLM fallback)

- **Primary:** Use local embeddings (jina-v5-text-nano) for semantic analysis
- **Fallback:** Grok 4.1 Fast for borderline cases (similarity 0.7-0.85)
- **Cost:** ~$0.007-0.010 per page audit (all 7 quality gates)

### Decision 3: AEO (AI Engine Optimization) as Separate Toggle

**Chosen:** Separate toggle with dependency on On-Page Mastery

| Component | Status | Rationale |
|-----------|--------|-----------|
| 500-Token Chunks | CORE (internal) | Helps YOUR RAG, not proven for Google |
| Entity Graph | CORE (Schema.org), PREMIUM (full KG) | Schema proven, KG speculative |
| Citation Formatting | PREMIUM | Logical but unproven for rankings |
| Query Fan-Out | CORE | This is just good topic coverage |
| Tributary Trust | FUTURE (Phase 100+) | Major link building module |

### Decision 4: Vertical Classification Approach

**Chosen:** Heuristic-first with LLM fallback

- **Fast path:** Schema.org types + URL patterns (confidence >= 0.90)
- **Slow path:** Grok 4.1 Fast classification (~250 tokens)
- **Caching:** By domain + path (classify once, reuse everywhere)
- **Savings:** 90%+ classifications skip LLM

---

## New Services

### 1. RuleEngineService
**Location:** `open-seo-main/src/server/features/onpage-mastery/services/RuleEngineService.ts`

Applies the 41-point SEO-AGI scorecard with client-specific rule weights.

```typescript
interface RuleEngineService {
  evaluateScorecard(ctx: OnPageMasteryContext, weights?: RuleWeights): Promise<ScorecardResult>;
  getRulesForPageType(pageType: PageType): RuleDefinition[];
  checkInformationGain(ctx: OnPageMasteryContext): Promise<RuleResult>;
  checkRedditTest(ctx: OnPageMasteryContext): Promise<RuleResult>;
  checkProveItDetails(ctx: OnPageMasteryContext): Promise<RuleResult>;
}
```

### 2. PageStructureAnalyzer
**Location:** `open-seo-main/src/server/features/onpage-mastery/services/PageStructureAnalyzer.ts`

Analyzes heading hierarchy, content blocks, and 500-token chunk structure.

### 3. QualityGateService
**Location:** `open-seo-main/src/server/features/onpage-mastery/services/QualityGateService.ts`

Implements 7 quality gates:
- T5-01: Reddit Test
- T5-02: Information Gain vs SERP
- T5-03: Prove-It Details
- T5-04: Not For You Block
- T5-05: QDD Vulnerability
- T5-06: Thin Content Detection
- T5-07-13: Additional quality filters

### 4. VerticalClassifier
**Location:** `open-seo-main/src/server/features/verticals/VerticalClassifier.ts`

Classifies pages into 12 verticals with YMYL detection.

---

## New Checks Summary

### Tier 1: Page Structure (T1-70 to T1-85)

| ID | Name | Page Types | Severity |
|----|------|------------|----------|
| T1-70 | Page type detected | All | medium |
| T1-71 | Value proposition above fold | All | high |
| T1-72 | Primary CTA above fold | service, local | high |
| T1-73 | H2 spacing optimal | article | low |
| T1-74 | Comparison table present | comparison | high |
| T1-75 | Pros/cons section present | comparison | medium |
| T1-76 | Winner declaration present | comparison | medium |
| T1-77 | Listicle items numbered | listicle | medium |
| T1-78 | NAP information present | local | critical |
| T1-79 | Map embed present | local | medium |
| T1-80 | LocalBusiness schema complete | local | high |
| T1-81 | Author byline present | article | high |
| T1-82 | Published date visible | article | medium |
| T1-83 | Service schema present | service | medium |
| T1-84 | ItemList schema present | listicle | medium |
| T1-85 | Social proof section present | service | medium |

### Tier 5: Content Quality Intelligence (T5-01 to T5-13)

| ID | Name | Blocking | Cost/Check |
|----|------|----------|------------|
| T5-01 | Reddit Test | Yes (<50) | ~$0.002 |
| T5-02 | Information Gain vs SERP | Yes (<40) | ~$0.0001 |
| T5-03 | Prove-It Details | Yes (<30) | ~$0.003 |
| T5-04 | Not For You Block | No | $0 |
| T5-05 | QDD Vulnerability | No | ~$0.002 |
| T5-06 | Thin Content Detection | Yes (<20) | ~$0.0001 |
| T5-07 | Fluff Detection | No | ~$0.001 |
| T5-08 | AI Slop Detection | Yes (<40) | ~$0.002 |
| T5-09 | Voice Consistency | No | ~$0.001 |
| T5-10 | Tone Appropriateness | No | ~$0.001 |
| T5-11 | Audience Alignment | No | ~$0.001 |
| T5-12 | Sentence Length Distribution | No | $0 |
| T5-13 | Paragraph Length Optimization | No | $0 |

---

## Vertical Classification

### 12 Primary Verticals

| Vertical | YMYL | Key Rules |
|----------|------|-----------|
| healthcare | Yes | Medical reviewer, citations to .gov/.edu, disclaimers |
| legal | Yes | Bar verification, jurisdiction disclaimers, no outcome guarantees |
| financial | Yes | Regulatory disclosures, fiduciary statements, risk disclaimers |
| ecommerce | No | Product schema, price freshness, shipping info |
| saas | No | Feature tables, integration mentions, security badges |
| real_estate | No | LocalBusiness schema, property listings, market data |
| home_services | No | NAP, service areas, licensing info |
| hospitality | No | Booking schema, reviews, amenities |
| education | No | Course schema, credentials, outcomes |
| professional | No | Service schema, case studies, testimonials |
| manufacturing | No | Product specs, compliance certifications |
| nonprofit | No | Charity schema, impact metrics, transparency |

### Rule Override Hierarchy

```
Universal < Vertical < Sub-vertical < Client
```

---

## Content Generation Prompts

### Master Article Prompt Structure

```python
SYSTEM_PROMPT = """
{CORE_IDENTITY}
{VERTICAL_RULES}        # Injected based on classification
{QUALITY_REQUIREMENTS}
{VOICE_CONSTRAINTS}     # From AI-Writer voice profile
{STRUCTURE_RULES}
"""
```

### Quality Requirements Block

```
EVIDENCE DENSITY: Statistics every 150-200 words
SPECIFICITY: No weasel words ("may", "might", "some experts say")
PROVE-IT: Every claim needs proof (stat, example, citation)
REDDIT TEST: Would this survive r/[niche] without roasting?
CHUNK SIZE: 400-600 tokens per H2 section
```

### Banned Patterns

```python
BANNED_INTRO_PHRASES = [
    "In today's digital age",
    "In the world of",
    "When it comes to",
    "It goes without saying",
    "Needless to say",
    # ... 30+ more
]

WEASEL_WORDS = [
    "may", "might", "could", "possibly",
    "some experts", "studies show" (without citation),
    "many people", "it is believed",
]
```

---

## 500-Token Chunk Architecture

### Chunk Definition

```typescript
interface SemanticChunk {
  id: string;
  contentId: string;
  position: number;
  text: string;
  tokenCount: number;  // Target: 400-600
  parentHeading: string | null;
  embedding: number[];  // 768-dim jina-v5
  metrics: {
    tokenScore: number;           // 1.0 in range, decays outside
    selfContainmentScore: number; // No cross-references
    headingAlignmentScore: number;// Content matches heading
    factDensity: number;          // Entities per 100 tokens
  };
}
```

### Boundary Detection Priority

1. H2 headings (strength: 1.0) - always split
2. H3 headings (strength: 0.8) - split if chunk > 400 tokens
3. Topic shift (strength: 0.5) - embedding similarity < 0.4
4. Paragraph breaks (strength: 0.2) - last resort

### Storage

New table: `semantic_chunks` with DiskANN vector index for similarity search.

---

## Topical Authority System

### Authority Score Formula

```
TopicAuthority = (
  CoverageScore * 0.30 +   # Pages covering topic / total possible
  DepthScore * 0.25 +       # Avg words, unique angles
  LinkDensityScore * 0.20 + # Internal links within cluster
  BacklinkScore * 0.25      # External authority signals
) * PillarMultiplier
```

### Gap Analysis Output

```typescript
interface TopicGap {
  topic: string;
  currentCoverage: number;      // 0-1
  competitorCoverage: number;   // Avg of top 5
  priorityScore: number;        // Weighted by search volume
  recommendedContent: string[]; // "Create: Ultimate Guide to X"
}
```

---

## Internal Linking Intelligence

### Enhancements Over Phase 35

| Current (Phase 35) | New (Phase 92) |
|--------------------|----------------|
| Jaccard keyword overlap | Embedding-based semantic matching |
| 3 anchor variants | 8 anchor patterns with diversity tracking |
| Manual opportunity detection | Auto-detection + recommendations |
| No PageRank | PageRank-style authority flow |

### Auto-Linking Rules

```typescript
interface AutoLinkRule {
  enabled: boolean;
  maxLinksPerPage: number;      // Default: 5
  minRelevanceScore: number;    // Default: 0.75
  anchorDiversity: boolean;     // Require varied anchors
  prioritizeAuthority: boolean; // Link to high-authority pages first
  excludePatterns: string[];    // URLs to skip
}
```

---

## Database Schema Additions

### New Tables

1. `client_seo_settings` - Feature toggles per client
2. `seo_rule_weights` - Custom rule weights per client
3. `page_quality_scores` - Tier 5 quality metrics
4. `semantic_chunks` - 500-token chunks with embeddings
5. `chunk_recommendations` - Split/merge/expand suggestions
6. `topic_clusters` - Topical authority clusters
7. `topic_authority_scores` - Per-cluster authority metrics
8. `vertical_classifications` - Cached vertical classifications

---

## Implementation Phases

| Sub-Phase | Scope | Est. Effort |
|-----------|-------|-------------|
| 92-01 | Database schema + VerticalClassifier | 2 days |
| 92-02 | PageStructureAnalyzer + Tier 1 checks (T1-70 to T1-85) | 3 days |
| 92-03 | RuleEngineService (41-point scorecard) | 4 days |
| 92-04 | QualityGateService (Tier 5 checks) | 3 days |
| 92-05 | 500-Token ChunkExtractor + storage | 3 days |
| 92-06 | Content generation prompts integration | 2 days |
| 92-07 | Topical Authority system | 4 days |
| 92-08 | Internal Linking enhancements | 3 days |
| 92-09 | UI integration + dashboards | 3 days |
| 92-10 | Testing + documentation | 2 days |
| **Total** | | **29 days** |

---

## Cost Projections

### Per-Page Audit Cost (All Features)

| Component | Cost |
|-----------|------|
| Vertical Classification | $0.00007 (cached) |
| Tier 5 Quality Gates | $0.010 |
| Embedding Operations | $0.0005 |
| **Total** | ~$0.011/page |

### Monthly Cost @ 10,000 pages/month

| Feature | Cost |
|---------|------|
| Quality audits | $110 |
| Content generation (1000 articles) | $1,250 |
| **Total** | ~$1,360/month |

---

## Risk Mitigations

| Risk | Mitigation |
|------|------------|
| AEO claims are speculative | Clearly label as "AI Readiness" not "ranking factor" |
| Quality gates too strict | Adjustable thresholds per client |
| Token costs exceed budget | Aggressive caching, heuristic-first classification |
| Vertical misclassification | Client override + forced vertical setting |
| Backward compatibility | Tier 5 is opt-in, doesn't affect base scores |

---

## Files Created by Research

### Core Phase Documents

| File | Purpose |
|------|---------|
| `92-CONTEXT.md` | Architecture decisions, services, checks, implementation phases |
| `92-EXTRACTED-RULES.md` | Writing rules extraction from seobuild-onpage.md for content generation prompts |
| `92-COST-CONTROL.md` | Cost control architecture for large sites (sampling, caching, plan tiers) |

### Research Outputs (tool-results)

Large outputs saved to:
- `/tool-results/toolu_0182muAwfvvXmPoEMFyrEDxA.json` - Article generation prompts
- `/tool-results/toolu_01QBg7Wv2R71dZcyazWRxL3T.json` - SEAT signals design
- `/tool-results/toolu_01Be2kkaptcUdSHoxKqp7jNm.json` - 7 ranking signals
- `/tool-results/toolu_01MmDWbqQZpfXE7uupBFHvGb.json` - Quality filters design
- `/tool-results/toolu_012omKWDsVh9hTGBSHfb2xqV.json` - Writing rules
- `/tool-results/toolu_01CCdGDjRA6DE4n6cxeqKmhB.json` - Topical authority
- `/tool-results/toolu_01LmQ8JyZ3PWFiZuqrVRZpPd.json` - Internal linking

---

## Next Steps

1. **Plan Phase:** Create 92-PLAN.md with detailed task breakdown
2. **Research Phase:** Deep-dive any remaining gray areas
3. **Execute Phase:** Begin with 92-01 (database schema)

---

## Deferred Ideas

- **Full Tributary Trust Protocol** - Major link building module (Phase 100+)
- **Real-time engagement signals** - Requires analytics integration
- **Competitor SERP scraping at scale** - Cost/legal considerations
- **Multi-language vertical rules** - i18n for rule packs
