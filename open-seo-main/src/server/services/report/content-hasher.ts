import { createHash } from "node:crypto";

/**
 * Input data used to compute report content hash.
 * Hash is based on data shape (counts, last date) not full content,
 * to enable cache hits when underlying data hasn't changed.
 */
export interface ReportInputData {
  clientId: string;
  dateRange: { start: string; end: string };
  gscDataCount: number;
  gscLastDate: string | null;
  ga4DataCount: number;
  queriesCount: number;
  locale: string;
}

/**
 * Compute a content hash for report caching.
 * Returns 16-char hex prefix of SHA256.
 *
 * The hash is deterministic for the same input data.
 * Used to detect when a report can be served from cache
 * vs. when it needs to be regenerated.
 *
 * @param data - Report input data to hash
 * @returns 16-character hex string
 */
export function computeReportHash(data: ReportInputData): string {
  const serialized = JSON.stringify({
    clientId: data.clientId,
    dateRange: data.dateRange,
    gscDataCount: data.gscDataCount,
    gscLastDate: data.gscLastDate,
    ga4DataCount: data.ga4DataCount,
    queriesCount: data.queriesCount,
    locale: data.locale,
  });
  return createHash("sha256").update(serialized).digest("hex").slice(0, 16);
}
