# Edge Cases & Error Handling Analysis

**Analysis Date**: 2026-05-04
**Analyst**: Opus 4.5 (Reliability & Recovery Specialist)
**Focus**: Bulletproof reliability for agencies who can't afford failures during client calls

> This is Section 8 of the World-Class Keyword Analysis research.
> Content should be merged into WORLD-CLASS-KEYWORD-ANALYSIS.md

---

## Executive Summary

The current implementation has a **single-layer error handling architecture** that is inadequate for agency use. When an analysis fails at stage 7 after 2 minutes of processing, all work is lost. Users see a generic "Analysis failed" message with no recovery options. This is unacceptable for agencies presenting to prospects.

**Critical Finding: Agency Risk Level = HIGH**

During client calls, a failure at any stage means:
- All progress is lost
- No way to resume from checkpoint
- Client sees only "Analysis failed" error
- Agency looks unprofessional

---

## Current State Assessment

**Architecture Overview:**
- SSE streaming endpoint (`/api/keyword-chat/analyze`) with 15-second heartbeat
- 8-stage pipeline: constraints -> funnel -> geo -> relevance -> filter -> select -> pSEO -> side keywords
- Basic validation: clientId, conversation (string), keywords (array 1-10000)
- Single try/catch wrapper, no per-stage recovery
- No checkpointing, no partial result persistence

**Identified Gaps:**
1. No checkpoint system (progress lost on any failure)
2. No SSE reconnection logic (browser close = restart)
3. No graceful degradation (all-or-nothing stages)
4. No retry with backoff (API failures = immediate abort)
5. Generic error messages (no actionable guidance)
6. No partial result export (lose everything)
7. No input sanitization (encoding, duplicates, limits)

---

## Missing Error Handling (Ranked by Likelihood x Impact)

### CRITICAL (Likelihood: HIGH x Impact: CATASTROPHIC)

| # | Edge Case | Current Behavior | Recommended Fix |
|---|-----------|------------------|-----------------|
| 1 | **LLM API timeout** (conversation intelligence) | Generic error, full restart | Circuit breaker + cached fallback + graceful degradation to rule-based extraction |
| 2 | **Mid-pipeline browser close** | All progress lost forever | Auto-checkpoint after each stage to IndexedDB + session recovery on reconnect |
| 3 | **SSE connection drop** (mobile/unstable network) | Silent failure, user confused | Auto-reconnect with exponential backoff (max 5 retries) + resume from last checkpoint |
| 4 | **Database connection lost** during save | Silent failure, results lost | Offline queue with sync-on-reconnect + local storage fallback |
| 5 | **Out of memory** (50k+ keywords) | Browser crash | Progressive loading + streaming batches of 1000 + memory pressure monitoring |

### HIGH (Likelihood: MEDIUM x Impact: HIGH)

| # | Edge Case | Current Behavior | Recommended Fix |
|---|-----------|------------------|-----------------|
| 6 | **Embedding API rate limit (429)** | Pipeline crash | Exponential backoff (100ms, 200ms, 400ms...) + batch splitting + queue management |
| 7 | **Partial pipeline failure** (one stage errors) | Full abort | Skip optional stages (pSEO, side keywords) + mark as incomplete + allow manual re-run of failed stage |
| 8 | **DataForSEO timeout** | No intent data | Use cached intent from previous runs + fallback to pattern-only classification |
| 9 | **Duplicate keywords** (user uploads same file twice) | Process all, waste resources | Dedup before processing + warn user + preserve original order |
| 10 | **Keywords exceed memory** (10k with embeddings) | Slow/crash | Streaming batches + dispose processed batches + use ArrayBuffer views |

### MEDIUM (Likelihood: MEDIUM x Impact: MEDIUM)

| # | Edge Case | Current Behavior | Recommended Fix |
|---|-----------|------------------|-----------------|
| 11 | **Non-UTF8 characters** | Potential garbled output | Detect encoding + normalize to UTF-8 + warn on conversion |
| 12 | **Keywords in wrong language** | Poor classification | Detect language + warn + skip or use generic patterns |
| 13 | **Empty conversation** | Process with no constraints | Default to generic constraints + flag as low-confidence |
| 14 | **Garbled/corrupted conversation** | LLM hallucination | Validate structure + confidence threshold + fallback prompt |
| 15 | **Special characters in keywords** | Regex breakage | Escape special chars before pattern matching |

