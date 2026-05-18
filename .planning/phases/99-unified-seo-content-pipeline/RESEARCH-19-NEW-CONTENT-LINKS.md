# Research 19: New Content Internal Linking

> **Agent:** 19 of 20  
> **Focus:** Auto-linking new articles to existing products/pages, contextual link insertion algorithms, anchor text variation strategy, related articles recommendations  
> **Created:** 2026-05-11

---

## Executive Summary

When new content is created, it must be intelligently connected to the existing site graph. This research defines the complete system for:

1. **Target Discovery** - Finding relevant existing pages to link TO from new content
2. **Contextual Insertion** - Placing links naturally within content flow
3. **Anchor Text Strategy** - Varying anchors to avoid over-optimization
4. **Related Articles** - Surfacing semantically similar content for recommendation blocks
5. **v6 UI Design** - Link suggestion interface during content creation

---

## 1. Target Discovery Algorithm

### 1.1 Multi-Signal Page Ranking

When a new article is created, identify the best internal link targets using weighted scoring:

```
Target Score = (0.30 × Semantic Score)
             + (0.25 × Link Deficit Score)
             + (0.20 × Orphan Score)
             + (0.15 × Depth Score)
             + (0.10 × Traffic Score)
```

| Signal | Weight | Description | Data Source |
|--------|--------|-------------|-------------|
| **Semantic Score** | 30% | Keyword/topic overlap between new content and target | Grok 4.1 embedding cosine similarity |
| **Link Deficit Score** | 25% | Pages with low inbound body links need more | `page_links.inbound_body` |
| **Orphan Score** | 20% | Orphan pages get priority rescue | `orphan_pages` table |
| **Depth Score** | 15% | Deep pages (>3 clicks from home) get boost | `page_links.click_depth_from_home` |
| **Traffic Score** | 10% | High-traffic pages amplify link equity | GSC clicks data |

### 1.2 Page Type Classification

Target pages fall into categories with different linking strategies:

| Page Type | Link Priority | Typical Anchor Strategy |
|-----------|---------------|------------------------|
| **Product Pages** | HIGH - commercial intent conversion | Exact product name, branded variations |
| **Category Pages** | HIGH - hub pages distribute equity | Category name, plural variants |
| **Pillar Content** | MEDIUM - topic clusters | Topic phrase, question variants |
| **Blog Posts** | MEDIUM - supporting content | Natural phrases, long-tail |
| **Landing Pages** | LOW - often have sufficient links | Action-oriented phrases |

### 1.3 Target Selection Constraints

```typescript
interface TargetConstraints {
  maxLinksPerNewArticle: 5;          // Don't over-link
  minSemanticScore: 0.65;            // Relevance threshold
  excludeSameCategory: false;        // Allow category siblings
  excludeRecentlyLinked: true;       // Avoid linking to same target within 7 days
  prioritizeProductPages: true;      // E-commerce boost
  maxDepthForTarget: 4;              // Don't link to already-shallow pages
}
```

---

## 2. Contextual Link Insertion Algorithm

### 2.1 Insertion Methods

Two primary methods for placing links in new content:

#### Method A: Wrap Existing Text (Preferred)

Find natural phrases in the content that match target keywords:

```typescript
interface WrapExistingStrategy {
  // Step 1: Extract target page's primary keyword
  targetKeyword: string;
  
  // Step 2: Find exact or fuzzy match in new content
  matchTypes: ['exact', 'stemmed', 'synonym'];
  
  // Step 3: Wrap first occurrence with anchor tag
  replacement: `<a href="${targetUrl}">${matchedText}</a>`;
}
```

**Example:**
- Target page: `/products/running-shoes`
- Target keyword: "running shoes"
- New content sentence: "Whether you're training for a marathon or just starting out, the right running shoes make all the difference."
- Result: "...the right <a href="/products/running-shoes">running shoes</a> make all the difference."

#### Method B: Append Contextual Sentence (Fallback)

When no natural match exists, generate a contextual sentence:

```typescript
interface AppendSentenceStrategy {
  // Step 1: Identify best paragraph for insertion (semantic similarity)
  targetParagraph: number;
  
  // Step 2: Generate transitional sentence via Grok 4.1
  prompt: `Write a single sentence that naturally transitions from discussing "${paragraphTopic}" to recommending "${targetPageTitle}". Keep it under 20 words.`;
  
  // Step 3: Append after target paragraph
  insertionPoint: 'after_paragraph';
}
```

