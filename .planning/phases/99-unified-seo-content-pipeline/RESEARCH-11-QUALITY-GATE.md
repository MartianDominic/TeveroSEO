# RESEARCH-11: Quality Gate Architecture

> **Agent 11 Research: Quality Gate System for Phase 99 Unified SEO Content Pipeline**  
> **Status:** Complete  
> **Date:** 2026-05-11

---

## Executive Summary

The Quality Gate is the critical checkpoint that determines whether AI-generated content can be auto-published or requires human review. This research documents the complete scoring architecture, E-E-A-T validation, readability analysis, originality detection, voice match scoring, and auto-publish vs manual review thresholds.

---

## 1. Score Calculation Architecture

### 1.1 Core Thresholds (Standardized)

From `AI-Writer/backend/core/scoring_constants.py`:

```python
class QualityThresholds:
    PASS = 80   # Auto-publish eligible
    WARN = 50   # Needs attention (manual review)
    FAIL = 0    # Blocked from publish
```

### 1.2 Score Color System

| Score Range | Color | Label | Action |
|-------------|-------|-------|--------|
| 90-100 | Green | Excellent | Auto-publish |
| 80-89 | Green | Good | Auto-publish |
| 50-79 | Yellow | Needs Attention | Manual review |
| 0-49 | Red | Poor | Blocked |

### 1.3 Weighted Score Calculation

The overall quality score is calculated from 6 weighted metrics:

| Metric | Weight | Focus Area |
|--------|--------|------------|
| Strategic Completeness | 25% | Business objectives, timeline, budget |
| Audience Intelligence | 20% | Pain points, preferences, journey |
| Content Strategy | 20% | Formats, mix, frequency, voice |
| Competitive Intelligence | 15% | Gaps, differentiation, trends |
| Performance Alignment | 15% | Traffic sources, conversion, ROI |
| Implementation Feasibility | 5% | Resources, team, timeline |

**Formula:**
```
overall_score = SUM(metric.score * metric.weight) / SUM(metric.weight)
```

With `safe_score_calc()` guard against division by zero.

---

## 2. E-E-A-T Checks

### 2.1 E-E-A-T Framework

| Signal | Check Type | Weight |
|--------|-----------|--------|
| **Experience** | First-person examples, case studies, personal anecdotes | 20% |
| **Expertise** | Technical accuracy, depth of coverage, proper terminology | 30% |
| **Authoritativeness** | Citations, data sources, expert quotes | 25% |
| **Trustworthiness** | Factual claims, balanced perspective, transparency | 25% |

### 2.2 E-E-A-T Scoring Implementation

```typescript
interface EEATScore {
  experience: {
    score: number;
    signals: string[];  // "Contains personal case study", "Uses first-person narrative"
    missing: string[];  // "No real-world examples found"
  };
  expertise: {
    score: number;
    signals: string[];
    missing: string[];
  };
  authoritativeness: {
    score: number;
    signals: string[];
    missing: string[];
  };
  trustworthiness: {
    score: number;
    signals: string[];
    missing: string[];
  };
  overall: number;
}
```

### 2.3 E-E-A-T Check Categories

**Experience Signals:**
- Personal anecdotes with specific details
- "In my experience..." / "When I worked on..."
- Case study references with outcomes
- Before/after comparisons from real projects

**Expertise Signals:**
- Correct industry terminology usage
- Technical depth appropriate to topic
- Nuanced explanations (not surface-level)
- Proper acronym expansion on first use

**Authoritativeness Signals:**
- Citations to primary sources
- Expert quotes with attribution
- Data/statistics with sources
- Links to authoritative references

**Trustworthiness Signals:**
- Balanced presentation (pros AND cons)
- Clear disclosure of limitations
- Factually verifiable claims
- No misleading clickbait patterns

---

## 3. Readability Scoring

### 3.1 Readability Metrics

| Metric | Target | Weight |
|--------|--------|--------|
| Flesch Reading Ease | 60-70 (8th-9th grade) | 30% |
| Flesch-Kincaid Grade | 8-10 | 25% |
| SMOG Index | 8-10 | 15% |
| Gunning Fog Index | 10-12 | 15% |
| Sentence Length | 15-20 words avg | 15% |

### 3.2 Readability Score Calculation

```typescript
interface ReadabilityScore {
  fleschReadingEase: number;      // 0-100 (higher = easier)
  fleschKincaidGrade: number;     // Grade level
  smogIndex: number;              // Grade level
  gunningFog: number;             // Grade level
  avgSentenceLength: number;      // Words per sentence
  avgSyllablesPerWord: number;    // Syllables per word
  
  // Derived
  overall: number;                // 0-100 composite
  targetAudience: string;         // "General Public" | "Technical" | "Academic"
}
```

