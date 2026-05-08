/**
 * Analytics Export API Route
 * Phase 96-05: POST /api/analytics/export/csv, /api/analytics/export/sheets
 *
 * Generates CSV downloads and Google Sheets from analytics data.
 * Rate limited: 10 exports per hour per workspace (96-security).
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "@/db";
import { getAnalyticsExportService } from "@/server/features/analytics/services/AnalyticsExportService";
import { getClientVisibilityService } from "@/server/features/analytics/services/ClientVisibilityService";
import { seoGscQueryAnalytics } from "@/db/gsc-analytics-schema";
import { clients } from "@/db/client-schema";
import { siteConnections } from "@/db/connection-schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import {
  analyticsExportRateLimiter,
  rateLimitExceededResponse,
  addRateLimitHeaders,
} from "@/server/middleware";

const exportSchema = z.object({
  clientId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(["queries", "pages", "summary"]),
});

const sheetsSchema = exportSchema.extend({
  title: z.string().optional(),
});

// Standard export columns
const QUERY_COLUMNS = [
  { key: "query", header: "Query" },
  { key: "clicks", header: "Clicks", format: "number" as const },
  { key: "impressions", header: "Impressions", format: "number" as const },
  { key: "ctr", header: "CTR", format: "percent" as const },
  { key: "position", header: "Avg Position", format: "number" as const },
];

const PAGE_COLUMNS = [
  { key: "pageUrl", header: "Page URL" },
  { key: "clicks", header: "Clicks", format: "number" as const },
  { key: "impressions", header: "Impressions", format: "number" as const },
  { key: "ctr", header: "CTR", format: "percent" as const },
  { key: "position", header: "Avg Position", format: "number" as const },
];

// CSV Export
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const CsvRoute = (createFileRoute as any)("/api/analytics/export/csv")({
  loader: async ({ request }: any) => {
    // POST only
    if (request.method !== "POST") {
      return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
    }

    try {
      const workspaceId = request.headers.get("X-Workspace-ID");

      if (!workspaceId) {
        return Response.json(
          { success: false, error: "Workspace ID required" },
          { status: 401 }
        );
      }

      // Rate limit check: 10 exports per hour per workspace
      const rateLimitResult = await analyticsExportRateLimiter(workspaceId);
      if (!rateLimitResult.allowed) {
        return rateLimitExceededResponse(rateLimitResult);
      }

      const body = await request.json();
      const parsed = exportSchema.safeParse(body);

      if (!parsed.success) {
        return Response.json(
          { success: false, error: "Invalid parameters", details: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const { clientId, startDate, endDate, type } = parsed.data;

      // Validate workspace access and export permission
      const visibilityService = await getClientVisibilityService();
      const hasAccess = await visibilityService.validateWorkspaceAccess(clientId, workspaceId);
      if (!hasAccess) {
        return Response.json(
          { success: false, error: "ACCESS_DENIED" },
          { status: 403 }
        );
      }

      const visibilityConfig = await visibilityService.getVisibilityConfig(clientId, workspaceId);
      if (!visibilityConfig.canExport) {
        return Response.json(
          { success: false, error: "EXPORT_NOT_ALLOWED", message: "Export permission not granted" },
          { status: 403 }
        );
      }

      // Get client name
      const clientData = await db
        .select({ name: clients.name })
        .from(clients)
        .where(eq(clients.id, clientId))
        .limit(1);

      // Get client's site connection
      const connection = await db
        .select({ siteId: siteConnections.id })
        .from(siteConnections)
        .where(eq(siteConnections.clientId, clientId))
        .limit(1);

      if (!connection[0]?.siteId) {
        return Response.json(
          { success: false, error: "Client has no connected GSC site" },
          { status: 400 }
        );
      }

      // Fetch data based on type
      let data: Record<string, unknown>[];
      let columns;

      if (type === "queries") {
        columns = QUERY_COLUMNS;
        const results = await db
          .select({
            query: seoGscQueryAnalytics.query,
            clicks: sql<number>`SUM(${seoGscQueryAnalytics.clicks})`,
            impressions: sql<number>`SUM(${seoGscQueryAnalytics.impressions})`,
            position: sql<number>`AVG(${seoGscQueryAnalytics.position})`,
          })
          .from(seoGscQueryAnalytics)
          .where(
            and(
              eq(seoGscQueryAnalytics.siteId, connection[0].siteId),
              gte(seoGscQueryAnalytics.queryTime, new Date(startDate)),
              lte(seoGscQueryAnalytics.queryTime, new Date(endDate))
            )
          )
          .groupBy(seoGscQueryAnalytics.query)
          .orderBy(sql`SUM(${seoGscQueryAnalytics.clicks}) DESC`);

        data = results.map((r) => ({
          query: r.query,
          clicks: Number(r.clicks),
          impressions: Number(r.impressions),
          ctr: Number(r.impressions) > 0 ? Number(r.clicks) / Number(r.impressions) : 0,
          position: Number(r.position),
        }));
      } else if (type === "pages") {
        columns = PAGE_COLUMNS;
        const results = await db
          .select({
            pageUrl: seoGscQueryAnalytics.pageUrl,
            clicks: sql<number>`SUM(${seoGscQueryAnalytics.clicks})`,
            impressions: sql<number>`SUM(${seoGscQueryAnalytics.impressions})`,
            position: sql<number>`AVG(${seoGscQueryAnalytics.position})`,
          })
          .from(seoGscQueryAnalytics)
          .where(
            and(
              eq(seoGscQueryAnalytics.siteId, connection[0].siteId),
              gte(seoGscQueryAnalytics.queryTime, new Date(startDate)),
              lte(seoGscQueryAnalytics.queryTime, new Date(endDate))
            )
          )
          .groupBy(seoGscQueryAnalytics.pageUrl)
          .orderBy(sql`SUM(${seoGscQueryAnalytics.clicks}) DESC`);

        data = results.map((r) => ({
          pageUrl: r.pageUrl,
          clicks: Number(r.clicks),
          impressions: Number(r.impressions),
          ctr: Number(r.impressions) > 0 ? Number(r.clicks) / Number(r.impressions) : 0,
          position: Number(r.position),
        }));
      } else {
        return Response.json(
          { success: false, error: "Summary export not yet implemented" },
          { status: 400 }
        );
      }

      // Generate CSV
      const exportService = getAnalyticsExportService();
      const csv = exportService.exportToCsv(data, columns, { visibilityConfig });

      // Return as downloadable file with rate limit headers
      const filename = `${clientData[0].name.replace(/\s+/g, "-")}-${type}-${startDate}-to-${endDate}.csv`;

      const response = new Response(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });

      return addRateLimitHeaders(response, rateLimitResult);
    } catch (error) {
      console.error("[export/csv] POST error:", error);
      return Response.json(
        { success: false, error: error instanceof Error ? error.message : "Internal server error" },
        { status: 500 }
      );
    }
  },
});

// Google Sheets Export
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SheetsRoute = (createFileRoute as any)("/api/analytics/export/sheets")({
  loader: async ({ request }: any) => {
    // POST only
    if (request.method !== "POST") {
      return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
    }

    try {
      const workspaceId = request.headers.get("X-Workspace-ID");
      const oauthToken = request.headers.get("X-Google-OAuth-Token");

      if (!workspaceId) {
        return Response.json(
          { success: false, error: "Workspace ID required" },
          { status: 401 }
        );
      }

      // Rate limit check: 10 exports per hour per workspace
      const rateLimitResult = await analyticsExportRateLimiter(workspaceId);
      if (!rateLimitResult.allowed) {
        return rateLimitExceededResponse(rateLimitResult);
      }

      if (!oauthToken) {
        return Response.json(
          { success: false, error: "Google OAuth token required", code: "OAUTH_REQUIRED" },
          { status: 401 }
        );
      }

      const body = await request.json();
      const parsed = sheetsSchema.safeParse(body);

      if (!parsed.success) {
        return Response.json(
          { success: false, error: "Invalid parameters", details: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const { clientId, startDate, endDate, type, title } = parsed.data;

      // Validate workspace access and export permission
      const visibilityService = await getClientVisibilityService();
      const hasAccess = await visibilityService.validateWorkspaceAccess(clientId, workspaceId);
      if (!hasAccess) {
        return Response.json(
          { success: false, error: "ACCESS_DENIED" },
          { status: 403 }
        );
      }

      const visibilityConfig = await visibilityService.getVisibilityConfig(clientId, workspaceId);
      if (!visibilityConfig.canExport) {
        return Response.json(
          { success: false, error: "EXPORT_NOT_ALLOWED", message: "Export permission not granted" },
          { status: 403 }
        );
      }

      // Get client name
      const clientData = await db
        .select({ name: clients.name })
        .from(clients)
        .where(eq(clients.id, clientId))
        .limit(1);

      // Get client's site connection
      const connection2 = await db
        .select({ siteId: siteConnections.id })
        .from(siteConnections)
        .where(eq(siteConnections.clientId, clientId))
        .limit(1);

      if (!connection2[0]?.siteId) {
        return Response.json(
          { success: false, error: "Client has no connected GSC site" },
          { status: 400 }
        );
      }

      // Fetch data (same logic as CSV)
      let data: Record<string, unknown>[];
      let columns;

      if (type === "queries") {
        columns = QUERY_COLUMNS;
        const results = await db
          .select({
            query: seoGscQueryAnalytics.query,
            clicks: sql<number>`SUM(${seoGscQueryAnalytics.clicks})`,
            impressions: sql<number>`SUM(${seoGscQueryAnalytics.impressions})`,
            position: sql<number>`AVG(${seoGscQueryAnalytics.position})`,
          })
          .from(seoGscQueryAnalytics)
          .where(
            and(
              eq(seoGscQueryAnalytics.siteId, connection2[0].siteId),
              gte(seoGscQueryAnalytics.queryTime, new Date(startDate)),
              lte(seoGscQueryAnalytics.queryTime, new Date(endDate))
            )
          )
          .groupBy(seoGscQueryAnalytics.query)
          .orderBy(sql`SUM(${seoGscQueryAnalytics.clicks}) DESC`);

        data = results.map((r) => ({
          query: r.query,
          clicks: Number(r.clicks),
          impressions: Number(r.impressions),
          ctr: Number(r.impressions) > 0 ? Number(r.clicks) / Number(r.impressions) : 0,
          position: Number(r.position),
        }));
      } else if (type === "pages") {
        columns = PAGE_COLUMNS;
        const results = await db
          .select({
            pageUrl: seoGscQueryAnalytics.pageUrl,
            clicks: sql<number>`SUM(${seoGscQueryAnalytics.clicks})`,
            impressions: sql<number>`SUM(${seoGscQueryAnalytics.impressions})`,
            position: sql<number>`AVG(${seoGscQueryAnalytics.position})`,
          })
          .from(seoGscQueryAnalytics)
          .where(
            and(
              eq(seoGscQueryAnalytics.siteId, connection2[0].siteId),
              gte(seoGscQueryAnalytics.queryTime, new Date(startDate)),
              lte(seoGscQueryAnalytics.queryTime, new Date(endDate))
            )
          )
          .groupBy(seoGscQueryAnalytics.pageUrl)
          .orderBy(sql`SUM(${seoGscQueryAnalytics.clicks}) DESC`);

        data = results.map((r) => ({
          pageUrl: r.pageUrl,
          clicks: Number(r.clicks),
          impressions: Number(r.impressions),
          ctr: Number(r.impressions) > 0 ? Number(r.clicks) / Number(r.impressions) : 0,
          position: Number(r.position),
        }));
      } else {
        return Response.json(
          { success: false, error: "Summary export not yet implemented" },
          { status: 400 }
        );
      }

      // Create Google Sheet
      const exportService = getAnalyticsExportService();
      const sheetTitle = title || `${clientData[0].name} - ${type} - ${startDate} to ${endDate}`;

      const result = await exportService.exportToGoogleSheets(
        data,
        columns,
        sheetTitle,
        oauthToken,
        { visibilityConfig }
      );

      const response = Response.json({
        success: true,
        data: result,
      });

      return addRateLimitHeaders(response, rateLimitResult);
    } catch (error) {
      console.error("[export/sheets] POST error:", error);
      return Response.json(
        { success: false, error: error instanceof Error ? error.message : "Internal server error" },
        { status: 500 }
      );
    }
  },
});
