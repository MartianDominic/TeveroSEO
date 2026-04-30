# Multi-Tier Keyword Classification Cascade Architecture

**Created:** 2026-04-30
**Status:** Design Complete
**Author:** Architect Agent (Opus)

---

## Executive Summary

This document defines a cost-optimized, multi-tier keyword classification cascade that achieves:

| Metric | Target | Mechanism |
|--------|--------|-----------|
| **Cost** | ~$0.01/prospect (200 kw) | Cheap Pass 1 filters 80% |
| **Quality** | Zero contextual drift | Business context enforcement |
| **Speed** | <10 seconds for 200 kw | Parallel batch processing |
| **Reliability** | 100% keyword retention | Graceful degradation chain |

---

## 1. System Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        KEYWORD CLASSIFICATION CASCADE                           │
│                                                                                 │
│  ┌─────────────────┐                                                           │
│  │ Business Context│◄──── From ConversationExtractor / Website Scraper         │
│  │   (Required)    │      Contains: industry, services, negative_associations  │
│  └────────┬────────┘                                                           │
│           │                                                                     │
│           ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         PASS 1: QUICK FILTER                            │   │
│  │  Model: GPT-4.1-nano (primary) | Gemini 2.5 Flash-Lite (fallback)      │   │
│  │  Task: Binary relevance with 0.9 confidence threshold                   │   │
│  │  Input: 200 keywords + business context                                 │   │
│  │  Output: clearly_include / clearly_exclude / uncertain                  │   │
│  │  Expected: 80% classified (160 kw) | Cost: ~$0.002                      │   │
│  └─────────────────────────────────┬───────────────────────────────────────┘   │
│                                    │                                           │
│           ┌────────────────────────┼────────────────────────┐                  │
│           ▼                        ▼                        ▼                  │
│  ┌────────────────┐    ┌────────────────────┐    ┌────────────────────┐        │
│  │ clearly_include│    │     uncertain      │    │  clearly_exclude   │        │
│  │   (~120 kw)    │    │     (~40 kw)       │    │     (~40 kw)       │        │
│  │ → Direct to    │    │ → Pass to Sonnet   │    │ → Marked excluded  │        │
│  │   Type Assign  │    │                    │    │   (with reason)    │        │
│  └────────┬───────┘    └─────────┬──────────┘    └────────────────────┘        │
│           │                      │                                              │
│           │                      ▼                                              │
│           │     ┌────────────────────────────────────────────────────────┐     │
│           │     │                    PASS 2: NUANCE CHECK                │     │
│           │     │  Model: Claude Sonnet                                  │     │
│           │     │  Task: Re-evaluate uncertain + categorize types        │     │
│           │     │  Input: ~40 uncertain keywords + full business context │     │
│           │     │  Output: include/exclude + type + confidence           │     │
│           │     │  Cost: ~$0.008                                         │     │
│           │     └──────────────────────┬─────────────────────────────────┘     │
│           │                            │                                       │
│           │     ┌──────────────────────┼──────────────────────┐                │
│           │     ▼                      ▼                      ▼                │
│           │  ┌──────────┐    ┌──────────────────┐    ┌────────────────┐        │
│           │  │ include  │    │ still_uncertain  │    │    exclude     │        │
│           │  │  (~30)   │    │    (~10 max)     │    │     (~10)      │        │
│           │  └────┬─────┘    └────────┬─────────┘    └────────────────┘        │
│           │       │                   │                                        │
│           │       │                   ▼                                        │
│           │       │     ┌────────────────────────────────────────────┐         │
│           │       │     │         PASS 3: HUMAN REVIEW (Optional)    │         │
│           │       │     │  Trigger: human_confirmation != 'never'    │         │
│           │       │     │  Queue: Max 20 keywords for review         │         │
│           │       │     │  UI: Approve/Reject with AI reasoning      │         │
│           │       │     └──────────────────────┬─────────────────────┘         │
│           │       │                            │                               │
│           └───────┼────────────────────────────┼───────────────────────────────┤
│                   ▼                            ▼                               │
│        ┌───────────────────────────────────────────────────────────────────┐   │
│        │                    TYPE CATEGORIZATION                            │   │
│        │  Applied to all included keywords after relevance gate            │   │
│        │  Types: product | long_tail | question | local | comparison       │   │
│        │  Uses keyword patterns + search intent signals                    │   │
│        └───────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Cost Breakdown

