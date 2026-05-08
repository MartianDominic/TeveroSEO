/**
 * BrandedKeywordService
 * Phase 96-05: Brand term detection and classification
 *
 * Auto-detects brand terms from domain/site name and classifies
 * search queries as branded or non-branded.
 *
 * Key features:
 * - Auto-detection from domain and company name
 * - Manual brand term management
 * - Query classification for branded/non-branded split
 * - Metrics aggregation by brand status
 */
import { eq, and } from "drizzle-orm";
import type { DbClient } from "@/db";
import { brandTerms } from "@/db/analytics-extended-schema";

/**
 * Brand term entity
 */
export interface BrandTerm {
  id: string;
  clientId: string;
  term: string;
  isAutoDetected: boolean;
  createdAt: Date;
}

/**
 * Branded/non-branded split result
 */
export interface BrandedSplit<T> {
  branded: T[];
  nonBranded: T[];
  brandedPercent: number;
  nonBrandedPercent: number;
}

/**
 * Legal entity suffixes to strip from company names (only strip from end)
 * Note: "company" is NOT included as it's often part of the brand name
 */
const COMPANY_SUFFIXES_END = [
  "inc",
  "inc.",
  "llc",
  "ltd",
  "ltd.",
  "corporation",
  "limited",
  "gmbh",
  "ag",
  "sa",
  "srl",
  "plc",
  "pty",
];

/**
 * Common prefixes to strip from company names (only strip from start)
 */
const COMPANY_PREFIXES = ["the"];

/**
 * Common TLDs to strip
 */
const COMMON_TLDS = [
  "com",
  "org",
  "net",
  "io",
  "co",
  "us",
  "uk",
  "de",
  "fr",
  "lt",
  "lv",
  "ee",
  "ru",
  "pl",
  "cz",
];

export class BrandedKeywordService {
  constructor(private db: DbClient) {}

