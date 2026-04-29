/**
 * Prospect management server functions.
 * Phase 26: Prospect Data Model
 *
 * TanStack Start server functions for prospect CRUD operations.
 * All endpoints require authentication and verify workspace ownership.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { inArray, eq, and } from "drizzle-orm";
import { db } from "@/db";
import { prospects, PROSPECT_STATUS, PIPELINE_STAGES } from "@/db/prospect-schema";
import { pipelineAutomationLogs } from "@/db/pipeline-rules-schema";
import { ProspectService } from "@/server/features/prospects/services/ProspectService";
import { AnalysisService } from "@/server/features/prospects/services/AnalysisService";
import { PipelineService } from "@/server/features/prospects/services/PipelineService";
import { requireAuthenticatedContext } from "@/serverFunctions/middleware";
import { AppError } from "@/server/lib/errors";
import { nanoid } from "nanoid";

/**
 * Schema for creating a prospect.
 */
const createProspectSchema = z.object({
  domain: z.string().min(1, "Domain is required"),
  companyName: z.string().optional(),
  contactEmail: z
    .string()
    .email("Invalid email format")
    .optional()
    .or(z.literal("")),
  contactName: z.string().optional(),
  industry: z.string().optional(),
  notes: z.string().optional(),
  source: z.string().optional(),
  assignedTo: z.string().optional(),
});

/**
 * Schema for updating a prospect.
 */
const updateProspectSchema = z.object({
  companyName: z.string().optional(),
  contactEmail: z
    .string()
    .email("Invalid email format")
    .optional()
    .or(z.literal("")),
  contactName: z.string().optional(),
  industry: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(PROSPECT_STATUS).optional(),
  source: z.string().optional(),
  assignedTo: z.string().optional(),
});

/**
 * Schema for listing prospects.
 */
const listProspectsSchema = z.object({
  page: z.number().int().positive().optional().default(1),
  pageSize: z.number().int().positive().max(100).optional().default(20),
  status: z.string().optional(),
  pipelineStage: z.enum(PIPELINE_STAGES).optional(),
});

/**
 * Create a new prospect.
 *
 * T-26-01: Verifies auth.organizationId from Clerk session before insert.
 */
export const createProspect = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => createProspectSchema.parse(data))
  .handler(async ({ data, context }) => {
    const prospect = await ProspectService.create({
      workspaceId: context.organizationId,
      ...data,
    });
    return prospect;
  });

/**
 * Get prospect by ID with analyses.
 *
 * T-26-03: Filters results by organizationId to prevent cross-tenant access.
 */
export const getProspect = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const prospect = await ProspectService.findById(data.id);

    if (!prospect) {
      throw new Error("Prospect not found");
    }

    // Verify workspace ownership (T-26-03)
    if (prospect.workspaceId !== context.organizationId) {
      throw new Error("Prospect not found");
    }

    return prospect;
  });

/**
 * List prospects for current workspace.
 *
 * T-26-05: Page size limited to max 100 to prevent DoS.
 */
export const listProspects = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => listProspectsSchema.parse(data))
  .handler(async ({ data, context }) => {
    return ProspectService.findByWorkspace(context.organizationId, data);
  });

/**
 * Update prospect.
 *
 * T-26-02: Re-verifies workspaceId ownership before update.
 */
export const updateProspect = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().min(1),
        updates: updateProspectSchema,
      })
      .parse(data),
  )
  .handler(async ({ data: { id, updates }, context }) => {
    // Verify ownership first (T-26-02)
    const existing = await ProspectService.findById(id);
    if (!existing || existing.workspaceId !== context.organizationId) {
      throw new Error("Prospect not found");
    }

    return ProspectService.update(id, updates);
  });

/**
 * Delete prospect.
 *
 * Verifies workspace ownership before deletion.
 */
export const deleteProspect = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    // Verify ownership first
    const existing = await ProspectService.findById(data.id);
    if (!existing || existing.workspaceId !== context.organizationId) {
      throw new Error("Prospect not found");
    }

    await ProspectService.delete(data.id);
    return { success: true };
  });

/**
 * Schema for importing prospects from CSV.
 * Limit to 10,000 rows per import to prevent DoS (T-30.5-03).
 */
const importCsvSchema = z.object({
  rows: z
    .array(
      z.object({
        domain: z.string().min(1),
        companyName: z.string().optional(),
        contactEmail: z.string().email().optional().or(z.literal("")),
        contactName: z.string().optional(),
        industry: z.string().optional(),
        notes: z.string().optional(),
        source: z.string().optional(),
      })
    )
    .min(1)
    .max(10000),
});

/**
 * Import prospects from parsed CSV data.
 * Creates prospects in batch, skipping duplicates.
 *
 * T-30.5-01: Validates all rows with zod before insert.
 * T-30.5-02: Handles duplicate domain conflicts gracefully.
 *
 * PERFORMANCE FIX: Uses batch INSERT with ON CONFLICT instead of
 * individual inserts per row. Reduces 10,000 queries to ~20 batch inserts.
 */