### LOW (Likelihood: LOW x Impact: VARIABLE)

| # | Edge Case | Current Behavior | Recommended Fix |
|---|-----------|------------------|-----------------|
| 16 | **Concurrent sessions same client** | Race conditions | Optimistic locking + session versioning |
| 17 | **Clock skew** (incorrect timestamps) | Minor inconsistencies | Use server time for all timestamps |
| 18 | **Unicode normalization** (e.g., accented characters) | Inconsistent matching | NFC normalization before processing |
| 19 | **Extremely long keywords** (> 200 chars) | May break UI | Truncate with ellipsis + tooltip |
| 20 | **Zero-volume keywords** | Included in results | Flag as "no data" + separate section |

---

## Recovery Flow Diagrams

### Flow 1: SSE Connection Recovery

```
[User Action] ────► [POST /api/keyword-chat/analyze]
                            │
                            ▼
                    [SSE Stream Started]
                            │
    ┌───────────────────────┼───────────────────────┐
    │                       │                       │
    ▼                       ▼                       ▼
[Stage 1-3]           [Connection Drop]        [Stage 4-8]
    │                       │                       │
    ▼                       ▼                       ▼
[Checkpoint            [Detect via              [Complete]
 to IndexedDB]         heartbeat miss]
                            │
                            ▼
                    ┌───────────────┐
                    │ Retry Logic   │
                    │ ─────────────│
                    │ Attempt 1: 1s │
                    │ Attempt 2: 2s │
                    │ Attempt 3: 4s │
                    │ Attempt 4: 8s │
                    │ Attempt 5: 16s│
                    └───────┬───────┘
                            │
            ┌───────────────┴───────────────┐
            │                               │
            ▼                               ▼
    [Reconnect Success]            [All Retries Failed]
            │                               │
            ▼                               ▼
    [Resume from last              [Show Recovery UI]
     checkpoint stage]             [Export partial results]
            │                      [Save to local storage]
            ▼
    [Continue pipeline]
            │
            ▼
    [Complete analysis]
```

### Flow 2: Graceful Degradation Pipeline

```
[Analysis Request]
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ STAGE 1: Extract Constraints                                  │
│ ──────────────────────────────────────────────────────────── │
│ Primary: LLM extraction (Claude/GPT)                          │
│ Fallback 1: Cached constraints from previous session          │
│ Fallback 2: Rule-based extraction (regex patterns)            │
│ Fallback 3: Prompt user for manual input                      │
│                                                               │
│ [Timeout 30s] ──► [Try next fallback]                         │
└───────────────────────────────────────────────────────────────┘
        │
        ▼ (checkpoint: constraints)
┌───────────────────────────────────────────────────────────────┐
│ STAGE 2-3: Classification (Funnel + Geo)                      │
│ ──────────────────────────────────────────────────────────── │
│ Primary: Jina embeddings + similarity scoring                 │
│ Fallback 1: Pattern-based classification only                 │
│ Fallback 2: DataForSEO intent-only classification             │
│                                                               │
│ [Rate Limit 429] ──► [Exponential backoff + batch split]      │
└───────────────────────────────────────────────────────────────┘
        │
        ▼ (checkpoint: classifications)
┌───────────────────────────────────────────────────────────────┐
│ STAGE 4-6: Scoring & Selection (REQUIRED)                     │
│ ──────────────────────────────────────────────────────────── │
│ These stages MUST complete for valid results                  │
│ No graceful degradation - retry or fail                       │
│                                                               │
│ [Error] ──► [Retry 3x with backoff] ──► [Show partial results]│
└───────────────────────────────────────────────────────────────┘
        │
        ▼ (checkpoint: selection - MINIMUM VIABLE RESULT)
┌───────────────────────────────────────────────────────────────┐
│ STAGE 7-8: Discovery (OPTIONAL - can skip)                    │
│ ──────────────────────────────────────────────────────────── │
│ pSEO detection + side keyword expansion                       │
│                                                               │
│ [Error] ──► [Mark as "discovery unavailable"] ──► [Complete]  │
│            [Show "Run Discovery" button for manual retry]     │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
[Complete with quality indicator]
   ├── "Full analysis" (all stages succeeded)
   ├── "Partial analysis" (core + some optional)
   └── "Basic analysis" (core only, fallbacks used)
```

