/**
 * Prospect management service.
 * Phase 26: Prospect Data Model
 *
 * Provides CRUD operations for prospects with domain validation.
 * Prospects are potential clients stored by domain with SEO analysis data.
 *
 * Security: All mutations are logged to audit trail.
 */
import { eq, and, desc, count, asc, isNull } from "drizzle-orm";
import { db } from "@/db/index";
import {
  prospects,
  prospectAnalyses,
  type ProspectSelect,
  type ProspectAnalysisSelect,
  type PipelineStage,
  PROSPECT_STATUS,
} from "@/db/prospect-schema";
import { clients, type ClientSelect } from "@/db/client-schema";
import { withAudit, type AuditContext } from "@/db/audit";
import { AppError } from "@/server/lib/errors";
import {
  withTransaction,
  TransactionContext,
  type PostCommitJob,
} from "@/server/lib/db-transaction";
import { nanoid } from "nanoid";
import { isEnumValue } from "@/lib/type-guards";

// Domain validation regex - matches valid domain names
// Allows: example.com, sub.example.com, example.co.uk
// Rejects: invalid chars, missing TLD, IP addresses
const DOMAIN_REGEX = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

/**
 * Normalize a domain string for storage.
 * Removes protocol, www prefix, path, and port.
 * Lowercases the result.
 */
