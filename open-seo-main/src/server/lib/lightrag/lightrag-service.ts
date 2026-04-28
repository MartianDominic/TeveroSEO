/**
 * LightRAG Service Client
 *
 * HTTP client for the LightRAG Python service that handles:
 * - NetworkX graph storage per tenant
 * - NanoVectorDB for embeddings
 * - GPT-4o-mini for entity extraction
 *
 * Per ADR-001: Each tenant has isolated working_dir at ./data/lightrag/{tenant_id}
 * Per ADR-002: All embeddings use jina-v3 @ 384-dim via unified embedding service
 */

import { createLogger } from "@/server/lib/logger";
import type {
  ExtractedEntity,
  EntityRelation,
} from "./entity-types";

const log = createLogger({ module: "lightrag" });

export interface LightRAGConfig {
  /** Base URL of the LightRAG Python service */
  baseUrl: string;
  /** Request timeout in milliseconds */
  timeout: number;
}

export interface TenantConfig {
  /** Tenant identifier */
  tenant_id: string;
  /** Path to tenant's LightRAG working directory */
  working_dir: string;
  /** Current status of the tenant's RAG instance */
  status: "initializing" | "ready" | "error";
}

export interface QueryResult {
  /** Synthesized answer from the knowledge graph */
  answer: string;
  /** Entities found relevant to the query */
  entities: ExtractedEntity[];
  /** Relations between relevant entities */
  relations: EntityRelation[];
  /** Context chunks used to generate the answer */
  context: string[];
}

export interface InsertResult {
  /** ID of the processed document */
  documentId: string;
  /** Number of text chunks processed */
  chunksProcessed: number;
  /** Number of entities extracted */
  entitiesExtracted: number;
}

/**
 * HTTP client for LightRAG Python service.
 *
 * The Python service runs separately and handles:
 * - NetworkX graph storage per tenant
 * - NanoVectorDB for embeddings
 * - GPT-4o-mini for entity extraction
 *
 * Per ADR-001: Each tenant has isolated working_dir at ./data/lightrag/{tenant_id}
 */
export class LightRAGService {
  private config: LightRAGConfig;

  constructor(config?: Partial<LightRAGConfig>) {
    this.config = {
      baseUrl: process.env.LIGHTRAG_SERVICE_URL ?? "http://localhost:8100",
      timeout: 60000, // 60s for extraction operations
      ...config,
    };
  }

  /**
   * Check if LightRAG service is healthy and tenant is initialized
   */
  async healthCheck(
    tenantId?: string
  ): Promise<{ healthy: boolean; tenantInitialized?: boolean }> {
    const url = tenantId
      ? `${this.config.baseUrl}/health?tenant_id=${tenantId}`
      : `${this.config.baseUrl}/health`;

    try {
      const res = await fetch(url, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      const data = (await res.json()) as { tenant_initialized?: boolean };
      return { healthy: res.ok, tenantInitialized: data.tenant_initialized };
    } catch (error) {
      log.error(
        "LightRAG health check failed",
        error instanceof Error ? error : new Error(String(error))
      );
      return { healthy: false };
    }
  }

  /**
   * Get tenant's LightRAG configuration
   */
  async getTenantConfig(tenantId: string): Promise<TenantConfig> {
    const res = await fetch(
      `${this.config.baseUrl}/tenants/${tenantId}/config`,
      {
        method: "GET",
        signal: AbortSignal.timeout(this.config.timeout),
      }
    );

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Failed to get tenant config for ${tenantId}: ${error}`);
    }

    return res.json();
  }

  /**
   * Initialize tenant's LightRAG instance with e-commerce entity types
   */
  async initializeTenant(tenantId: string): Promise<void> {
    const res = await fetch(
      `${this.config.baseUrl}/tenants/${tenantId}/initialize`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(this.config.timeout),
      }
    );

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Failed to initialize tenant ${tenantId}: ${error}`);
    }
  }

  /**
   * Insert documents for entity extraction
   * Documents are chunked and entities extracted via GPT-4o-mini
   */
  async insertDocuments(
    tenantId: string,
    documents: { id: string; content: string; url: string }[]
  ): Promise<InsertResult[]> {
    const res = await fetch(
      `${this.config.baseUrl}/tenants/${tenantId}/documents`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documents }),
        signal: AbortSignal.timeout(this.config.timeout * documents.length),
      }
    );

    if (!res.ok) {
      const error = await res.text();
      throw new Error(
        `Failed to insert documents for tenant ${tenantId}: ${error}`
      );
    }

    return res.json();
  }

  /**
   * Query the knowledge graph using LightRAG's hybrid mode
   * Returns entities, relations, and synthesized answer
   */
  async queryRAG(
    tenantId: string,
    query: string,
    mode: "hybrid" | "local" | "global" = "hybrid"
  ): Promise<QueryResult> {
    const res = await fetch(
      `${this.config.baseUrl}/tenants/${tenantId}/query`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, mode }),
        signal: AbortSignal.timeout(30000),
      }
    );

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Query failed for tenant ${tenantId}: ${error}`);
    }

    return res.json();
  }

  /**
   * Get all entities of a specific type for a tenant
   */
  async getEntitiesByType(
    tenantId: string,
    entityType: string
  ): Promise<ExtractedEntity[]> {
    const res = await fetch(
      `${this.config.baseUrl}/tenants/${tenantId}/entities?type=${entityType}`,
      {
        method: "GET",
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Failed to get entities for tenant ${tenantId}: ${error}`);
    }

    return res.json();
  }

  /**
   * Delete tenant's LightRAG data (working directory)
   */
  async deleteTenant(tenantId: string): Promise<void> {
    const res = await fetch(`${this.config.baseUrl}/tenants/${tenantId}`, {
      method: "DELETE",
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Failed to delete tenant ${tenantId}: ${error}`);
    }
  }
}

// Singleton instance
let _service: LightRAGService | null = null;

export function getLightRAGService(): LightRAGService {
  if (!_service) {
    _service = new LightRAGService();
  }
  return _service;
}