### Flow 3: Checkpoint & Resume Data Model

```typescript
interface AnalysisCheckpoint {
  // Identity
  sessionId: string;
  clientId: string;
  workspaceId: string;
  
  // Input (immutable after start)
  request: {
    conversation: string;
    keywords: string[];
    config: AnalysisConfig;
  };
  
  // Progress tracking
  currentStage: AnalysisStage;
  completedStages: AnalysisStage[];
  
  // Partial results (accumulated)
  partialResults: {
    constraints?: AnalysisConstraints;
    funnelBreakdown?: FunnelBreakdown;
    geoBreakdown?: GeoBreakdown;
    selection?: SelectionResult;
    filtering?: FilteringResult;
    pseoOpportunities?: PSEOOpportunity[];
    sideKeywords?: SideKeyword[];
  };
  
  // Recovery metadata
  createdAt: number;
  lastUpdatedAt: number;
  expiresAt: number; // 24 hours from start
  retryCount: number;
  errorLog: Array<{
    stage: AnalysisStage;
    error: string;
    timestamp: number;
    retryable: boolean;
  }>;
  
  // Quality indicators
  degradedStages: AnalysisStage[]; // Used fallbacks
  skippedStages: AnalysisStage[];  // Intentionally skipped
}

// Storage locations (hierarchical fallback)
const CHECKPOINT_STORAGE = {
  primary: 'IndexedDB',        // Most reliable, works offline
  fallback: 'localStorage',    // If IndexedDB unavailable
  sync: 'server',              // On reconnect, sync to server
};
```

---

## User Communication Guidelines

### Error Message Templates

```typescript
const ERROR_MESSAGES = {
  // Connection errors
  CONNECTION_LOST: {
    title: "Connection interrupted",
    body: "Your analysis is safe. Reconnecting automatically...",
    action: "Reconnecting ({retryCount}/5)...",
    fallbackAction: "Reconnect manually"
  },
  
  // Processing errors
  STAGE_TIMEOUT: {
    title: "Analysis is taking longer than expected",
    body: "Stage '{stageName}' is slow. This can happen with large keyword sets.",
    action: "Continue waiting",
    fallbackAction: "Skip this stage"
  },
  
  // API errors
  RATE_LIMITED: {
    title: "Temporarily rate limited",
    body: "Processing will resume automatically in {seconds} seconds.",
    action: null, // Auto-resume
    showProgress: true
  },
  
  LLM_UNAVAILABLE: {
    title: "AI analysis temporarily unavailable",
    body: "Using backup classification method. Results may be less detailed.",
    action: "Continue with backup",
    fallbackAction: "Wait for AI service"
  },
  
  // Data errors
  INVALID_KEYWORDS: {
    title: "{count} keywords have issues",
    body: "Found: {issues}. These will be processed with warnings.",
    action: "Continue",
    fallbackAction: "Review and fix"
  },
  
  // Success variants
  PARTIAL_SUCCESS: {
    title: "Analysis complete (partial)",
    body: "Some optional features were unavailable: {skippedFeatures}",
    action: "View results",
    secondaryAction: "Run full analysis later"
  }
};
```

### Progress Preservation UI

```typescript
interface ProgressUI {
  // Always visible during analysis
  progressBar: {
    current: number;        // 0-100
    stage: string;          // Human-readable stage name
    eta?: number;           // Estimated seconds remaining
    savedAt?: number;       // Last checkpoint timestamp
  };
  
  // On error/disconnect
  recoveryUI: {
    show: boolean;
    status: 'reconnecting' | 'failed' | 'recovered';
    partialResultsAvailable: boolean;
    actions: Array<{
      label: string;
      handler: () => void;
      primary?: boolean;
    }>;
  };
  
  // Export partial results
  exportOptions: {
    format: 'csv' | 'json' | 'xlsx';
    includeMetadata: boolean;
    includeErrors: boolean;
  };
}
```

---

## Implementation Priority Matrix

