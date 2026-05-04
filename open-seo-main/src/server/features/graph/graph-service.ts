/**
 * GraphService - Graph Operations for GraphRAG
 * Phase 65: GraphRAG Foundation (65-04)
 *
 * Wraps TenantGraphManager with domain-specific operations for
 * entity management and graph manipulation.
 */

import type { TenantGraphManager } from "@/server/lib/graph";
import { getTenantGraphManager } from "@/server/lib/graph";
import type { GraphEntity, GraphRelation } from "@/server/lib/graph";
import { createEntityCypher, createRelationCypher } from "@/server/lib/graph";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "graph-service" });

/**
 * GraphService provides domain-level graph operations.
 *
 * Wraps TenantGraphManager with:
 * - Entity CRUD operations
 * - Relation management
 * - Tenant lifecycle (init/delete)
 */
export class GraphService {
  private manager: TenantGraphManager;

  constructor(manager: TenantGraphManager) {
    this.manager = manager;
  }

  /**
   * Initialize a tenant's graph with indexes and configuration.
   */
  async initializeTenant(tenantId: string): Promise<void> {
    log.info("Initializing tenant graph", { tenantId });
    await this.manager.initializeTenant(tenantId);
  }

  /**
   * Add an entity to the tenant's graph.
   */
  async addEntity(tenantId: string, entity: GraphEntity): Promise<void> {
    const graph = await this.manager.getGraph(tenantId);
    const { cypher, params } = createEntityCypher(entity);
    // Cast params to expected type - CypherQuery.params uses Record<string, unknown>
    // but FalkorDB expects narrower QueryParams type
    await graph.query(cypher, { params: params as Record<string, string | number | boolean | null | number[]> });
    log.debug("Entity added", { tenantId, entityId: entity.id, type: entity.type });
  }

  /**
   * Add a relation between two entities.
   */
  async addRelation(tenantId: string, relation: GraphRelation): Promise<void> {
    const graph = await this.manager.getGraph(tenantId);
    const { cypher, params } = createRelationCypher(relation);
    // Cast params to expected type
    await graph.query(cypher, { params: params as Record<string, string | number | boolean | null | number[]> });
    log.debug("Relation added", {
      tenantId,
      from: relation.from,
      to: relation.to,
      type: relation.type,
    });
  }

  /**
   * Delete a tenant's graph and all data.
   */
  async deleteTenant(tenantId: string): Promise<void> {
    log.info("Deleting tenant graph", { tenantId });
    await this.manager.deleteTenant(tenantId);
  }

  /**
   * Check if a tenant's graph exists and has data.
   */
  async hasTenantData(tenantId: string): Promise<boolean> {
    try {
      const graph = await this.manager.getGraph(tenantId);
      const result = await graph.query<{ count: number }>(
        "MATCH (n) RETURN count(n) AS count LIMIT 1"
      );
      return (result.data?.[0]?.count ?? 0) > 0;
    } catch (error) {
      // Log error but return false - graph may not exist yet
      log.debug("hasTenantData check failed", {
        tenantId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}

// Singleton instance
let _service: GraphService | null = null;

/**
 * Get the singleton GraphService instance.
 */
export async function getGraphService(): Promise<GraphService> {
  if (!_service) {
    const manager = await getTenantGraphManager();
    _service = new GraphService(manager);
  }
  return _service;
}
