"""BGE Reranker module for cross-encoder reranking.

Phase 73-03: Retrieval Quality Enhancement

This module provides:
- BGE Reranker v2 M3 for cross-encoder scoring
- +3-8 recall@10 improvement at ~80ms per (query, candidate) pair
- Multilingual support (good for Lithuanian)

Reference:
- .planning/phases/73-infrastructure-optimization/73-03-PLAN.md
- docs/infra-research/cpu-only-rag-graph.md
"""

from .bge_reranker import BGEReranker, get_reranker, rerank_candidates

__all__ = [
    "BGEReranker",
    "get_reranker",
    "rerank_candidates",
]