| Fix | Effort | Impact | Priority | Sprint |
|-----|--------|--------|----------|--------|
| Checkpoint/Resume system | HIGH | CRITICAL | P0 | Week 1 |
| SSE auto-reconnect | MEDIUM | HIGH | P0 | Week 1 |
| Graceful degradation pipeline | HIGH | HIGH | P1 | Week 2 |
| Export partial results | LOW | HIGH | P1 | Week 2 |
| Exponential backoff retry | LOW | MEDIUM | P1 | Week 2 |
| Input validation (encoding, dedup) | MEDIUM | MEDIUM | P2 | Week 3 |
| Memory pressure monitoring | MEDIUM | MEDIUM | P2 | Week 3 |
| Error message templates | LOW | MEDIUM | P2 | Week 3 |
| Offline queue with sync | HIGH | HIGH | P3 | Month 1 |
| Circuit breaker pattern | MEDIUM | HIGH | P3 | Month 1 |

---

## Required Code Changes Summary

### 1. New Files Required

```
apps/web/src/lib/keyword-chat/
  checkpoint-manager.ts       # IndexedDB checkpoint CRUD
  connection-manager.ts       # SSE reconnect logic
  error-handler.ts            # Error categorization + messages
  graceful-degradation.ts     # Fallback pipeline logic
  retry-utils.ts              # Exponential backoff utilities
```

### 2. Modified Files

```
apps/web/src/app/api/keyword-chat/analyze/route.ts
  + Add per-stage checkpointing
  + Add timeout per stage (configurable)
  + Add graceful degradation paths
  + Return checkpoint ID in stream

apps/web/src/hooks/useKeywordAnalysis.ts
  + Add reconnection logic
  + Add checkpoint recovery
  + Add partial result export
  + Add progress preservation state

apps/web/src/lib/keyword-chat/analysis-pipeline.ts
  + Add stage-level try/catch
  + Add fallback service injection
  + Add skip-stage capability
  + Add quality indicator calculation

apps/web/src/lib/keyword-chat/types.ts
  + Add checkpoint types
  + Add error event types with stage
  + Add quality indicator types
```

### 3. New Dependencies

```json
{
  "idb": "^8.0.0",           // IndexedDB wrapper for checkpoints
  "p-retry": "^6.0.0"        // Retry with backoff (or custom impl)
}
```

---

## Testing Edge Cases

```typescript
describe("Keyword Analysis Error Recovery", () => {
  // Connection recovery
  it("resumes from checkpoint after disconnect", async () => {});
  it("exports partial results when all retries fail", async () => {});
  it("shows correct progress after reconnect", async () => {});
  
  // Graceful degradation
  it("uses pattern-only when embeddings unavailable", async () => {});
  it("skips pSEO stage on timeout without failing", async () => {});
  it("marks analysis as partial when fallbacks used", async () => {});
  
  // Input validation
  it("handles 50k keywords without crashing", async () => {});
  it("deduplicates keywords before processing", async () => {});
  it("sanitizes non-UTF8 input", async () => {});
  
  // Rate limiting
  it("backs off on 429 and resumes automatically", async () => {});
  it("splits batches when rate limited", async () => {});
  
  // User communication
  it("shows clear error messages for each failure type", async () => {});
  it("preserves progress on screen during reconnect", async () => {});
});
```

---

## NEVER LOSE USER WORK Checklist

- [ ] Every stage emits checkpoint before proceeding
- [ ] Connection drop detected within 30 seconds (via heartbeat miss)
- [ ] Auto-reconnect attempts immediately with exponential backoff
- [ ] Partial results always exportable (CSV/JSON even on failure)
- [ ] Local storage backup for IndexedDB failures
- [ ] Server-side session recovery on page refresh
- [ ] Quality indicators visible (full/partial/basic)
- [ ] Clear user messaging for every error state
- [ ] Manual "resume" button if auto-recovery fails
- [ ] 24-hour session expiry with warning

---

## Input Validation Edge Cases

### Empty/Malformed Input

