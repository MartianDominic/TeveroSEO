/**
 * TenantGraphManager - Per-Tenant Graph Isolation with 768-dim Vector Support
 * Phase 65: GraphRAG Foundation
 *
 * Provides graph database access with per-tenant isolation via Redis keyspace.
 * Each tenant's graph is stored under the key "kg_{sanitized_tenant_id}" to ensure
 * complete data isolation between tenants.
 *
 * Key features:
 * - Per-tenant graph isolation via keyspace naming (T-65-02)
 * - 768-dim vector indexes with cosine similarity
 * - NODE_CREATION_BUFFER 1024 for memory efficiency (Pitfall #1)
 * - Hybrid vector + graph search (Pattern 3)
 *
 * @see .planning/phases/65-graphrag-foundation/65-RESEARCH.md
 */

import { FalkorDB, type Graph } from "falkordb";
import { LRUCache } from "lru-cache";

/** Maximum number of graph handles to cache (M-65-03) */
const MAX_CACHED_GRAPHS = 1000;

/** TTL for cached graph handles in milliseconds (1 hour) */
const GRAPH_CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Options for TenantGraphManager
 */
export interface TenantGraphManagerOptions {
  /** Redis host (default: 127.0.0.1) */
  host?: string;
  /** Redis port (default: 6379) */
  port?: number;
  /** Redis username (optional) */
  username?: string;
  /** Redis password (optional) */
  password?: string;
  /** Maximum connections (default: 64) */
  maxConnections?: number;
}

/**
 * Result from hybrid vector + graph search
 */
export interface HybridSearchResult {
  /** Entity ID */
  id: string;
  /** Entity name */
  name: string;
  /** Entity type */
  type: string;
  /** Similarity score */
  score: number;
  /** Related entity names (from graph traversal) */
  related: string[];
}

/**
 * Options for hybrid search
 */
export interface HybridSearchOptions {
  /** Filter by category slug */
  category?: string;
  /** Number of results to return (default: 10) */
  k?: number;
}

/**
 * Validates tenant ID format to prevent injection attacks.
 * Only alphanumeric characters and hyphens are allowed.
 *
 * @throws Error if tenant ID is invalid
 */
function validateTenantId(tenantId: string): void {
  if (!tenantId || tenantId.length === 0) {
    throw new Error("Tenant ID cannot be empty");
  }

  // Only allow alphanumeric and hyphens (T-65-03 mitigation)
  const validPattern = /^[a-zA-Z0-9-]+$/;
  if (!validPattern.test(tenantId)) {
    throw new Error(
      `Invalid tenant ID format: "${tenantId}". Only alphanumeric characters and hyphens are allowed.`
    );
  }
}

/**
 * Sanitize tenant ID for use in graph name.
 * Replaces hyphens with underscores and limits to 32 characters.
 */
function sanitizeTenantId(tenantId: string): string {
  return tenantId.replace(/-/g, "_").slice(0, 32);
}

/**
 * TenantGraphManager - Production-ready graph manager with per-tenant isolation.
 *
 * Extends existing FalkorDBClient patterns with:
 * - Connection pooling (max_connections=64)
 * - Per-tenant graph isolation (kg_{tenant_id})
 * - 768-dim vector indexes with cosine similarity
 * - Hybrid vector + graph search
 */
export class TenantGraphManager {
  private options: TenantGraphManagerOptions;
  private db: Awaited<ReturnType<typeof FalkorDB.connect>> | null = null;
  // M-65-03 fix: Use LRU cache instead of unbounded Map
  private graphs: LRUCache<string, Graph>;
  private connected = false;

  constructor(options?: TenantGraphManagerOptions) {
    // M-65-03 fix: Initialize LRU cache with max entries and TTL
    this.graphs = new LRUCache<string, Graph>({
      max: MAX_CACHED_GRAPHS,
      ttl: GRAPH_CACHE_TTL_MS,
      updateAgeOnGet: true,
    });

    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    let parsedHost = "127.0.0.1";
    let parsedPort = 6379;

    try {
      const url = new URL(redisUrl);
      parsedHost = url.hostname;
      parsedPort = parseInt(url.port || "6379", 10);
    } catch {
      // Fall back to defaults
    }

    this.options = {
      host: options?.host ?? parsedHost,
      port: options?.port ?? parsedPort,
      username: options?.username,
      password: options?.password,
      maxConnections: options?.maxConnections ?? 64,
    };
  }

  /**
   * Connect to FalkorDB instance.
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    this.db = await FalkorDB.connect({
      username: this.options.username,
      password: this.options.password,
      socket: {
        host: this.options.host!,
        port: this.options.port!,
      },
    });

    this.connected = true;
  }

  /**
   * Close connection to FalkorDB.
   */
  async close(): Promise<void> {
    if (this.db && this.connected) {
      await this.db.close();
      this.db = null;
      this.graphs.clear();
      this.connected = false;
    }
  }

