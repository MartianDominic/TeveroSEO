---
phase: 37-brand-voice
plan: 02
subsystem: voice-analysis
tags: [ai, claude, bullmq, scraper, tdd]
dependency_graph:
  requires: [37-01-voice-schema]
  provides: [voice-analyzer, voice-queue, voice-worker]
  affects: [voice-profiles, voice-analysis-table]
tech_stack:
  added: [anthropic-sdk]
  patterns: [sandboxed-processor, checkpoint-resume, weighted-aggregation]
key_files:
  created:
    - src/server/features/voice/types.ts
    - src/server/features/voice/services/VoiceAnalyzer.ts
    - src/server/features/voice/services/VoiceAnalyzer.test.ts
    - src/server/queues/voiceAnalysisQueue.ts
    - src/server/workers/voice-analysis-worker.ts
    - src/server/workers/voice-analysis-processor.ts
  modified:
    - src/server/features/voice/index.ts
    - src/worker-entry.ts
decisions:
  - Claude claude-3-5-sonnet model for voice extraction (env configurable)
  - Zod validation for AI response parsing
  - Weighted aggregation by confidence score for multi-page analysis
  - Rate limit 1 concurrent voice analysis job per client
metrics:
  duration_minutes: 8
  completed: 2026-04-23T15:42:00Z
---

# Phase 37 Plan 02: Voice Analysis Service Summary

AI-powered voice extraction from scraped content with BullMQ background processing.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create voice analysis types | cbb4aa9 | types.ts, index.ts |
| 2 | Implement VoiceAnalyzer with TDD | 922b835 | VoiceAnalyzer.ts, VoiceAnalyzer.test.ts |
| 3 | Create BullMQ queue and worker | 589ebf1 | voiceAnalysisQueue.ts, voice-analysis-worker.ts, voice-analysis-processor.ts, worker-entry.ts |

## Implementation Details

### VoiceAnalyzer Service

**analyzePageVoice(page, domain)**
- Sends PageAnalysis content to Claude AI
- Extracts 12 voice dimensions with confidence score
- Validates response with Zod schema
- Returns VoiceExtractionResult

**buildVoicePrompt(pages)**
- Builds structured prompt with all 12 dimension definitions
- Includes archetype definitions and confidence scoring guidelines
- Aggregates content from multiple pages

**aggregateVoiceResults(results)**
- Combines multiple page analyses into single profile
- Weighted averaging by confidence for numeric fields
- Most-common selection for categorical fields
- Array deduplication for lists

### BullMQ Voice Analysis Queue

**voiceAnalysisQueue**
- Queue name: `voice-analysis`
- Default attempts: 3 with exponential backoff (15s base)
- Rate limited: max 1 concurrent job per client (T-37-05)

**queueVoiceAnalysis(clientId, profileId, urls)**
- Queues voice learning job
- Validates no existing active job for client
- Returns job ID for progress tracking

### Voice Analysis Worker

**voice-analysis-worker.ts**
- Sandboxed processor for isolation
- Lock duration: 180s (AI calls take time)
- Concurrency: 3 (Claude API rate limit friendly)
- Graceful shutdown: 30s timeout
- DLQ for failed jobs

**voice-analysis-processor.ts**
- Scrapes each URL sequentially
- Extracts voice with VoiceAnalyzer
- Saves individual results to voice_analysis table
- Updates job progress for real-time tracking
- Aggregates results on completion
- Updates voice_profiles with final dimensions

## Threat Mitigations

| Threat ID | Mitigation |
|-----------|------------|
| T-37-03 | URL validation before scraping |
| T-37-04 | Only log metadata, not full scraped content |
| T-37-05 | Rate limit 1 concurrent job per client |

## Test Results

```
Test Files  1 passed (1)
     Tests  7 passed (7)
  Duration  452ms
```

Tests cover:
- 12 dimension extraction
- Low confidence for minimal content
- Malformed AI output rejection
- Prompt includes all dimensions
- Weighted aggregation
- Array merging
- Categorical value selection

## Verification Checklist

- [x] VoiceAnalyzer.test.ts passes with mocked Anthropic
- [x] Queue can be instantiated and accepts jobs
- [x] Worker starts without errors (added to worker-entry.ts)
- [x] Job progress updates via job.updateProgress()

## Self-Check: PASSED

All created files exist and commits verified:
- cbb4aa9: feat(37-02): create voice analysis types
- 922b835: feat(37-02): implement VoiceAnalyzer with TDD
- 589ebf1: feat(37-02): create BullMQ voice analysis queue and worker