### 3.3 Readability Thresholds by Content Type

| Content Type | Target Flesch | Target Grade |
|--------------|---------------|--------------|
| Blog Post | 60-70 | 8-9 |
| Technical Guide | 50-60 | 10-12 |
| Product Description | 70-80 | 6-8 |
| Landing Page | 65-75 | 7-9 |
| Case Study | 55-65 | 9-11 |

---

## 4. Originality Detection

### 4.1 Originality Check Components

| Check | Method | Threshold |
|-------|--------|-----------|
| **AI Detection** | Classifier model | < 30% AI probability |
| **Plagiarism** | Content fingerprinting | < 10% matched phrases |
| **Duplicate Content** | Internal corpus search | < 15% overlap with existing |
| **Template Detection** | Pattern matching | No repeated boilerplate |

### 4.2 Originality Score Calculation

```typescript
interface OriginalityScore {
  aiProbability: number;          // 0-100% AI-generated likelihood
  plagiarismScore: number;        // 0-100% matched content
  duplicateScore: number;         // 0-100% internal overlap
  templateDetected: boolean;      // Boilerplate pattern found
  
  // Sources of matches
  plagiarismSources: Array<{
    url: string;
    matchPercent: number;
    snippet: string;
  }>;
  
  duplicatePages: Array<{
    url: string;
    overlap: number;
    keyword: string;
  }>;
  
  overall: number;                // 0-100 (100 = fully original)
}
```

### 4.3 Originality Scoring Formula

```
originality = 100 - (
  aiProbability * 0.3 +
  plagiarismScore * 0.4 +
  duplicateScore * 0.2 +
  (templateDetected ? 10 : 0)
)
```

### 4.4 Cannibalization Check (Pre-Publish)

The existing `_check_cannibalization_risk()` in `auto_publish_executor.py` checks for keyword conflicts:

| Risk Level | Action |
|------------|--------|
| NONE/LOW | Proceed |
| MEDIUM | Warn, proceed |
| HIGH | Warn, proceed |
| CRITICAL | **Block publish** |

---

## 5. Voice Match Scoring

### 5.1 Voice Profile Components

From the 40+ field voice profiles:

| Category | Fields | Weight |
|----------|--------|--------|
| **Tone** | formal/casual, serious/playful, confident/humble | 25% |
| **Style** | sentence length, paragraph structure, transitions | 20% |
| **Vocabulary** | industry terms, jargon level, banned words | 20% |
| **Perspective** | first/second/third person, inclusive language | 15% |
| **Brand Elements** | taglines, value props, differentiators | 20% |

### 5.2 Voice Match Score Calculation

```typescript
interface VoiceMatchScore {
  toneAlignment: number;          // 0-100
  styleConsistency: number;       // 0-100
  vocabularyMatch: number;        // 0-100
  perspectiveCorrect: number;     // 0-100
  brandElementsPresent: number;   // 0-100
  
  violations: Array<{
    type: 'tone' | 'style' | 'vocabulary' | 'perspective' | 'brand';
    severity: 'low' | 'medium' | 'high';
    location: string;             // Paragraph/sentence reference
    expected: string;
    found: string;
    suggestion: string;
  }>;
  
  overall: number;                // Weighted composite
}
```

### 5.3 Voice Constraint Builder Integration

The `VoiceConstraintBuilder` from AI-Writer enforces:

1. **Sentence Length Limits** - Max/min words per sentence
2. **Banned Words** - Client-specific exclusions
3. **Required Terms** - Must-include vocabulary
4. **Tone Markers** - Specific phrases that signal tone
5. **Person Perspective** - First/second/third enforcement

---

## 6. Composite Quality Score

### 6.1 Final Score Components

| Component | Weight | Source |
|-----------|--------|--------|
| SEO Technical Score | 25% | 109 on-page checks |
| E-E-A-T Score | 25% | AI analysis |
| Readability Score | 20% | Formula-based |
| Originality Score | 15% | Detection models |
| Voice Match Score | 15% | Constraint validation |

### 6.2 Final Score Formula

```
quality_score = (
  seo_score * 0.25 +
  eeat_score * 0.25 +
  readability_score * 0.20 +
  originality_score * 0.15 +
  voice_score * 0.15
)
```

### 6.3 Fail-Fast Rules

Regardless of overall score, BLOCK if:

- **Originality < 50** (plagiarism concern)
- **AI Probability > 70%** (too detectable)
- **Cannibalization = CRITICAL**
- **E-E-A-T < 40** (no expertise signals)
- **Voice Violations = HIGH severity** with count > 3

---

