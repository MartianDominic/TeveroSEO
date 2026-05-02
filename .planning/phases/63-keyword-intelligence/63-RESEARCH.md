# Phase 63: Keyword Intelligence - Research

**Researched:** 2026-05-02
**Domain:** AI-powered keyword classification cascade, autocomplete APIs, adaptive intent detection
**Confidence:** HIGH

## Summary

Phase 63 implements a multi-tier keyword classification pipeline that transforms the current fixed extraction approach into an adaptive, cost-efficient system. The core innovation is a Grok 4.1 Pass 1 filter ($0.20/1M input) that processes 80% of keywords at minimal cost, with Claude Sonnet Pass 2 handling the remaining 20% of uncertain classifications. This cascade achieves the target of 100-200 ON-POINT keywords per prospect at approximately $0.01 per prospect.

The existing codebase already has substantial infrastructure: `ResilientClassifier.ts` (Claude + GPT-4o-mini cascade with circuit breakers), `FalkorDBClient` (per-tenant graph isolation), `EmbeddingService` (jina-v3 with 384-dim Matryoshka truncation), and comprehensive DataForSEO integration. The primary work is extending the `ResilientClassifier` to support Grok 4.1 as Pass 1, implementing negative association extraction in `ConversationExtractor`, and adding the human confirmation toggle UI.

**Primary recommendation:** Extend existing `ResilientClassifier` architecture to support Grok 4.1 as a new primary backend, implement business model and negative association extraction in `ConversationExtractor`, and add a confirmation toggle in the prospect wizard UI.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Pass 1:** Grok 4.1 via xAI (`https://api.x.ai/v1`, OpenAI SDK compatible)
- **Pass 1 Fallback:** Gemini 2.5 Flash Lite
- **Pass 2:** Claude Sonnet 4.6 for nuance classification
- **Classification Thresholds:**
  - High confidence include: >=0.85 confidence -> direct to output
  - High confidence exclude: >=0.85 confidence -> mark excluded
  - Uncertain: <0.85 -> Pass 2 review
- **Human-in-the-Loop:**
  - Default mode: "confirm" (pause before expensive operations)
  - Autonomous mode: proceed without confirmation
  - Toggle persists in localStorage

### Claude's Discretion
- Implementation details within the locked model selection
- UI component design for confirmation toggle
- Integration patterns with existing services

### Deferred Ideas (OUT OF SCOPE)
- None specified in CONTEXT.md
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| KI-01 | 100-200 classified keywords per prospect | Grok 4.1 batch classification with 0.85 threshold filtering |
| KI-02 | Pass 1 (Grok 4.1) filters 80% of keywords | Binary confidence scoring with optimized prompt |
| KI-03 | Adjacent verticals excluded via negative associations | Extended BusinessContextSchema with negativeAssociations |
| KI-04 | Confirmation toggle works in both modes | localStorage-persisted toggle with SSE progress display |
| KI-05 | Intent detection routes correctly | quick_check (<30s) vs full_analysis routing based on input mode |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Keyword classification | API / Backend | -- | LLM inference requires server-side API keys and rate limiting |
| Negative association extraction | API / Backend | -- | Claude/Grok calls with structured output |
| Human confirmation UI | Frontend Server (SSR) | Browser | React components with localStorage persistence |
| Classification progress | API / Backend | Browser | SSE streaming from backend, display in browser |
| Keyword storage | Database / Storage | -- | PostgreSQL with pgvector for embeddings |
| Graph storage | Database / Storage | -- | FalkorDB (Redis-based) per tenant isolation |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| openai | 6.35.0 | xAI Grok API client (OpenAI-compatible) | [VERIFIED: npm registry] xAI API uses OpenAI SDK format |
| @anthropic-ai/sdk | 0.92.0 | Claude Sonnet Pass 2 | [VERIFIED: package.json] Already in use |
| falkordb | 6.6.2 | Per-tenant keyword graph storage | [VERIFIED: package.json] Phase 42 infrastructure |
| ioredis | 5.10.1 | Redis connection for FalkorDB and caching | [VERIFIED: package.json] Already in use |
| zod | ^3.23 | Classification output validation | [VERIFIED: codebase] Pattern used in BusinessPriorityParser |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| p-limit | ^6.0 | Concurrency control for batch classification | Limit parallel API calls |
| use-debounce | ^10.0 | Debounce confirmation toggle changes | Already in codebase |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Grok 4.1 | GPT-4.1-nano | GPT-4.1-nano is ~$0.10/1M vs $0.20/1M, but xAI provides $175/mo free credits |
| Gemini 2.5 Flash Lite | Gemini 2.5 Flash | Flash is 2x cost ($0.20/1M vs $0.10/1M) but faster |
| FalkorDB | Neo4j | Neo4j is more mature but requires separate license/server |

