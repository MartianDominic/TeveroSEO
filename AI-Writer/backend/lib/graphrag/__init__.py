"""GraphRAG integration with LightRAG and FalkorDB.

Phase 65: GraphRAG Foundation

This module provides:
- LightRAG configuration with PostgreSQL storage backends
- Jina embeddings v3 client with caching
- Per-tenant workspace isolation

Reference:
- .planning/phases/65-graphrag-foundation/65-RESEARCH.md
- docs/infra-research/cpu-only-rag-graph.md
"""

from .lightrag_config import (
    get_tenant_rag,
    configure_lightrag_postgres,
    query_lightrag,
    insert_documents,
)
from .embedding_service import JinaEmbeddingService, embed_passages, embed_query

__all__ = [
    "get_tenant_rag",
    "configure_lightrag_postgres",
    "query_lightrag",
    "insert_documents",
    "JinaEmbeddingService",
    "embed_passages",
    "embed_query",
]