  /**
   * Get a tenant-isolated graph.
   *
   * Graph name follows the pattern "kg_{sanitized_tenant_id}" to ensure isolation.
   * Tenant ID is validated to prevent injection attacks (T-65-03).
   *
   * @param tenantId - Tenant identifier (alphanumeric + hyphens only)
   * @returns Graph handle for the tenant
   * @throws Error if tenant ID is invalid or not connected
   */
  async getGraph(tenantId: string): Promise<Graph> {
    if (!this.db) {
      throw new Error("Not connected to FalkorDB. Call connect() first.");
    }

    validateTenantId(tenantId);

    // Check cache first
    const cached = this.graphs.get(tenantId);
    if (cached) {
      return cached;
    }

    // Create new graph handle
    const sanitizedId = sanitizeTenantId(tenantId);
    const graphName = `kg_${sanitizedId}`;
    const graph = this.db.selectGraph(graphName);

    // Cache for future requests
    this.graphs.set(tenantId, graph);

    return graph;
  }

  /**
   * Initialize tenant graph with required indexes and configuration.
   *
   * Sets up:
   * - NODE_CREATION_BUFFER=1024 for memory efficiency (Pitfall #1)
   * - Index on Entity.name for fast lookups
   * - Vector index with dimension:768, similarityFunction:'cosine', M:16, efConstruction:200
   *
   * @param tenantId - Tenant identifier
   */
  async initializeTenant(tenantId: string): Promise<void> {
    const graph = await this.getGraph(tenantId);

    // Set NODE_CREATION_BUFFER for memory efficiency (T-65-04 mitigation)
    // This reduces sparse matrix memory allocation per graph
    await graph.query("CALL db.config('NODE_CREATION_BUFFER', 1024)");

    // Create index on Entity.name for fast lookups
    await graph.query("CREATE INDEX FOR (e:Entity) ON (e.name)");

    // Create index on Entity.type for filtered queries
    await graph.query("CREATE INDEX FOR (e:Entity) ON (e.type)");

    // Create vector index for embeddings (768-dim cosine per Phase 65 spec)
    // M:16 and efConstruction:200 per RESEARCH.md Pattern 1
    await graph.query(`
      CREATE VECTOR INDEX FOR (e:Entity) ON (e.embedding)
      OPTIONS {dimension:768, similarityFunction:'cosine', M:16, efConstruction:200}
    `);
  }

  /**
   * Delete a tenant's graph and all its data.
   *
   * @param tenantId - Tenant identifier
   */
  async deleteTenant(tenantId: string): Promise<void> {
    const graph = await this.getGraph(tenantId);
    await graph.delete();

    // Remove from cache
    this.graphs.delete(tenantId);
  }

  /**
   * Combined vector + graph search (Pattern 3 from RESEARCH.md).
   *
   * Performs hybrid retrieval:
   * 1. Vector similarity search on embeddings
   * 2. Graph traversal to find related entities
   * 3. Returns results with score and related entity names
   *
   * @param tenantId - Tenant identifier
   * @param queryVec - 768-dim query embedding vector
   * @param options - Search options (category filter, k)
   * @returns Search results with scores and related entities
   */
  async hybridVectorGraphSearch(
    tenantId: string,
    queryVec: number[],
    options?: HybridSearchOptions
  ): Promise<HybridSearchResult[]> {
    const graph = await this.getGraph(tenantId);
    const k = options?.k ?? 10;
    const category = options?.category;

    // Build Cypher query for hybrid search
    let cypher = `
      CALL db.idx.vector.queryNodes('Entity', 'embedding', $kExpand, vecf32($vec))
      YIELD node AS e, score
    `;

    // Add category filter if specified
    if (category) {
      cypher += `
      MATCH (e)-[:IN_CATEGORY]->(:Category {slug: $cat})
      `;
    }

    // Add graph traversal for related entities
    cypher += `
      OPTIONAL MATCH (e)-[:RELATES_TO]->(related:Entity)
      RETURN e.id AS id, e.name AS name, e.type AS type,
             score AS score, collect(DISTINCT related.name)[..5] AS related
      ORDER BY score DESC
      LIMIT $k
    `;

    // Build params object, only including category if specified
    const queryParams: Record<string, string | number | boolean | null | number[]> = {
      kExpand: k * 4, // Expand candidates for graph filtering
      vec: queryVec,
      k,
    };
    if (category) {
      queryParams.cat = category;
    }

    const result = await graph.query<{
      id: string;
      name: string;
      type: string;
      score: number;
      related: string[];
    }>(cypher, { params: queryParams });

    // Map results to HybridSearchResult format
    return (result.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      score: row.score,
      related: row.related ?? [],
    }));
  }

  /**
   * Check if connected to FalkorDB.
   */
  isConnected(): boolean {
    return this.connected;
  }
}

// Singleton instance management
let _manager: TenantGraphManager | null = null;

/**
 * Get or create the singleton TenantGraphManager instance.
 */
export async function getTenantGraphManager(): Promise<TenantGraphManager> {
  if (!_manager) {
    _manager = new TenantGraphManager();
    await _manager.connect();
  }
  return _manager;
}

/**
 * Close the singleton TenantGraphManager instance.
 */
export async function closeTenantGraphManager(): Promise<void> {
  if (_manager) {
    await _manager.close();
    _manager = null;
  }
}