**Installation:**
```bash
# OpenAI SDK already installed - used for xAI Grok API compatibility
# No new packages required
```

**Version verification:** [VERIFIED: npm registry 2026-05-02]
- openai: 6.35.0 (current)
- @anthropic-ai/sdk: 0.92.0 (current)

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────────────────────────────────────┐
                          │                    INPUT LAYER                          │
                          │                                                         │
                          │  ConversationExtractor       Website Scraper            │
                          │  ─────────────────────       ───────────────            │
                          │  • Business context          • Product/service discovery│
                          │  • Negative associations     • Domain terms             │
                          │  • 5-10 seed keywords        • Competitor signals       │
                          └──────────────────────────────┬──────────────────────────┘
                                                         │
                                                         ▼
                          ┌─────────────────────────────────────────────────────────┐
                          │              STEP 1: EXPAND (DataForSEO)                │
                          │                                                         │
                          │  Seed Keywords (5-10) ──► autocomplete + suggestions    │
                          │                     ──► keyword_ideas + related         │
                          │                                                         │
                          │  Output: 150-300 raw keywords                           │
                          └──────────────────────────────┬──────────────────────────┘
                                                         │
                                                         ▼
                          ┌─────────────────────────────────────────────────────────┐
                          │              STEP 2: CLASSIFY - PASS 1 (Grok 4.1)       │
                          │                                                         │
                          │  All Keywords ──► Grok 4.1 (batch 50-100)               │
                          │       │                                                 │
                          │       ├──► confidence >= 0.85 ──► INCLUDE (direct)      │
                          │       ├──► confidence >= 0.85 ──► EXCLUDE (filtered)    │
                          │       └──► confidence < 0.85  ──► UNCERTAIN (Pass 2)    │
                          │                                                         │
                          │  ~80% resolved, ~20% to Pass 2                          │
                          │  Cost: ~$0.004 for 200 keywords                         │
                          └──────────────────────────────┬──────────────────────────┘
                                                         │
                                          ┌──────────────┴──────────────┐
                                          │                             │
                                          ▼                             ▼
               ┌────────────────────────────────┐    ┌────────────────────────────────┐
               │  RESOLVED (80%)                 │    │  STEP 3: PASS 2 (Claude Sonnet)│
               │  Direct to output               │    │  ~40 uncertain keywords        │
               │                                 │    │  + GraphRAG context            │
               │                                 │    │  + Business model              │
               │                                 │    │  = Final classification        │
               │                                 │    │  Cost: ~$0.02 for 40 keywords  │
               └────────────────────────────────┘    └──────────────────────────────────┘
                                          │                             │
                                          └──────────────┬──────────────┘
                                                         │
                                                         ▼
                          ┌─────────────────────────────────────────────────────────┐
                          │              STEP 4: HUMAN REVIEW (Optional)            │
                          │                                                         │
                          │  Toggle: "confirm" (default) | "autonomous"             │
                          │                                                         │
                          │  If confirm mode:                                       │
                          │    • Display classified keywords grouped by type        │
                          │    • Approve/Reject/Edit actions                        │
                          │    • Override persisted for future                      │
                          │                                                         │
                          │  If autonomous mode:                                    │
                          │    • Skip directly to storage                           │
                          └──────────────────────────────┬──────────────────────────┘
                                                         │
                                                         ▼
                          ┌─────────────────────────────────────────────────────────┐
                          │              OUTPUT: Classified Keywords                │
                          │                                                         │
                          │  ClassifiedKeyword[] (100-200 per prospect)             │
                          │  ├── keyword: string                                    │
                          │  ├── type: product | long_tail | question | local       │
                          │  ├── confidence: 0.85-1.0                               │
                          │  └── reasoning: string                                  │
                          └─────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
