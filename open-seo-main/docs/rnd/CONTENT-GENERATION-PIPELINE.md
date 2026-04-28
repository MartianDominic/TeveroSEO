# World-Class Content Generation Pipeline

> Comprehensive architecture for SEO-optimized content generation using Gemini with information gain as the primary differentiator.

## Core Principle

Content that ranks in 2026 must do ONE thing competitors don't: **add something Google hasn't seen before**. Everything else is table stakes.

- **Information Gain** is the #1 ranking factor (March 2026 core update)
- **E-E-A-T Experience** is structurally immune to AI — it requires real practitioner knowledge
- **NavBoost** uses Chrome engagement data as ranking signals (dwell time, scroll depth, pogo-sticking)

---

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    WORLD-CLASS CONTENT PIPELINE                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐                 │
│  │ 1. RESEARCH  │──▶│ 2. PLANNING  │──▶│ 3. GENERATE  │                 │
│  │              │   │              │   │              │                 │
│  │ SERP Intel   │   │ Content Brief│   │ Multi-Stage  │                 │
│  │ Competitor   │   │ Outline      │   │ with Quality │                 │
│  │ Entity Map   │   │ Info Gain    │   │ Gates        │                 │
│  │ Intent Match │   │ Injection    │   │              │                 │
│  │ First-Party  │   │ Points       │   │ Gemini +     │                 │
│  │ Data Pull    │   │              │   │ Grounding    │                 │
│  └──────────────┘   └──────────────┘   └──────────────┘                 │
│         │                                      │                         │
│         ▼                                      ▼                         │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │           QUALITY GATES - ALL MUST PASS 75+                    │     │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │     │
│  │  │Semantic │ │ E-E-A-T │ │Readable │ │Engaging │ │Info Gain│  │     │
│  │  │Coverage │ │ Signals │ │  Score  │ │Predict  │ │  Score  │  │     │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘  │     │
│  └────────────────────────────────────────────────────────────────┘     │
│         │                                                                │
│         ▼                                                                │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐                 │
│  │ 4. ON-PAGE   │──▶│ 5. TECHNICAL │──▶│ 6. PUBLISH   │                 │
│  │              │   │              │   │              │                 │
│  │ Title/Meta   │   │ Speed Check  │   │ CMS Push     │                 │
│  │ Headings     │   │ Mobile Check │   │ Schema Inject│                 │
│  │ Internal Link│   │ Crawlability │   │ Sitemap      │                 │
│  │ Images/Alt   │   │ Index Check  │   │ Index Request│                 │
│  │ Schema Gen   │   │              │   │              │                 │
│  └──────────────┘   └──────────────┘   └──────────────┘                 │
│         │                                                                │
│         ▼                                                                │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │                    7. POST-PUBLISH LOOP                        │     │
│  │                                                                │     │
│  │   Monitor ──▶ Detect Decay ──▶ Auto-Refresh ──▶ A/B Test      │     │
│  │      ▲                                              │          │     │
│  │      └──────────────────────────────────────────────┘          │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Stage 1: Research Intelligence

Build a complete intelligence picture before writing anything.

### 1.1 SERP Deep Analysis

```typescript
interface SerpIntelligence {
  keyword: string;
  topResults: Array<{
    url: string;
    title: string;
    wordCount: number;
    headings: string[];           // Full H1-H6 structure
    entities: Entity[];           // Extracted via NLP
    contentType: 'guide' | 'listicle' | 'comparison' | 'tutorial' | 'review';
    uniqueAngles: string[];       // What makes THIS result different
    weaknesses: string[];         // Outdated info, missing topics, poor UX
  }>;
  serpFeatures: {
    featuredSnippet: SnippetAnalysis | null;
    peopleAlsoAsk: string[];      // Mine these for H2s
    relatedSearches: string[];    // Secondary keyword opportunities
    imageResults: boolean;
    videoResults: boolean;
  };
  contentGaps: string[];          // Topics NO ONE covers well
  averageWordCount: number;
  commonHeadings: string[];       // What ALL top results have
  requiredEntities: Entity[];     // Must-mention for topical coverage
}
```

### 1.2 Competitor Content X-Ray

Don't just read competitors — dissect them:

| Analysis | Purpose |
|----------|---------|
| Structure patterns | How do top 3 organize content? |
| Entity coverage | What concepts do they all mention? |
| Depth analysis | Where do they go deep vs shallow? |
| Weakness mapping | Outdated stats? Missing angles? Poor examples? |
| Differentiation opportunities | What can we add they CAN'T? |

