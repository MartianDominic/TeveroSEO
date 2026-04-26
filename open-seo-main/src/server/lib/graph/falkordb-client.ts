/**
 * FalkorDB Client with Tenant Isolation
 *
 * Provides graph database access with per-tenant isolation via Redis keyspace.
 * Each tenant's graph is stored under the key "kg:{tenantId}" to ensure
 * complete data isolation between tenants.
 *
 * @see .planning/keyword-intelligence/ARCHITECTURE-DECISIONS.md (ADR-001)
 */

import { FalkorDB } from "falkordb";

/**
 * Connection options for FalkorDB client
 */
export interface FalkorDBClientOptions {
  host: string;
  port: number;
  username?: string;
  password?: string;
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

  // Only allow alphanumeric and hyphens (T-42-01 mitigation)
  const validPattern = /^[a-zA-Z0-9-]+$/;
  if (!validPattern.test(tenantId)) {
    throw new Error(
      `Invalid tenant ID format: "${tenantId}". Only alphanumeric characters and hyphens are allowed.`
    );
  }
}

/**
 * FalkorDB client with tenant isolation via Redis keyspace.
 *
 * Each tenant gets their own graph stored under "kg:{tenantId}".
 * All queries use parameterized Cypher to prevent injection (T-42-03).
 */
export class FalkorDBClient {
  private options: FalkorDBClientOptions;
  private db: Awaited<ReturnType<typeof FalkorDB.connect>> | null = null;

  constructor(options: FalkorDBClientOptions) {
    this.options = options;
  }

  /**
   * Connect to FalkorDB instance
   */
  async connect(): Promise<void> {
    this.db = await FalkorDB.connect({
      username: this.options.username,
      password: this.options.password,
      socket: {
        host: this.options.host,
        port: this.options.port,
      },
    });
  }

  /**
   * Close connection to FalkorDB
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }

  /**
   * Get the underlying DB connection (for testing)
   */
  getDb(): typeof this.db {
    return this.db;
  }

  /**
   * Get a tenant-isolated graph.
   *
   * Graph name follows the pattern "kg:{tenantId}" to ensure isolation.
   * Tenant ID is validated to prevent injection attacks.
   *
   * @param tenantId - Tenant identifier (alphanumeric + hyphens only)
   * @returns Graph handle for the tenant
   * @throws Error if tenant ID is invalid or not connected
   */
  getTenantGraph(tenantId: string) {
    if (!this.db) {
      throw new Error("Not connected to FalkorDB. Call connect() first.");
    }

    validateTenantId(tenantId);
    const graphName = `kg:${tenantId}`;
    return this.db.selectGraph(graphName);
  }

  /**
   * Create and initialize a tenant graph with required indexes.
   *
   * Sets up:
   * - Index on Product.sku for fast product lookups
   * - Index on Category.slug for fast category lookups
   * - Index on Brand.name for fast brand lookups
   * - NODE_CREATION_BUFFER=1024 for memory efficiency (ADR-001)
   *
   * @param tenantId - Tenant identifier
   */
  async createTenantGraph(tenantId: string): Promise<void> {
    const graph = this.getTenantGraph(tenantId);

    // Set NODE_CREATION_BUFFER for memory efficiency (T-42-04 mitigation)
    // This reduces matrix resize frequency during bulk inserts
    await graph.query("CALL db.config('NODE_CREATION_BUFFER', 1024)");

    // Create indexes for fast lookups
    await graph.query("CREATE INDEX FOR (p:Product) ON (p.sku)");
    await graph.query("CREATE INDEX FOR (c:Category) ON (c.slug)");
    await graph.query("CREATE INDEX FOR (b:Brand) ON (b.name)");

    // Create vector index for embeddings (384-dim cosine per ADR-002)
    await graph.query(
      "CREATE VECTOR INDEX FOR (p:Product) ON (p.embedding) OPTIONS {dimension:384, similarityFunction:'cosine'}"
    );
  }

  /**
   * Delete a tenant's graph and all its data.
   *
   * Uses GRAPH.DELETE command to remove the entire graph.
   *
   * @param tenantId - Tenant identifier
   */
  async deleteTenantGraph(tenantId: string): Promise<void> {
    const graph = this.getTenantGraph(tenantId);
    await graph.delete();
  }

  /**
   * Get memory usage for a tenant's graph.
   *
   * Uses GRAPH.MEMORY USAGE command to retrieve bytes used.
   *
   * @param tenantId - Tenant identifier
   * @returns Memory usage in bytes
   */
  async getGraphMemoryUsage(tenantId: string): Promise<number> {
    const graph = this.getTenantGraph(tenantId);

    // FalkorDB provides memory info via CALL db.info()
    // or we can query directly
    const result = await graph.query("CALL db.info() YIELD memory RETURN memory");

    // Extract bytes from result
    const memory = result.data?.[0]?.[0] ?? 0;
    return typeof memory === "number" ? memory : 0;
  }

  /**
   * Execute a Cypher query on a tenant's graph.
   *
   * All queries use parameterized Cypher to prevent injection (T-42-03).
   * Never interpolate user input directly into query strings.
   *
   * @param tenantId - Tenant identifier
   * @param cypher - Cypher query with $param placeholders
   * @param params - Query parameters
   * @returns Query result set
   */
  async query<T = unknown>(
    tenantId: string,
    cypher: string,
    params: Record<string, unknown>
  ): Promise<{ data: T[] }> {
    const graph = this.getTenantGraph(tenantId);
    return await graph.query(cypher, { params });
  }

  /**
   * Check if a vector index exists for a node label and property.
   *
   * @param tenantId - Tenant identifier
   * @param nodeLabel - Node label (e.g., "Product")
   * @param property - Property name (e.g., "embedding")
   * @returns True if the vector index exists
   */
  async hasVectorIndex(
    tenantId: string,
    nodeLabel: string,
    property: string
  ): Promise<boolean> {
    const graph = this.getTenantGraph(tenantId);

    // Query FalkorDB for vector index info
    const result = await graph.query(
      `CALL db.idx.vector.info()
       YIELD label, property
       WHERE label = $nodeLabel AND property = $property
       RETURN count(*) > 0 AS exists`,
      { params: { nodeLabel, property } }
    );

    return result.data?.[0]?.[0] ?? false;
  }
}

/**
 * Create a FalkorDB client using environment variables.
 *
 * Uses REDIS_URL or falls back to localhost:6379.
 */
export function createFalkorDBClient(): FalkorDBClient {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  const url = new URL(redisUrl);

  return new FalkorDBClient({
    host: url.hostname,
    port: parseInt(url.port || "6379", 10),
    username: url.username || undefined,
    password: url.password || undefined,
  });
}

// Export singleton instance creation for convenience
let defaultClient: FalkorDBClient | null = null;

/**
 * Get or create the default FalkorDB client.
 */
export async function getDefaultFalkorDBClient(): Promise<FalkorDBClient> {
  if (!defaultClient) {
    defaultClient = createFalkorDBClient();
    await defaultClient.connect();
  }
  return defaultClient;
}

/**
 * Close the default FalkorDB client.
 */
export async function closeDefaultFalkorDBClient(): Promise<void> {
  if (defaultClient) {
    await defaultClient.close();
    defaultClient = null;
  }
}