### 2.2 Insertion Positioning Rules

| Position | Priority | Reasoning |
|----------|----------|-----------|
| **First 2 paragraphs** | AVOID | Too aggressive, readers haven't engaged |
| **Paragraphs 3-5** | PREFERRED | Reader is engaged, natural flow |
| **Final 2 paragraphs** | ACCEPTABLE | Related content zone |
| **After H2/H3** | GOOD | Natural section transitions |
| **Within lists** | AVOID | Breaks list flow |

### 2.3 Link Density Constraints

```typescript
const DENSITY_RULES = {
  maxLinksPerParagraph: 1,           // Never cluster
  minWordsBetwLinks: 100,            // Breathing room
  maxLinksPerHundredWords: 0.5,      // 1 link per 200 words
  noLinksInFirstSentence: true,      // Let paragraph establish topic
  noBackToBackParagraphLinks: true,  // Skip a paragraph between links
};
```

---

## 3. Anchor Text Variation Strategy

### 3.1 The Anchor Diversity Problem

Google penalizes over-optimized anchor text profiles. A page receiving 100% exact-match anchors signals manipulation.

**Target Distribution:**
| Anchor Type | Target % | Description |
|-------------|----------|-------------|
| Exact Match | 15-25% | Target keyword verbatim |
| Partial Match | 20-30% | Contains target keyword + modifiers |
| Branded | 10-15% | Company/product name |
| Natural/Misc | 30-40% | Generic phrases, long-tail, questions |
| URL | 5-10% | Raw URL as anchor |

### 3.2 Anchor Selection Algorithm

```typescript
interface AnchorSelector {
  selectAnchor(targetPage: Page, existingAnchors: AnchorDistribution): string {
    // Step 1: Get current anchor distribution for target
    const { exactMatchPercent, brandedPercent, miscPercent } = existingAnchors;
    
    // Step 2: Determine what type is needed
    if (exactMatchPercent < 0.15) {
      return targetPage.primaryKeyword;  // Exact match
    }
    if (brandedPercent < 0.10) {
      return generateBrandedVariant(targetPage);  // "Acme running shoes"
    }
    if (miscPercent < 0.30) {
      return generateNaturalPhrase(targetPage);  // "find the perfect pair"
    }
    
    // Step 3: Default to partial match with variation
    return generatePartialMatch(targetPage);
  }
}
```

### 3.3 Anchor Generation Variants

For a target page `/products/running-shoes` with keyword "running shoes":

| Type | Examples |
|------|----------|
| **Exact** | "running shoes" |
| **Partial** | "best running shoes for beginners", "lightweight running shoes" |
| **Branded** | "Acme running shoes", "shop Acme footwear" |
| **Natural** | "find your perfect pair", "explore our footwear", "check these out" |
| **Question** | "looking for running shoes?", "need new trainers?" |
| **Long-tail** | "running shoes for flat feet", "marathon training footwear" |

### 3.4 Anchor Confidence Scoring

```typescript
interface AnchorConfidence {
  score: number;  // 0.0 - 1.0
  
  factors: {
    grammarCorrect: boolean;      // +0.2 if grammatically natural
    contextFit: boolean;          // +0.3 if fits surrounding text
    diversityHelps: boolean;      // +0.2 if improves target's anchor profile
    notOverused: boolean;         // +0.2 if anchor isn't already common
    lengthOptimal: boolean;       // +0.1 if 2-5 words
  };
}
```

---

## 4. Related Articles Recommendation System

### 4.1 Recommendation Sources

Three methods for surfacing related content:

#### A. Semantic Similarity (Primary)

```typescript
async function getSemanticRelated(articleId: string, limit: number = 5) {
  // Get article embedding
  const embedding = await getEmbedding(article.content);
  
  // Vector similarity search
  return db.query(`
    SELECT page_id, title, url, 
           1 - (embedding <=> $1) as similarity
    FROM page_embeddings
    WHERE client_id = $2
      AND page_id != $3
      AND page_type IN ('blog', 'article', 'guide')
    ORDER BY similarity DESC
    LIMIT $4
  `, [embedding, clientId, articleId, limit]);
}
```

#### B. Topic Cluster Siblings