### 1.3 Entity & Topic Graph

```typescript
interface EntityMap {
  primaryEntity: Entity;          // Main topic
  requiredEntities: Entity[];     // Must mention for coverage
  relatedEntities: Entity[];      // Expand topical authority
  entityRelationships: Array<{
    from: Entity;
    to: Entity;
    relationship: string;         // "is a", "used for", "compared to"
  }>;
  topicClusters: Array<{
    cluster: string;
    keywords: string[];
    existingContent: string[];    // URLs we already have
    gaps: string[];               // Content we need
  }>;
}
```

### 1.4 Search Intent Precision

```typescript
type SearchIntent = {
  primary: 'informational' | 'transactional' | 'navigational' | 'commercial';
  stage: 'awareness' | 'consideration' | 'decision';
  userGoal: string;               // "Learn how to X" / "Compare options for Y"
  expectedFormat: string;         // "Step-by-step guide" / "Comparison table"
  successMetric: string;          // What makes the user satisfied?
};
```

### 1.5 First-Party Data Pull (THE DIFFERENTIATOR)

This is where information gain lives:

- Client's analytics data (what content performs?)
- Case studies with real numbers
- Proprietary research or surveys
- Customer testimonials with specifics
- Internal benchmarks and results
- "What we learned" from real experience

**This is the moat. AI can't generate this. Competitors can't copy this.**

---

## Stage 2: Content Planning

### 2.1 Content Brief Generation

```typescript
interface ContentBrief {
  // Core targeting
  targetKeyword: string;
  secondaryKeywords: string[];
  searchIntent: SearchIntent;
  
  // Structure requirements
  contentType: ContentType;
  wordCountTarget: { min: number; max: number };
  requiredHeadings: string[];     // From SERP analysis
  requiredEntities: Entity[];     // Must mention
  
  // Differentiation strategy
  uniqueAngle: string;            // Our hook - what makes this different
  informationGainOpportunities: Array<{
    section: string;
    opportunity: string;          // "Add conversion rate data from Q3"
    dataSource: string;           // Where to get it
  }>;
  
  // Internal strategy
  internalLinkTargets: Array<{
    url: string;
    anchorTextOptions: string[];
    contextPlacement: string;     // Where in content it fits
  }>;
  
  // External requirements
  citationRequirements: Array<{
    claim: string;
    sourceType: 'statistic' | 'quote' | 'study' | 'tool';
  }>;
  
  // Technical
  schemaType: SchemaType;
  targetAudience: AudienceProfile;
  toneGuidelines: string;
}
```

### 2.2 Outline with Information Gain Injection

```typescript
interface ContentOutline {
  h1: string;
  sections: Array<{
    heading: string;              // H2
    purpose: string;              // What question does this answer?
    keyPoints: string[];          // Must cover
    entities: Entity[];           // Must mention
    wordCount: number;
    subsections?: Array<{         // H3s
      heading: string;
      keyPoints: string[];
    }>;
    
    // THE KEY PART
    informationGainInjection: {
      type: 'case_study' | 'data' | 'expert_quote' | 'original_framework' | 'contrarian_take';
      content: string;            // The actual unique content to inject
      source: string;             // Where this comes from
    } | null;
  }>;
}
```

---

## Stage 3: Multi-Stage Generation with Gemini

### 3.1 Generation Flow

```
Research Synthesis → Section-by-Section → Coherence Pass → Optimization Pass → Fact-Check
```

### 3.2 Section-by-Section Generation

Each section generated independently with full context:

```typescript
const sectionPrompt = `
You are writing section "${section.heading}" for an article about "${keyword}".

FULL OUTLINE FOR CONTEXT:
${JSON.stringify(outline, null, 2)}

THIS SECTION REQUIREMENTS:
- Purpose: ${section.purpose}
- Key points: ${section.keyPoints.join(', ')}
- Entities to mention: ${section.entities.map(e => e.name).join(', ')}
- Word count: ${section.wordCount}

INFORMATION GAIN INJECTION (REQUIRED):
${section.informationGainInjection ? `
Include this unique content: ${section.informationGainInjection.content}
Type: ${section.informationGainInjection.type}
` : 'Include at least one specific example, number, or insight not found in typical content.'}

ANTI-GENERIC RULES:
- Never start with "In today's digital age" or similar
- Every claim must be specific and verifiable
- Write as a practitioner who has done this, not an observer
- Include at least one surprising or counterintuitive point
- Reference specific tools, techniques, or numbers

