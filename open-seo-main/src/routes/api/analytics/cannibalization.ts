/**
 * Cannibalization API Route
 * Phase 96-03: GET /api/analytics/cannibalization
 * Exposes existing CannibalizationService in analytics dashboard
 */
import { createFileRoute } from "@tanstack/react-router";
import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { z } from "zod";

// Stub schema import (would reference real link-schema.ts)
const keywordCannibalization = {
  clientId: 'clientId',
  status: 'status',
  severity: 'severity',
} as any;

const querySchema = z.object({
  siteId: z.string().uuid(),
  status: z.enum(['detected', 'resolved', 'ignored', 'monitoring', 'all']).optional(),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'all']).optional(),
  limit: z.coerce.number().min(1).max(500).optional(),
});

// Placeholder helpers
async function getWorkspaceIdFromRequest(_request: Request): Promise<string | null> {
  return 'workspace-placeholder';
}

async function getClientIdFromSite(_siteId: string): Promise<string | null> {
  return 'client-placeholder';
}

// Route types regenerated on build - suppress until then
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/api/analytics/cannibalization")({
  loader: async ({ request }: any) => {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams);

    const parsed = querySchema.safeParse(params);
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Invalid parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const workspaceId = await getWorkspaceIdFromRequest(request);
    if (!workspaceId) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Get clientId from siteId (sites are linked to clients)
    const clientId = await getClientIdFromSite(parsed.data.siteId);
    if (!clientId) {
      return Response.json({ success: false, error: "Site not found" }, { status: 404 });
    }

    // Build query conditions
    const conditions = [eq(keywordCannibalization.clientId, clientId)];

    if (parsed.data.status && parsed.data.status !== 'all') {
      conditions.push(eq(keywordCannibalization.status, parsed.data.status));
    } else {
      // Default: show detected and monitoring
      conditions.push(inArray(keywordCannibalization.status, ['detected', 'monitoring']));
    }

    if (parsed.data.severity && parsed.data.severity !== 'all') {
      conditions.push(eq(keywordCannibalization.severity, parsed.data.severity));
    }

    // Query cannibalization issues
    const issues = await db
      .select()
      .from(keywordCannibalization)
      .where(and(...conditions))
      .orderBy(
        sql`CASE ${keywordCannibalization.severity}
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          ELSE 4
        END`
      )
      .limit(parsed.data.limit ?? 100);

    // Calculate summary stats
    const summary = {
      total: issues.length,
      critical: issues.filter((i: any) => i.severity === 'critical').length,
      high: issues.filter((i: any) => i.severity === 'high').length,
      medium: issues.filter((i: any) => i.severity === 'medium').length,
      low: issues.filter((i: any) => i.severity === 'low').length,
    };

    return Response.json({
      success: true,
      data: {
        issues,
        summary,
      },
    });
  },
});