| Stage | Keywords | Model | Input Tokens | Output Tokens | Cost |
|-------|----------|-------|--------------|---------------|------|
| Pass 1 (batch 200) | 200 | GPT-4.1-nano | ~4,000 | ~2,000 | $0.002 |
| Pass 2 (uncertain) | 40 | Claude Sonnet | ~2,000 | ~1,500 | $0.008 |
| **Total** | 200 | - | ~6,000 | ~3,500 | **$0.01** |

**Cost vs Baseline:** $0.01 vs $0.04 = **75% savings**

---

## 3. Model Selection

### Pass 1: GPT-4.1-nano (Recommended)
- **Pricing:** $0.10/$0.40 per 1M tokens (Batch: $0.05/$0.20)
- **Strengths:** Designed for "classification, autocomplete, data extraction" per OpenAI
- **Structured Output:** 100% JSON schema adherence with `strict: true`
- **Context:** 1M tokens (fits 500+ keywords in single call)
- **Fallback:** Gemini 2.5 Flash-Lite (identical pricing)

### Pass 2: Claude Sonnet 4.6 (Existing)
- **Pricing:** $3.00/$15.00 per 1M tokens
- **Strengths:** Nuanced reasoning, Lithuanian language quality
- **Use:** Only for uncertain keywords (~20% of total)

---

## 4. Data Types

```typescript
// Business context for classification
interface BusinessContext {
  name: string;
  industry: string;
  services: string[];
  targetAudience?: string;
  geoFocus?: string;
  language: string;
  negativeAssociations: string[];  // CRITICAL: Keywords to always exclude
  domainTerms: string[];           // Keywords that indicate relevance
}

// Keyword type categorization
type KeywordType = 'product' | 'long_tail' | 'question' | 'local' | 'comparison';

// Final classified keyword
interface ClassifiedKeyword {
  keyword: string;
  normalizedKeyword: string;
  include: boolean;
  type?: KeywordType;
  confidence: number;
  classificationSource: 'pass1' | 'pass2' | 'human';
  reasoning?: string;
  exclusionReason?: string;
}
```

---

## 5. Error Handling Matrix

| Error Type | Pass 1 Action | Pass 2 Action |
|------------|---------------|---------------|
| Rate Limit (429) | Backoff 3x → Gemini | Backoff 2x → Human queue |
| Timeout | Switch to Gemini | Queue for human review |
| Invalid JSON | Retry once → Gemini | Retry once → Human queue |
| Server Error (5xx) | Switch to Gemini | Queue all for human |
| Context Too Long | Split batch | Split batch |

**Key Principle:** Never lose keywords due to API failure.

---

## 6. File Structure

```
open-seo-main/src/server/features/keywords/services/classification/
├── types.ts                    # Zod schemas
├── model-config.ts             # Model costs and configs
├── ModelSelector.ts            # Health tracking + fallback
├── ErrorHandler.ts             # Recovery logic
├── cost-estimator.ts           # Cost calculations
├── Pass1Classifier.ts          # GPT-4.1-nano / Gemini
├── Pass2Classifier.ts          # Claude Sonnet
├── ClassificationCascade.ts    # Main orchestrator
├── HumanReviewQueue.ts         # Optional review queue
├── prompts/
│   ├── pass1-prompt.xml
│   └── pass2-prompt.xml
└── index.ts
```

---

## 7. Implementation Sequence

| Order | Component | Depends On | Effort |
|-------|-----------|------------|--------|
| 1 | Type definitions | None | 1h |
| 2 | Model config | None | 1h |
| 3 | Model selector | 2 | 2h |
| 4 | Error handler | 1 | 2h |
| 5 | Cost estimator | 2 | 1h |
| 6 | Pass 1 classifier | 1-5 | 4h |
| 7 | Pass 2 classifier | 1-5 | 3h |
| 8 | Cascade orchestrator | 6-7 | 3h |
| 9 | Human review queue | 8 | 2h |
| 10 | API route | 9 | 1h |

**Total:** ~20h

---

## 8. ADR: Multi-Tier Cascade over Single-Pass

### Context
Need to classify 200 keywords per prospect with minimal cost and zero contextual drift.

### Decision
Implement 3-pass cascade: GPT-4.1-nano → Claude Sonnet → Human review.

### Consequences
**Positive:**
- 75% cost reduction (~$0.01 vs ~$0.04)
- Zero contextual drift via explicit negative associations
- Graceful degradation maintains 100% keyword retention

**Negative:**
- More complex (3 services vs 1)
- Potential latency increase
- Multiple API credentials required

### Status
Accepted (2026-04-30)