ENGAGEMENT RULES:
- Pattern interrupt every 200-300 words (question, bold statement, example)
- Front-load value — don't bury the lead
- Use concrete examples instead of abstract explanations

Write this section now:
`;
```

### 3.3 Gemini-Specific Configuration

```typescript
// Use Search Grounding for real-time data
const response = await gemini.generateContent({
  contents: [{ role: 'user', parts: [{ text: prompt }] }],
  tools: [{
    googleSearchRetrieval: {
      dynamicRetrievalConfig: {
        mode: 'MODE_DYNAMIC',
        dynamicThreshold: 0.3
      }
    }
  }]
});
```

**Gemini Advantages:**
- 1M token context = analyze 50+ competitor pages at once
- Search grounding = real-time data (not stale training cutoffs)
- Native Lithuanian support for local markets
- Cost efficiency vs OpenAI for volume

---

## Stage 4: Quality Scoring System

### 4.1 The 5 Dimensions

Content doesn't advance until ALL dimensions pass 75+.

```typescript
interface QualityScore {
  semanticCoverage: number;       // 0-100: All entities and topics covered?
  eeatScore: {
    experience: number;           // Specific examples, case studies, "what we learned"
    expertise: number;            // Technical depth, correct terminology
    authority: number;            // Citations, references, credentials
    trust: number;                // Transparency, methodology, honesty
    overall: number;
  };
  readability: {
    fleschKincaid: number;
    avgSentenceLength: number;
    avgParagraphLength: number;
    formattingScore: number;      // Bullets, bold, lists usage
    overall: number;
  };
  engagementPrediction: {
    hookStrength: number;         // Does intro grab attention?
    valueDensity: number;         // Insight per paragraph
    scanability: number;          // Can you skim and get value?
    ctaClarity: number;           // What should reader do next?
    overall: number;
  };
  informationGain: {
    uniqueDataPoints: number;     // Count of novel facts
    originalFrameworks: number;   // New ways of thinking
    firstPartyData: number;       // Proprietary insights
    contrarianInsights: number;   // Surprising takes
    overall: number;
  };
  
  overallScore: number;           // Weighted average
  passedThreshold: boolean;       // All dimensions >= 75?
  improvementSuggestions: string[];
}
```

### 4.2 Dimension Weights

| Dimension | Weight | Focus |
|-----------|--------|-------|
| Semantic Coverage | 20% | All entities and topics covered |
| E-E-A-T Signals | 25% | Experience, expertise, authority, trust |
| Readability | 15% | Appropriate complexity, formatting |
| Engagement Prediction | 20% | Hook, value density, scanability |
| Information Gain | 20% | Unique insights, first-party data |

### 4.3 E-E-A-T Signal Details

**Experience (hardest to fake):**
- Specific examples from real work
- "What we learned" / "What surprised us"
- Process details only practitioners know
- Screenshots, before/after, real results

**Expertise:**
- Technical depth appropriate to topic
- Correct terminology used naturally
- Nuanced understanding (not surface level)

**Authority:**
- Citations to reputable sources
- References to studies/data
- Expert quotes when relevant

**Trust:**
- Methodology transparency
- Honest about limitations
- No exaggerated claims

### 4.4 Information Gain Scoring

```typescript
interface InformationGainAnalysis {
  uniqueDataPoints: Array<{
    content: string;
    foundInTop10: boolean;        // If true, not unique
  }>;
  originalFrameworks: Array<{
    name: string;
    description: string;
  }>;
  firstPartyData: Array<{
    type: 'case_study' | 'research' | 'benchmark' | 'testimonial';
    content: string;
    verifiable: boolean;
  }>;
  contrarianInsights: Array<{
    claim: string;
    reasoning: string;
  }>;
  
  score: number;                  // 0-100
  suggestions: string[];          // How to improve
}
```

---

## Stage 5: On-Page SEO Optimization

### 5.1 Title Tag

```typescript
interface TitleOptimization {
  primary: string;                // Main title
  variations: string[];           // For A/B testing
  rules: {
    primaryKeywordPosition: 'front';  // Front preferred
    length: { min: 50, max: 60 };
    powerWords: string[];         // "Ultimate", "Complete", "[2026]"
    brandPosition: 'end' | 'none';
  };
}
```

### 5.2 Meta Description

- Primary keyword included
- Clear value proposition
- Call-to-action
- 150-160 characters
- Unique per page

### 5.3 Heading Hierarchy

```
H1: Primary keyword + hook (ONE per page)
├── H2: Major section + secondary keyword
│   ├── H3: Subsection
│   └── H3: Subsection
├── H2: Major section + secondary keyword
└── H2: FAQ section (for PAA targeting)
```

