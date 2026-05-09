/**
 * ColumnDetector
 *
 * Smart CSV column detection supporting Ahrefs, SEMrush, Moz, and generic formats.
 * Auto-detects column mappings and determines if API enrichment is needed.
 */

export type DetectedFormat =
  | "ahrefs"
  | "semrush"
  | "moz"
  | "generic"
  | "keywords_only";

export interface ColumnMapping {
  sourceColumn: string;
  targetField:
    | "keyword"
    | "volume"
    | "difficulty"
    | "cpc"
    | "position"
    | "url"
    | "ignore";
  confidence: number;
  sampleValue: string;
}

export interface CsvColumnDetection {
  detectedFormat: DetectedFormat;
  hasMetrics: {
    volume: boolean;
    difficulty: boolean;
    cpc: boolean;
    position: boolean;
  };
  mappings: ColumnMapping[];
  enrichmentNeeded: boolean;
  estimatedCost: number;
}

/**
 * Column name patterns for each target field.
 * Includes English, Lithuanian, and common tool-specific variations.
 */
const COLUMN_PATTERNS: Record<string, string[]> = {
  keyword: [
    "keyword",
    "keywords",
    "search term",
    "query",
    "term",
    "phrase",
    "raktazodis",
    "raktazodziai", // Lithuanian
  ],
  volume: [
    "volume",
    "search volume",
    "sv",
    "searches",
    "monthly volume",
    "avg. monthly searches",
    "paieskos",
    "menesiniai", // Lithuanian
  ],
  difficulty: [
    "kd",
    "keyword difficulty",
    "difficulty",
    "seo difficulty",
    "competition",
    "kd %",
    "keyword difficulty %",
    "sunkumas", // Lithuanian
  ],
  cpc: [
    "cpc",
    "cost per click",
    "ppc",
    "avg. cpc",
    "cpc (usd)",
    "cpc (eur)",
    "kaina", // Lithuanian
  ],
  position: [
    "position",
    "rank",
    "ranking",
    "current position",
    "serp position",
    "pozicija",
    "vieta", // Lithuanian
  ],
  url: [
    "url",
    "page",
    "landing page",
    "target url",
    "ranked url",
    "puslapis",
    "nuoroda", // Lithuanian
  ],
};

/**
 * Format-specific column signatures.
 * When these columns appear together, we can identify the source tool.
 * Note: More specific signatures should come first to ensure correct detection.
 */
const FORMAT_SIGNATURES: Array<{format: Exclude<DetectedFormat, "generic" | "keywords_only">, signatures: string[][]}> = [
  // SEMrush has very specific column names - check first
  {
    format: "semrush",
    signatures: [
      ["keyword", "search volume", "keyword difficulty"],
      ["keyword", "volume", "kd %"],
    ],
  },
  // Moz has "monthly volume" which is distinctive
  {
    format: "moz",
    signatures: [
      ["keyword", "monthly volume", "difficulty"],
      ["keyword suggestions", "monthly volume"],
    ],
  },
  // Ahrefs is more generic - check last
  {
    format: "ahrefs",
    signatures: [
      ["keyword", "difficulty", "volume", "cpc"],
      ["keyword", "kd", "volume"],
    ],
  },
];

import { getKeywordMetricsCostCents } from "@/server/features/scraping/cost";

/**
 * Cost per keyword for enrichment (in cents).
 * From canonical DFS pricing: $0.0005 per keyword = 0.05 cents
 */
const COST_PER_KEYWORD_CENTS = getKeywordMetricsCostCents();

export class ColumnDetector {
  /**
   * Detect the CSV format and generate column mappings.
   */
  detectFormat(headers: string[], sampleRow: string[]): CsvColumnDetection {
    const normalizedHeaders = headers.map((h) => h.toLowerCase().trim());

    // Generate mappings first
    const mappings: ColumnMapping[] = headers.map((header, idx) => {
      const normalized = header.toLowerCase().trim();
      let targetField: ColumnMapping["targetField"] = "ignore";
      let confidence = 0;

      for (const [field, patterns] of Object.entries(COLUMN_PATTERNS)) {
        for (const pattern of patterns) {
          if (normalized === pattern) {
            targetField = field as ColumnMapping["targetField"];
            confidence = 1.0;
            break;
          } else if (normalized.includes(pattern)) {
            targetField = field as ColumnMapping["targetField"];
            confidence = 0.8;
            break;
          }
        }
        if (confidence > 0) break;
      }

      return {
        sourceColumn: header,
        targetField,
        confidence,
        sampleValue: sampleRow[idx] || "",
      };
    });

    // Check if we have a keyword column
    const hasKeyword = mappings.some((m) => m.targetField === "keyword");
    if (!hasKeyword) {
      throw new Error("No keyword column detected");
    }

    // Check what metrics we have
    const hasVolume = mappings.some((m) => m.targetField === "volume");
    const hasDifficulty = mappings.some((m) => m.targetField === "difficulty");
    const hasCpc = mappings.some((m) => m.targetField === "cpc");
    const hasPosition = mappings.some((m) => m.targetField === "position");

    // Try to detect format based on signatures
    let detectedFormat: DetectedFormat = "generic";

    for (const { format, signatures } of FORMAT_SIGNATURES) {
      for (const signature of signatures) {
        const matchCount = signature.filter((sig) =>
          normalizedHeaders.some((h) => h.includes(sig))
        ).length;

        if (matchCount >= signature.length * 0.8) {
          detectedFormat = format;
          break;
        }
      }
      if (detectedFormat !== "generic") break;
    }

    // Override to keywords_only if no volume and no difficulty
    if (!hasVolume && !hasDifficulty) {
      detectedFormat = "keywords_only";
    }

    const enrichmentNeeded = !hasVolume || !hasDifficulty;
    const estimatedCost = enrichmentNeeded ? COST_PER_KEYWORD_CENTS : 0;

    return {
      detectedFormat,
      hasMetrics: {
        volume: hasVolume,
        difficulty: hasDifficulty,
        cpc: hasCpc,
        position: hasPosition,
      },
      mappings,
      enrichmentNeeded,
      estimatedCost,
    };
  }

  /**
   * Parse a value to number, handling common formats.
   * Returns null for N/A, empty, or invalid values.
   */
  parseNumericValue(value: string): number | null {
    if (!value || value === "-" || value.toLowerCase() === "n/a") {
      return null;
    }

    // Remove commas, currency symbols, percent signs
    const cleaned = value
      .replace(/[,$%]/g, "")
      .replace(/\s/g, "")
      .trim();

    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }
}

export const columnDetector = new ColumnDetector();
