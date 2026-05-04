import { describe, it, expect } from "vitest";
import {
  BOFU_PATTERNS,
  MOFU_PATTERNS,
  TOFU_PATTERNS,
  matchPatterns,
  detectFunnelPatterns,
} from "./patterns";

describe("BOFU Patterns", () => {
  it("should match purchase intent patterns", () => {
    expect(matchPatterns("pirkti šampūną", BOFU_PATTERNS)).toEqual({
      matched: true,
      patternType: "purchase",
    });
    expect(matchPatterns("nusipirk kolagenų", BOFU_PATTERNS)).toEqual({
      matched: true,
      patternType: "purchase",
    });
    expect(matchPatterns("užsakyti veido serumą", BOFU_PATTERNS)).toEqual({
      matched: true,
      patternType: "purchase",
    });
  });

  it("should match price-related patterns", () => {
    expect(matchPatterns("šampūnas kaina", BOFU_PATTERNS)).toEqual({
      matched: true,
      patternType: "purchase",
    });
    expect(matchPatterns("kiek kainuoja kolagenas", BOFU_PATTERNS)).toEqual({
      matched: true,
      patternType: "purchase",
    });
  });

  it("should match booking patterns", () => {
    expect(matchPatterns("registruotis procedūrai", BOFU_PATTERNS)).toEqual({
      matched: true,
      patternType: "booking",
    });
    expect(matchPatterns("rezervuoti laiką", BOFU_PATTERNS)).toEqual({
      matched: true,
      patternType: "booking",
    });
  });

  it("should match local intent patterns", () => {
    expect(matchPatterns("plovykla šalia manęs", BOFU_PATTERNS)).toEqual({
      matched: true,
      patternType: "local",
    });
    expect(matchPatterns("kosmetologė netoli", BOFU_PATTERNS)).toEqual({
      matched: true,
      patternType: "local",
    });
  });

  it("should match delivery patterns", () => {
    expect(matchPatterns("pristatymas į namus", BOFU_PATTERNS)).toEqual({
      matched: true,
      patternType: "delivery",
    });
    expect(matchPatterns("nemokamas pristatymas", BOFU_PATTERNS)).toEqual({
      matched: true,
      patternType: "delivery",
    });
  });

  it("should not match non-BOFU keywords", () => {
    expect(matchPatterns("random text", BOFU_PATTERNS)).toEqual({
      matched: false,
      patternType: null,
    });
    expect(matchPatterns("kas yra kolagenas", BOFU_PATTERNS)).toEqual({
      matched: false,
      patternType: null,
    });
  });

  it("should be case-insensitive", () => {
    expect(matchPatterns("PIRKTI šampūną", BOFU_PATTERNS)).toEqual({
      matched: true,
      patternType: "purchase",
    });
    expect(matchPatterns("Užsakyti Kolagenų", BOFU_PATTERNS)).toEqual({
      matched: true,
      patternType: "purchase",
    });
  });
});

describe("MOFU Patterns", () => {
  it("should match comparison patterns", () => {
    expect(matchPatterns("geriausi šampūnai", MOFU_PATTERNS)).toEqual({
      matched: true,
      patternType: "comparison",
    });
    expect(matchPatterns("top 10 kolagenų", MOFU_PATTERNS)).toEqual({
      matched: true,
      patternType: "comparison",
    });
  });

  it("should match versus patterns", () => {
    expect(matchPatterns("cosrx vs some by mi", MOFU_PATTERNS)).toEqual({
      matched: true,
      patternType: "versus",
    });
    expect(matchPatterns("palyginti produktus", MOFU_PATTERNS)).toEqual({
      matched: true,
      patternType: "versus",
    });
  });

  it("should match review patterns", () => {
    expect(matchPatterns("atsiliepimai apie šampūną", MOFU_PATTERNS)).toEqual({
      matched: true,
      patternType: "reviews",
    });
    expect(matchPatterns("ar verta pirkti", MOFU_PATTERNS)).toEqual({
      matched: true,
      patternType: "reviews",
    });
  });

  it("should match selection help patterns", () => {
    expect(matchPatterns("kaip pasirinkti šampūną", MOFU_PATTERNS)).toEqual({
      matched: true,
      patternType: "selection",
    });
    expect(matchPatterns("koks šampūnas tinka", MOFU_PATTERNS)).toEqual({
      matched: true,
      patternType: "selection",
    });
  });

  it("should not match non-MOFU keywords", () => {
    expect(matchPatterns("random text", MOFU_PATTERNS)).toEqual({
      matched: false,
      patternType: null,
    });
  });
});