### 5.4 Internal Linking Strategy

```typescript
interface InternalLinkPlan {
  links: Array<{
    targetUrl: string;
    anchorText: string;           // Keyword-rich but varied
    contextSentence: string;      // Natural placement
    position: 'early' | 'middle' | 'late';
  }>;
  pillarPageLinks: string[];      // Always link to topic pillar
  clusterLinks: string[];         // Related content in same cluster
}
```

### 5.5 Schema Markup Auto-Generation

```typescript
const schemaMap: Record<ContentType, SchemaType> = {
  'guide': 'HowTo',
  'listicle': 'ItemList', 
  'faq': 'FAQPage',
  'review': 'Review',
  'comparison': 'ItemList',
  'tutorial': 'HowTo',
  'news': 'NewsArticle'
};

// Always include base schemas
const baseSchemas = [
  'Article',           // For all content
  'BreadcrumbList',    // Navigation
  'Organization',      // Publisher
  'Person'             // Author (E-E-A-T)
];
```

### 5.6 Image Optimization

- Descriptive file names with keywords
- Alt text with keywords (natural, not stuffed)
- Compressed for speed (WebP format)
- Lazy loading enabled
- Responsive srcset for different sizes

---

## Stage 6: Technical SEO Verification

### 6.1 Pre-Publish Checklist

```typescript
interface TechnicalChecklist {
  speed: {
    lcp: number;                  // < 2.5s
    cls: number;                  // < 0.1
    inp: number;                  // < 200ms
    passed: boolean;
  };
  mobile: {
    responsive: boolean;
    touchTargets: boolean;        // >= 48px
    fontSizes: boolean;           // >= 16px
    noHorizontalScroll: boolean;
  };
  crawlability: {
    inSitemap: boolean;
    robotsAllowed: boolean;
    noOrphan: boolean;            // Has internal links pointing to it
    canonicalCorrect: boolean;
  };
  indexability: {
    noNoindex: boolean;
    canonicalSelf: boolean;
    hreflangCorrect: boolean;     // If international
  };
}
```

---

## Stage 7: Publish Pipeline

```typescript
interface PublishPipeline {
  // 1. Push to CMS
  cmsIntegration: 'wordpress' | 'shopify' | 'webflow' | 'custom';
  
  // 2. Inject schema (via pixel or CMS)
  schemaInjection: {
    method: 'pixel' | 'cms_field' | 'plugin';
    schemas: Schema[];
  };
  
  // 3. Update sitemap
  sitemapUpdate: {
    addUrl: boolean;
    priority: number;             // 0.8 for new content
    changefreq: 'weekly';
  };
  
  // 4. Request indexing
  indexingRequest: {
    method: 'api' | 'ping';       // GSC API preferred
    submitted: boolean;
  };
  
  // 5. Internal link injection
  retroactiveLinks: Array<{
    existingPageUrl: string;
    anchorText: string;
    insertionPoint: string;       // After which paragraph
  }>;
}
```

---

## Stage 8: Post-Publish Optimization Loop

### 8.1 Performance Monitoring

```typescript
interface ContentPerformance {
  rankings: Array<{
    keyword: string;
    position: number;
    change: number;               // vs last check
    trend: 'up' | 'down' | 'stable';
  }>;
  traffic: {
    organic: number;
    trend: number;                // % change
  };
  engagement: {
    avgTimeOnPage: number;
    scrollDepth: number;
    bounceRate: number;
    returningVisitors: number;
  };
  conversions: {
    count: number;
    rate: number;
  };
}
```

### 8.2 Content Decay Detection

```typescript
interface DecaySignals {
  rankingDrop: boolean;           // Position dropped 5+ in 2 weeks
  trafficDrop: boolean;           // Organic down 20%+ month-over-month
  competitorGain: boolean;        // New competitor in top 5
  contentAge: number;             // Months since last update
  outdatedStatistics: string[];   // Stats older than 1 year
  brokenLinks: string[];          // External links that 404
  
  refreshRecommended: boolean;
  refreshPriority: 'high' | 'medium' | 'low';
  refreshSuggestions: string[];
}
```

### 8.3 Automated Refresh Workflow

When decay detected:

1. Re-run SERP analysis (what changed?)
2. Identify new competitors and their angles
3. Update outdated statistics
4. Add new sections for emerging subtopics
5. Refresh examples and case studies
6. Update internal links to newer content
7. Re-score quality and re-publish