```typescript
async function getClusterSiblings(articleId: string) {
  // Find article's topic cluster
  const cluster = await getArticleCluster(articleId);
  
  // Return other articles in same cluster
  return db.query(`
    SELECT * FROM articles
    WHERE cluster_id = $1
      AND id != $2
    ORDER BY published_at DESC
    LIMIT 5
  `, [cluster.id, articleId]);
}
```

#### C. Same-Category Content

```typescript
async function getCategoryRelated(articleId: string) {
  const categories = await getArticleCategories(articleId);
  
  return db.query(`
    SELECT a.* FROM articles a
    JOIN article_categories ac ON a.id = ac.article_id
    WHERE ac.category_id = ANY($1)
      AND a.id != $2
    ORDER BY a.traffic_score DESC
    LIMIT 5
  `, [categories, articleId]);
}
```

### 4.2 Recommendation Ranking

Combine all sources with deduplication:

```typescript
interface RelatedArticle {
  id: string;
  title: string;
  url: string;
  excerpt: string;
  thumbnail?: string;
  
  // Scoring
  semanticScore: number;      // 0-1
  clusterScore: number;       // 1.0 if same cluster, 0 otherwise
  categoryScore: number;      // 0-1 based on shared categories
  recencyBoost: number;       // Slight boost for recent content
  trafficBoost: number;       // Boost for high-traffic pages
  
  finalScore: number;         // Weighted combination
}

const RELATED_WEIGHTS = {
  semantic: 0.40,
  cluster: 0.25,
  category: 0.15,
  recency: 0.10,
  traffic: 0.10,
};
```

### 4.3 Display Formats

| Format | When to Use | Display |
|--------|-------------|---------|
| **End of Article Block** | Always | 3-4 cards with thumbnail + title |
| **Inline Callout** | Long articles (>1500 words) | Single featured article mid-content |
| **Sidebar Widget** | Desktop rail | 5 text-only links |
| **Category Footer** | Category pages | Grid of related posts |

---

## 5. v6 UI: Link Suggestions During Content Creation

### 5.1 Design Principles (v6 Compliance)

Per design-system-v6.md:
- One editorial moment per interface state
- Hover-to-reveal secondary actions
- Ghost-edge shadows on cards
- 12px minimum text, 14px body
- Newsreader for numerals, Geist for UI

### 5.2 Link Suggestion Panel (Right Rail)

```
┌────────────────────────────────────────────────────┐
│  INTERNAL LINKS                              ⟳     │
│  5 suggestions · Auto-insert ready                 │
├────────────────────────────────────────────────────┤
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │  /products/running-shoes                     │ │
│  │  "running shoes" in ¶4                       │ │
│  │  ────────────────────────────────────────    │ │
│  │  Score: 87   Anchor: exact match             │ │
│  │                                              │ │
│  │  [Wrap Text]  [Edit Anchor]  [Skip]   →     │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │  /category/athletic-footwear                 │ │
│  │  "athletic footwear" in ¶7                   │ │
│  │  ────────────────────────────────────────    │ │
│  │  Score: 72   Anchor: category                │ │
│  │                                              │ │
│  │  [Wrap Text]  [Edit Anchor]  [Skip]   →     │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  + 3 more suggestions...                          │
│                                                    │
├────────────────────────────────────────────────────┤
│  ● 2 auto-inserted · 0 skipped                    │
│  [Apply All]                           kbd ⌘⇧L    │
└────────────────────────────────────────────────────┘
```

### 5.3 Suggestion Card Anatomy

```css
.link-suggestion-card {
  background: var(--surface);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  padding: var(--space-5);
  
  /* Hover lift */
  transition: box-shadow var(--motion-hover), transform var(--motion-hover);
}
.link-suggestion-card:hover {
  box-shadow: var(--shadow-lift);
  transform: translateY(-1px);
}

.link-suggestion-card .url {
  font-family: var(--font-mono);
  font-size: 13px;  /* --type-small */
  color: var(--text-2);
}

.link-suggestion-card .context {
  font-size: 14px;  /* --type-body */
  color: var(--text-3);
}

.link-suggestion-card .score {
  font-family: var(--font-display);
  font-size: 20px;  /* --num-row */
  font-variant-numeric: tabular-nums lining-nums;
}

.link-suggestion-card .anchor-type {
  font-size: 12px;  /* --type-tiny */
  font-variant-caps: all-small-caps;
  letter-spacing: 0.06em;
  color: var(--text-3);
}
```

### 5.4 Inline Editor Highlight

