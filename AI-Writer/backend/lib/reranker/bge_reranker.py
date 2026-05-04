"""
BGE Reranker v2 M3 for cross-encoder reranking.

Phase 73-03: Retrieval Quality Enhancement

Adds +3-8 recall@10 at ~80ms per (query, candidate) pair on AVX2 CPU.
Uses BAAI/bge-reranker-v2-m3 which is multilingual (good for Lithuanian).

Reference:
- .planning/phases/73-infrastructure-optimization/73-03-PLAN.md
- docs/infra-research/cpu-only-rag-graph.md
"""

import time
from typing import Any, List, Optional, Tuple

from loguru import logger

# Model: BAAI/bge-reranker-v2-m3 (multilingual, good for Lithuanian)
MODEL_NAME = "BAAI/bge-reranker-v2-m3"

# Lazy-loaded model instance
_model: Optional[Any] = None


class BGEReranker:
    """Cross-encoder reranker using BGE Reranker v2 M3.

    This class wraps the sentence-transformers CrossEncoder model
    for reranking search results. It provides:
    - Cross-encoder scoring for query-candidate pairs
    - Batch processing for efficiency
    - Metadata preservation during reranking

    The model is loaded lazily on first use to avoid startup overhead.

    Attributes:
        model: The CrossEncoder model instance
        device: Device to run inference on ('cpu' or 'cuda')
    """

    def __init__(self, device: str = "cpu"):
        """Initialize the BGE Reranker.

        Args:
            device: Device to run inference on. Defaults to 'cpu'.
                   Use 'cuda' if GPU is available for faster inference.
        """
        self.device = device
        self._model: Optional[Any] = None
        self._load_attempted = False

    def _ensure_model_loaded(self) -> None:
        """Lazy-load the model on first use.

        Raises:
            RuntimeError: If model loading fails (e.g., missing dependencies).
        """
        if self._model is not None:
            return

        if self._load_attempted:
            raise RuntimeError(
                "BGE Reranker model failed to load. "
                "Ensure sentence-transformers is installed."
            )

        self._load_attempted = True

        try:
            from sentence_transformers import CrossEncoder

            logger.info(f"Loading BGE Reranker model: {MODEL_NAME}")
            start_time = time.time()

            self._model = CrossEncoder(MODEL_NAME, device=self.device)

            load_time = time.time() - start_time
            logger.info(f"BGE Reranker loaded in {load_time:.2f}s on {self.device}")

        except ImportError as e:
            logger.error(f"Failed to import sentence-transformers: {e}")
            raise RuntimeError(
                "sentence-transformers is required for BGE Reranker. "
                "Install with: pip install sentence-transformers"
            ) from e
        except Exception as e:
            logger.error(f"Failed to load BGE Reranker model: {e}")
            raise RuntimeError(f"Failed to load BGE Reranker: {e}") from e

    def rerank(
        self,
        query: str,
        candidates: List[str],
        top_k: int = 10
    ) -> List[Tuple[int, float]]:
        """Rerank candidates by relevance to query.

        Uses cross-encoder scoring to compute relevance scores for each
        query-candidate pair, then returns the top-k most relevant candidates.

        Args:
            query: Search query string.
            candidates: List of candidate texts (e.g., top-50 from vector search).
            top_k: Number of results to return. Defaults to 10.
                  If larger than len(candidates), returns all candidates.

        Returns:
            List of (original_index, score) tuples, sorted by score descending.
            The original_index refers to the position in the input candidates list.

        Raises:
            RuntimeError: If model loading fails.
            ValueError: If query is empty.

        Example:
            >>> reranker = BGEReranker()
            >>> results = reranker.rerank(
            ...     query="laptop computer",
            ...     candidates=["desktop PC", "laptop notebook", "smartphone"],
            ...     top_k=2
            ... )
            >>> # Returns: [(1, 0.95), (0, 0.3)] - laptop notebook ranked first
        """
        if not query or not query.strip():
            raise ValueError("Query cannot be empty")

        if not candidates:
            return []

        self._ensure_model_loaded()

        # Create query-candidate pairs for scoring
        pairs = [[query, candidate] for candidate in candidates]

        # Get relevance scores from cross-encoder
        scores = self._model.predict(pairs, show_progress_bar=False)

        # Create indexed scores and sort by score descending
        indexed_scores = list(enumerate(scores))
        indexed_scores.sort(key=lambda x: x[1], reverse=True)

        # Return top_k results
        return indexed_scores[:min(top_k, len(candidates))]

    def rerank_with_metadata(
        self,
        query: str,
        candidates: List[dict],
        text_key: str = "text",
        top_k: int = 10
    ) -> List[dict]:
        """Rerank candidates while preserving metadata.

        This method is useful when candidates contain additional metadata
        (like IDs, scores, etc.) that should be preserved through reranking.

        Args:
            query: Search query string.
            candidates: List of candidate dicts. Each dict must contain
                       a text field (specified by text_key).
            text_key: Key in candidate dicts containing the text to score.
                     Defaults to "text".
            top_k: Number of results to return. Defaults to 10.

        Returns:
            List of candidate dicts with added 'rerank_score' field,
            sorted by rerank_score descending.

        Raises:
            RuntimeError: If model loading fails.
            ValueError: If query is empty or candidates lack text_key.
            KeyError: If any candidate is missing the text_key field.

        Example:
            >>> reranker = BGEReranker()
            >>> candidates = [
            ...     {"id": "1", "text": "laptop notebook", "score": 0.8},
            ...     {"id": "2", "text": "desktop PC", "score": 0.9},
            ... ]
            >>> results = reranker.rerank_with_metadata(
            ...     query="laptop computer",
            ...     candidates=candidates,
            ...     top_k=2
            ... )
            >>> # Returns candidates sorted by rerank_score, with original metadata
        """
        if not candidates:
            return []

        # Extract texts from candidates
        try:
            texts = [c[text_key] for c in candidates]
        except KeyError as e:
            raise KeyError(
                f"Candidate missing required key '{text_key}'. "
                f"Ensure all candidates have a '{text_key}' field."
            ) from e

        # Rerank using text content
        reranked = self.rerank(query, texts, top_k)

        # Build result with preserved metadata
        return [
            {**candidates[idx], "rerank_score": float(score)}
            for idx, score in reranked
        ]

    def score_pair(self, query: str, candidate: str) -> float:
        """Score a single query-candidate pair.

        Useful for scoring individual pairs without the overhead of
        sorting and filtering.

        Args:
            query: Search query string.
            candidate: Candidate text to score.

        Returns:
            Relevance score (higher = more relevant).

        Raises:
            RuntimeError: If model loading fails.
            ValueError: If query or candidate is empty.
        """
        if not query or not query.strip():
            raise ValueError("Query cannot be empty")
        if not candidate or not candidate.strip():
            raise ValueError("Candidate cannot be empty")

        self._ensure_model_loaded()

        scores = self._model.predict([[query, candidate]], show_progress_bar=False)
        return float(scores[0])