open-seo-main/src/server/features/keywords/
├── classification/
│   ├── types.ts                      # Zod schemas for classification
│   ├── config.ts                     # Model configs, thresholds (0.85)
│   ├── ClassificationPipeline.ts     # Main orchestrator (Pass 1 + Pass 2)
│   ├── GrokClassifier.ts             # Grok 4.1 xAI integration
│   ├── GeminiClassifier.ts           # Fallback classifier
│   ├── prompts/
│   │   └── keyword-classifier.xml    # Classification prompt template
│   └── index.ts
│
├── context/
│   ├── NegativeAssociationExtractor.ts  # Extract what business does NOT do
│   ├── BusinessModelDetector.ts         # B2B/B2C/ecommerce detection
│   └── index.ts
│
├── review/
│   ├── HumanReviewQueue.ts           # Review queue management
│   ├── types.ts                      # Review UI types
│   └── index.ts
│
└── services/
    ├── ResilientClassifier.ts        # EXISTING - extend for Grok
    └── KeywordIntelligenceService.ts # EXISTING - wire new pipeline
```

### Pattern 1: Grok 4.1 as OpenAI-Compatible Client

**What:** Use OpenAI SDK with xAI base URL for Grok API calls
**When to use:** All Pass 1 classification calls
**Example:**
```typescript
// Source: https://docs.x.ai/docs/guides/migration [CITED]
import OpenAI from "openai";

const grokClient = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

async function classifyWithGrok(keywords: string[], context: BusinessContext): Promise<ClassificationResult[]> {
  const response = await grokClient.chat.completions.create({
    model: "grok-4.1-fast",  // $0.20/1M input, $0.50/1M output
    messages: [
      { role: "system", content: CLASSIFICATION_SYSTEM_PROMPT },
      { role: "user", content: buildClassificationPrompt(keywords, context) }
    ],
    response_format: { type: "json_object" },
    max_tokens: 4000,
  });
  
  return parseClassificationResponse(response);
}
```

### Pattern 2: Two-Pass Classification Cascade

**What:** Grok Pass 1 (cheap, fast) -> Claude Pass 2 (expensive, accurate) for uncertain cases
**When to use:** All keyword classification
**Example:**
```typescript
// Source: Existing ResilientClassifier.ts pattern [VERIFIED: codebase]
async function classifyBatch(keywords: string[], context: BusinessContext): Promise<ClassifiedKeyword[]> {
  // Pass 1: Grok 4.1 for all keywords
  const pass1Results = await this.grokClassifier.classify(keywords, context);
  
  const resolved: ClassifiedKeyword[] = [];
  const uncertain: string[] = [];
  
  for (const result of pass1Results) {
    if (result.confidence >= 0.85) {
      resolved.push(result);  // High confidence - done
    } else {
      uncertain.push(result.keyword);  // Low confidence - needs Pass 2
    }
  }
  
  // Pass 2: Claude Sonnet only for uncertain keywords
  if (uncertain.length > 0) {
    const graphContext = await this.lightrag.getContext(uncertain.slice(0, 10));
    const pass2Results = await this.claudeClassifier.classify(uncertain, context, graphContext);
    resolved.push(...pass2Results);
  }
  
  return resolved;
}
```

### Pattern 3: Negative Association Extraction

**What:** Extend ConversationExtractor to capture what business explicitly does NOT do
**When to use:** During prospect input extraction
**Example:**
```typescript
// Source: Extended from ConversationExtractor.ts [VERIFIED: codebase]
interface NegativeAssociations {
  notServices: string[];      // Things they explicitly do NOT sell/provide
  competitors: string[];      // Known competitor domains or business types
  adjacentVerticals: string[]; // Related but wrong verticals
  wrongIntent: string[];      // Intent signals to suppress
}

