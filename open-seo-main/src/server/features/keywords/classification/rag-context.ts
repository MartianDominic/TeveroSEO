/**
 * RAG Context Retriever for Classification Pipeline
 *
 * Uses LightRAG to retrieve knowledge graph context for better keyword classification.
 * Per Plan 73-04: Wires LightRAG context retrieval into ClassificationPipeline.
 *
 * The context enhances classification by providing:
 * - Known entities from the tenant's knowledge graph
 * - Relationships between entities
 * - Suggested categories based on existing taxonomy
 */

import { getLightRAGService } from "@/server/lib/lightrag/lightrag-service";
import type { ExtractedEntity, EntityRelation } from "@/server/lib/lightrag/entity-types";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "rag-context" });

/** Maximum content length to send to LightRAG query */
const MAX_CONTENT_LENGTH = 2000;

/**
 * RAG context result from knowledge graph query.
 */
export interface RAGContext {
  /** Entities found relevant to the content */
  entities: ExtractedEntity[];
  /** Relations between relevant entities */
  relations: EntityRelation[];
  /** Category names extracted from category-type entities */
  relevantCategories: string[];
  /** Confidence score based on entity confidences (0-1) */
  confidence: number;
  /** Error message if retrieval failed (RAG continues to work as enhancement) */
  error?: string;
}

/**
 * Empty RAG context for fallback scenarios.
 */
function emptyContext(error?: string): RAGContext {
  return {
    entities: [],
    relations: [],
    relevantCategories: [],
    confidence: 0,
    error,
  };
}

/**
 * Calculate confidence score from entity confidences.
 * Returns average of all entity confidence scores, or 0 if no entities.
 */
function calculateConfidence(entities: ExtractedEntity[]): number {
  if (entities.length === 0) {
    return 0;
  }
  const sum = entities.reduce((acc, e) => acc + e.confidence, 0);
  return sum / entities.length;
}

/**
 * Extract category names from category-type entities.
 */
function extractCategories(entities: ExtractedEntity[]): string[] {
  return entities
    .filter((e) => e.type === "category")
    .map((e) => e.name);
}

/**
 * Truncate content to maximum query length.
 */
function truncateContent(content: string): string {
  if (content.length <= MAX_CONTENT_LENGTH) {
    return content;
  }
  return content.slice(0, MAX_CONTENT_LENGTH);
}

/**
 * Retrieve classification context from LightRAG knowledge graph.
 *
 * @param tenantId - Tenant identifier for isolated knowledge graph
 * @param pageContent - Page content to query against
 * @returns RAGContext with entities, relations, and suggested categories
 *
 * This function is designed to be non-blocking:
 * - Returns empty context if RAG service is unavailable
 * - Returns empty context if tenant is not initialized
 * - Wraps all failures in graceful fallback (RAG is enhancement, not requirement)
 */
export async function getClassificationContext(
  tenantId: string,
  pageContent: string
): Promise<RAGContext> {
  const service = getLightRAGService();

  try {
    // Check if service is healthy and tenant is initialized
    const health = await service.healthCheck(tenantId);

    if (!health.healthy) {
      log.warn("LightRAG service unhealthy, skipping context retrieval", { tenantId });
      return emptyContext("LightRAG service unhealthy");
    }

    if (!health.tenantInitialized) {
      log.info("Tenant not initialized in LightRAG, skipping context retrieval", { tenantId });
      return emptyContext();
    }

    // Query knowledge graph with truncated content
    const query = truncateContent(pageContent);
    const result = await service.queryRAG(tenantId, query, "hybrid");

    // Calculate confidence and extract categories
    const confidence = calculateConfidence(result.entities);
    const relevantCategories = extractCategories(result.entities);

    log.info("RAG context retrieved", {
      tenantId,
      entityCount: result.entities.length,
      relationCount: result.relations.length,
      categoryCount: relevantCategories.length,
      confidence,
    });

    return {
      entities: result.entities,
      relations: result.relations,
      relevantCategories,
      confidence,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.warn("Failed to retrieve RAG context, proceeding without", {
      tenantId,
      error: errorMessage,
    });
    return emptyContext(errorMessage);
  }
}