# Singleton instance for reuse across requests
_reranker: Optional[BGEReranker] = None


def get_reranker(device: str = "cpu") -> BGEReranker:
    """Get the singleton BGE Reranker instance.

    Creates the reranker on first call. Subsequent calls return the
    same instance for efficiency (model loading is expensive).

    Args:
        device: Device to run inference on. Only used on first call.
               Defaults to 'cpu'.

    Returns:
        Singleton BGEReranker instance.

    Note:
        The device parameter is only used when creating the instance.
        Subsequent calls ignore this parameter.
    """
    global _reranker
    if _reranker is None:
        _reranker = BGEReranker(device=device)
    return _reranker


async def rerank_candidates(
    query: str,
    candidates: List[dict],
    text_key: str = "text",
    top_k: int = 10
) -> List[dict]:
    """Async wrapper for reranking candidates.

    This function provides an async interface for use in FastAPI endpoints.
    The actual reranking is CPU-bound, so this runs in the default executor.

    Args:
        query: Search query string.
        candidates: List of candidate dicts with text field.
        text_key: Key containing text to score. Defaults to "text".
        top_k: Number of results to return. Defaults to 10.

    Returns:
        List of reranked candidates with 'rerank_score' field added.
    """
    import asyncio

    reranker = get_reranker()

    # Run CPU-bound reranking in executor to avoid blocking
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        lambda: reranker.rerank_with_metadata(query, candidates, text_key, top_k)
    )

    return result