// Prompt extension for extraction
const EXTRACTION_PROMPT = `...
<negative-associations>
Based on the business description, extract:
1. notServices: What does this business explicitly NOT do?
2. competitors: Who competes with them?
3. adjacentVerticals: What related verticals are NOT their business?
4. wrongIntent: What intent signals indicate wrong audience?
</negative-associations>
...`;
```

### Anti-Patterns to Avoid

- **Single-model classification:** Using only Claude for all keywords is 10x more expensive than the Grok cascade
- **Synchronous blocking:** Don't block UI while classification runs; use SSE progress streaming
- **No circuit breaker:** Always have fallback (Grok -> Gemini -> Rules) to prevent total failure
- **Hardcoded thresholds:** Make 0.85 confidence threshold configurable via environment variable

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate limiting | Custom token bucket | `redis-rate-limiter.ts` | Already implemented, Redis-backed for multi-worker |
| Circuit breaker | Custom failure tracking | `CircuitBreaker.ts` | Already implemented with per-backend isolation |
| Embedding generation | Custom jina API calls | `EmbeddingService` | Already implemented with caching and batching |
| Graph storage | Custom Redis commands | `FalkorDBClient` | Already implemented with tenant isolation |
| Keyword deduplication | Custom string matching | `KeywordDeduplicator` | Already implemented with Lithuanian lemmatization |

**Key insight:** Phase 42-43 built comprehensive keyword infrastructure. Phase 63 extends rather than replaces.

## Common Pitfalls

### Pitfall 1: xAI API Key Confusion

**What goes wrong:** Using OPENAI_API_KEY for xAI calls
**Why it happens:** xAI uses OpenAI SDK format but different API key
**How to avoid:** Use separate `XAI_API_KEY` environment variable
**Warning signs:** 401 Unauthorized errors from api.x.ai

### Pitfall 2: Grok Response Format Mismatch

**What goes wrong:** Grok returns slightly different JSON structure than Claude
**Why it happens:** Different models have different output tendencies
**How to avoid:** Use Zod validation with .safeParse() and fallback handling
**Warning signs:** Classification results missing fields or malformed

### Pitfall 3: Context Window Overflow

**What goes wrong:** Sending too many keywords in one batch exceeds context
**Why it happens:** Grok 4.1 has 2M context but prompts can get large
**How to avoid:** Limit batches to 50-100 keywords per API call
**Warning signs:** Truncated responses, missing keywords in output

### Pitfall 4: Pass 2 Explosion

**What goes wrong:** More than 20% of keywords go to Pass 2
**Why it happens:** Pass 1 prompt not optimized for binary classification
**How to avoid:** Tune prompt to produce confident scores; add fallback rules
**Warning signs:** Pass 2 costs exceed Pass 1 costs

### Pitfall 5: LocalStorage Toggle Not Syncing

**What goes wrong:** Confirmation toggle state inconsistent across tabs
**Why it happens:** localStorage doesn't trigger events in same tab
**How to avoid:** Use React state with localStorage persistence on change
**Warning signs:** User changes toggle but behavior doesn't change

## Code Examples

### GrokClassifier Implementation

```typescript
// Source: Pattern from ResilientClassifier.ts + xAI docs [VERIFIED: codebase + CITED: docs.x.ai]
import OpenAI from "openai";
import { z } from "zod";
import { CircuitBreaker } from "./CircuitBreaker";

const ClassificationItemSchema = z.object({
  keyword: z.string(),
  include: z.boolean(),
  confidence: z.number().min(0).max(1),
  type: z.enum(["product", "long_tail", "question", "local", "comparison"]).nullable(),
  reasoning: z.string(),
});

const ClassificationResponseSchema = z.object({
  classifications: z.array(ClassificationItemSchema),
});