## 7. Auto-Publish vs Manual Review Thresholds

### 7.1 Decision Matrix

| Score | E-E-A-T | Originality | Voice | Decision |
|-------|---------|-------------|-------|----------|
| >= 80 | >= 70 | >= 80 | >= 75 | **AUTO-PUBLISH** |
| >= 80 | >= 60 | >= 70 | >= 70 | Auto with warning |
| 70-79 | >= 60 | >= 70 | >= 70 | **MANUAL REVIEW** |
| 60-69 | Any | Any | Any | Manual with edits required |
| < 60 | Any | Any | Any | **REGENERATE** |

### 7.2 Review Queue Priority

When manual review required:

| Priority | Condition |
|----------|-----------|
| P0 Critical | Score < 50 OR originality < 50 |
| P1 High | Score 50-69 OR voice violations |
| P2 Medium | Score 70-79, minor issues |
| P3 Low | Score >= 80 but flagged for review |

### 7.3 Re-Verification at Publish Time

From `auto_publish_executor.py`:

```python
# HIGH-10-01 FIX: Re-verify quality score before final publish
quality_result = asyncio.run(check_quality_gate(client_id, content_html, article_title))
if quality_score < QUALITY_GATE_THRESHOLD:
    # BLOCK - score dropped below threshold
```

This ensures quality hasn't degraded between approval and publish.

---

## 8. v6 UI Design for Quality Gate Panel

### 8.1 Quality Gate Card (v6 Compliant)

Following design-system-v6.md:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  QUALITY GATE                                    ← eyebrow  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │                                                       │ │
│  │        87                                             │ │
│  │        ──                                             │ │
│  │       / 100                                           │ │
│  │                                                       │ │
│  │   ●●● APPROVED FOR AUTO-PUBLISH                       │ │
│  │                                                       │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ E-E-A-T     │ │ Readability │ │ Originality │           │
│  │ 85          │ │ 91          │ │ 88          │           │
│  │ ████████░░  │ │ █████████░  │ │ █████████░  │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
│                                                             │
│  ┌─────────────┐ ┌─────────────┐                           │
│  │ SEO Score   │ │ Voice Match │                           │
│  │ 82          │ │ 89          │                           │
│  │ ████████░░  │ │ █████████░  │                           │
│  └─────────────┘ └─────────────┘                           │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ ● 2 recommendations · hover to reveal →              │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 Component Specifications