```typescript
const INPUT_VALIDATION = {
  // Empty arrays
  emptyKeywords: {
    check: (kw: string[]) => kw.length === 0,
    error: "No keywords provided",
    action: "Show helpful prompt to paste/upload keywords"
  },
  
  // Too many keywords (exceeds limit)
  tooManyKeywords: {
    check: (kw: string[]) => kw.length > 10000,
    error: "Maximum 10,000 keywords allowed",
    action: "Offer to split into batches or truncate"
  },
  
  // Absurd keyword count (DoS prevention)
  absurdKeywordCount: {
    check: (kw: string[]) => kw.length > 50000,
    error: "Keyword limit exceeded",
    action: "Hard reject, no processing"
  },
  
  // Empty conversation (no context)
  emptyConversation: {
    check: (conv: string) => conv.trim().length === 0,
    warn: "No conversation context provided",
    action: "Use generic constraints, flag as low-confidence"
  },
  
  // Non-string keywords
  invalidKeywordTypes: {
    check: (kw: unknown[]) => kw.some(k => typeof k !== 'string'),
    error: "Invalid keyword format",
    action: "Filter out non-strings, warn user"
  },
  
  // Duplicate keywords
  duplicateKeywords: {
    check: (kw: string[]) => new Set(kw).size < kw.length,
    warn: "Duplicate keywords found",
    action: "Deduplicate, show count removed"
  }
};
```

### Character Encoding Issues

```typescript
const ENCODING_HANDLING = {
  // Non-UTF8 bytes
  detectEncoding: (text: string) => {
    // Check for UTF-8 BOM
    // Check for common encoding markers
    // Fallback to UTF-8
  },
  
  // Normalize Unicode
  normalizeUnicode: (keyword: string) => {
    return keyword
      .normalize('NFC')           // Canonical composition
      .replace(/\s+/g, ' ')       // Collapse whitespace
      .trim();
  },
  
  // Handle special characters
  escapeForRegex: (keyword: string) => {
    return keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },
  
  // Truncate long keywords
  truncateLong: (keyword: string, maxLength = 200) => {
    return keyword.length > maxLength 
      ? keyword.slice(0, maxLength) + '...'
      : keyword;
  }
};
```

---

## Memory Management for Large Datasets

```typescript
interface MemoryManagement {
  // Batch processing to avoid OOM
  batchSize: 1000;  // Process 1000 keywords at a time
  
  // Stream results instead of accumulating
  streamResults: true;
  
  // Dispose processed batches
  disposeOnComplete: true;
  
  // Memory pressure detection
  memoryCheck: () => {
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory;
      const usedPercent = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
      if (usedPercent > 0.9) {
        throw new Error('Memory pressure detected, pausing processing');
      }
    }
  };
  
  // Efficient data structures
  useTypedArrays: true;  // Float32Array for embeddings
  useWeakRefs: true;     // For cached data that can be garbage collected
}
```

---

## Timeout Configuration per Stage

```typescript
const STAGE_TIMEOUTS: Record<AnalysisStage, number> = {
  idle: 0,
  extracting_constraints: 30000,    // 30s - LLM can be slow
  classifying_funnel: 60000,        // 60s - depends on keyword count
  classifying_geo: 30000,           // 30s - pattern matching is fast
  scoring_relevance: 120000,        // 120s - embeddings can be slow
  filtering: 30000,                 // 30s - local processing
  selecting: 30000,                 // 30s - local processing
  discovering_pseo: 60000,          // 60s - optional, can skip
  discovering_side_keywords: 60000, // 60s - optional, can skip
  complete: 0,
};

// Per-stage timeout handling
const handleStageTimeout = async (stage: AnalysisStage) => {
  if (isOptionalStage(stage)) {
    return { skip: true, reason: 'timeout' };
  }
  return { retry: true, backoff: true };
};
```

---

## Conclusion

The current implementation is technically functional but **fragile under real-world conditions**. For agencies presenting to prospects, any failure is embarrassing and potentially deal-breaking. The priority must be:

1. **Never lose work** - Checkpoint everything, recover everything
2. **Degrade gracefully** - Something is better than nothing
3. **Communicate clearly** - Users should never wonder "what happened?"
4. **Enable recovery** - Manual options when automatic fails

The key insight: **Agency users are often on calls with prospects. Failures must be invisible or recoverable in seconds.**

---

*Analysis completed: 2026-05-04*
*Agent: Reliability & Recovery Specialist*