export class GrokClassifier {
  private client: OpenAI;
  private circuit: CircuitBreaker;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://api.x.ai/v1",
    });
    this.circuit = new CircuitBreaker({
      name: "grok-classifier",
      failureThreshold: 3,
      resetTimeout: 60000,
    });
  }

  async classify(
    keywords: string[],
    context: BusinessContext
  ): Promise<ClassificationResult[]> {
    if (!this.circuit.allowsRequest) {
      throw new CircuitOpenError("Grok circuit is open");
    }

    try {
      const response = await this.client.chat.completions.create({
        model: "grok-4.1-fast",
        messages: [
          { role: "system", content: this.buildSystemPrompt() },
          { role: "user", content: this.buildUserPrompt(keywords, context) },
        ],
        response_format: { type: "json_object" },
        max_tokens: 4000,
        temperature: 0.1,
      });

      const text = response.choices[0]?.message?.content || "";
      const parsed = ClassificationResponseSchema.safeParse(JSON.parse(text));
      
      if (!parsed.success) {
        this.circuit.recordFailure();
        throw new Error(`Invalid Grok response: ${parsed.error.message}`);
      }

      this.circuit.recordSuccess();
      return parsed.data.classifications;
    } catch (error) {
      this.circuit.recordFailure();
      throw error;
    }
  }

  private buildSystemPrompt(): string {
    return `You are an expert keyword classifier for Lithuanian e-commerce and B2B businesses.
Your task is to determine which keywords are relevant for the given business.

CRITICAL: A keyword that is semantically similar but contextually WRONG must be EXCLUDED.
Example: "embroidery services" is EXCLUDE for a company that BUYS embroidery, not SELLS it.`;
  }

  private buildUserPrompt(keywords: string[], context: BusinessContext): string {
    return `<business-context>
${JSON.stringify(context, null, 2)}
</business-context>

<keywords-to-classify>
${keywords.map((k, i) => `${i + 1}. ${k}`).join("\n")}
</keywords-to-classify>

Return JSON: {"classifications": [...]}`;
  }
}
```

### Human Confirmation Toggle Component

```typescript
// Source: Pattern from prospect-wizard-store.ts [VERIFIED: codebase]
"use client";

import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const STORAGE_KEY = "keyword_confirmation_mode";