When user clicks "Edit Anchor" or hovers a suggestion, highlight in editor:

```css
.editor-link-highlight {
  background: var(--accent-soft);
  border-radius: 2px;
  outline: 2px solid var(--accent);
  outline-offset: 1px;
  animation: pulse-soft 2s ease-in-out infinite;
}

@keyframes pulse-soft {
  0%, 100% { outline-color: var(--accent); }
  50% { outline-color: var(--accent-tint); }
}
```

### 5.5 Anchor Text Editor Modal

```
┌─────────────────────────────────────────────────────────┐
│  Edit Anchor Text                                   ✕   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Target: /products/running-shoes                        │
│  Current anchor profile:                                │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  ■■■■ exact 22%   ■■■ branded 18%   ■■■■■■■ misc 60%   │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │ running shoes for beginners                       │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  Suggestions:                                           │
│  [running shoes] [best running shoes] [Acme footwear]  │
│  [find the right pair] [shop running shoes]            │
│                                                         │
│  ● Recommendation: Use partial match (exact is 22%)    │
│                                                         │
│  [Cancel]                              [Apply Anchor]   │
└─────────────────────────────────────────────────────────┘
```

### 5.6 Batch Action Controls

```
┌────────────────────────────────────────────────────────────┐
│  Internal Link Actions                                     │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  5 suggestions available                                   │
│                                                            │
│  [Apply All High-Confidence]        Apply 3 links (≥80)   │
│  [Review Each]                      Step through 1 by 1   │
│  [Skip All]                         No internal links     │
│                                                            │
│  ─────────────────────────────────────────────────────    │
│                                                            │
│  Settings:                                                 │
│  ☑ Auto-insert links scoring ≥ 85                         │
│  ☐ Always ask before inserting                            │
│  ☑ Show suggestions in editor rail                        │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 5.7 Applied Links Summary

After links are inserted, show confirmation:

```
┌────────────────────────────────────────────────────────┐
│  ✓ 4 Internal Links Added                              │
├────────────────────────────────────────────────────────┤
│                                                        │
│  ¶4  "running shoes" → /products/running-shoes        │
│  ¶7  "athletic gear" → /category/athletic-footwear    │
│  ¶9  "training guide" → /blog/marathon-training       │
│  ¶12 "shop now" → /products                           │
│                                                        │
│  Anchor distribution for this article:                 │
│  ■■ exact 25%   ■ branded 0%   ■■■ natural 75%        │
│                                                        │
│  [Undo All]                               [Continue]   │
└────────────────────────────────────────────────────────┘
```

---

## 6. Integration with Existing Schema

### 6.1 Database Tables Used

From `link-schema.ts`:

| Table | Usage |
|-------|-------|
| `link_graph` | Store new links after insertion |
| `page_links` | Check target's current link metrics |
| `link_suggestions` | Queue suggestions for review |
| `link_opportunities` | Track which opportunities are addressed |
| `orphan_pages` | Prioritize orphan rescue |

### 6.2 New Fields Required

```typescript
// Add to link_suggestions table
const newContentLinkFields = {
  sourceArticleId: text("source_article_id"),  // FK to AI-Writer articles
  isNewContent: boolean("is_new_content").default(false),
  contentCreationSession: text("content_creation_session"),  // Group suggestions
  paragraphIndex: integer("paragraph_index"),  // Where to insert
  sentenceIndex: integer("sentence_index"),    // Precise position
  autoApplied: boolean("auto_applied").default(false),
};
```

### 6.3 API Endpoints

```typescript
// POST /api/content/:articleId/link-suggestions
// Generate link suggestions for new content
interface GenerateSuggestionsRequest {
  articleId: string;
  content: string;
  maxSuggestions?: number;  // default 5
  autoApplyThreshold?: number;  // default 85
}

// POST /api/content/:articleId/apply-links
// Apply selected link suggestions
interface ApplyLinksRequest {
  articleId: string;
  suggestions: Array<{
    suggestionId: string;
    anchorText?: string;  // Override suggested anchor
    skip?: boolean;
  }>;
}