describe("TOFU Patterns", () => {
  it("should match learning patterns", () => {
    expect(matchPatterns("kas yra hialurono rūgštis", TOFU_PATTERNS)).toEqual({
      matched: true,
      patternType: "learning",
    });
    expect(matchPatterns("kaip veikia kolagenas", TOFU_PATTERNS)).toEqual({
      matched: true,
      patternType: "learning",
    });
  });

  it("should match how-to patterns", () => {
    expect(matchPatterns("kaip naudoti serumą", TOFU_PATTERNS)).toEqual({
      matched: true,
      patternType: "how_to",
    });
    expect(matchPatterns("naudojimo instrukcija", TOFU_PATTERNS)).toEqual({
      matched: true,
      patternType: "how_to",
    });
  });

  it("should match why patterns", () => {
    expect(matchPatterns("kodėl svarbu naudoti", TOFU_PATTERNS)).toEqual({
      matched: true,
      patternType: "why",
    });
    expect(matchPatterns("kam reikia kolageno", TOFU_PATTERNS)).toEqual({
      matched: true,
      patternType: "why",
    });
  });

  it("should match tips patterns", () => {
    expect(matchPatterns("plaukų priežiūros patarimai", TOFU_PATTERNS)).toEqual({
      matched: true,
      patternType: "tips",
    });
    expect(matchPatterns("kosmetikos idėjos", TOFU_PATTERNS)).toEqual({
      matched: true,
      patternType: "tips",
    });
  });

  it("should not match non-TOFU keywords", () => {
    expect(matchPatterns("random text", TOFU_PATTERNS)).toEqual({
      matched: false,
      patternType: null,
    });
  });
});

describe("detectFunnelPatterns", () => {
  it("should prioritize BOFU over MOFU and TOFU", () => {
    expect(detectFunnelPatterns("pirkti šampūną")).toEqual({
      stage: "bofu",
      patternType: "purchase",
    });
  });

  it("should detect MOFU when no BOFU match", () => {
    expect(detectFunnelPatterns("geriausi šampūnai 2024")).toEqual({
      stage: "mofu",
      patternType: "comparison",
    });
  });

  it("should detect TOFU when no BOFU or MOFU match", () => {
    expect(detectFunnelPatterns("kas yra kolagenas")).toEqual({
      stage: "tofu",
      patternType: "learning",
    });
  });

  it("should return null for no pattern match", () => {
    expect(detectFunnelPatterns("random keyword")).toEqual({
      stage: null,
      patternType: null,
    });
  });

  it("should be case-insensitive", () => {
    expect(detectFunnelPatterns("PIRKTI ŠAMPŪNĄ")).toEqual({
      stage: "bofu",
      patternType: "purchase",
    });
  });
});

describe("Pattern Coverage", () => {
  it("should have at least 40 BOFU patterns", () => {
    const totalPatterns = BOFU_PATTERNS.reduce(
      (sum, group) => sum + group.patterns.length,
      0
    );
    expect(totalPatterns).toBeGreaterThanOrEqual(40);
  });

  it("should have at least 30 MOFU patterns", () => {
    const totalPatterns = MOFU_PATTERNS.reduce(
      (sum, group) => sum + group.patterns.length,
      0
    );
    expect(totalPatterns).toBeGreaterThanOrEqual(30);
  });

  it("should have at least 25 TOFU patterns", () => {
    const totalPatterns = TOFU_PATTERNS.reduce(
      (sum, group) => sum + group.patterns.length,
      0
    );
    expect(totalPatterns).toBeGreaterThanOrEqual(25);
  });
});