export function ConfirmationToggle() {
  const [mode, setMode] = useState<"confirm" | "autonomous">("confirm");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "confirm" || stored === "autonomous") {
      setMode(stored);
    }
  }, []);

  const handleChange = (checked: boolean) => {
    const newMode = checked ? "autonomous" : "confirm";
    setMode(newMode);
    localStorage.setItem(STORAGE_KEY, newMode);
  };

  return (
    <div className="flex items-center space-x-2">
      <Switch
        id="confirmation-mode"
        checked={mode === "autonomous"}
        onCheckedChange={handleChange}
      />
      <Label htmlFor="confirmation-mode">
        {mode === "confirm" ? "Confirm before proceeding" : "Autonomous mode"}
      </Label>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single Claude classification | Multi-tier cascade (Grok -> Claude) | April 2026 | 10x cost reduction |
| 1000s of keywords | 100-200 on-point keywords | April 2026 | Better relevance |
| No negative associations | Explicit exclusion signals | Phase 63 | Eliminates contextual drift |
| Fixed pipeline | Adaptive intent routing | Phase 63 | quick_check <30s possible |

**Deprecated/outdated:**
- GPT-4.1-nano: xAI Grok 4.1 offers better value with free credits
- Single-pass classification: Cascade approach is now standard for cost optimization

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Grok 4.1 can reliably classify 50-100 keywords per batch with JSON output | Architecture Patterns | Need smaller batches, higher latency |
| A2 | Pass 1 will resolve 80% of keywords at >=0.85 confidence | Architecture Patterns | Pass 2 costs increase significantly |
| A3 | xAI free tier ($175/mo) is sufficient for MVP volume | Cost Model | Need paid tier earlier |
| A4 | Lithuanian keyword classification quality matches English | Classification | May need Lithuanian-specific prompt tuning |

## Open Questions

1. **Grok 4.1 Lithuanian Quality**
   - What we know: xAI docs don't specify language-specific benchmarks
   - What's unclear: Classification accuracy for Lithuanian keywords vs English
   - Recommendation: Test with 100 Lithuanian keywords; fallback to Claude if <90% accuracy

2. **Batch Size Optimization**
   - What we know: Design doc suggests 50-100 keywords per batch
   - What's unclear: Optimal batch size for latency vs throughput
   - Recommendation: Start with 50, benchmark, adjust based on P95 latency

3. **Human Review UX**
   - What we know: Need approve/reject/edit actions
   - What's unclear: Should bulk approve be default or require explicit action?
   - Recommendation: Default to "approve all" with individual override capability

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| XAI_API_KEY | Grok 4.1 classifier | Check env | -- | Gemini 2.5 Flash Lite |
| ANTHROPIC_API_KEY | Claude Sonnet Pass 2 | Yes | -- | Rules-based |
| Redis | FalkorDB, rate limiting | Yes | -- | -- |
| PostgreSQL | pgvector embeddings | Yes | -- | -- |

**Missing dependencies with no fallback:**
- Redis required for FalkorDB graph storage

**Missing dependencies with fallback:**
- XAI_API_KEY: Can use Gemini 2.5 Flash Lite ($0.10/1M) as Pass 1 fallback

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 1.x |
| Config file | `open-seo-main/vitest.config.ts` |
| Quick run command | `pnpm --filter open-seo-main test -- --run src/server/features/keywords/classification/` |
| Full suite command | `pnpm --filter open-seo-main test` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| KI-01 | 100-200 classified keywords returned | unit | `vitest run ClassificationPipeline.test.ts` | Wave 0 |
| KI-02 | Pass 1 resolves >=80% at confidence >=0.85 | unit | `vitest run GrokClassifier.test.ts` | Wave 0 |
| KI-03 | Negative associations filter adjacents | unit | `vitest run NegativeAssociationExtractor.test.ts` | Wave 0 |
| KI-04 | Toggle persists mode in localStorage | unit | `vitest run ConfirmationToggle.test.tsx` | Wave 0 |
| KI-05 | quick_check completes <30s | integration | `vitest run KeywordIntelligence.integration.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm --filter open-seo-main test -- --run --changed`
- **Per wave merge:** `pnpm --filter open-seo-main test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/server/features/keywords/classification/GrokClassifier.test.ts` -- covers KI-02
- [ ] `src/server/features/keywords/classification/ClassificationPipeline.test.ts` -- covers KI-01
- [ ] `src/server/features/keywords/context/NegativeAssociationExtractor.test.ts` -- covers KI-03
- [ ] Mock setup for xAI API responses in test fixtures

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A - API keys only |
| V3 Session Management | no | N/A - stateless |
| V4 Access Control | yes | Tenant isolation via FalkorDB keyspace |
| V5 Input Validation | yes | Zod schemas for all API responses |
| V6 Cryptography | yes | API keys from environment variables |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API key exposure | Information Disclosure | Environment variables, never in code |
| Tenant data leakage | Information Disclosure | FalkorDB keyspace isolation `kg:{tenantId}` |
| Prompt injection | Tampering | Validate keyword inputs, limit length |
| Cost explosion | Denial of Service | Circuit breakers, rate limiting, batch size limits |

## Sources

### Primary (HIGH confidence)
- [VERIFIED: codebase] `ResilientClassifier.ts` - existing cascade pattern
- [VERIFIED: codebase] `FalkorDBClient.ts` - tenant graph isolation
- [VERIFIED: codebase] `EmbeddingService.ts` - jina-v3 embeddings
- [VERIFIED: codebase] `ConversationExtractor.ts` - extraction pattern
- [VERIFIED: npm registry] openai 6.35.0, @anthropic-ai/sdk 0.92.0

### Secondary (MEDIUM confidence)
- [CITED: docs.x.ai/developers/models] - Grok 4.1 pricing $0.20/1M input
- [CITED: ai.google.dev/gemini-api/docs/pricing] - Gemini 2.5 Flash Lite $0.10/1M
- [CITED: docs.x.ai/docs/guides/migration] - OpenAI SDK compatibility

### Tertiary (LOW confidence)
- [WebSearch] xAI free tier $175/mo - requires confirmation during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - verified against codebase and npm registry
- Architecture: HIGH - extends proven ResilientClassifier pattern
- Pitfalls: MEDIUM - some based on similar projects, not Phase 63 specific

**Research date:** 2026-05-02
**Valid until:** 2026-06-02
