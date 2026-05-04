import { describe, it, expect } from "vitest";
import {
  AnalysisConstraints,
  BusinessContext,
  GeoConstraints,
  AudienceConstraints,
  FunnelConfig,
  Priority,
  NegativeFilters,
  SpecialModes,
  ExtractionResult,
  ConfidenceScores,
  isValidAnalysisConstraints,
  AnalysisConstraintsSchema,
  BusinessContextSchema,
  GeoConstraintsSchema,
  AudienceConstraintsSchema,
  FunnelConfigSchema,
  PrioritySchema,
  NegativeFiltersSchema,
  SpecialModesSchema,
  ConfidenceScoresSchema,
  ExtractionResultSchema,
} from "./types";

describe("AnalysisConstraints Types", () => {
  describe("BusinessContext", () => {
    it("should validate valid business context", () => {
      const valid: BusinessContext = {
        type: "ecommerce",
        coreOffering: "Online cosmetics store",
        problemsSolved: ["Beauty product discovery", "Fast delivery"],
        productCategories: ["Skincare", "Makeup"],
      };

      const result = BusinessContextSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should reject invalid business type", () => {
      const invalid = {
        type: "invalid",
        coreOffering: "Test",
        problemsSolved: [],
        productCategories: [],
      };

      const result = BusinessContextSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("GeoConstraints", () => {
    it("should validate hyperlocal scope with cities", () => {
      const valid: GeoConstraints = {
        scope: "hyperlocal",
        includeCities: ["Šiauliai"],
        excludeCities: [],
        nearMeAllowed: true,
        genericAllowed: false,
      };

      const result = GeoConstraintsSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should validate national scope", () => {
      const valid: GeoConstraints = {
        scope: "national",
        includeCities: [],
        excludeCities: [],
        nearMeAllowed: false,
        genericAllowed: true,
      };

      const result = GeoConstraintsSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should reject invalid scope", () => {
      const invalid = {
        scope: "global",
        includeCities: [],
        excludeCities: [],
        nearMeAllowed: false,
        genericAllowed: true,
      };

      const result = GeoConstraintsSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("AudienceConstraints", () => {
    it("should validate B2B-only audience", () => {
      const valid: AudienceConstraints = {
        b2bOnly: true,
        b2cAllowed: false,
        industryFocus: ["Manufacturing", "IT"],
      };

      const result = AudienceConstraintsSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should validate mixed B2B/B2C audience", () => {
      const valid: AudienceConstraints = {
        b2bOnly: false,
        b2cAllowed: true,
        industryFocus: [],
      };

      const result = AudienceConstraintsSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });

  describe("FunnelConfig", () => {
    it("should validate BOFU primary funnel", () => {
      const valid: FunnelConfig = {
        primary: "bofu",
        fallbackOrder: ["mofu", "tofu"],
        targetCount: 30,
        minPerStage: 10,
      };

      const result = FunnelConfigSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should reject invalid funnel stage", () => {
      const invalid = {
        primary: "bottomfunnel",
        fallbackOrder: [],
        targetCount: 30,
      };

      const result = FunnelConfigSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should allow optional minPerStage", () => {
      const valid: FunnelConfig = {
        primary: "mofu",
        fallbackOrder: ["bofu"],
        targetCount: 50,
      };

      const result = FunnelConfigSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });

  describe("Priority", () => {
    it("should validate priority with weight multiplier", () => {
      const valid: Priority = {
        category: "Transactional",
        weightMultiplier: 1.5,
        reason: "High buyer intent",
      };

      const result = PrioritySchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should reject weight multiplier outside range", () => {
      const invalid = {
        category: "Test",
        weightMultiplier: 2.5,
        reason: "Too high",
      };

      const result = PrioritySchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("NegativeFilters", () => {
    it("should validate negative filters", () => {
      const valid: NegativeFilters = {
        excludeTerms: ["free", "cheap"],
        excludeBrands: ["Competitor A"],
        excludeIntents: ["navigational"],
      };

      const result = NegativeFiltersSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should allow empty arrays", () => {
      const valid: NegativeFilters = {
        excludeTerms: [],
        excludeBrands: [],
        excludeIntents: [],
      };

      const result = NegativeFiltersSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });

  describe("SpecialModes", () => {
    it("should validate special modes configuration", () => {
      const valid: SpecialModes = {
        pSEODetection: true,
        sideKeywordDiscovery: false,
        competitorGaps: true,
      };

      const result = SpecialModesSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });

  describe("ConfidenceScores", () => {
    it("should validate confidence scores with all fields", () => {
      const valid: ConfidenceScores = {
        overall: 0.85,
        business: 0.9,
        geo: 0.8,
        audience: 0.85,
        funnel: 0.75,
        priorities: 0.9,
        negatives: 0.7,
        specialModes: 0.6,
      };

      const result = ConfidenceScoresSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should reject confidence scores outside 0-1 range", () => {
      const invalid = {
        overall: 1.5,
        business: 0.9,
        geo: 0.8,
        audience: 0.85,
        funnel: 0.75,
        priorities: 0.9,
        negatives: 0.7,
        specialModes: 0.6,
      };

      const result = ConfidenceScoresSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("AnalysisConstraints", () => {
    it("should validate complete constraints object", () => {
      const valid: AnalysisConstraints = {
        business: {
          type: "service",
          coreOffering: "Car wash service",
          problemsSolved: ["Dirty cars"],
          productCategories: ["Auto care"],
        },
        geo: {
          scope: "city",
          includeCities: ["Vilnius"],
          excludeCities: ["Kaunas"],
          nearMeAllowed: true,
          genericAllowed: false,
        },
        audience: {
          b2bOnly: false,
          b2cAllowed: true,
          industryFocus: [],
        },
        funnel: {
          primary: "bofu",
          fallbackOrder: ["mofu"],
          targetCount: 30,
        },
        priorities: [
          {
            category: "Local",
            weightMultiplier: 1.8,
            reason: "Geographic focus",
          },
        ],
        negatives: {
          excludeTerms: ["DIY"],
          excludeBrands: [],
          excludeIntents: [],
        },
        specialModes: {
          pSEODetection: false,
          sideKeywordDiscovery: true,
          competitorGaps: false,
        },
      };

      const result = AnalysisConstraintsSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should allow priorities array to be empty", () => {
      const valid: AnalysisConstraints = {
        business: {
          type: "saas",
          coreOffering: "Project management",
          problemsSolved: [],
          productCategories: [],
        },
        geo: {
          scope: "national",
          includeCities: [],
          excludeCities: [],
          nearMeAllowed: false,
          genericAllowed: true,
        },
        audience: {
          b2bOnly: true,
          b2cAllowed: false,
          industryFocus: ["Tech"],
        },
        funnel: {
          primary: "mofu",
          fallbackOrder: ["tofu"],
          targetCount: 50,
        },
        priorities: [],
        negatives: {
          excludeTerms: [],
          excludeBrands: [],
          excludeIntents: [],
        },
        specialModes: {
          pSEODetection: false,
          sideKeywordDiscovery: false,
          competitorGaps: false,
        },
      };

      const result = AnalysisConstraintsSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });

  describe("ExtractionResult", () => {
    it("should validate successful extraction", () => {
      const valid: ExtractionResult = {
        success: true,
        constraints: {
          business: {
            type: "local",
            coreOffering: "Dental services",
            problemsSolved: ["Tooth pain"],
            productCategories: ["Dentistry"],
          },
          geo: {
            scope: "city",
            includeCities: ["Kaunas"],
            excludeCities: [],
            nearMeAllowed: true,
            genericAllowed: false,
          },
          audience: {
            b2bOnly: false,
            b2cAllowed: true,
            industryFocus: [],
          },
          funnel: {
            primary: "bofu",
            fallbackOrder: [],
            targetCount: 20,
          },
          priorities: [],
          negatives: {
            excludeTerms: [],
            excludeBrands: [],
            excludeIntents: [],
          },
          specialModes: {
            pSEODetection: false,
            sideKeywordDiscovery: false,
            competitorGaps: false,
          },
        },
        confidence: {
          overall: 0.85,
          business: 0.9,
          geo: 0.9,
          audience: 0.8,
          funnel: 0.75,
          priorities: 0.7,
          negatives: 0.6,
          specialModes: 0.5,
        },
        clarificationNeeded: [],
        error: null,
        rawResponse: undefined,
      };

      const result = ExtractionResultSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should validate failed extraction", () => {
      const valid: ExtractionResult = {
        success: false,
        constraints: null,
        confidence: null,
        clarificationNeeded: [],
        error: "Failed to parse JSON response",
        rawResponse: "Invalid JSON",
      };

      const result = ExtractionResultSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should validate extraction with clarification needed", () => {
      const valid: ExtractionResult = {
        success: true,
        constraints: {
          business: {
            type: "b2b_services",
            coreOffering: "IT consulting",
            problemsSolved: [],
            productCategories: [],
          },
          geo: {
            scope: "national",
            includeCities: [],
            excludeCities: [],
            nearMeAllowed: false,
            genericAllowed: true,
          },
          audience: {
            b2bOnly: true,
            b2cAllowed: false,
            industryFocus: [],
          },
          funnel: {
            primary: "mofu",
            fallbackOrder: [],
            targetCount: 30,
          },
          priorities: [],
          negatives: {
            excludeTerms: [],
            excludeBrands: [],
            excludeIntents: [],
          },
          specialModes: {
            pSEODetection: false,
            sideKeywordDiscovery: false,
            competitorGaps: false,
          },
        },
        confidence: {
          overall: 0.65,
          business: 0.8,
          geo: 0.4,
          audience: 0.7,
          funnel: 0.5,
          priorities: 0.3,
          negatives: 0.2,
          specialModes: 0.4,
        },
        clarificationNeeded: [
          "Geographic targeting unclear - national or specific cities?",
          "Priority categories not mentioned - should we infer from business type?",
          "Negative filters not specified - any brands or terms to exclude?",
        ],
        error: null,
        rawResponse: undefined,
      };

      const result = ExtractionResultSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });

  describe("isValidAnalysisConstraints", () => {
    it("should return true for valid constraints", () => {
      const valid = {
        business: {
          type: "ecommerce",
          coreOffering: "Online store",
          problemsSolved: [],
          productCategories: [],
        },
        geo: {
          scope: "national",
          includeCities: [],
          excludeCities: [],
          nearMeAllowed: false,
          genericAllowed: true,
        },
        audience: {
          b2bOnly: false,
          b2cAllowed: true,
          industryFocus: [],
        },
        funnel: {
          primary: "mofu",
          fallbackOrder: [],
          targetCount: 30,
        },
        priorities: [],
        negatives: {
          excludeTerms: [],
          excludeBrands: [],
          excludeIntents: [],
        },
        specialModes: {
          pSEODetection: false,
          sideKeywordDiscovery: false,
          competitorGaps: false,
        },
      };

      expect(isValidAnalysisConstraints(valid)).toBe(true);
    });

    it("should return false for invalid constraints", () => {
      const invalid = {
        business: { type: "invalid" },
        geo: { scope: "unknown" },
      };

      expect(isValidAnalysisConstraints(invalid)).toBe(false);
    });

    it("should return false for null", () => {
      expect(isValidAnalysisConstraints(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isValidAnalysisConstraints(undefined)).toBe(false);
    });
  });
});
