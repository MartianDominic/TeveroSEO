---
phase: 74
name: Jina Embedding Benchmark
status: in_progress
estimated_hours: 6
priority: high
---

# Phase 74: Jina Embedding Benchmark

## Goal

Build a local benchmark to compare jina-embeddings-v3, v5-text-nano, and v5-text-small for Lithuanian e-commerce retrieval. Definitively prove whether v5-small matches v3's quality and confirm v5-nano's expected failure on Lithuanian.

## Background

TeveroSEO uses jina-embeddings-v3 at 768-dim for keyword classification and retrieval. Research identified potential upgrades:

| Model | Lithuanian | Backbone | Risk |
|-------|-----------|----------|------|
| v3 | ✅ Proven (AUC-ROC 0.887) | XLM-RoBERTa | Baseline |
| v5-nano | ❌ NOT SUPPORTED | EuroBERT (15 langs) | HIGH |
| v5-small | ⚠️ Likely (119+ langs) | Qwen3-0.6B | Needs validation |

## Research Findings

From prior session research:
- v5-nano's EuroBERT backbone explicitly excludes Baltic languages
- v5-small's Qwen3 backbone claims Lithuanian support but needs validation
- v5 uses different prefixes: `Query:`/`Document:` vs v3's `query:`/`passage:`
- Migration cost is trivial (~$0.40 for test corpus)

## Plans

| Plan | Focus | Status |
|------|-------|--------|
| 74-01 | Test Data & Corpus | Ready |
| 74-02 | Embedding Generator | Ready |
| 74-03 | Evaluation Metrics | Ready |
| 74-04 | Main Benchmark Runner | Blocked on 74-01,02,03 |

## Success Criteria

1. Clear metrics table showing Recall@10, MRR, NDCG for all 3 models
2. v5-nano LT metrics confirm failure (<60% recall)
3. v5-small vs v3 comparison enables data-driven decision
4. Reproducible benchmark script for future model evaluations