### 8.4 A/B Testing Framework

```typescript
interface ContentTest {
  element: 'title' | 'meta' | 'h1' | 'intro' | 'cta';
  variants: Array<{
    id: string;
    content: string;
    traffic: number;              // % of visitors
  }>;
  metrics: {
    ctr: number;                  // For title/meta
    timeOnPage: number;           // For intro
    conversions: number;          // For CTA
  };
  winner: string | null;
  statisticalSignificance: number;
}
```

---

## Data Models

### Content Entity

```typescript
interface Content {
  id: string;
  targetKeyword: string;
  secondaryKeywords: string[];
  searchIntent: SearchIntent;
  contentType: ContentType;
  status: 'research' | 'planning' | 'draft' | 'review' | 'published' | 'refreshing';
  
  // Pipeline artifacts
  serpAnalysis: SerpIntelligence;
  competitorAnalysis: CompetitorAnalysis[];
  entityMap: EntityMap;
  brief: ContentBrief;
  outline: ContentOutline;
  
  // Quality tracking
  scores: QualityScore;
  draftVersions: DraftVersion[];
  publishedVersion: PublishedVersion;
  
  // Performance
  performance: ContentPerformance;
  decaySignals: DecaySignals;
  refreshHistory: RefreshRecord[];
  
  // Metadata
  createdAt: Date;
  publishedAt: Date | null;
  lastRefreshedAt: Date | null;
}
```

### Quality Thresholds

```typescript
const QUALITY_THRESHOLDS = {
  semanticCoverage: 75,
  eeatScore: 75,
  readability: 75,
  engagementPrediction: 75,
  informationGain: 75,
  overall: 75
};

// Content cannot publish until ALL thresholds met
function canPublish(scores: QualityScore): boolean {
  return (
    scores.semanticCoverage >= QUALITY_THRESHOLDS.semanticCoverage &&
    scores.eeatScore.overall >= QUALITY_THRESHOLDS.eeatScore &&
    scores.readability.overall >= QUALITY_THRESHOLDS.readability &&
    scores.engagementPrediction.overall >= QUALITY_THRESHOLDS.engagementPrediction &&
    scores.informationGain.overall >= QUALITY_THRESHOLDS.informationGain
  );
}
```

---

## Competitive Differentiation

| Competitor | Their Approach | Our Advantage |
|------------|----------------|---------------|
| **Surfer SEO** | Term frequency matching | Entity coverage + information gain scoring |
| **Clearscope** | Post-hoc content grading | Real-time scoring during generation |
| **Frase** | Question research | Full intent mapping + entity relationships |
| **MarketMuse** | Topic modeling | First-party data injection + E-E-A-T |
| **Jasper** | Generic AI writing | Multi-stage pipeline with quality gates |
| **Koala/Byword** | One-shot SEO articles | Research → Plan → Generate → Optimize flow |

---

## Success Criteria

Content from this pipeline should:

1. **Rank** — Covers all semantic requirements + proper on-page SEO
2. **Engage** — Keeps users reading (optimized for NavBoost signals)
3. **Convert** — Clear CTAs, value-first structure
4. **Stand Out** — Unique insights competitors can't copy
5. **Build Authority** — Contributes to topical cluster strategy
6. **Stay Fresh** — Auto-detects decay, triggers refresh

---

## Implementation Notes

### Gemini Model Selection

| Task | Model | Reason |
|------|-------|--------|
| Content generation | Gemini 2.5 Pro | Quality, grounding support |
| SERP analysis | Gemini 2.5 Flash | Speed, cost efficiency |
| Quality scoring | Gemini 2.5 Flash | Structured output |
| Entity extraction | Gemini 2.5 Flash | NLP tasks |

### Integration Points

- **DataForSEO**: SERP data, keyword metrics, competitor analysis
- **Google Search Console**: Indexing API, performance data
- **Google Analytics**: Engagement metrics, conversion tracking
- **CMS APIs**: WordPress, Shopify, Webflow publishing
- **Pixel System**: Schema injection, A/B testing, engagement tracking

---

## Related Documentation

- [Auto-Pilot Ranking System](/.planning/research/AUTO-PILOT-RANKING-SYSTEM.md)
- [Pixel Optimization System](/.planning/research/PIXEL-OPTIMIZATION-SYSTEM.md)
- [Technical SEO Automation](/.planning/research/TECHNICAL-SEO-AUTOMATION-STRATEGY.md)
- [World-Class Platform Strategy](/.planning/research/WORLD_CLASS_SEO_PLATFORM_STRATEGY.md)
