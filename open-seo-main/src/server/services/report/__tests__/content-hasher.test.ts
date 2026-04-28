import { describe, it, expect } from "vitest";
import { computeReportHash, type ReportInputData } from "../content-hasher";

describe("computeReportHash", () => {
  const baseData: ReportInputData = {
    clientId: "550e8400-e29b-41d4-a716-446655440000",
    dateRange: { start: "2026-03-01", end: "2026-03-31" },
    gscDataCount: 31,
    gscLastDate: "2026-03-31",
    ga4DataCount: 31,
    queriesCount: 50,
    locale: "en",
  };

  it("returns consistent 16-char hex for same input", () => {
    const hash1 = computeReportHash(baseData);
    const hash2 = computeReportHash(baseData);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(16);
    expect(hash1).toMatch(/^[a-f0-9]{16}$/);
  });

  it("returns different hash for different clientId", () => {
    const hash1 = computeReportHash(baseData);
    const hash2 = computeReportHash({
      ...baseData,
      clientId: "660e8400-e29b-41d4-a716-446655440001",
    });

    expect(hash1).not.toBe(hash2);
  });

  it("returns different hash for different dateRange", () => {
    const hash1 = computeReportHash(baseData);
    const hash2 = computeReportHash({
      ...baseData,
      dateRange: { start: "2026-02-01", end: "2026-02-28" },
    });

    expect(hash1).not.toBe(hash2);
  });

  it("returns different hash for different gscDataCount", () => {
    const hash1 = computeReportHash(baseData);
    const hash2 = computeReportHash({
      ...baseData,
      gscDataCount: 30,
    });

    expect(hash1).not.toBe(hash2);
  });

  it("returns different hash for different locale", () => {
    const hash1 = computeReportHash(baseData);
    const hash2 = computeReportHash({
      ...baseData,
      locale: "de",
    });

    expect(hash1).not.toBe(hash2);
  });

  it("handles null gscLastDate correctly", () => {
    const dataWithNull: ReportInputData = {
      ...baseData,
      gscLastDate: null,
    };

    const hash = computeReportHash(dataWithNull);
    expect(hash).toHaveLength(16);
    expect(hash).toMatch(/^[a-f0-9]{16}$/);
  });
});
