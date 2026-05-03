"""LightRAG configuration with PostgreSQL storage backends.

Phase 65: GraphRAG Foundation

Per-tenant workspace isolation via POSTGRES_WORKSPACE env var.
Uses PGGraphStorage, PGVectorStorage, and PGKVStorage for persistence.

Reference:
- .planning/phases/65-graphrag-foundation/65-RESEARCH.md (Pattern 2)
- Context7 /hkuds/lightrag - PostgreSQL storage
"""

import os
from typing import Optional

from lightrag import LightRAG, QueryParam
from lightrag.llm.openai import gpt_4o_mini_complete

from .embedding_service import embed_passages


# LightRAG embedding wrapper
async def jina_embed_func(texts: list[str]) -> list[list[float]]:
    """Wrapper for LightRAG embedding_func parameter.

    LightRAG expects a function that takes a list of texts and returns
    a list of embedding vectors. This wraps our Jina service.
    """
    return await embed_passages(texts)


def configure_lightrag_postgres(tenant_id: str) -> LightRAG:
    """Configure LightRAG with PostgreSQL storage backends.

    Per RESEARCH.md Pattern 2: LightRAG Workspace Isolation.
    Sets environment variables for PostgreSQL connection and
    creates LightRAG instance with per-tenant workspace.

    Args:
        tenant_id: Tenant identifier for workspace isolation.

    Returns:
        Configured LightRAG instance.

    Note:
        Environment variables should be pre-set in .env or deployment config.
        This function only ensures POSTGRES_WORKSPACE is set per-tenant.
    """
    # Environment configuration - read from env, don't overwrite existing
    os.environ.setdefault("POSTGRES_HOST", os.getenv("POSTGRES_HOST", "localhost"))
    os.environ.setdefault("POSTGRES_PORT", os.getenv("POSTGRES_PORT", "5432"))
    os.environ.setdefault("POSTGRES_USER", os.getenv("POSTGRES_USER", "postgres"))
    os.environ.setdefault("POSTGRES_PASSWORD", os.getenv("POSTGRES_PASSWORD", ""))
    os.environ.setdefault("POSTGRES_DATABASE", os.getenv("POSTGRES_DATABASE", "open_seo"))

    # Critical for isolation - set per-request
    os.environ["POSTGRES_WORKSPACE"] = tenant_id

    # Storage selection
    os.environ["LIGHTRAG_KV_STORAGE"] = "PGKVStorage"
    os.environ["LIGHTRAG_VECTOR_STORAGE"] = "PGVectorStorage"
    os.environ["LIGHTRAG_GRAPH_STORAGE"] = "PGGraphStorage"
    os.environ["LIGHTRAG_DOC_STATUS_STORAGE"] = "PGDocStatusStorage"

    return LightRAG(
        working_dir=f"./lightrag_workspaces/{tenant_id}",
        workspace=tenant_id,
        llm_model_func=gpt_4o_mini_complete,
        embedding_func=jina_embed_func,
        chunk_token_size=1200,
        chunk_overlap_token_size=100,
        enable_llm_cache=True,
        addon_params={
            # Entity types for SEO/e-commerce domain
            "entity_types": [
                "keyword",
                "page",
                "product",
                "category",
                "brand",
                "attribute",
                "topic",
            ]
        },
        vector_db_storage_cls_kwargs={
            "cosine_better_than_threshold": 0.2
        }
    )


# Tenant RAG cache
_tenant_rags: dict[str, LightRAG] = {}


def get_tenant_rag(tenant_id: str) -> LightRAG:
    """Get or create LightRAG instance for tenant.

    Caches instances per tenant to avoid repeated initialization.

    Args:
        tenant_id: Tenant identifier.

    Returns:
        LightRAG instance configured for the tenant.
    """
    if tenant_id not in _tenant_rags:
        _tenant_rags[tenant_id] = configure_lightrag_postgres(tenant_id)
    return _tenant_rags[tenant_id]


def clear_tenant_rag(tenant_id: str) -> None:
    """Remove cached LightRAG instance for tenant.

    Call when tenant configuration changes or for cleanup.

    Args:
        tenant_id: Tenant identifier to clear.
    """
    if tenant_id in _tenant_rags:
        del _tenant_rags[tenant_id]


async def query_lightrag(
    tenant_id: str,
    query: str,
    mode: str = "hybrid"
) -> str:
    """Query LightRAG with specified retrieval mode.

    Args:
        tenant_id: Tenant identifier.
        query: Search query text.
        mode: Retrieval mode - one of:
            - local: Entity-focused retrieval
            - global: Relationship pattern retrieval
            - hybrid: Both local and global (recommended)
            - naive: Vector-only search
            - mix: Graph + vector combination

    Returns:
        LightRAG response text.
    """
    rag = get_tenant_rag(tenant_id)
    result = await rag.aquery(
        query,
        param=QueryParam(
            mode=mode,
            only_need_context=False,
            top_k=20
        )
    )
    return result


async def insert_documents(
    tenant_id: str,
    documents: list[str]
) -> None:
    """Insert documents into tenant's knowledge graph.

    Documents are chunked, embedded, and added to the graph.
    Entity extraction and relationship detection are automatic.

    Args:
        tenant_id: Tenant identifier.
        documents: List of document texts to insert.
    """
    rag = get_tenant_rag(tenant_id)
    for doc in documents:
        await rag.ainsert(doc)
