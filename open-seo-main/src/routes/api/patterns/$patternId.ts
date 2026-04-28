/**
 * Pattern API endpoint.
 * Phase 41-02: Pattern Detection with Real GSC Data
 *
 * PATCH /api/patterns/{patternId}
 * Updates pattern status (dismiss/resolve).
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "@/db";
import { detectedPatterns } from "@/db/patterns-schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import { requireApiAuth } from "@/routes/api/seo/-middleware";

const log = createLogger({ module: "api/patterns" });

/**
 * Schema for PATCH request body.
 */
const patchPatternSchema = z.object({
  status: z.enum(["active", "dismissed", "resolved"]).optional(),
  dismissedAt: z.string().datetime().optional(),
  resolvedAt: z.string().datetime().optional(),
});

export const Route = createFileRoute("/api/patterns/$patternId")({
  server: {
    handlers: {
      /**
       * PATCH /api/patterns/{patternId}
       * Update pattern status.
       */
      PATCH: async ({
        request,
        params,
      }: {
        request: Request;
        params: { patternId: string };
      }) => {
        try {
          await requireApiAuth(request);

          const { patternId } = params;

          if (!patternId) {
            return Response.json(
              { error: "patternId is required" },
              { status: 400 }
            );
          }

          const body = (await request.json()) as Record<string, unknown>;
          const parsed = patchPatternSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json(
              { error: "Invalid request", details: parsed.error.issues },
              { status: 400 }
            );
          }

          const { status, dismissedAt, resolvedAt } = parsed.data;

          // Build update payload
          const updateData: Record<string, unknown> = {};
          if (status !== undefined) {
            updateData.status = status;
          }
          if (dismissedAt !== undefined) {
            updateData.dismissedAt = new Date(dismissedAt);
          }
          if (resolvedAt !== undefined) {
            updateData.resolvedAt = new Date(resolvedAt);
          }

          if (Object.keys(updateData).length === 0) {
            return Response.json(
              { error: "No valid fields to update" },
              { status: 400 }
            );
          }

          // Update pattern
          const [updated] = await db
            .update(detectedPatterns)
            .set(updateData)
            .where(eq(detectedPatterns.id, patternId))
            .returning();

          if (!updated) {
            return Response.json(
              { error: "Pattern not found" },
              { status: 404 }
            );
          }

          log.info("Pattern updated", {
            patternId,
            status: updated.status,
          });

          return Response.json({
            success: true,
            pattern: {
              id: updated.id,
              status: updated.status,
              resolvedAt: updated.resolvedAt?.toISOString() ?? null,
              dismissedAt: updated.dismissedAt?.toISOString() ?? null,
            },
          });
        } catch (err) {
          if (err instanceof AppError) {
            const status =
              err.code === "UNAUTHENTICATED"
                ? 401
                : err.code === "FORBIDDEN"
                  ? 403
                  : 400;
            return Response.json({ error: err.message }, { status });
          }
          log.error(
            "Failed to update pattern",
            err instanceof Error ? err : new Error(String(err))
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },

      /**
       * GET /api/patterns/{patternId}
       * Get pattern details.
       */
      GET: async ({
        request,
        params,
      }: {
        request: Request;
        params: { patternId: string };
      }) => {
        try {
          await requireApiAuth(request);

          const { patternId } = params;

          if (!patternId) {
            return Response.json(
              { error: "patternId is required" },
              { status: 400 }
            );
          }

          const [pattern] = await db
            .select()
            .from(detectedPatterns)
            .where(eq(detectedPatterns.id, patternId))
            .limit(1);

          if (!pattern) {
            return Response.json(
              { error: "Pattern not found" },
              { status: 404 }
            );
          }

          return Response.json({
            id: pattern.id,
            workspaceId: pattern.workspaceId,
            patternType: pattern.patternType,
            title: pattern.title,
            description: pattern.description,
            affectedClientIds: pattern.affectedClientIds,
            affectedCount: pattern.affectedCount,
            magnitude: pattern.magnitude,
            direction: pattern.direction,
            confidence: pattern.confidence,
            startDate: pattern.startDate?.toISOString() ?? null,
            endDate: pattern.endDate?.toISOString() ?? null,
            status: pattern.status,
            resolvedAt: pattern.resolvedAt?.toISOString() ?? null,
            dismissedAt: pattern.dismissedAt?.toISOString() ?? null,
            detectedAt: pattern.detectedAt?.toISOString() ?? null,
          });
        } catch (err) {
          if (err instanceof AppError) {
            const status =
              err.code === "UNAUTHENTICATED"
                ? 401
                : err.code === "FORBIDDEN"
                  ? 403
                  : 400;
            return Response.json({ error: err.message }, { status });
          }
          log.error(
            "Failed to fetch pattern",
            err instanceof Error ? err : new Error(String(err))
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
