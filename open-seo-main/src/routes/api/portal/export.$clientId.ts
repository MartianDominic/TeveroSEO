/**
 * Portal Export API Route
 * Phase 96-05: Client Portal Analytics Export
 *
 * POST /api/portal/export/:clientId - Export analytics data for portal clients
 *
 * Provides CSV export (PDF returns 501 Not Implemented) for portal users.
 * Supports exporting:
 * - Trends (growing/decaying pages)
 * - Cannibalization issues
 * - Striking distance opportunities
 * - Topic clusters
 *
 * All exports are filtered through ClientVisibilityService.
 * Rate limited: 5 exports per hour per client.
 */
import { createFileRoute } from "@tanstack/react-router";
import {
  validatePortalAuth,
  verifyClientIdMatch,
  requirePortalPermission,
  portalAuthErrorResponse,
} from "@/server/middleware/portal-auth";
import {
  portalExportRateLimiter,
  rateLimitExceededResponse,
  addRateLimitHeaders,
} from "@/server/middleware/rate-limit";
import { getClientVisibilityService } from "@/server/features/analytics/services/ClientVisibilityService";
import { getAnalyticsExportService } from "@/server/features/analytics/services/AnalyticsExportService";
import { analyzePageTrends } from "@/server/features/analytics/services/TrendDetectionService";
import { getCannibalizationService } from "@/server/features/analytics";
import { getStrikingDistancePages } from "@/server/features/analytics/services/StrikingDistanceService";
import { TopicClusterService } from "@/server/features/analytics/services/TopicClusterService";
import type { TrendAnalysis } from "@/server/features/analytics/types";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";
import { z } from "zod";

const log = createLogger({ module: "portal/export" });

/**
 * Request body schema for export endpoint.
 */
const exportRequestSchema = z.object({
  format: z.enum(["csv", "pdf"]),
  sections: z
    .array(z.enum(["trends", "cannibalization", "striking_distance", "topic_clusters"]))
    .min(1, "At least one section is required"),
  date_range: z
    .object({
      start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be YYYY-MM-DD"),
      end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be YYYY-MM-DD"),
    })
    .optional(),
});

type ExportRequest = z.infer<typeof exportRequestSchema>;

/**
 * Get site ID for a client.
 */
async function getClientSiteId(clientId: string): Promise<string | null> {
  const result = await db.execute(sql`
    SELECT id FROM site_connections
    WHERE client_id = ${clientId}
    ORDER BY created_at ASC
    LIMIT 1
  `);

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0].id as string;
}

/**
 * Get client name for export metadata.
 */
async function getClientName(clientId: string): Promise<string> {
  const result = await db.execute(sql`
    SELECT name FROM clients
    WHERE id = ${clientId}
    LIMIT 1
  `);

  if (result.rows.length === 0) {
    return "Unknown Client";
  }

  return result.rows[0].name as string;
}

/**
 * Sanitize filename by removing special characters.
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9-_\s]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 50);
}

/**
 * Validate date range is within 90 days.
 */
function validateDateRange(dateRange?: { start: string; end: string }): {
  valid: boolean;
  error?: string;
  start: Date;
  end: Date;
} {
  const now = new Date();
  const defaultEnd = now;
  const defaultStart = new Date(now);
  defaultStart.setDate(defaultStart.getDate() - 30);

  if (!dateRange) {
    return {
      valid: true,
      start: defaultStart,
      end: defaultEnd,
    };
  }

  const start = new Date(dateRange.start);
  const end = new Date(dateRange.end);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return {
      valid: false,
      error: "Invalid date format",
      start: defaultStart,
      end: defaultEnd,
    };
  }

  if (start > end) {
    return {
      valid: false,
      error: "Start date must be before end date",
      start: defaultStart,
      end: defaultEnd,
    };
  }

  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff > 90) {
    return {
      valid: false,
      error: "Date range cannot exceed 90 days",
      start: defaultStart,
      end: defaultEnd,
    };
  }

  return {
    valid: true,
    start,
    end,
  };
}

/**
 * Generate CSV content for multiple sections.
 */
