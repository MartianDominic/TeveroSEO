/**
 * Export utilities for audit results.
 * M-AUDIT-04: Added chunked export for large reports to prevent browser freezing.
 */
import type { AuditResultsData } from "@/client/features/audit/results/types";
import { buildCsv, downloadCsv } from "@/client/lib/csv";
import { toast } from "sonner";

/** M-AUDIT-04: Max rows before using chunked export */
const LARGE_EXPORT_THRESHOLD = 1000;

/** M-AUDIT-04: Chunk size for processing large exports */
const EXPORT_CHUNK_SIZE = 500;

function downloadFile(content: string, filename: string, mime: string) {
  try {
    const blob = new Blob([content], { type: `${mime};charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    // M-AUDIT-04: Handle export failures gracefully
    console.error("Export failed:", error);
    toast.error("Export failed", {
      description: "The report was too large to export. Try exporting fewer pages.",
    });
    throw error;
  }
}

/**
 * M-AUDIT-04: Process data in chunks to prevent browser freezing on large exports.
 * Uses setTimeout to yield to the main thread between chunks.
 */
async function processInChunks<T, R>(
  items: T[],
  processor: (item: T) => R,
  chunkSize: number = EXPORT_CHUNK_SIZE,
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const chunkResults = chunk.map(processor);
    results.push(...chunkResults);

    // Yield to main thread between chunks for large datasets
    if (items.length > LARGE_EXPORT_THRESHOLD && i + chunkSize < items.length) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  return results;
}

/**
 * M-AUDIT-04: Export pages with chunked processing for large reports.
 */
export async function exportPages(
  pages: AuditResultsData["pages"],
  format: "csv" | "json",
) {
  // Show progress toast for large exports
  if (pages.length > LARGE_EXPORT_THRESHOLD) {
    toast.info("Preparing export...", {
      description: `Processing ${pages.length} pages`,
      duration: 2000,
    });
  }

  const rows = await processInChunks(
    pages,
    (page: AuditResultsData["pages"][number]) => ({
      url: page.url,
      statusCode: page.statusCode,
      title: page.title ?? "",
      h1Count: page.h1Count,
      wordCount: page.wordCount,
      imagesTotal: page.imagesTotal,
      imagesMissingAlt: page.imagesMissingAlt,
      responseTimeMs: page.responseTimeMs,
    }),
  );

  if (format === "json") {
    downloadFile(
      JSON.stringify(rows, null, 2),
      "audit-pages.json",
      "application/json",
    );
    return;
  }

  const headers = [
    "URL",
    "Status",
    "Title",
    "H1",
    "Words",
    "Images",
    "Missing Alt",
    "Response Time (ms)",
  ];
  const lines = rows.map((row: (typeof rows)[number]) => [
    row.url,
    row.statusCode,
    row.title,
    row.h1Count,
    row.wordCount,
    row.imagesTotal,
    row.imagesMissingAlt,
    row.responseTimeMs,
  ]);

  downloadCsv("audit-pages.csv", buildCsv(headers, lines));
}

/**
 * M-AUDIT-04: Export performance data with chunked processing for large reports.
 */
export async function exportPerformance(
  lighthouse: AuditResultsData["lighthouse"],
  pages: AuditResultsData["pages"],
  format: "csv" | "json",
) {
  // Show progress toast for large exports
  if (lighthouse.length > LARGE_EXPORT_THRESHOLD) {
    toast.info("Preparing export...", {
      description: `Processing ${lighthouse.length} lighthouse results`,
      duration: 2000,
    });
  }

  // Build page lookup map for efficiency
  const pageMap = new Map(pages.map((p) => [p.id, p]));

  const rows = await processInChunks(
    lighthouse,
    (result: AuditResultsData["lighthouse"][number]) => {
      const page = pageMap.get(result.pageId);
      return {
        url: page?.url ?? "",
        strategy: result.strategy,
        performance: result.performanceScore,
        accessibility: result.accessibilityScore,
        seo: result.seoScore,
        lcpMs: result.lcpMs,
        cls: result.cls,
        inpMs: result.inpMs,
        ttfbMs: result.ttfbMs,
      };
    },
  );

  if (format === "json") {
    downloadFile(
      JSON.stringify(rows, null, 2),
      "audit-performance.json",
      "application/json",
    );
    return;
  }

  const headers = [
    "URL",
    "Device",
    "Performance",
    "Accessibility",
    "SEO",
    "LCP (ms)",
    "CLS",
    "INP (ms)",
    "TTFB (ms)",
  ];
  const lines = rows.map((row: (typeof rows)[number]) => [
    row.url,
    row.strategy,
    row.performance,
    row.accessibility,
    row.seo,
    row.lcpMs,
    row.cls,
    row.inpMs,
    row.ttfbMs,
  ]);

  downloadCsv("audit-performance.csv", buildCsv(headers, lines));
}