export const importProspectsFromCsv = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => importCsvSchema.parse(data))
  .handler(async ({ data, context }) => {
    const results = {
      created: 0,
      skipped: 0,
      errors: [] as Array<{ domain: string; error: string }>,
    };

    // Normalize and validate domains, collect valid rows
    const validRows: Array<{
      id: string;
      workspaceId: string;
      domain: string;
      companyName: string | undefined;
      contactEmail: string | undefined;
      contactName: string | undefined;
      industry: string | undefined;
      notes: string | undefined;
      source: string;
      status: string;
      pipelineStage: string;
      createdAt: Date;
      updatedAt: Date;
    }> = [];

    const DOMAIN_REGEX = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
    const now = new Date();

    for (const row of data.rows) {
      // Normalize domain
      let normalized = row.domain.replace(/^https?:\/\//, "");
      normalized = normalized.replace(/^www\./, "");
      normalized = normalized.split("/")[0];
      normalized = normalized.split(":")[0];
      normalized = normalized.toLowerCase().trim();

      if (!DOMAIN_REGEX.test(normalized)) {
        results.errors.push({
          domain: row.domain,
          error: `Invalid domain format: ${row.domain}`,
        });
        continue;
      }

      validRows.push({
        id: nanoid(),
        workspaceId: context.organizationId,
        domain: normalized,
        companyName: row.companyName,
        contactEmail: row.contactEmail || undefined,
        contactName: row.contactName,
        industry: row.industry,
        notes: row.notes,
        source: row.source || "csv_import",
        status: "new",
        pipelineStage: "new",
        createdAt: now,
        updatedAt: now,
      });
    }

    // Batch insert with ON CONFLICT DO NOTHING
    // Process in batches of 500 to avoid query size limits
    const BATCH_SIZE = 500;

    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      const batch = validRows.slice(i, i + BATCH_SIZE);

      try {
        const inserted = await db
          .insert(prospects)
          .values(batch)
          .onConflictDoNothing({
            target: [prospects.workspaceId, prospects.domain],
          })
          .returning({ id: prospects.id });

        results.created += inserted.length;
        results.skipped += batch.length - inserted.length;
      } catch (error) {
        // If batch fails, record all domains as errors
        for (const row of batch) {
          results.errors.push({
            domain: row.domain,
            error: error instanceof Error ? error.message : "Batch insert failed",
          });
        }
      }
    }

    return results;
  });

// ============================================================================
// Phase 30.5-05: Bulk Actions
// ============================================================================

/**
 * Schema for bulk analyze action.
 * Limit to 500 prospects per request (T-30.5-05b).
 */
const bulkAnalyzeSchema = z.object({
  prospectIds: z.array(z.string()).min(1).max(500),
  analysisType: z.enum(["quick_scan", "deep_dive", "opportunity_discovery"]),
});

/**
 * Schema for bulk archive action.
 * Limit to 500 prospects per request.
 */
const bulkArchiveSchema = z.object({
  prospectIds: z.array(z.string()).min(1).max(500),
});

/**
 * Schema for getting stage distribution.
 */
const getStageDistributionSchema = z.object({});

/**
 * Bulk analyze selected prospects.
 * Respects daily quota (10/day/workspace).
 *
 * T-30.5-05a: All server functions verify workspace ownership before action.
 * T-30.5-05b: 500 prospect limit per request; 10/day quota enforced server-side.
 */
export const bulkAnalyzeProspects = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => bulkAnalyzeSchema.parse(data))
  .handler(async ({ data, context }) => {
    return AnalysisService.bulkQueueAnalysis({
      prospectIds: data.prospectIds,
      workspaceId: context.organizationId,
      analysisType: data.analysisType,
      triggeredBy: context.userId,
    });
  });

/**
 * Bulk archive selected prospects.
 * Transitions all selected to "archived" stage.
 *
 * T-30.5-05a: Verifies ownership for each prospect before archiving.
 *
 * PERFORMANCE FIX: Uses bulk UPDATE with IN clause instead of
 * individual findById + transitionStage per ID. Reduces 1,000 queries to 3.
 */
export const bulkArchiveProspects = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => bulkArchiveSchema.parse(data))
  .handler(async ({ data, context }) => {
    const now = new Date();

    // Step 1: Get current state of all prospects that belong to this workspace
    // This validates ownership in a single query
    const existingProspects = await db
      .select({
        id: prospects.id,
        pipelineStage: prospects.pipelineStage,
      })
      .from(prospects)
      .where(
        and(
          inArray(prospects.id, data.prospectIds),
          eq(prospects.workspaceId, context.organizationId)
        )
      );

    // Track which IDs were found and owned by this workspace
    const validIds = existingProspects.map((p) => p.id);
    const notFoundOrUnauthorized = data.prospectIds.length - validIds.length;

    if (validIds.length === 0) {
      return { archived: 0, errors: notFoundOrUnauthorized };
    }

    // Step 2: Bulk update all valid prospects to archived stage
    const updated = await db
      .update(prospects)
      .set({
        pipelineStage: "archived",
        updatedAt: now,
      })
      .where(inArray(prospects.id, validIds))
      .returning({ id: prospects.id });

    // Step 3: Bulk insert pipeline transition logs for audit trail
    const logsToInsert = existingProspects
      .filter((p) => p.pipelineStage !== "archived") // Only log actual transitions
      .map((p) => ({
        id: nanoid(),
        prospectId: p.id,
        ruleId: "bulk_archive",
        fromStage: p.pipelineStage,
        toStage: "archived" as const,
        executedAt: now,
      }));

    if (logsToInsert.length > 0) {
      await db.insert(pipelineAutomationLogs).values(logsToInsert);
    }

    return {
      archived: updated.length,
      errors: notFoundOrUnauthorized,
    };
  });

/**
 * Get pipeline stage distribution for current workspace.
 */
export const getStageDistribution = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => getStageDistributionSchema.parse(data))
  .handler(async ({ context }) => {
    return PipelineService.getStageDistribution(context.organizationId);
  });

/**
 * Get remaining analysis quota for today.
 */
export const getRemainingQuota = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .handler(async ({ context }) => {
    const remaining = await AnalysisService.getRemainingAnalysesToday(context.organizationId);
    return { remaining, limit: 10 };
  });
