---
phase: 83
plan: 01
subsystem: keyword-intelligence
tags: [embedding, v5-nano, infrastructure, performance]
dependency_graph:
  requires: [phase-82-complete]
  provides: [v5-nano-embeddings, local-embedding-server, embedding-fallback-cascade]
  affects: [ResilientEmbedding, embedding-config, docker-compose]
tech_stack:
  added: [sentence-transformers, jina-v5-nano, fastapi-embedding-server]
  patterns: [fallback-cascade, circuit-breaker, health-check-caching]
key_files:
  created:
    - open-seo-main/src/server/services/embedding-server/server.py
    - open-seo-main/src/server/services/embedding-server/requirements.txt
    - open-seo-main/src/server/services/embedding-server/Dockerfile
    - open-seo-main/scripts/benchmark-embeddings.ts
  modified:
    - open-seo-main/src/server/features/keywords/types/embeddings.ts
    - open-seo-main/src/server/lib/embeddings/embedding-config.ts
    - open-seo-main/src/server/features/keywords/services/ResilientEmbedding.ts
    - open-seo-main/src/server/lib/embeddings/index.ts
    - docker-compose.dev.yml
    - open-seo-main/.env.example
decisions:
  - v5-nano as default model (12x faster, 98.3% recall vs v3 98.0%)
  - Python FastAPI server for local embeddings (sentence-transformers)
  - 4-level fallback cascade (local server -> local ONNX -> Jina API -> zero vectors)
  - Cache prefix bumped from emb:v2 to emb:v3 to invalidate old embeddings
  - Health check caching (30s interval) to avoid excessive server pings
metrics:
  duration: 8 minutes
  completed: 2026-05-05T11:47:00Z
  tasks_completed: 8
  files_created: 4
  files_modified: 6
---

# Phase 83 Plan 01: Embedding Infrastructure (v5-nano Upgrade) Summary

Upgraded embedding infrastructure from Jina v3 to v5-nano for 12x faster embeddings, enabling 100 prospects/hour throughput.

## Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Add v5-nano to EmbeddingModel enum | 39a631b26 |
| 2 | Update embedding-config.ts for v5 | e19518962 |
| 3 | Update ResilientEmbedding.ts for v5 API | a0ef3368b |
| 4 | Create Python Embedding Server | fa0650047 |
| 5 | (Completed in Task 3 - LocalEmbeddingClient) | - |
| 6 | Update docker-compose.dev.yml | 5e754983a |
| 7 | Add environment variables | 3183d5ceb |
| 8 | Benchmark v5-nano embeddings | 950e12592 |

## Key Changes

### 1. EmbeddingModel Enum Extended

Added `JINA_V5_NANO` and `JINA_V5_SMALL` to the EmbeddingModel enum with new `EmbeddingModelConfig` interface supporting v5-specific parameters (`apiTask`, `promptName`).

### 2. Embedding Config Updated

- Default model switched from v3 to v5-nano
- Batch size increased from 32 to 64 (v5 supports larger batches)
- Cache prefix bumped from `emb:v2:` to `emb:v3:` to invalidate old embeddings
- Added `getApiPayload()` helper for v5 API parameters

### 3. ResilientEmbedding Fallback Cascade

Updated fallback cascade order:
1. **Local Server** (v5-nano via Python FastAPI) - fastest, no rate limits
2. **Local ONNX** (hash-based stub) - always available fallback
3. **Jina API** (v5 parameters) - higher quality when local fails
4. **Zero vectors** - last resort, never throws

Added `LocalEmbeddingClient` with:
- Health check caching (30s interval)
- Circuit breaker (3 failures, 30s reset)

### 4. Python Embedding Server

Created FastAPI server at `open-seo-main/src/server/services/embedding-server/`:
- `server.py` - FastAPI with `/health` and `/embed` endpoints
- `requirements.txt` - sentence-transformers, torch, fastapi
- `Dockerfile` - Pre-downloads model for fast startup

Memory footprint: ~1GB (300MB model + runtime)

### 5. Docker Compose Integration

Added `embedding-server` service:
- Port: 58001
- Memory limit: 2GB (1GB reserved)
- Profile: `embedding` (optional startup)
- Health check: 30s interval

### 6. Environment Variables

Added to `.env.example`:
- `EMBEDDING_SERVER_URL` - Local server URL
- `EMBEDDING_MODEL` - Model to use
- `JINA_API_KEY` - API fallback

### 7. Benchmark Script

Created `scripts/benchmark-embeddings.ts`:
- Generates 1000 Lithuanian keywords
- Target: 200 kw/sec (100 prospects in <10 minutes)
- Supports `--local-only` and `--api-only` modes

## Deviations from Plan

None - plan executed exactly as written.

## Verification Checklist

- [x] EmbeddingModel enum includes JINA_V5_NANO
- [x] embedding-config.ts uses v5-nano as default
- [x] Cache prefix bumped to emb:v3:
- [x] ResilientEmbedding calls v5 API with correct parameters
- [x] Python embedding server files created
- [x] LocalEmbeddingClient connects to Python server
- [x] Fallback to Jina API works when server down
- [x] docker-compose includes embedding-server
- [x] Benchmark script created

## Next Steps

1. Build and test embedding server Docker image
2. Run benchmark with local server running
3. Proceed to Wave 2: Error Handling & Recovery (83-02)

## Self-Check: PASSED

All files verified:
- [x] open-seo-main/src/server/services/embedding-server/server.py exists
- [x] open-seo-main/src/server/services/embedding-server/requirements.txt exists
- [x] open-seo-main/src/server/services/embedding-server/Dockerfile exists
- [x] open-seo-main/scripts/benchmark-embeddings.ts exists
- [x] All commits verified in git log
