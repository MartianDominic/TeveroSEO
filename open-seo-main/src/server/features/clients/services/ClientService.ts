/**
 * Client management service with audit logging.
 *
 * Provides CRUD operations for clients with comprehensive audit trails.
 * All mutations are logged with before/after values.
 */

import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db/index";
import {
  clients,
  type ClientSelect,
  type ClientInsert,
  CLIENT_STATUS,
  type ClientStatus,
} from "@/db/client-schema";
import { withAudit, type AuditContext } from "@/db/audit";
import { AppError } from "@/server/lib/errors";
import { nanoid } from "nanoid";
import { isEnumValue } from "@/lib/type-guards";
import { invalidateAllClientAccessCaches } from "@/server/middleware/authz";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "ClientService" });

// Domain validation regex
const DOMAIN_REGEX = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

/**
 * Normalize a domain string for storage.
 */
function normalizeDomain(domain: string): string {
  let normalized = domain.replace(/^https?:\/\//, "");
  normalized = normalized.replace(/^www\./, "");
  normalized = normalized.split("/")[0];
  normalized = normalized.split(":")[0];
  return normalized.toLowerCase().trim();
}

/**
 * Validate and normalize a domain string.
 */
function validateDomain(domain: string): string {
  const normalized = normalizeDomain(domain);
  if (!DOMAIN_REGEX.test(normalized)) {
    throw new AppError("VALIDATION_ERROR", `Invalid domain format: ${domain}`);
  }
  return normalized;
}

export interface CreateClientInput {
  workspaceId: string;
  name: string;
  domain: string;
  contactEmail?: string;
  contactName?: string;
  industry?: string;
  convertedFromProspectId?: string;
}

export interface UpdateClientInput {
  name?: string;
  contactEmail?: string;
  contactName?: string;
  industry?: string;
  status?: ClientStatus;
  gscRefreshToken?: string;
  gscSiteUrl?: string;
  targetKeywords?: string[];
}

export interface PaginatedClients {
  data: ClientSelect[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Client service with audit logging.
 */
export const ClientService = {
  /**
   * Create a new client with audit logging.
   *
   * Uses INSERT ON CONFLICT to atomically prevent duplicate domain/workspace
   * combinations, avoiding TOCTOU race conditions.
   */
  async create(
    input: CreateClientInput,
    auditContext: AuditContext
  ): Promise<ClientSelect> {
    const normalizedDomain = validateDomain(input.domain);
    const audit = withAudit<ClientSelect>("client", auditContext);

    const id = nanoid();
    const now = new Date();

    // Use INSERT ON CONFLICT DO NOTHING to atomically check for duplicates
    // This avoids TOCTOU race conditions where two requests could pass a
    // SELECT check and both attempt to insert the same domain/workspace
    const [created] = await db
      .insert(clients)
      .values({
        id,
        workspaceId: input.workspaceId,
        name: input.name,
        domain: normalizedDomain,
        contactEmail: input.contactEmail,
        contactName: input.contactName,
        industry: input.industry,
        convertedFromProspectId: input.convertedFromProspectId,
        status: "onboarding",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({
        target: [clients.workspaceId, clients.domain],
      })
      .returning();

    // If no row returned, a client with this domain already exists
    if (!created) {
      throw new AppError(
        "CONFLICT",
        `Client with domain ${normalizedDomain} already exists in this workspace`
      );
    }

    // Log the creation
    await audit.logCreate(id, created, {
      source: input.convertedFromProspectId ? "prospect_conversion" : "manual",
    });

    return created;
  },

  /**
   * Find client by ID.
   */
  async findById(id: string): Promise<ClientSelect | null> {
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, id))
      .limit(1);

    return client ?? null;
  },

  /**
   * Find all clients for a workspace with pagination.
   */
  async findByWorkspace(
    workspaceId: string,
    options: { page?: number; pageSize?: number; status?: ClientStatus } = {}
  ): Promise<PaginatedClients> {
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    let whereClause = eq(clients.workspaceId, workspaceId);
    if (options.status) {
      whereClause = and(whereClause, eq(clients.status, options.status))!;
    }

    const [data, countResult] = await Promise.all([
      db
        .select()
        .from(clients)
        .where(whereClause)
        .orderBy(desc(clients.createdAt))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ count: clients.id })
        .from(clients)
        .where(whereClause),
    ]);

    return {
      data,
      total: countResult.length,
      page,
      pageSize,
    };
  },

  /**
   * Update client with audit logging.
   */
  async update(
    id: string,
    input: UpdateClientInput,
    auditContext: AuditContext
  ): Promise<ClientSelect> {
    const audit = withAudit<ClientSelect>("client", auditContext);

    // Validate status if provided
    if (input.status && !isEnumValue(input.status, CLIENT_STATUS)) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Invalid status: ${input.status}. Must be one of: ${CLIENT_STATUS.join(", ")}`
      );
    }

    // Get current values for audit log
    const [oldClient] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, id))
      .limit(1);

    if (!oldClient) {
      throw new AppError("NOT_FOUND", `Client not found: ${id}`);
    }

    // Build update object
    const updateData: Partial<ClientInsert> & { updatedAt: Date } = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.contactEmail !== undefined) updateData.contactEmail = input.contactEmail;
    if (input.contactName !== undefined) updateData.contactName = input.contactName;
    if (input.industry !== undefined) updateData.industry = input.industry;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.gscRefreshToken !== undefined) updateData.gscRefreshToken = input.gscRefreshToken;
    if (input.gscSiteUrl !== undefined) updateData.gscSiteUrl = input.gscSiteUrl;
    if (input.targetKeywords !== undefined) updateData.targetKeywords = input.targetKeywords;

    // Handle GSC connection timestamp
    if (input.gscRefreshToken && !oldClient.gscConnectedAt) {
      updateData.gscConnectedAt = new Date();
    }

    const [updated] = await db
      .update(clients)
      .set(updateData)
      .where(eq(clients.id, id))
      .returning();

    // Log the update
    await audit.logUpdate(id, oldClient, updated);

    return updated;
  },

  /**
   * Delete client with audit logging.
   */
  async delete(id: string, auditContext: AuditContext): Promise<void> {
    const audit = withAudit<ClientSelect>("client", auditContext);

    // Get current values for audit log
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, id))
      .limit(1);

    if (!client) {
      throw new AppError("NOT_FOUND", `Client not found: ${id}`);
    }

    await db.delete(clients).where(eq(clients.id, id));

    // Log the deletion
    await audit.logDelete(id, client, {
      reason: "user_requested",
    });

    // CRITICAL: Invalidate all authorization caches for this client.
    // This ensures users who had access can no longer access the deleted client.
    try {
      await invalidateAllClientAccessCaches(id);
      log.info("Invalidated auth cache after client deletion", { clientId: id });
    } catch (cacheErr) {
      // Cache invalidation failure is logged but not fatal.
      // The cache has a 5-minute TTL so stale entries will expire.
      log.warn("Failed to invalidate auth cache after client deletion", {
        clientId: id,
        error: cacheErr instanceof Error ? cacheErr.message : String(cacheErr),
      });
    }
  },

  /**
   * Update client status with audit logging.
   */
  async updateStatus(
    id: string,
    status: ClientStatus,
    auditContext: AuditContext
  ): Promise<ClientSelect> {
    return this.update(id, { status }, auditContext);
  },

  /**
   * Connect GSC with audit logging.
   * Logs a sensitive operation since it involves OAuth credentials.
   */
  async connectGSC(
    id: string,
    gscRefreshToken: string,
    gscSiteUrl: string,
    auditContext: AuditContext
  ): Promise<ClientSelect> {
    const audit = withAudit<ClientSelect>("client", auditContext);

    // Log sensitive credential access
    await audit.logSensitiveRead(id, ["gscRefreshToken"], {
      operation: "gsc_connect",
    });

    return this.update(
      id,
      { gscRefreshToken, gscSiteUrl },
      auditContext
    );
  },

  /**
   * Disconnect GSC with audit logging.
   */
  async disconnectGSC(
    id: string,
    auditContext: AuditContext
  ): Promise<ClientSelect> {
    const audit = withAudit<ClientSelect>("client", auditContext);

    // Get current values
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, id))
      .limit(1);

    if (!client) {
      throw new AppError("NOT_FOUND", `Client not found: ${id}`);
    }

    const [updated] = await db
      .update(clients)
      .set({
        gscRefreshToken: null,
        gscSiteUrl: null,
        gscConnectedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(clients.id, id))
      .returning();

    // Log the credential removal
    await audit.logUpdate(id, client, updated, {
      operation: "gsc_disconnect",
      sensitiveFieldsCleared: ["gscRefreshToken"],
    });

    return updated;
  },

  /**
   * Complete onboarding with audit logging.
   */
  async completeOnboarding(
    id: string,
    auditContext: AuditContext
  ): Promise<ClientSelect> {
    const audit = withAudit<ClientSelect>("client", auditContext);

    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, id))
      .limit(1);

    if (!client) {
      throw new AppError("NOT_FOUND", `Client not found: ${id}`);
    }

    const now = new Date();

    const [updated] = await db
      .update(clients)
      .set({
        status: "active",
        onboardingCompletedAt: now,
        updatedAt: now,
      })
      .where(eq(clients.id, id))
      .returning();

    await audit.logUpdate(id, client, updated, {
      milestone: "onboarding_complete",
    });

    return updated;
  },
};
