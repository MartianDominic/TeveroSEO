"""Jina Embeddings v3 client with caching.

Phase 65: GraphRAG Foundation

Uses 768-dim embeddings for optimal Lithuanian quality.
Provides both class-based and module-level function interfaces.

Reference:
- .planning/phases/65-graphrag-foundation/65-RESEARCH.md
- Jina AI Embedding API documentation
"""

import hashlib
import os
from typing import List, Optional

import httpx


class JinaEmbeddingService:
    """Jina Embeddings v3 client with in-memory caching.

    Supports task-specific embeddings:
    - retrieval.query: For search queries
    - retrieval.passage: For documents/passages
    - text-matching: For semantic similarity
    - classification: For text classification
    - separation: For clustering/grouping

    Uses 768-dim Matryoshka truncation for optimal Lithuanian quality
    while maintaining storage efficiency.
    """

    BASE_URL = "https://api.jina.ai/v1/embeddings"

    def __init__(
        self,
        api_key: Optional[str] = None,
        cache_enabled: bool = True
    ):
        """Initialize the embedding service.

        Args:
            api_key: Jina API key. Falls back to JINA_API_KEY env var.
            cache_enabled: Whether to cache embeddings in memory.
        """
        self.api_key = api_key or os.getenv("JINA_API_KEY", "")
        self.cache_enabled = cache_enabled
        self._cache: dict[str, List[float]] = {}

    def _cache_key(self, text: str, task: str) -> str:
        """Generate cache key for text and task combination."""
        return hashlib.sha256(f"{task}:{text}".encode()).hexdigest()[:16]

    async def embed(
        self,
        texts: List[str],
        task: str = "retrieval.passage",
        dimensions: int = 768
    ) -> List[List[float]]:
        """Generate embeddings with Jina v3 API.

        Args:
            texts: List of texts to embed.
            task: Embedding task type (retrieval.query, retrieval.passage, etc.)
            dimensions: Output dimension (768 default for GraphRAG).

        Returns:
            List of embedding vectors.

        Raises:
            httpx.HTTPStatusError: On API error (including rate limits).
        """
        # Check cache first
        if self.cache_enabled:
            results: List[tuple[int, List[float]]] = []
            uncached_texts: List[str] = []
            uncached_indices: List[int] = []

            for i, text in enumerate(texts):
                key = self._cache_key(text, task)
                if key in self._cache:
                    results.append((i, self._cache[key]))
                else:
                    uncached_texts.append(text)
                    uncached_indices.append(i)

            if not uncached_texts:
                return [r[1] for r in sorted(results)]

            texts = uncached_texts
        else:
            uncached_indices = list(range(len(texts)))
            results = []

        # API call
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.BASE_URL,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "jina-embeddings-v3",
                    "input": texts,
                    "task": task,
                    "dimensions": dimensions,
                    "late_chunking": False
                },
                timeout=60.0
            )
            response.raise_for_status()
            data = response.json()

        embeddings = [item["embedding"] for item in data["data"]]

        # Update cache
        if self.cache_enabled:
            for text, embedding, idx in zip(texts, embeddings, uncached_indices):
                key = self._cache_key(text, task)
                self._cache[key] = embedding
                results.append((idx, embedding))
            return [r[1] for r in sorted(results)]

        return embeddings

    async def embed_query(self, query: str, dimensions: int = 768) -> List[float]:
        """Embed a single query for retrieval.

        Args:
            query: Query text to embed.
            dimensions: Output dimension.

        Returns:
            Single embedding vector.
        """
        results = await self.embed([query], task="retrieval.query", dimensions=dimensions)
        return results[0]

    async def embed_passages(self, passages: List[str], dimensions: int = 768) -> List[List[float]]:
        """Embed multiple passages/documents for retrieval.

        Args:
            passages: List of passage texts to embed.
            dimensions: Output dimension.

        Returns:
            List of embedding vectors.
        """
        return await self.embed(passages, task="retrieval.passage", dimensions=dimensions)

    def clear_cache(self) -> None:
        """Clear the in-memory embedding cache."""
        self._cache.clear()


# Module-level singleton and functions
_service: Optional[JinaEmbeddingService] = None


def get_embedding_service() -> JinaEmbeddingService:
    """Get the singleton embedding service instance.

    Creates the service on first call with default configuration.
    """
    global _service
    if _service is None:
        _service = JinaEmbeddingService()
    return _service


async def embed_passages(texts: List[str]) -> List[List[float]]:
    """Embed multiple passages using the singleton service.

    Convenience function for common use case.

    Args:
        texts: List of passage texts to embed.

    Returns:
        List of 768-dim embedding vectors.
    """
    return await get_embedding_service().embed(texts, task="retrieval.passage")


async def embed_query(query: str) -> List[float]:
    """Embed a single query using the singleton service.

    Convenience function for common use case.

    Args:
        query: Query text to embed.

    Returns:
        768-dim embedding vector.
    """
    return await get_embedding_service().embed_query(query)
