# Phase 86: Semantic Intelligence - Documentation Index

> **Last Updated**: 2026-05-05

## Overview

Phase 86 implements the Semantic Intelligence layer for keyword analysis, including embeddings, clustering, classification, and LLM-powered analysis.

---

## Document Map

### Core Planning Documents

| Document | Purpose | Status |
|----------|---------|--------|
| `86-CONTEXT.md` | Phase context and dependencies | Reference |
| `86-01-PLAN.md` | Embedding infrastructure | Ready |
| `86-02-PLAN.md` | Clustering service | Ready |
| `86-03-PLAN.md` | Classification pipeline | Ready |
| `86-04-PLAN.md` | LLM classifier integration | Ready |
| `86-05-PLAN.md` | SERP enrichment | Ready |
| `86-06-PLAN.md` | CopilotKit integration | Ready |
| `86-07-PLAN.md` | Backfill processing | Ready |
| `86-08-PLAN.md` | Halfvec quantization | Ready |
| `86-09-PLAN.md` | Production optimization | Ready |
| `86-10-PLAN.md` | Monitoring & observability | Ready |

### Cost & Architecture Documentation

| Document | Purpose | Priority |
|----------|---------|----------|
| **MODEL-REFERENCE.md** | Authoritative model list (May 2026) | **READ FIRST** |
| **IMPLEMENTATION-GUIDE.md** | Step-by-step implementation guide | **Implementation** |
| **COST-CONTROL-MASTER.md** | Complete cost inventory & optimization | Reference |
| **LLM-ARCHITECTURE.md** | LLM architecture decisions | Reference |
| **API-COST-ANALYSIS.md** | Detailed API cost breakdown | Reference |
| **COST-OPTIMIZATION-DEEP-DIVE.md** | Deep optimization techniques | Reference |
| **IMPLEMENTATION-GAP-ANALYSIS.md** | Gap analysis vs. current codebase | Reference |

---

## Quick Reference

### Target Model Architecture

```
ANALYSIS:  grok-4.1-fast / grok-4.1-thinking
CONTENT:   gemini-3.1-pro
IMAGES:    gemini-3.1-flash-image-preview
VOICE:     gemini-3.1-pro (or claude-sonnet-4-6)
BACKUP:    kimi-2.6
```

### Key Optimizations

1. **GSC-First Ranking** — Use GSC for ranking data (FREE), DataForSEO only for discovery
2. **Local Embedding Server** — Eliminate Jina API costs
3. **Batching** — 200 keywords/batch for classification (4x improvement)
4. **Quality Analysis** — Consolidate 7 calls → 1 call (85% savings)

### Estimated Savings

| Optimization | Monthly Savings |
|--------------|-----------------|
| GSC-first ranking | $105-120 |
| Local embeddings | $5-500 |
| Batching improvements | $100-200 |
| PageSpeed Insights (free) | $30-50 |
| **TOTAL** | **$270-910/mo** |

---

## Implementation Priority

### Week 1: Quick Wins
- [ ] Deploy local embedding server
- [ ] Replace Lighthouse with PageSpeed Insights
- [ ] Increase classification batch size to 200

### Week 2: GSC-First Ranking
- [ ] Add ranking source column to schema
- [ ] Create GscRankingMatcher service
- [ ] Modify ranking-processor for GSC-first logic

### Week 3: Batching
- [ ] Consolidate quality analysis (7→1 call)
- [ ] Implement true translation batching
- [ ] Batch Pass 2 refinement

### Week 4: Model Migration
- [ ] Update 42 files with correct model IDs
- [ ] Test all updated services

---

## Related Documents

- `/CLAUDE.md` — Project-level LLM architecture
- `/.planning/ROADMAP.md` — Master roadmap
- `/.planning/phases/PHASE-85-89-DEEP-DIVE.md` — Phases 85-89 technical overview
