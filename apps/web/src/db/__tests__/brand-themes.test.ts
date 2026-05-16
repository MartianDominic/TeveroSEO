/**
 * Brand Themes Table Tests
 * Phase 102-11: Task 1 - TDD tests for brand_themes schema
 *
 * Validates the brandThemes table has correct structure
 * for storing extracted document themes.
 */

import { describe, test, expect } from "vitest";
import { brandThemes } from "../schema/document-builder";

describe("brandThemes table", () => {
  test("has documentId foreign key column", () => {
    const columns = Object.keys(brandThemes);
    expect(columns).toContain("documentId");
  });

  test("has colors column for hex color array", () => {
    const columns = Object.keys(brandThemes);
    expect(columns).toContain("colors");
  });

  test("has fonts column for font family array", () => {
    const columns = Object.keys(brandThemes);
    expect(columns).toContain("fonts");
  });

  test("has voiceAttributes column for tone/vocabulary JSON", () => {
    const columns = Object.keys(brandThemes);
    expect(columns).toContain("voiceAttributes");
  });

  test("has primary and secondary color fields", () => {
    const columns = Object.keys(brandThemes);
    expect(columns).toContain("primaryColor");
    expect(columns).toContain("secondaryColor");
  });

  test("has heading and body font fields", () => {
    const columns = Object.keys(brandThemes);
    expect(columns).toContain("headingFont");
    expect(columns).toContain("bodyFont");
  });

  test("has extractionConfidence score field", () => {
    const columns = Object.keys(brandThemes);
    expect(columns).toContain("extractionConfidence");
  });
});