// GET /api/content/:articleId/related-articles
// Get related article recommendations
interface RelatedArticlesResponse {
  articles: RelatedArticle[];
  insertionPoints: Array<{
    paragraphIndex: number;
    type: 'inline_callout' | 'section_end';
  }>;
}
```

---

## 7. Autopilot vs Human-in-the-Loop

### 7.1 Decision Matrix

| Scenario | Mode | Reasoning |
|----------|------|-----------|
| Score ≥ 90, exact text match | **Autopilot** | High confidence, natural fit |
| Score 80-89 | **HITL Review** | Review anchor choice |
| Score 70-79 | **HITL Required** | May need context edit |
| Score < 70 | **Skip by default** | Low relevance |
| Orphan rescue | **Autopilot boost** | Always try to rescue |
| Product page target | **HITL Review** | Commercial intent needs human eye |

### 7.2 User Preference Settings

```typescript
interface LinkAutomationSettings {
  autoApplyEnabled: boolean;
  autoApplyMinScore: number;  // 85 default
  autoApplyMaxPerArticle: number;  // 3 default
  alwaysShowSuggestions: boolean;
  notifyOnAutoApply: boolean;
  requireApprovalForProducts: boolean;
}
```

---

## 8. Performance Considerations

### 8.1 Suggestion Generation Time

Target: <2 seconds for 5 suggestions

```
Step                          Target Time
─────────────────────────────────────────
1. Parse content              50ms
2. Extract candidate phrases  100ms
3. Query page_links (top 50)  150ms
4. Semantic similarity        800ms (batch Grok call)
5. Score & rank               100ms
6. Generate anchor variants   500ms
Total                         ~1.7s
```

### 8.2 Caching Strategy

```typescript
const CACHE_TTL = {
  pageEmbeddings: 7 * 24 * 60 * 60,  // 7 days
  pageLinkMetrics: 24 * 60 * 60,     // 1 day
  orphanPages: 24 * 60 * 60,         // 1 day
  anchorDistributions: 24 * 60 * 60, // 1 day
};
```

### 8.3 Background Processing

For bulk content creation (e.g., importing 50 articles):

```typescript
interface BulkLinkProcessingJob {
  articleIds: string[];
  mode: 'generate_only' | 'auto_apply';
  priority: 'high' | 'normal' | 'low';
  notifyOnComplete: boolean;
}

// Process via BullMQ queue
await linkSuggestionQueue.add('bulk_generate', job, {
  priority: job.priority === 'high' ? 1 : 3,
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
});
```

---

## 9. Quality Metrics

### 9.1 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Suggestion acceptance rate | >70% | Accepted / Total shown |
| Auto-apply success rate | >95% | No user override after auto |
| Anchor diversity improvement | +15% misc | Before/after anchor profiles |
| Orphan page rescue rate | >80% | Orphans linked within 30 days |
| Click depth reduction | -0.5 avg | Site-wide depth improvement |

### 9.2 Quality Gates

```typescript
interface LinkQualityChecks {
  // Before inserting any link
  noExistingLinkToTarget: boolean;
  noTooManyLinksInParagraph: boolean;
  anchorNotOverused: boolean;
  targetNotAlreadyOverlinked: boolean;
  semanticRelevanceAboveThreshold: boolean;
}
```

---

## 10. Implementation Checklist

### Phase 1: Core Algorithm
- [ ] Implement target discovery scoring
- [ ] Build contextual insertion logic (wrap + append)
- [ ] Create anchor variation generator
- [ ] Integrate with existing link_suggestions table

### Phase 2: UI Components
- [ ] Build LinkSuggestionPanel (right rail)
- [ ] Build AnchorEditorModal
- [ ] Build AppliedLinksSummary
- [ ] Add editor highlighting integration

### Phase 3: Related Articles
- [ ] Implement semantic similarity search
- [ ] Build RelatedArticlesBlock component
- [ ] Add inline callout variant
- [ ] Create recommendation API endpoint

### Phase 4: Automation
- [ ] Implement autopilot mode
- [ ] Build user preference settings
- [ ] Create BullMQ background processor
- [ ] Add quality gate checks

### Phase 5: Testing
- [ ] Unit tests for scoring algorithms
- [ ] Integration tests for link insertion
- [ ] E2E tests for UI workflow
- [ ] Performance benchmarks

---

## References

- `link-schema.ts` - Existing database schema with `linkGraph`, `pageLinks`, `linkSuggestions`, `orphanPages`
- `design-system-v6.md` - UI design rules (shadows, typography, motion)
- Phase 35 - Original internal linking implementation
- Phase 99 Master Spec - Pipeline context

---

*End of Research 19: New Content Internal Linking*