**Score Numeral (Editorial Moment):**
- Font: Newsreader, `--num-hero` (38-46px)
- Color: `--text-1` (#14141A)
- Alignment: Left, with `/100` in `--type-small` (13px)

**Status Pill:**
- Approved: `--success-soft` bg, `--success` text
- Review Required: `--warning-soft` bg, `--warning` text
- Blocked: `--error-soft` bg, `--error` text

**Severity Dots:**
- `●●●` for scores 90-100 (3 dots, green)
- `●●○` for scores 80-89 (2 dots, green)
- `●○○` for scores 50-79 (1 dot, yellow)
- `○○○` for scores < 50 (0 dots, red outline)

**Sub-Score Bars:**
- Track: `--surface-3` (#F2F1EB)
- Fill: `--accent` (#0F4F3D) for passing, `--warning` for 50-79, `--error` for < 50
- Height: 4px
- Radius: 2px

### 8.3 Quality Gate Detail Modal

On click, expand to show:

```
┌─────────────────────────────────────────────────────────────┐
│ QUALITY GATE ANALYSIS                            [×]        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ E-E-A-T BREAKDOWN                                           │
│ ├── Experience      78  ████████░░  ⚠ Add case study       │
│ ├── Expertise       92  █████████░  ✓ Good depth           │
│ ├── Authority       84  ████████░░  ✓ Sources cited        │
│ └── Trust           86  █████████░  ✓ Balanced view        │
│                                                             │
│ READABILITY                                                 │
│ ├── Flesch Score    68  ████████░░  Target: 60-70          │
│ ├── Grade Level     8.2 ████████░░  Target: 8-10           │
│ └── Avg Sentence    17w ████████░░  Target: 15-20          │
│                                                             │
│ ORIGINALITY                                                 │
│ ├── AI Detection    12% █░░░░░░░░░  ✓ Human-like           │
│ ├── Plagiarism      3%  █░░░░░░░░░  ✓ Original             │
│ └── Duplicate       8%  █░░░░░░░░░  ✓ Unique content       │
│                                                             │
│ VOICE MATCH                                                 │
│ ├── Tone            92  █████████░  ✓ Matches brand        │
│ ├── Vocabulary      85  █████████░  ✓ Terms correct        │
│ └── Perspective     89  █████████░  ✓ 2nd person           │
│                                                             │
│ RECOMMENDATIONS                                             │
│ 1. Add a personal case study to boost Experience score     │
│ 2. Consider adding one more expert quote for Authority     │
│                                                             │
│              [Approve Anyway]  [Send to Review]             │
└─────────────────────────────────────────────────────────────┘
```

### 8.4 Empty States

**No Content Generated Yet:**
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  QUALITY GATE                                               │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │                                                       │ │
│  │        --                                             │ │
│  │                                                       │ │
│  │   Waiting for content generation                      │ │
│  │                                                       │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Analysis In Progress:**
```
│  ┌───────────────────────────────────────────────────────┐ │
│  │                                                       │ │
│  │        ◐  Analyzing...                                │ │
│  │                                                       │ │
│  │   Checking E-E-A-T signals                            │ │
│  │   ████████░░░░░░░░░░  42%                             │ │
│  │                                                       │ │
│  └───────────────────────────────────────────────────────┘ │
```

---

## 9. API Contracts

### 9.1 Quality Gate Check Endpoint

**Request:**
```typescript
POST /api/seo/content/validate
{
  html: string;
  keyword: string;
  client_id: string;
  include_details?: boolean;  // Return full breakdown
}
```

**Response:**
```typescript
{
  approved: boolean;
  score: number;              // 0-100
  failedChecks: number;
  
  // When include_details=true
  breakdown?: {
    seo: { score: number; issues: Issue[] };
    eeat: EEATScore;
    readability: ReadabilityScore;
    originality: OriginalityScore;
    voice: VoiceMatchScore;
  };
  
  recommendations: string[];
  blockers: string[];         // Reasons that prevent auto-publish
}
```

### 9.2 Quality History Endpoint

**Request:**
```typescript
GET /api/seo/content/{article_id}/quality-history
```

**Response:**
```typescript
{
  history: Array<{
    timestamp: string;
    score: number;
    status: 'draft' | 'review' | 'approved' | 'published';
    changes: string[];        // What changed since last check
  }>;
  
  trend: 'improving' | 'stable' | 'declining';
  averageScore: number;
}
```

---

## 10. Implementation Checklist

### Phase 1: Core Scoring
- [ ] Migrate `scoring_constants.py` thresholds to TypeScript
- [ ] Implement weighted score calculation in open-seo-main
- [ ] Add `passes_quality_gate()` to TypeScript

### Phase 2: E-E-A-T Analysis
- [ ] Build E-E-A-T signal detection (Gemini 3.1 Pro)
- [ ] Create signal extraction prompts
- [ ] Implement score aggregation

### Phase 3: Readability
- [ ] Integrate Flesch/SMOG/Fog calculations
- [ ] Add content-type-specific targets
- [ ] Build readability API endpoint

### Phase 4: Originality
- [ ] Integrate AI detection model
- [ ] Build internal corpus search
- [ ] Implement plagiarism fingerprinting

### Phase 5: Voice Match
- [ ] Port VoiceConstraintBuilder to validation mode
- [ ] Build violation detection
- [ ] Create voice score calculation

### Phase 6: UI Components
- [ ] Build QualityGateCard component
- [ ] Build QualityDetailModal component
- [ ] Implement empty states
- [ ] Add hover-to-reveal recommendations

### Phase 7: Auto-Publish Integration
- [ ] Update decision matrix logic
- [ ] Add review queue priority
- [ ] Implement re-verification at publish

---

## 11. Dependencies

| System | Dependency | Purpose |
|--------|-----------|---------|
| AI-Writer | `scoring_constants.py` | Threshold definitions |
| AI-Writer | `ai_quality_analysis_service.py` | Quality metrics |
| AI-Writer | `auto_publish_executor.py` | Publish gate |
| AI-Writer | `article_generation_service.py` | Quality check call |
| open-seo-main | `/api/seo/content/validate` | Validation endpoint |
| Gemini 3.1 Pro | E-E-A-T analysis | Signal detection |

---

## 12. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Score gaming | Multi-signal approach prevents single-metric manipulation |
| False positives (blocking good content) | Human review queue with priority |
| False negatives (publishing bad content) | Re-verification at publish time |
| API timeout | Fail-closed with QualityGateError |
| Model drift | Periodic calibration against human reviews |

---

## Document References

- `AI-Writer/backend/core/scoring_constants.py` - Threshold definitions
- `AI-Writer/backend/services/ai_quality_analysis_service.py` - Quality analysis
- `AI-Writer/backend/services/auto_publish_executor.py` - Publish gate
- `AI-Writer/backend/services/article_generation_service.py` - Quality check
- `.planning/design/design-system-v6.md` - UI specifications
