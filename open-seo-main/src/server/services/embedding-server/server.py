"""
Local Jina v5-nano embedding server using sentence-transformers.

Phase 83: Embedding Infrastructure Upgrade

Runs as a sidecar container for CPU-based inference.
Provides 12x faster embeddings compared to v3 API calls.

Endpoints:
- GET /health - Health check with model status
- POST /embed - Generate embeddings for texts

Environment variables:
- EMBEDDING_MODEL: Model to use (default: jinaai/jina-embeddings-v5-text-nano)
- PORT: Server port (default: 8001)
"""
import os
from typing import List

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import numpy as np

app = FastAPI(
    title="Embedding Server",
    description="Local embedding server for Jina v5-nano model",
    version="1.0.0",
)

# Model configuration
MODEL_NAME = os.getenv("EMBEDDING_MODEL", "jinaai/jina-embeddings-v5-text-nano")
model = None


class EmbedRequest(BaseModel):
    """Request body for embedding generation."""

    texts: List[str] = Field(..., description="List of texts to embed")
    batch_size: int = Field(64, description="Batch size for processing", ge=1, le=256)
    is_document: bool = Field(
        False, description="Whether texts are documents (vs queries)"
    )


class EmbedResponse(BaseModel):
    """Response body with embeddings."""

    embeddings: List[List[float]] = Field(..., description="List of embedding vectors")
    model: str = Field(..., description="Model used for generation")
    dimensions: int = Field(..., description="Embedding dimensions")


class HealthResponse(BaseModel):
    """Health check response."""

    status: str
    model: str
    loaded: bool
    dimensions: int | None = None


@app.on_event("startup")
async def load_model():
    """Load the embedding model at startup."""
    global model

    # Import here to avoid slow startup if model loading fails
    from sentence_transformers import SentenceTransformer

    print(f"Loading model: {MODEL_NAME}")
    model = SentenceTransformer(MODEL_NAME, trust_remote_code=True)
    print(f"Model loaded. Dimensions: {model.get_sentence_embedding_dimension()}")


@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy" if model is not None else "loading",
        model=MODEL_NAME,
        loaded=model is not None,
        dimensions=model.get_sentence_embedding_dimension() if model else None,
    )


@app.post("/embed", response_model=EmbedResponse)
async def embed(request: EmbedRequest):
    """Generate embeddings for texts.

    Args:
        request: EmbedRequest with texts and options

    Returns:
        EmbedResponse with embedding vectors

    Raises:
        HTTPException: If model not loaded or encoding fails
    """
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    if not request.texts:
        raise HTTPException(status_code=400, detail="No texts provided")

    try:
        # v5 models use task and prompt_name for asymmetric retrieval
        prompt_name = "document" if request.is_document else "query"

        embeddings = model.encode(
            request.texts,
            batch_size=request.batch_size,
            normalize_embeddings=True,
            show_progress_bar=False,
            task="retrieval",
            prompt_name=prompt_name,
        )

        # Convert numpy array to list for JSON serialization
        embeddings_list = embeddings.tolist()

        return EmbedResponse(
            embeddings=embeddings_list,
            model=MODEL_NAME,
            dimensions=embeddings.shape[1],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8001"))
    uvicorn.run(app, host="0.0.0.0", port=port)
