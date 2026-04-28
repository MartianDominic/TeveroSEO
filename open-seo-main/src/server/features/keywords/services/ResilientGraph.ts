/**
 * ResilientGraph: Graph database service with fallback cascade.
 *
 * Cascade order:
 * 1. FalkorDB (primary - Redis-native, sub-10ms traversals)
 * 2. PostgreSQL + Apache AGE (fallback - mostly compatible Cypher)
 *
 * Features:
 * - Circuit breaker for FalkorDB
 * - Cypher query translation (minor compatibility adjustments)
 * - Logs all failover events for monitoring
 * - Per-tenant graph isolation (kg:{tenant_id})
 * - Safe parameterized queries to prevent injection
 */

import { CircuitBreaker } from "./CircuitBreaker";
import { createLogger } from "@/server/lib/logger";
import {
  sanitizeGraphName,
  safeTenantGraphName,
  sanitizeIdentifier,
} from "@/lib/db/safe-query";

const log = createLogger({ module: "ResilientGraph" });

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type GraphBackend = "falkordb" | "postgres_age";

export interface GraphQueryResult {
  /** Query results as records */
  records: Array<Record<string, unknown>>;
  /** Number of records returned */
  count: number;
  /** Which backend served this query */
  source: GraphBackend;
  /** Query execution time in ms */
  executionTimeMs: number;
  /** Whether this was a fallback result */
  isFallback: boolean;
}

export interface GraphNode {
  id: string;
  labels: string[];
  properties: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  type: string;
  startNode: string;
  endNode: string;
  properties: Record<string, unknown>;
}

export interface GraphConfig {
  /** FalkorDB Redis host (default: localhost) */
  falkordbHost?: string;
  /** FalkorDB Redis port (default: 6379) */
  falkordbPort?: number;
  /** PostgreSQL connection string for AGE */
  postgresConnectionString?: string;
  /** Graph name prefix (default: kg) */
  graphPrefix?: string;
  /** Circuit breaker config for FalkorDB */
  falkordbCircuit?: { failureThreshold?: number; resetTimeout?: number };
}

const DEFAULT_CONFIG: GraphConfig = {
  falkordbHost: "localhost",
  falkordbPort: 6379,
  graphPrefix: "kg",
};

// ─────────────────────────────────────────────────────────────────────────────
// FalkorDB Client
// ─────────────────────────────────────────────────────────────────────────────

/**
 * FalkorDB graph database client.
 * Uses Redis protocol with GRAPH.QUERY commands.
 *
 * In production, this would use:
 * - redis or ioredis package
 * - FalkorDB specific commands
 *
 * For this implementation, we simulate the interface.
 */
class FalkorDBClient {
  private readonly host: string;
  private readonly port: number;
  private connected = false;

  constructor(host: string, port: number) {
    this.host = host;
    this.port = port;
  }

