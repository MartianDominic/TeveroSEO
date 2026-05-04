"""Embeddings API router for vector operations and reranking.

Phase 73-03: Retrieval Quality Enhancement

This router provides:
- /rerank endpoint for cross-encoder reranking using BGE Reranker v2 M3
- Future: /embed endpoint for embedding generation

Reference:
- .planning/phases/73-infrastructure-optimization/73-03-PLAN.md
"""

import time
from typing import Any, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from loguru import logger

router = APIRouter(prefix="/api/embeddings", tags=["embeddings"])


# ============================================================================
# Request/Response Models
# ============================================================================


class RerankCandidate(BaseModel):
    """A candidate document for reranking.

    Attributes:
        text: The text content to score against the query.
        Additional fields are allowed and preserved in the response.
    """

    text: str = Field(..., description="Text content to score against the query")

    class Config:
        extra = "allow"  # Allow additional fields to be preserved


class RerankRequest(BaseModel):
    """Request body for the rerank endpoint.

    Attributes:
        query: The search query to rank candidates against.
        candidates: List of candidate documents with text fields.
        text_key: The key in candidate dicts containing text to score.
        top_k: Number of top results to return.
    """

    query: str = Field(
        ...,
        description="Search query to rank candidates against",
        min_length=1,
        max_length=10000,
    )
    candidates: List[dict] = Field(
        ...,
        description="List of candidate documents with text fields",
        min_length=1,
        max_length=100,  # DoS protection: max 100 candidates per request
    )
    text_key: str = Field(
        default="text",
        description="Key in candidate dicts containing text to score",
    )
    top_k: int = Field(
        default=10,
        description="Number of top results to return",
        ge=1,
        le=100,
    )


class RerankResponse(BaseModel):
    """Response body for the rerank endpoint.

    Attributes:
        results: Reranked candidates with added rerank_score field.
        latency_ms: Time taken for reranking in milliseconds.
        model: Name of the reranker model used.
    """

    results: List[dict] = Field(
        ..., description="Reranked candidates with rerank_score field"
    )
    latency_ms: float = Field(
        ..., description="Time taken for reranking in milliseconds"
    )
    model: str = Field(
        default="BAAI/bge-reranker-v2-m3",
        description="Name of the reranker model used",
    )


class RerankHealthResponse(BaseModel):
    """Health check response for reranker service."""

    status: str = Field(..., description="Service status")
    model_loaded: bool = Field(..., description="Whether the model is loaded")
    model_name: str = Field(..., description="Name of the reranker model")


# ============================================================================
# Endpoints
# ============================================================================


@router.post("/rerank", response_model=RerankResponse)
async def rerank_candidates(request: RerankRequest) -> RerankResponse:
    """Rerank candidates by relevance to a query using BGE Reranker.

    This endpoint uses a cross-encoder model to score query-candidate pairs
    and return the most relevant candidates. Cross-encoder reranking provides
    +3-8 recall@10 improvement over vector-only retrieval.

    The reranker uses BAAI/bge-reranker-v2-m3, which is multilingual and
    works well for Lithuanian content.

    Args:
        request: RerankRequest with query, candidates, text_key, and top_k.

    Returns:
        RerankResponse with reranked results, latency, and model info.

    Raises:
        HTTPException 400: If request validation fails.
        HTTPException 500: If reranking fails unexpectedly.

    Example:
        ```
        POST /api/embeddings/rerank
        {
            "query": "laptop computer",
            "candidates": [
                {"id": "1", "text": "desktop PC", "score": 0.8},
                {"id": "2", "text": "laptop notebook", "score": 0.7}
            ],
            "top_k": 10
        }
        ```

    Performance:
        - ~80ms per candidate pair on AVX2 CPU
        - Model loaded lazily on first request (~5-10s cold start)
        - Subsequent requests are fast (model cached in memory)
    """
    from lib.reranker import rerank_candidates as do_rerank

    start_time = time.perf_counter()

    try:
        # Validate that all candidates have the text key
        for i, candidate in enumerate(request.candidates):
            if request.text_key not in candidate:
                raise HTTPException(
                    status_code=400,
                    detail=f"Candidate at index {i} missing required key '{request.text_key}'",
                )

        # Perform reranking
        results = await do_rerank(
            query=request.query,
            candidates=request.candidates,
            text_key=request.text_key,
            top_k=request.top_k,
        )

        latency_ms = (time.perf_counter() - start_time) * 1000

        logger.info(
            f"Reranked {len(request.candidates)} candidates to top-{request.top_k} "
            f"in {latency_ms:.2f}ms"
        )

        return RerankResponse(
            results=results,
            latency_ms=latency_ms,
            model="BAAI/bge-reranker-v2-m3",
        )

    except HTTPException:
        raise
    except KeyError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        # Model loading failed
        logger.error(f"Reranker runtime error: {e}")
        raise HTTPException(
            status_code=503,
            detail="Reranker service unavailable. Model may be loading.",
        )
    except Exception as e:
        logger.error(f"Reranking failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Internal error during reranking. See logs for details.",
        )


@router.get("/rerank/health", response_model=RerankHealthResponse)
async def rerank_health() -> RerankHealthResponse:
    """Health check for the reranker service.

    Returns the status of the reranker service and whether the model is loaded.
    This endpoint does not load the model if it's not already loaded.

    Returns:
        RerankHealthResponse with service status and model info.
    """
    try:
        import lib.reranker.bge_reranker as reranker_module

        model_loaded = (
            reranker_module._reranker is not None
            and reranker_module._reranker._model is not None
        )

        return RerankHealthResponse(
            status="healthy",
            model_loaded=model_loaded,
            model_name="BAAI/bge-reranker-v2-m3",
        )
    except Exception as e:
        logger.error(f"Reranker health check failed: {e}")
        return RerankHealthResponse(
            status="error",
            model_loaded=False,
            model_name="BAAI/bge-reranker-v2-m3",
        )


@router.post("/rerank/warmup")
async def warmup_reranker() -> dict:
    """Warm up the reranker by loading the model.

    Call this endpoint on service startup to pre-load the model and
    avoid cold start latency on the first real request.

    Returns:
        Dict with warmup status and latency.
    """
    from lib.reranker import get_reranker

    start_time = time.perf_counter()

    try:
        # This will trigger model loading if not already loaded
        reranker = get_reranker()
        reranker._ensure_model_loaded()

        latency_ms = (time.perf_counter() - start_time) * 1000

        return {
            "status": "warmed_up",
            "latency_ms": latency_ms,
            "model": "BAAI/bge-reranker-v2-m3",
        }

    except Exception as e:
        logger.error(f"Reranker warmup failed: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"Failed to warm up reranker: {e}",
        )
