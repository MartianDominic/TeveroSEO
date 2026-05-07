/**
 * Annotations API Route
 * Phase 96-03: GET/POST /api/analytics/annotations
 * Timeline annotations management
 */
import { createFileRoute } from "@tanstack/react-router";
import { AnnotationsRepository } from "@/server/features/analytics/repositories/AnnotationsRepository";
import { triggerAnnotationsImport } from "@/server/features/analytics/jobs/annotations-import.job";
import { z } from "zod";
import { db } from "@/db";

const getQuerySchema = z.object({
  siteId: z.string().uuid().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  types: z.string().optional(), // Comma-separated
  includeGlobal: z.coerce.boolean().optional(),
});

const postBodySchema = z.object({
  siteId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  impact: z.enum(['positive', 'negative', 'neutral']),
});

// Placeholder helpers
async function getWorkspaceIdFromRequest(_request: Request): Promise<string | null> {
  return 'workspace-placeholder';
}

async function getUserIdFromRequest(_request: Request): Promise<string> {
  return 'user-placeholder';
}

async function verifySiteOwnership(_siteId: string, _workspaceId: string): Promise<boolean> {
  return true;
}

// Route types regenerated on build - suppress until then
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/api/analytics/annotations")({
  loader: async ({ request }: any) => {
    const workspaceId = await getWorkspaceIdFromRequest(request);
    if (!workspaceId) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (request.method === 'GET') {
      const url = new URL(request.url);
      const params = Object.fromEntries(url.searchParams);

      const parsed = getQuerySchema.safeParse(params);
      if (!parsed.success) {
        return Response.json(
          { success: false, error: "Invalid parameters", details: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const repo = new AnnotationsRepository(db);
      const annotations = await repo.findByFilters(workspaceId, {
        siteId: parsed.data.siteId,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        types: parsed.data.types?.split(',').filter(Boolean) as any,
        includeGlobal: parsed.data.includeGlobal ?? true,
      });

      return Response.json({ success: true, data: annotations });
    }

    if (request.method === 'POST') {
      const body = await request.json();
      const parsed = postBodySchema.safeParse(body);
      if (!parsed.success) {
        return Response.json(
          { success: false, error: "Invalid body", details: parsed.error.flatten() },
          { status: 400 }
        );
      }

      // Verify site ownership
      const siteVerified = await verifySiteOwnership(parsed.data.siteId, workspaceId);
      if (!siteVerified) {
        return Response.json({ success: false, error: "Site not found" }, { status: 404 });
      }

      const userId = await getUserIdFromRequest(request);
      const repo = new AnnotationsRepository(db);
      const annotation = await repo.createCustom(workspaceId, parsed.data.siteId, {
        date: new Date(parsed.data.date),
        title: parsed.data.title,
        description: parsed.data.description,
        impact: parsed.data.impact,
        createdBy: userId,
      });

      return Response.json({ success: true, data: annotation }, { status: 201 });
    }

    return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
  },
});