function generateMultiSectionCsv(
  sections: {
    name: string;
    headers: string[];
    rows: string[][];
  }[],
  metadata: {
    clientName: string;
    generatedAt: string;
    dateRange: { start: string; end: string };
  }
): string {
  const exportService = getAnalyticsExportService();
  const lines: string[] = [];

  // Add metadata header
  lines.push("# TeveroSEO Analytics Export");
  lines.push(`# Client: ${exportService.escapeCsvField(metadata.clientName).replace(/^"|"$/g, "")}`);
  lines.push(`# Generated: ${metadata.generatedAt}`);
  lines.push(`# Date Range: ${metadata.dateRange.start} to ${metadata.dateRange.end}`);
  lines.push("");

  // Add each section
  for (const section of sections) {
    lines.push(`## ${section.name}`);
    lines.push(section.headers.join(","));
    for (const row of section.rows) {
      lines.push(row.map((cell) => exportService.escapeCsvField(cell)).join(","));
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Log export audit trail.
 */
function logExportAudit(
  clientId: string,
  workspaceId: string,
  format: string,
  sections: string[],
  success: boolean,
  error?: string
): void {
  log.info("Portal export audit", {
    clientId,
    workspaceId,
    format,
    sections,
    success,
    error,
    timestamp: new Date().toISOString(),
  });
}

// Route types regenerated on build - suppress until then
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/api/portal/export/$clientId")({
  server: {
    handlers: {
      POST: async ({
        params,
        request,
      }: {
        params: { clientId: string };
        request: Request;
      }) => {
        const { clientId } = params;

        try {
          // Step 1: Validate portal authentication
          const authResult = await validatePortalAuth(request);
          if (!authResult.success) {
            return portalAuthErrorResponse(authResult);
          }

          // Step 2: Verify clientId matches token
          const clientVerification = verifyClientIdMatch(authResult, clientId);
          if (!clientVerification.success) {
            return portalAuthErrorResponse(clientVerification);
          }

          // Step 3: Check rate limit (5 exports per hour per clientId)
          const rateLimitResult = await portalExportRateLimiter(clientId);

          if (!rateLimitResult.allowed) {
            log.warn("Portal export rate limit exceeded", {
              clientId,
              current: rateLimitResult.current,
              limit: rateLimitResult.limit,
              retryAfter: rateLimitResult.retryAfter,
            });
            return rateLimitExceededResponse(rateLimitResult);
          }

          // Step 4: Check export permission (requires full_login)
          const permissionCheck = requirePortalPermission(
            authResult,
            "canExport",
            "export"
          );
          if (!permissionCheck.success) {
            return portalAuthErrorResponse(permissionCheck);
          }

          // Step 5: Parse and validate request body
          let body: unknown;
          try {
            body = await request.json();
          } catch {
            return Response.json(
              { success: false, error: "Invalid JSON body" },
              { status: 400 }
            );
          }

          const parsed = exportRequestSchema.safeParse(body);
          if (!parsed.success) {
            return Response.json(
              {
                success: false,
                error: "Invalid parameters",
                details: parsed.error.flatten(),
              },
              { status: 400 }
            );
          }

          const exportRequest: ExportRequest = parsed.data;

          // Step 6: Check format support
          if (exportRequest.format === "pdf") {
            logExportAudit(
              clientId,
              authResult.data.workspaceId,
              "pdf",
              exportRequest.sections,
              false,
              "PDF export not implemented"
            );
            return Response.json(
              {
                success: false,
                error: "PDF export is not yet implemented",
                code: "NOT_IMPLEMENTED",
              },
              { status: 501 }
            );
          }

          // Step 7: Validate date range
          const dateValidation = validateDateRange(exportRequest.date_range);
          if (!dateValidation.valid) {
            return Response.json(
              { success: false, error: dateValidation.error },
              { status: 400 }
            );
          }

          // Step 8: Get site ID for analytics queries
          const siteId = await getClientSiteId(clientId);
          if (!siteId) {
            return Response.json(
              {
                success: false,
                error: "No site connection found for this client",
              },
              { status: 404 }
            );
          }

          // Step 9: Get visibility configuration
          const visibilityService = await getClientVisibilityService();
          const visibility = await visibilityService.getVisibilityConfig(
            clientId,
            authResult.data.workspaceId
          );

          // Step 10: Check canExport permission from visibility config
          if (!visibility.canExport) {
            logExportAudit(
              clientId,
              authResult.data.workspaceId,
              exportRequest.format,
              exportRequest.sections,
              false,
              "Export disabled in visibility settings"
            );
            return Response.json(
              {
                success: false,
                error: "Export is disabled for this client",
                code: "EXPORT_DISABLED",
              },
              { status: 403 }
            );
          }

          // Step 11: Get client name for metadata
          const clientName = await getClientName(clientId);

          // Step 12: Collect data for each requested section
          const sections: {
            name: string;
            headers: string[];
            rows: string[][];
          }[] = [];

          const periodDays = Math.ceil(
            (dateValidation.end.getTime() - dateValidation.start.getTime()) /
              (1000 * 60 * 60 * 24)
          );

          for (const section of exportRequest.sections) {
            switch (section) {
              case "trends": {
                // Check visibility for trends
                if (!visibility.canViewGrowing && !visibility.canViewDecaying) {
                  continue; // Skip section if both are hidden
                }

                const trendResult = await analyzePageTrends(siteId, {
                  periodDays,
                });

                // Filter by visibility
                const filteredPages = trendResult.pages.filter((page: TrendAnalysis) => {
                  if (page.trend === "growing" && !visibility.canViewGrowing) {
                    return false;
                  }
                  if (page.trend === "decaying" && !visibility.canViewDecaying) {
                    return false;
                  }
                  return true;
                });

                const headers = ["page_url", "current_clicks", "previous_clicks", "change_percent", "trend"];
                const rows = filteredPages.map((page: TrendAnalysis) => [
                  page.pageUrl,
                  String(page.currentClicks),
                  String(page.previousClicks),
                  `${page.changePercent >= 0 ? "+" : ""}${page.changePercent.toFixed(1)}%`,
                  page.trend,
                ]);

                sections.push({ name: "Trends", headers, rows });
                break;
              }

              case "cannibalization": {
                // Check visibility for cannibalization
                if (!visibility.canViewCannibalization) {
                  continue; // Skip section if hidden
                }

                const cannibService = getCannibalizationService();
                const issues = await cannibService.detectCannibalization(siteId, {
                  limit: 100,
                });

                const headers = ["keyword", "competing_pages", "severity", "primary_page", "secondary_pages"];
                const rows = issues.map((issue) => [
                  issue.keyword,
                  String(issue.pages.length),
                  issue.severity,
                  issue.pages[0]?.pageUrl || "",
                  issue.pages
                    .slice(1)
                    .map((p) => p.pageUrl)
                    .join("; "),
                ]);

                sections.push({ name: "Cannibalization Issues", headers, rows });
                break;
              }

              case "striking_distance": {
                const strikingResult = await getStrikingDistancePages(siteId, {
                  minPosition: 11,
                  maxPosition: 20,
                  limit: 100,
                });

                const headers = [
                  "page_url",
                  "avg_position",
                  "impressions",
                  "current_clicks",
                  "potential_clicks",
                  "difficulty",
                ];
                const rows = strikingResult.pages.map((page) => [
                  page.pageUrl,
                  page.avgPosition.toFixed(1),
                  String(page.impressions),
                  String(page.currentClicks),
                  String(page.potentialClicks),
                  page.difficulty,
                ]);

                sections.push({ name: "Striking Distance Keywords", headers, rows });
                break;
              }

              case "topic_clusters": {
                const clusterService = new TopicClusterService();
                const clusters = await clusterService.getClusters(siteId);

                const headers = [
                  "cluster_name",
                  "hub_page",
                  "spoke_count",
                  "coverage",
                  "total_clicks",
                  "total_impressions",
                ];
                const rows = clusters.map((cluster) => [
                  cluster.name,
                  cluster.hubPage.url,
                  String(cluster.spokePages.length),
                  `${cluster.coverage.toFixed(1)}%`,
                  String(cluster.totalClicks),
                  String(cluster.totalImpressions),
                ]);

                sections.push({ name: "Topic Clusters", headers, rows });
                break;
              }
            }
          }

          // Step 13: Check if any sections were generated
          if (sections.length === 0) {
            logExportAudit(
              clientId,
              authResult.data.workspaceId,
              exportRequest.format,
              exportRequest.sections,
              false,
              "No data available for requested sections due to visibility restrictions"
            );
            return Response.json(
              {
                success: false,
                error: "No data available for the requested sections due to visibility restrictions",
              },
              { status: 403 }
            );
          }

          // Step 14: Generate CSV content
          const csv = generateMultiSectionCsv(sections, {
            clientName,
            generatedAt: new Date().toISOString(),
            dateRange: {
              start: dateValidation.start.toISOString().split("T")[0],
              end: dateValidation.end.toISOString().split("T")[0],
            },
          });

          // Step 15: Log successful export
          logExportAudit(
            clientId,
            authResult.data.workspaceId,
            exportRequest.format,
            exportRequest.sections,
            true
          );

          log.info("Portal export generated successfully", {
            clientId,
            format: exportRequest.format,
            sections: exportRequest.sections,
            rowCount: sections.reduce((sum, s) => sum + s.rows.length, 0),
          });

          // Step 16: Build response with proper headers
          const safeClientName = sanitizeFilename(clientName);
          const dateStr = new Date().toISOString().split("T")[0];
          const filename = `analytics-export-${safeClientName}-${dateStr}.csv`;

          const response = new Response(csv, {
            status: 200,
            headers: {
              "Content-Type": "text/csv; charset=utf-8",
              "Content-Disposition": `attachment; filename="${filename}"`,
              "Cache-Control": "no-store, no-cache, must-revalidate",
            },
          });

          return addRateLimitHeaders(response, rateLimitResult);
        } catch (error) {
          log.error(
            "Portal export API error",
            error instanceof Error ? error : undefined,
            { clientId }
          );

          logExportAudit(
            clientId,
            "unknown",
            "unknown",
            [],
            false,
            error instanceof Error ? error.message : "Unknown error"
          );

          return Response.json(
            { success: false, error: "Failed to generate export" },
            { status: 500 }
          );
        }
      },
    },
  },
});
