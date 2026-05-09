import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import type { ClientMetrics, ExportColumn } from "@/lib/dashboard/types";
import { EXPORT_COLUMN_LABELS } from "@/lib/dashboard/types";
import { logger } from '@/lib/logger';
import { exportLimiter, rateLimitHeaders } from "@/lib/rate-limit";
import { getFastApi } from "@/lib/server-fetch";
/**
 * Valid export columns - derived from ExportColumn type.
 * Used for runtime validation of query string parameters.
 */
const validColumns = [
  "clientName",
  "healthScore",
  "trafficCurrent",
  "trafficTrendPct",
  "keywordsTotal",
  "keywordsTop10",
  "keywordsTop3",
  "keywordsPosition1",
  "alertsOpen",
  "connectionStatus",
  "lastReportAt",
  "lastAuditAt",
] as const;

const columnsSchema = z.array(z.enum(validColumns));
const formatSchema = z.enum(["csv", "json"]).default("csv");

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 10 exports per minute (prevents DoS)
  const rateLimitResult = await exportLimiter.limit(userId);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      { status: 429, headers: rateLimitHeaders(rateLimitResult) }
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const columnsParam = searchParams.get("columns");
    const formatParam = searchParams.get("format");

    // Validate format parameter
    const formatResult = formatSchema.safeParse(formatParam ?? "csv");
    if (!formatResult.success) {
      return NextResponse.json(
        { error: "Invalid format. Must be 'csv' or 'json'" },
        { status: 400 }
      );
    }
    const format = formatResult.data;

    // Validate and parse columns parameter
    let columns: ExportColumn[];
    if (columnsParam) {
      const columnsList = columnsParam.split(",").map(c => c.trim());
      const columnsResult = columnsSchema.safeParse(columnsList);
      if (!columnsResult.success) {
        return NextResponse.json(
          { error: "Invalid columns. Valid values: " + validColumns.join(", ") },
          { status: 400 }
        );
      }
      columns = columnsResult.data as ExportColumn[];
    } else {
      // Default columns if not specified
      columns = ["clientName", "healthScore", "trafficCurrent", "trafficTrendPct", "keywordsTotal", "alertsOpen"];
    }

    // HIGH-AUTH-05 FIX: Pass userId to backend for user-scoped filtering
    // The backend MUST filter results to only include clients owned by this user
    const metrics = await getFastApi<ClientMetrics[]>(`/api/dashboard/metrics?user_id=${encodeURIComponent(userId)}`);

    // Return JSON for client-side export (PDF uses this)
    if (format === "json") {
      return NextResponse.json(metrics);
    }

    // Build CSV
    const headers = columns.map(col => EXPORT_COLUMN_LABELS[col]);
    const rows = metrics.map(client => {
      return columns.map(col => {
        switch (col) {
          case "clientName": return client.clientName;
          case "healthScore": return String(client.healthScore);
          case "trafficCurrent": return String(client.trafficCurrent);
          case "trafficTrendPct": return `${(client.trafficTrendPct * 100).toFixed(1)}%`;
          case "keywordsTotal": return String(client.keywordsTotal);
          case "keywordsTop10": return String(client.keywordsTop10);
          case "keywordsTop3": return String(client.keywordsTop3);
          case "keywordsPosition1": return String(client.keywordsPosition1);
          case "alertsOpen": return String(client.alertsOpen);
          case "connectionStatus": return client.connectionStatus;
          case "lastReportAt": return client.lastReportAt ?? "Never";
          case "lastAuditAt": return client.lastAuditAt ?? "Never";
          default: return "";
        }
      });
    });

    // Escape CSV values
    const escapeCSV = (val: string) => {
      if (val.includes(",") || val.includes('"') || val.includes("\n")) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const csvContent = [
      headers.map(escapeCSV).join(","),
      ...rows.map(row => row.map(escapeCSV).join(",")),
    ].join("\n");

    const filename = `clients-export-${new Date().toISOString().split("T")[0]}.csv`;

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    // Log error in development only
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      logger.error("Export failed", error instanceof Error ? error : { error: String(error) });
    }
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
