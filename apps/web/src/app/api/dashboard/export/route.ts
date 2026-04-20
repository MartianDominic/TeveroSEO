import { NextRequest, NextResponse } from "next/server";
import { getFastApi } from "@/lib/server-fetch";
import type { ClientMetrics, ExportColumn } from "@/lib/dashboard/types";
import { EXPORT_COLUMN_LABELS } from "@/lib/dashboard/types";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const columnsParam = searchParams.get("columns");
    const format = searchParams.get("format") || "csv";

    // Default columns if not specified
    const columns: ExportColumn[] = columnsParam
      ? (columnsParam.split(",") as ExportColumn[])
      : ["clientName", "healthScore", "trafficCurrent", "trafficTrendPct", "keywordsTotal", "alertsOpen"];

    // Fetch metrics (would include filters in production)
    const metrics = await getFastApi<ClientMetrics[]>("/api/dashboard/metrics");

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
      console.error("Export failed:", error);
    }
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