  /**
   * Auto-detect brand terms from domain and optional site name.
   * Returns unsaved brand term objects.
   */
  autoDetectBrandTerms(
    clientId: string,
    domain: string,
    siteName?: string
  ): BrandTerm[] {
    const termsSet = new Set<string>();

    // Extract from domain
    const domainTerms = this.extractTermsFromDomain(domain);
    domainTerms.forEach((t) => termsSet.add(t));

    // Extract from site name if provided
    if (siteName) {
      const nameTerms = this.extractTermsFromName(siteName);
      nameTerms.forEach((t) => termsSet.add(t));
    }

    // Convert to BrandTerm objects
    const now = new Date();
    return Array.from(termsSet).map((term) => ({
      id: `auto-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      clientId,
      term,
      isAutoDetected: true,
      createdAt: now,
    }));
  }

  /**
   * Get all brand terms for a client.
   */
  async getBrandTerms(clientId: string): Promise<BrandTerm[]> {
    const results = await this.db
      .select()
      .from(brandTerms)
      .where(eq(brandTerms.clientId, clientId));

    return results.map((row) => ({
      id: row.id,
      clientId: row.clientId,
      term: row.term,
      isAutoDetected: row.isAutoDetected,
      createdAt: row.createdAt,
    }));
  }

  /**
   * Add a brand term (manual or auto-detected).
   */
  async addBrandTerm(
    clientId: string,
    term: string,
    isAutoDetected: boolean = false
  ): Promise<BrandTerm> {
    const result = await this.db
      .insert(brandTerms)
      .values({
        clientId,
        term: term.toLowerCase().trim(),
        isAutoDetected,
      })
      .returning();

    const row = result[0];
    return {
      id: row.id,
      clientId: row.clientId,
      term: row.term,
      isAutoDetected: row.isAutoDetected,
      createdAt: row.createdAt,
    };
  }

  /**
   * Remove a brand term by ID.
   */
  async removeBrandTerm(clientId: string, termId: string): Promise<void> {
    await this.db
      .delete(brandTerms)
      .where(and(eq(brandTerms.clientId, clientId), eq(brandTerms.id, termId)));
  }

  /**
   * Sync auto-detected terms: add new ones without duplicating existing.
   */
  async syncAutoDetectedTerms(
    clientId: string,
    domain: string,
    siteName?: string
  ): Promise<BrandTerm[]> {
    // Get existing terms
    const existing = await this.getBrandTerms(clientId);
    const existingTermsSet = new Set(existing.map((t) => t.term.toLowerCase()));

    // Generate auto-detected terms
    const autoTerms = this.autoDetectBrandTerms(clientId, domain, siteName);

    // Filter out duplicates
    const newTerms = autoTerms.filter(
      (t) => !existingTermsSet.has(t.term.toLowerCase())
    );

    // Insert new terms
    const inserted: BrandTerm[] = [];
    for (const term of newTerms) {
      const saved = await this.addBrandTerm(clientId, term.term, true);
      inserted.push(saved);
    }

    return inserted;
  }

  /**
   * Classify a search query as branded or non-branded.
   */
  classifyQuery(
    query: string,
    brandTerms: string[]
  ): "branded" | "non-branded" {
    if (!query || brandTerms.length === 0) {
      return "non-branded";
    }

    const normalizedQuery = query.toLowerCase().trim();

    for (const term of brandTerms) {
      const normalizedTerm = term.toLowerCase().trim();
      if (normalizedQuery.includes(normalizedTerm)) {
        return "branded";
      }
    }

    return "non-branded";
  }

  /**
   * Split metrics by branded/non-branded queries.
   * Calculates percentages based on clicks.
   */
  splitMetricsByBranded<T extends { query?: string; clicks?: number }>(
    metrics: T[],
    brandTerms: string[]
  ): BrandedSplit<T> {
    if (metrics.length === 0) {
      return {
        branded: [],
        nonBranded: [],
        brandedPercent: 0,
        nonBrandedPercent: 0,
      };
    }

    const branded: T[] = [];
    const nonBranded: T[] = [];

    for (const metric of metrics) {
      const classification = this.classifyQuery(
        metric.query || "",
        brandTerms
      );
      if (classification === "branded") {
        branded.push(metric);
      } else {
        nonBranded.push(metric);
      }
    }

    // Calculate percentages based on clicks
    const brandedClicks = branded.reduce(
      (sum, m) => sum + (m.clicks || 0),
      0
    );
    const nonBrandedClicks = nonBranded.reduce(
      (sum, m) => sum + (m.clicks || 0),
      0
    );
    const totalClicks = brandedClicks + nonBrandedClicks;

    const brandedPercent =
      totalClicks > 0 ? (brandedClicks / totalClicks) * 100 : 0;
    const nonBrandedPercent =
      totalClicks > 0 ? (nonBrandedClicks / totalClicks) * 100 : 0;

    return {
      branded,
      nonBranded,
      brandedPercent,
      nonBrandedPercent,
    };
  }

  /**
   * Extract brand terms from domain.
   */
  private extractTermsFromDomain(domain: string): string[] {
    const terms: string[] = [];

    // Remove protocol and www
    let cleanDomain = domain
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .toLowerCase();

    // Remove path
    cleanDomain = cleanDomain.split("/")[0];

    // Split by dot
    const parts = cleanDomain.split(".");

    // Get the main domain part (before TLD)
    // Handle multi-part TLDs like .co.uk
    let mainPart = "";
    for (const part of parts) {
      if (!COMMON_TLDS.includes(part)) {
        mainPart = part;
        break;
      }
    }

    if (mainPart) {
      // Add as-is (with hyphens)
      terms.push(mainPart);

      // Add without hyphens
      if (mainPart.includes("-")) {
        terms.push(mainPart.replace(/-/g, ""));
      }
    }

    return terms;
  }

  /**
   * Extract brand terms from company/site name.
   */
  private extractTermsFromName(name: string): string[] {
    const terms: string[] = [];

    // Clean the name
    let cleanName = name.toLowerCase().trim();
    const words = cleanName.split(/\s+/);

    // Remove prefix words (e.g., "the")
    let startIndex = 0;
    while (
      startIndex < words.length &&
      COMPANY_PREFIXES.includes(words[startIndex].toLowerCase())
    ) {
      startIndex++;
    }

    // Remove suffix words (e.g., "inc", "llc", "company")
    let endIndex = words.length;
    while (
      endIndex > startIndex &&
      COMPANY_SUFFIXES_END.includes(words[endIndex - 1].toLowerCase())
    ) {
      endIndex--;
    }

    const filteredWords = words.slice(startIndex, endIndex);
    cleanName = filteredWords.join(" ");

    if (cleanName) {
      // Add full cleaned name
      terms.push(cleanName);

      // Add without spaces
      terms.push(cleanName.replace(/\s+/g, ""));

      // If multi-word, add individual significant words
      if (filteredWords.length > 1) {
        for (const word of filteredWords) {
          if (word.length >= 3) {
            terms.push(word);
          }
        }
      }
    }

    return terms;
  }
}

// Singleton instance with lazy db import
let instance: BrandedKeywordService | null = null;

export async function getBrandedKeywordService(): Promise<BrandedKeywordService> {
  if (!instance) {
    const { db } = await import("@/db");
    instance = new BrandedKeywordService(db);
  }
  return instance;
}

// Reset singleton for testing
export function resetBrandedKeywordService(): void {
  instance = null;
}
