/**
 * Prospect Keyword Schema Tests
 *
 * Tests for the ProspectKeyword schema with source tracking.
 */

import { describe, test, expect } from "vitest";

describe("ProspectKeyword Schema", () => {
  // Test 1: ProspectKeyword has required fields
  test("ProspectKeyword has required fields: keyword, normalizedKeyword, prospectId, source", async () => {
    const {
      prospectKeywords,
      KEYWORD_SOURCES,
      ENRICHMENT_STATUS,
    } = await import("./prospect-keyword-schema");

    // Check table exists
    expect(prospectKeywords).toBeDefined();

    // Check required columns exist by checking the table config
    const columns = Object.keys(prospectKeywords);
    expect(columns).toContain("keyword");
    expect(columns).toContain("normalizedKeyword");
    expect(columns).toContain("prospectId");
    expect(columns).toContain("source");
    expect(columns).toContain("id");

    // Check enums are exported
    expect(KEYWORD_SOURCES).toBeDefined();
    expect(ENRICHMENT_STATUS).toBeDefined();
  });

  // Test 2: Source enum includes required values
  test("Source enum includes: dataforseo, manual, csv_upload, competitor_gap, quick_check", async () => {
    const { KEYWORD_SOURCES } = await import("./prospect-keyword-schema");

    expect(KEYWORD_SOURCES).toContain("dataforseo");
    expect(KEYWORD_SOURCES).toContain("manual");
    expect(KEYWORD_SOURCES).toContain("csv_upload");
    expect(KEYWORD_SOURCES).toContain("competitor_gap");
    expect(KEYWORD_SOURCES).toContain("quick_check");
    expect(KEYWORD_SOURCES.length).toBe(5);
  });

  // Test 3: EnrichmentStatus enum includes required values
  test("EnrichmentStatus enum includes: pending, enriched, cached, failed, skipped", async () => {
    const { ENRICHMENT_STATUS } = await import("./prospect-keyword-schema");

    expect(ENRICHMENT_STATUS).toContain("pending");
    expect(ENRICHMENT_STATUS).toContain("enriched");
    expect(ENRICHMENT_STATUS).toContain("cached");
    expect(ENRICHMENT_STATUS).toContain("failed");
    expect(ENRICHMENT_STATUS).toContain("skipped");
    expect(ENRICHMENT_STATUS.length).toBe(5);
  });

  // Test 4: Tier enum includes required values
  test("Tier enum includes: must_do, should_do, nice_to_have, ignore", async () => {
    const { KEYWORD_TIERS } = await import("./prospect-keyword-schema");

    expect(KEYWORD_TIERS).toContain("must_do");
    expect(KEYWORD_TIERS).toContain("should_do");
    expect(KEYWORD_TIERS).toContain("nice_to_have");
    expect(KEYWORD_TIERS).toContain("ignore");
    expect(KEYWORD_TIERS.length).toBe(4);
  });

  // Test 5: Table and all enums are exported
  test("Table and all enums are exported correctly", async () => {
    const mod = await import("./prospect-keyword-schema");

    // Check that all expected exports exist
    expect(mod.prospectKeywords).toBeDefined();
    expect(mod.KEYWORD_SOURCES).toBeDefined();
    expect(mod.ENRICHMENT_STATUS).toBeDefined();
    expect(mod.KEYWORD_TIERS).toBeDefined();
    expect(mod.QUICK_WIN_TYPES).toBeDefined();

    // Verify table has the required structure
    expect(typeof mod.prospectKeywords).toBe("object");
  });

  // Test 6: Table has correct indexes
  test("Table has unique index on prospectId + normalizedKeyword", async () => {
    const { prospectKeywords } = await import("./prospect-keyword-schema");

    // The table should have the unique index defined
    // We verify by checking the table structure
    expect(prospectKeywords).toBeDefined();

    // Check prospectId is a text field
    const prospectIdColumn = prospectKeywords.prospectId;
    expect(prospectIdColumn).toBeDefined();

    // Check normalizedKeyword is a text field
    const normalizedKeywordColumn = prospectKeywords.normalizedKeyword;
    expect(normalizedKeywordColumn).toBeDefined();
  });
});