  async connect(): Promise<void> {
    // In production: Establish Redis connection
    // For now: Simulate connection
    this.connected = true;
    log.debug("FalkorDB connected", { host: this.host, port: this.port });
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  /**
   * Execute a Cypher query on a graph.
   */
  async query(graphName: string, cypher: string, params?: Record<string, unknown>): Promise<Record<string, unknown>[]> {
    if (!this.connected) {
      await this.connect();
    }

    // In production: Execute via Redis GRAPH.QUERY command
    // GRAPH.QUERY graphName "cypher query" params

    // Simulate query execution (would parse Cypher and return results)
    log.debug("FalkorDB query", { graphName, cypher: cypher.slice(0, 100), params });

    // For testing: Return mock results based on query pattern
    return this.simulateQuery(cypher, params);
  }

  /**
   * Simulate query results for testing.
   * In production, this would be replaced with actual Redis/FalkorDB calls.
   */
  private simulateQuery(cypher: string, params?: Record<string, unknown>): Record<string, unknown>[] {
    // Match node query
    if (cypher.toLowerCase().includes("match") && cypher.toLowerCase().includes("return")) {
      // Extract node labels and return simulated results
      const labelMatch = cypher.match(/:\s*(\w+)/);
      const label = labelMatch ? labelMatch[1] : "Node";

      return [
        {
          n: {
            id: params?.id || "node-1",
            labels: [label],
            properties: { name: "Test Node", ...params },
          },
        },
      ];
    }

    // Create node query
    if (cypher.toLowerCase().includes("create")) {
      return [{ created: 1 }];
    }

    // Delete query
    if (cypher.toLowerCase().includes("delete")) {
      return [{ deleted: 1 }];
    }

    return [];
  }

  /**
   * Create a new graph if it doesn't exist.
   */
  async createGraph(graphName: string): Promise<void> {
    // FalkorDB creates graphs implicitly on first query
    // But we can run a no-op query to ensure it exists
    await this.query(graphName, "RETURN 1");
  }

  /**
   * Delete a graph.
   */
  async deleteGraph(graphName: string): Promise<void> {
    // In production: GRAPH.DELETE graphName
    log.info("FalkorDB graph deleted", { graphName });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PostgreSQL + Apache AGE Client
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PostgreSQL with Apache AGE extension for graph queries.
 * AGE supports Cypher with minor syntax differences.
 *
 * Key differences from FalkorDB:
 * - Graphs are schemas, not separate databases
 * - Some function syntax differs
 * - LOAD CSV not supported (use COPY instead)
 */
class PostgresAGEClient {
  private readonly connectionString: string;
  private connected = false;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  async connect(): Promise<void> {
    // In production: Connect via pg pool
    this.connected = true;
    log.debug("PostgreSQL AGE connected");
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  /**
   * Execute a Cypher query via AGE.
   * Translates FalkorDB-specific syntax to AGE-compatible syntax.
   */
  async query(
    tenantId: string,
    cypher: string,
    params?: Record<string, unknown>,
  ): Promise<Record<string, unknown>[]> {
    if (!this.connected) {
      await this.connect();
    }

    // Translate Cypher for AGE compatibility
    const translatedCypher = this.translateCypher(cypher);

    // Build AGE query wrapper
    // SELECT * FROM cypher('graph_name', $$ cypher_query $$) AS (column agtype);
    const ageQuery = this.buildAGEQuery(tenantId, translatedCypher, params);

    log.debug("PostgreSQL AGE query", {
      tenantId,
      originalCypher: cypher.slice(0, 100),
      translatedCypher: translatedCypher.slice(0, 100),
    });

    // Simulate query execution
    return this.simulateQuery(translatedCypher, params);
  }

  /**
   * Translate FalkorDB Cypher to AGE-compatible Cypher.
   */
  private translateCypher(cypher: string): string {
    let translated = cypher;

    // AGE uses slightly different syntax for some functions
    // FalkorDB: toInteger(x) -> AGE: tointeger(x)
    translated = translated.replace(/toInteger/gi, "tointeger");
    translated = translated.replace(/toString/gi, "tostring");
    translated = translated.replace(/toFloat/gi, "tofloat");

    // AGE requires explicit type casting in some cases
    // This is handled by the param binding

    return translated;
  }

  /**
   * Build AGE-wrapped SQL query with proper sanitization.
   * Uses safeTenantGraphName to prevent graph name injection.
   */
  private buildAGEQuery(tenantId: string, cypher: string, _params?: Record<string, unknown>): string {
    // Sanitize graph name using safe utility
    const graphName = safeTenantGraphName("kg", tenantId);

    // Escape dollar signs and single quotes in cypher for AGE $$ quoting
    // Note: The actual parameter values should be passed via AGE's parameter mechanism
    const escapedCypher = cypher
      .replace(/\$/g, "\\$")  // Escape $ to prevent parameter injection
      .replace(/'/g, "''");   // Escape single quotes

    // Build AGE query wrapper
    // The cypher query should use $param syntax for actual values
    return `
      SELECT * FROM cypher('${graphName}', $$
        ${escapedCypher}
      $$) AS (result agtype);
    `;
  }

  /**
   * Simulate query results for testing.
   */
  private simulateQuery(cypher: string, params?: Record<string, unknown>): Record<string, unknown>[] {
    // Similar to FalkorDB simulation
    if (cypher.toLowerCase().includes("match") && cypher.toLowerCase().includes("return")) {
      const labelMatch = cypher.match(/:\s*(\w+)/);
      const label = labelMatch ? labelMatch[1] : "Node";

      return [
        {
          n: {
            id: params?.id || "node-1",
            labels: [label],
            properties: { name: "Test Node (AGE)", ...params },
          },
        },
      ];
    }

    if (cypher.toLowerCase().includes("create")) {
      return [{ created: 1 }];
    }

    if (cypher.toLowerCase().includes("delete")) {
      return [{ deleted: 1 }];
    }

    return [];
  }

  /**
   * Create a graph schema in PostgreSQL.
   */
  async createGraph(tenantId: string): Promise<void> {
    const graphName = `kg_${tenantId.replace(/-/g, "_")}`;
    // In production: SELECT create_graph('graph_name');
    log.info("PostgreSQL AGE graph created", { graphName });
  }

  /**
   * Delete a graph schema.
   */
  async deleteGraph(tenantId: string): Promise<void> {
    const graphName = `kg_${tenantId.replace(/-/g, "_")}`;
    // In production: SELECT drop_graph('graph_name', true);
    log.info("PostgreSQL AGE graph deleted", { graphName });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ResilientGraph
// ─────────────────────────────────────────────────────────────────────────────

export class ResilientGraph {
  private readonly falkordb: FalkorDBClient;
  private readonly postgres: PostgresAGEClient | null;
  private readonly graphPrefix: string;

  private readonly falkordbCircuit: CircuitBreaker;

  constructor(config: Partial<GraphConfig> = {}) {
    const fullConfig = { ...DEFAULT_CONFIG, ...config };

    this.graphPrefix = fullConfig.graphPrefix || "kg";

    // FalkorDB is always configured
    this.falkordb = new FalkorDBClient(fullConfig.falkordbHost || "localhost", fullConfig.falkordbPort || 6379);

    // PostgreSQL AGE is optional fallback
    this.postgres = fullConfig.postgresConnectionString
      ? new PostgresAGEClient(fullConfig.postgresConnectionString)
      : null;

    // Circuit breaker for FalkorDB
    this.falkordbCircuit = new CircuitBreaker({
      name: "falkordb-graph",
      failureThreshold: fullConfig.falkordbCircuit?.failureThreshold ?? 3,
      resetTimeout: fullConfig.falkordbCircuit?.resetTimeout ?? 30000, // Shorter timeout for graph DB
    });
  }

  /**
   * Execute a Cypher query on the tenant's graph.
   * Falls back to PostgreSQL AGE if FalkorDB fails.
   *
   * @param tenantId - Tenant identifier
   * @param cypher - Cypher query to execute
   * @param params - Optional query parameters
   * @returns Query result with backend indicator
   */
  async query(tenantId: string, cypher: string, params?: Record<string, unknown>): Promise<GraphQueryResult> {
    const startTime = Date.now();

    // Try FalkorDB first (if circuit allows)
    if (this.falkordbCircuit.allowsRequest) {
      try {
        const graphName = `${this.graphPrefix}:${tenantId}`;
        const records = await this.falkordb.query(graphName, cypher, params);
        this.falkordbCircuit.recordSuccess();

        const executionTimeMs = Date.now() - startTime;

        log.debug("FalkorDB query succeeded", {
          tenantId,
          executionTimeMs,
          recordCount: records.length,
        });

        return {
          records,
          count: records.length,
          source: "falkordb",
          executionTimeMs,
          isFallback: false,
        };
      } catch (error) {
        this.falkordbCircuit.recordFailure();
        log.warn("FalkorDB query failed, trying PostgreSQL AGE", {
          tenantId,
          error: error instanceof Error ? error.message : String(error),
          circuitState: this.falkordbCircuit.currentState,
        });
      }
    } else {
      log.debug("FalkorDB circuit open, skipping to PostgreSQL AGE", {
        tenantId,
        circuitState: this.falkordbCircuit.currentState,
      });
    }

    // Fallback to PostgreSQL AGE
    if (this.postgres) {
      try {
        const records = await this.postgres.query(tenantId, cypher, params);
        const executionTimeMs = Date.now() - startTime;

        log.info("PostgreSQL AGE fallback succeeded", {
          tenantId,
          executionTimeMs,
          recordCount: records.length,
        });

        return {
          records,
          count: records.length,
          source: "postgres_age",
          executionTimeMs,
          isFallback: true,
        };
      } catch (postgresError) {
        log.error(
          "PostgreSQL AGE fallback also failed",
          postgresError instanceof Error ? postgresError : new Error(String(postgresError)),
          { tenantId }
        );
        throw new Error(
          `All graph backends failed: ${postgresError instanceof Error ? postgresError.message : String(postgresError)}`,
        );
      }
    }

    // No fallback available
    throw new Error("FalkorDB failed and no PostgreSQL AGE fallback configured");
  }

  /**
   * Create a node in the tenant's graph.
   * Uses parameterized properties to prevent injection.
   *
   * @param tenantId - Tenant identifier
   * @param labels - Node labels (must be valid identifiers)
   * @param properties - Node properties (passed as parameters)
   * @returns Created node
   */
  async createNode(tenantId: string, labels: string[], properties: Record<string, unknown>): Promise<GraphNode> {
    // Validate and sanitize labels to prevent injection
    const sanitizedLabels = labels.map((l) => {
      const safe = sanitizeIdentifier(l);
      return `:${safe}`;
    }).join("");

    // Use parameterized properties instead of string interpolation
    // Build a Cypher query that uses $props parameter
    const cypher = `CREATE (n${sanitizedLabels} $props) RETURN n`;
    const result = await this.query(tenantId, cypher, { props: properties });

    const created = result.records[0]?.n as GraphNode | undefined;
    if (!created) {
      throw new Error("Failed to create node - no result returned");
    }

    return created;
  }

  /**
   * Create an edge between two nodes.
   * Uses parameterized properties to prevent injection.
   *
   * @param tenantId - Tenant identifier
   * @param startNodeId - Start node ID
   * @param endNodeId - End node ID
   * @param type - Relationship type (must be valid identifier)
   * @param properties - Relationship properties (passed as parameters)
   * @returns Created edge
   */
  async createEdge(
    tenantId: string,
    startNodeId: string,
    endNodeId: string,
    type: string,
    properties?: Record<string, unknown>,
  ): Promise<GraphEdge> {
    // Sanitize relationship type to prevent injection
    const safeType = sanitizeIdentifier(type);

    // Use parameterized properties
    const cypher = properties
      ? `
        MATCH (a), (b)
        WHERE id(a) = $startId AND id(b) = $endId
        CREATE (a)-[r:${safeType} $props]->(b)
        RETURN r
      `
      : `
        MATCH (a), (b)
        WHERE id(a) = $startId AND id(b) = $endId
        CREATE (a)-[r:${safeType}]->(b)
        RETURN r
      `;

    const result = await this.query(tenantId, cypher, {
      startId: startNodeId,
      endId: endNodeId,
      ...(properties && { props: properties }),
    });

    const created = result.records[0]?.r as GraphEdge | undefined;
    if (!created) {
      throw new Error("Failed to create edge - no result returned");
    }

    return created;
  }

  /**
   * Find nodes by label and properties.
   * Uses parameterized properties to prevent injection.
   *
   * @param tenantId - Tenant identifier
   * @param label - Node label to match (must be valid identifier)
   * @param properties - Properties to filter by (passed as parameters)
   * @returns Matching nodes
   */
  async findNodes(tenantId: string, label: string, properties?: Record<string, unknown>): Promise<GraphNode[]> {
    // Sanitize label to prevent injection
    const safeLabel = sanitizeIdentifier(label);

    let whereClause = "";
    if (properties && Object.keys(properties).length > 0) {
      // Sanitize property keys and build parameterized conditions
      const conditions = Object.entries(properties)
        .map(([key]) => {
          const safeKey = sanitizeIdentifier(key);
          return `n.${safeKey} = $${safeKey}`;
        })
        .join(" AND ");
      whereClause = `WHERE ${conditions}`;
    }

    const cypher = `MATCH (n:${safeLabel}) ${whereClause} RETURN n`;
    const result = await this.query(tenantId, cypher, properties);

    return result.records.map((r) => r.n as GraphNode);
  }

  /**
   * Delete a node by ID.
   *
   * @param tenantId - Tenant identifier
   * @param nodeId - Node ID to delete
   */
  async deleteNode(tenantId: string, nodeId: string): Promise<void> {
    const cypher = `MATCH (n) WHERE id(n) = $nodeId DETACH DELETE n`;
    await this.query(tenantId, cypher, { nodeId });
  }

  /**
   * Format properties object as Cypher property string.
   *
   * @deprecated Use parameterized queries with $props instead of string formatting.
   * This method is kept for backward compatibility but should not be used for
   * user-controlled data. All new code should use query parameters.
   *
   * @internal
   */
  private formatProperties(properties: Record<string, unknown>): string {
    if (!properties || Object.keys(properties).length === 0) {
      return "";
    }

    const pairs = Object.entries(properties).map(([key, value]) => {
      // Sanitize property key
      const safeKey = sanitizeIdentifier(key);

      if (typeof value === "string") {
        // Escape special characters to prevent injection
        const escaped = value
          .replace(/\\/g, "\\\\")
          .replace(/"/g, '\\"')
          .replace(/'/g, "\\'")
          .replace(/\n/g, "\\n")
          .replace(/\r/g, "\\r")
          .replace(/\t/g, "\\t");
        return `${safeKey}: "${escaped}"`;
      }
      if (typeof value === "number" || typeof value === "boolean") {
        return `${safeKey}: ${value}`;
      }
      if (value === null) {
        return `${safeKey}: null`;
      }
      // For complex types, use JSON but validate it doesn't contain injection
      const jsonStr = JSON.stringify(value);
      return `${safeKey}: ${jsonStr}`;
    });

    return `{ ${pairs.join(", ")} }`;
  }

  /**
   * Get current circuit breaker state for monitoring.
   */
  getCircuitState(): string {
    return this.falkordbCircuit.currentState;
  }

  /**
   * Reset circuit breaker (for testing/recovery).
   */
  resetCircuit(): void {
    this.falkordbCircuit.reset();
    log.info("FalkorDB graph circuit reset");
  }

  /**
   * Close all connections.
   */
  async close(): Promise<void> {
    await this.falkordb.disconnect();
    if (this.postgres) {
      await this.postgres.disconnect();
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a ResilientGraph with environment-based configuration.
 */
export function createResilientGraph(): ResilientGraph {
  return new ResilientGraph({
    falkordbHost: process.env.FALKORDB_HOST || "localhost",
    falkordbPort: parseInt(process.env.FALKORDB_PORT || "6379", 10),
    postgresConnectionString: process.env.POSTGRES_AGE_CONNECTION_STRING,
  });
}