function normalizeDomain(domain: string): string {
  // Remove protocol if present
  let normalized = domain.replace(/^https?:\/\//, "");
  // Remove www. prefix
  normalized = normalized.replace(/^www\./, "");
  // Remove trailing slash and path
  normalized = normalized.split("/")[0];
  // Remove port
  normalized = normalized.split(":")[0];
  // Lowercase
  return normalized.toLowerCase().trim();
}

/**
 * Validate and normalize a domain string.
 * @throws AppError("BAD_REQUEST") if domain format is invalid
 */
function validateDomain(domain: string): string {
  const normalized = normalizeDomain(domain);
  if (!DOMAIN_REGEX.test(normalized)) {
    throw new AppError("VALIDATION_ERROR", `Invalid domain format: ${domain}`);
  }
  return normalized;
}

export interface CreateProspectInput {
  workspaceId: string;
  domain: string;
  companyName?: string;
  contactEmail?: string;
  contactName?: string;
  industry?: string;
  notes?: string;
  source?: string;
  assignedTo?: string;
  /** Audit context for logging mutations */
  auditContext?: AuditContext;
}

export interface UpdateProspectInput {
  companyName?: string;
  contactEmail?: string;
  contactName?: string;
  industry?: string;
  notes?: string;
  status?: string;
  source?: string;
  assignedTo?: string;
  /** Audit context for logging mutations */
  auditContext?: AuditContext;
}

export interface ProspectWithAnalyses extends ProspectSelect {
  analyses: ProspectAnalysisSelect[];
}

export interface PaginatedProspects {
  data: ProspectSelect[];
  total: number;
  page: number;
  pageSize: number;
}

export const ProspectService = {
  /**
   * Create a new prospect with domain validation.
   * Throws if domain already exists in workspace.
   *
   * T-26-04: Uses Drizzle ORM parameterized queries to prevent SQL injection.
   * Security: Logs creation to audit trail.
   *
   * Uses atomic INSERT ON CONFLICT to prevent race conditions where concurrent
   * requests could both pass the duplicate check and create duplicates.
   */
  async create(input: CreateProspectInput): Promise<ProspectSelect> {
    const normalizedDomain = validateDomain(input.domain);
    const audit = input.auditContext
      ? withAudit<ProspectSelect>("prospect", input.auditContext)
      : null;

    const id = nanoid();
    const now = new Date();

    // Atomic insert with ON CONFLICT DO NOTHING
    // This prevents race conditions where two concurrent requests could both
    // pass a "check if exists" step and create duplicate prospects
    const [inserted] = await db
      .insert(prospects)
      .values({
        id,
        workspaceId: input.workspaceId,
        domain: normalizedDomain,
        companyName: input.companyName,
        contactEmail: input.contactEmail,
        contactName: input.contactName,
        industry: input.industry,
        notes: input.notes,
        source: input.source,
        assignedTo: input.assignedTo,
        status: "new",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({
        // Target the unique index on (workspaceId, domain)
        target: [prospects.workspaceId, prospects.domain],
      })
      .returning();

    // If insert was a no-op due to conflict, the prospect already exists
    if (!inserted) {
      throw new AppError(
        "CONFLICT",
        `Prospect with domain ${normalizedDomain} already exists in this workspace`,
      );
    }

    // Log the creation to audit trail
    if (audit) {
      await audit.logCreate(id, inserted, { source: input.source });
    }

    return inserted;
  },

  /**
   * Find prospect by ID with its analyses (internal use only).
   *
   * WARNING: This method does NOT filter by workspace.
   * Use findByIdScoped() for tenant-safe access.
   */
  async findById(id: string): Promise<ProspectWithAnalyses | null> {
    const [prospect] = await db
      .select()
      .from(prospects)
      .where(eq(prospects.id, id))
      .limit(1);

    if (!prospect) return null;

    const analyses = await db
      .select()
      .from(prospectAnalyses)
      .where(eq(prospectAnalyses.prospectId, id))
      .orderBy(desc(prospectAnalyses.createdAt));

    return { ...prospect, analyses };
  },

  /**
   * Find prospect by ID with its analyses, scoped to workspace.
   * Returns null if prospect doesn't exist OR belongs to different workspace.
   *
   * SECURITY: Use this for tenant-safe data access.
   */
  async findByIdScoped(id: string, workspaceId: string): Promise<ProspectWithAnalyses | null> {
    const [prospect] = await db
      .select()
      .from(prospects)
      .where(and(eq(prospects.id, id), eq(prospects.workspaceId, workspaceId)))
      .limit(1);

    if (!prospect) return null;

    const analyses = await db
      .select()
      .from(prospectAnalyses)
      .where(eq(prospectAnalyses.prospectId, id))
      .orderBy(desc(prospectAnalyses.createdAt));

    return { ...prospect, analyses };
  },

  /**
   * Find all prospects for a workspace with pagination.
   *
   * T-26-05: Limits pageSize to max 100 to prevent DoS.
   */
  async findByWorkspace(
    workspaceId: string,
    options: { page?: number; pageSize?: number; status?: string; pipelineStage?: PipelineStage; sortBy?: "priority" | "created" } = {},
  ): Promise<PaginatedProspects> {
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
    const offset = (page - 1) * pageSize;
    const sortBy = options.sortBy ?? "created";

    let whereClause = eq(prospects.workspaceId, workspaceId);
    if (options.status) {
      whereClause = and(whereClause, eq(prospects.status, options.status))!;
    }
    if (options.pipelineStage) {
      whereClause = and(whereClause, eq(prospects.pipelineStage, options.pipelineStage))!;
    }

    // Sort by priority (descending, nulls last) or created date
    const orderByClause =
      sortBy === "priority"
        ? [desc(prospects.priorityScore), desc(prospects.createdAt)]
        : [desc(prospects.createdAt)];

    const [data, [{ total }]] = await Promise.all([
      db
        .select()
        .from(prospects)
        .where(whereClause)
        .orderBy(...orderByClause)
        .limit(pageSize)
        .offset(offset),
      db.select({ total: count() }).from(prospects).where(whereClause),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
    };
  },

  /**
   * Update prospect fields.
   *
   * T-26-02: Caller must verify workspace ownership before calling.
   * Security: Logs update to audit trail with before/after values.
   *
   * Uses transaction with row-level locking to prevent race conditions
   * where concurrent updates could overwrite each other or create
   * inconsistent audit logs.
   */
  async update(id: string, input: UpdateProspectInput): Promise<ProspectSelect> {
    const { auditContext, ...updateFields } = input;

    // Validate status if provided using type-safe enum check
    if (updateFields.status && !isEnumValue(updateFields.status, PROSPECT_STATUS)) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Invalid status: ${updateFields.status}. Must be one of: ${PROSPECT_STATUS.join(", ")}`,
      );
    }

    // Use transaction to ensure atomic read-update-audit operation
    return await db.transaction(async (tx) => {
      // Get current state within transaction with row-level lock
      // FOR UPDATE prevents concurrent transactions from modifying the same row
      const [current] = await tx
        .select()
        .from(prospects)
        .where(eq(prospects.id, id))
        .for("update")
        .limit(1);

      if (!current) {
        throw new AppError("NOT_FOUND", `Prospect not found: ${id}`);
      }

      // Update and return new state
      const [updated] = await tx
        .update(prospects)
        .set({
          ...updateFields,
          updatedAt: new Date(),
        })
        .where(eq(prospects.id, id))
        .returning();

      // Log audit with accurate before/after values within same transaction
      if (auditContext) {
        const audit = withAudit<ProspectSelect>("prospect", auditContext);
        await audit.logUpdate(id, current, updated);
      }

      return updated;
    });
  },

  /**
   * Delete prospect (cascades to analyses via FK).
   * Security: Logs deletion to audit trail with deleted values.
   */
  async delete(id: string, auditContext?: AuditContext): Promise<void> {
    const audit = auditContext
      ? withAudit<ProspectSelect>("prospect", auditContext)
      : null;

    // Get current values for audit log before deletion
    const [prospect] = audit
      ? await db.select().from(prospects).where(eq(prospects.id, id)).limit(1)
      : [null];

    const [deleted] = await db
      .delete(prospects)
      .where(eq(prospects.id, id))
      .returning({ id: prospects.id });

    if (!deleted) {
      throw new AppError("NOT_FOUND", `Prospect not found: ${id}`);
    }

    // Log the deletion to audit trail
    if (audit && prospect) {
      await audit.logDelete(id, prospect);
    }
  },

  /**
   * Update prospect status to 'analyzing' before starting analysis.
   */
  async markAnalyzing(id: string): Promise<void> {
    await db
      .update(prospects)
      .set({ status: "analyzing", updatedAt: new Date() })
      .where(eq(prospects.id, id));
  },

  /**
   * Update prospect status to 'analyzed' after analysis completes.
   */
  async markAnalyzed(id: string): Promise<void> {
    await db
      .update(prospects)
      .set({ status: "analyzed", updatedAt: new Date() })
      .where(eq(prospects.id, id));
  },

  /**
   * Update prospect status to 'converted' and link to client.
   *
   * Validates clientId is a valid UUID format before storing.
   * No FK constraint exists due to cross-database design (clients may live in AI-Writer DB).
   * Caller should verify client actually exists via resolveClientId() before calling.
   */
  async markConverted(id: string, clientId: string): Promise<void> {
    // Validate UUID format to match the UUID column type
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(clientId)) {
      throw new AppError("VALIDATION_ERROR", `Invalid client ID format: ${clientId}. Must be a valid UUID.`);
    }

    await db
      .update(prospects)
      .set({
        status: "converted",
        convertedClientId: clientId,
        pipelineStage: "converted",
        updatedAt: new Date(),
      })
      .where(eq(prospects.id, id));
  },

  /**
   * Convert a prospect to a client with full transaction safety.
   *
   * Phase 69-01: Transaction wrapper with post-commit job collection.
   *
   * Operations (all in single transaction):
   * 1. Fetch prospect (validates existence)
   * 2. Create client record
   * 3. Update prospect status to 'converted'
   * 4. Collect webhook job for post-commit delivery
   *
   * Webhook jobs are enqueued AFTER transaction commits to ensure
   * workers don't process events for uncommitted data.
   *
   * @param prospectId - Prospect to convert
   * @param userId - User performing the conversion (for audit)
   * @param workspaceId - Workspace context
   * @returns Created client record
   * @throws AppError if prospect not found or already converted
   */
  async convertProspectToClient(
    prospectId: string,
    userId: string,
    workspaceId: string,
  ): Promise<{
    client: ClientSelect;
    postCommitJobs: PostCommitJob[];
  }> {
    const txContext = new TransactionContext();

    const client = await withTransaction(async (tx) => {
      // 1. Fetch prospect within transaction for consistency
      const [prospect] = await tx
        .select()
        .from(prospects)
        .where(and(eq(prospects.id, prospectId), eq(prospects.workspaceId, workspaceId)))
        .for("update") // Lock row to prevent concurrent conversion
        .limit(1);

      if (!prospect) {
        throw new AppError("NOT_FOUND", `Prospect not found: ${prospectId}`);
      }

      if (prospect.status === "converted") {
        throw new AppError("CONFLICT", `Prospect already converted: ${prospectId}`);
      }

      // 2. Create client record
      const now = new Date();
      const [createdClient] = await tx
        .insert(clients)
        .values({
          workspaceId,
          name: prospect.companyName ?? prospect.domain,
          domain: prospect.domain,
          contactEmail: prospect.contactEmail,
          contactName: prospect.contactName,
          industry: prospect.industry,
          status: "onboarding",
          convertedFromProspectId: prospectId,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      // 3. Update prospect status
      await tx
        .update(prospects)
        .set({
          status: "converted",
          convertedClientId: createdClient.id,
          pipelineStage: "converted",
          updatedAt: now,
        })
        .where(eq(prospects.id, prospectId));

      // 4. Collect post-commit webhook job
      // Job is NOT enqueued yet - caller must call enqueuePostCommitJobs after this returns
      txContext.addPostCommitJob({
        queue: "webhooks",
        jobName: "client.created",
        data: {
          clientId: createdClient.id,
          prospectId,
          workspaceId,
          domain: prospect.domain,
          convertedBy: userId,
          convertedAt: now.toISOString(),
        },
      });

      return createdClient;
    });

    // Return client and jobs for caller to enqueue after commit
    return {
      client,
      postCommitJobs: txContext.getPostCommitJobs(),
    };
  },
};
