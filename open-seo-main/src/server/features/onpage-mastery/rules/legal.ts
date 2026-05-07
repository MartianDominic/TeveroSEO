/**
 * Legal Vertical Rules (YMYL)
 * Phase 92-04: RuleEngineService
 *
 * Rules specific to legal services content.
 * These rules enforce YMYL requirements for attorney attribution,
 * jurisdiction disclaimers, and no outcome guarantees.
 */

import type { RuleDefinition } from "./types";

/**
 * Legal-specific rules (YMYL requirements).
 * Higher weights due to YMYL criticality.
 */
export const legalRules: RuleDefinition[] = [
  {
    id: "R-LG-01",
    name: "Attorney attribution required",
    description: "Legal content requires attorney/law firm attribution",
    category: "trust",
    weight: 3.0,
    severity: "critical",
    verticals: ["legal"],
    evaluate: (ctx) => {
      const patterns = [
        /\b(attorney|lawyer|law firm|esq\.?|j\.?d\.?)\b/i,
        /licensed to practice/i,
        /admitted to.*bar/i,
        /practicing attorney/i,
      ];
      const hasAttorney = patterns.some((p) => p.test(ctx.text));
      return {
        passed: hasAttorney,
        score: hasAttorney ? 100 : 0,
        message: hasAttorney
          ? "Attorney attribution found"
          : "Missing attorney attribution",
      };
    },
  },
  {
    id: "R-LG-02",
    name: "Legal disclaimer present",
    description: "Content includes legal disclaimer",
    category: "compliance",
    weight: 2.5,
    severity: "high",
    verticals: ["legal"],
    evaluate: (ctx) => {
      const disclaimerPatterns = [
        /not (constitute|intended as).*legal advice/i,
        /consult.*attorney/i,
        /for informational purposes only/i,
        /does not create.*attorney.?client/i,
        /this is not legal advice/i,
        /seek legal counsel/i,
      ];
      const hasDisclaimer = disclaimerPatterns.some((p) => p.test(ctx.text));
      return {
        passed: hasDisclaimer,
        score: hasDisclaimer ? 100 : 0,
        message: hasDisclaimer
          ? "Legal disclaimer present"
          : "Missing legal disclaimer",
      };
    },
  },
  {
    id: "R-LG-03",
    name: "Jurisdiction notice",
    description: "Content specifies applicable jurisdiction",
    category: "compliance",
    weight: 1.5,
    severity: "high",
    verticals: ["legal"],
    evaluate: (ctx) => {
      const jurisdictionPatterns = [
        /laws (of|in) [A-Z][a-z]+/,
        /\b(state|federal|local) law\b/i,
        /jurisdiction\b/i,
        /licensed in [A-Z][a-z]+/,
        /practice areas?:? [A-Z][a-z]+/i,
      ];
      const hasJurisdiction = jurisdictionPatterns.some((p) => p.test(ctx.text));
      return {
        passed: hasJurisdiction,
        score: hasJurisdiction ? 100 : 50,
        message: hasJurisdiction
          ? "Jurisdiction information found"
          : "Consider specifying applicable jurisdiction",
      };
    },
  },
  {
    id: "R-LG-04",
    name: "No outcome guarantees",
    description: "Content does not guarantee case outcomes",
    category: "compliance",
    weight: 2.0,
    severity: "critical",
    verticals: ["legal"],
    evaluate: (ctx) => {
      const guaranteePatterns = [
        /guaranteed? (to )?(win|success|outcome|verdict)/i,
        /100% (success|win) rate/i,
        /will definitely (win|succeed)/i,
        /never lost a case/i,
      ];
      const hasGuarantee = guaranteePatterns.some((p) => p.test(ctx.text));
      return {
        passed: !hasGuarantee,
        score: hasGuarantee ? 0 : 100,
        message: hasGuarantee
          ? "Warning: Content contains outcome guarantees"
          : "No outcome guarantees detected",
      };
    },
  },
  {
    id: "R-LG-05",
    name: "Bar association information",
    description: "Attorney bar association membership visible",
    category: "trust",
    weight: 1.5,
    severity: "medium",
    verticals: ["legal"],
    evaluate: (ctx) => {
      const barPatterns = [
        /bar (association|number|#)/i,
        /state bar of/i,
        /admitted to.*bar/i,
        /bar license/i,
      ];
      const hasBar = barPatterns.some((p) => p.test(ctx.text));
      return {
        passed: hasBar,
        score: hasBar ? 100 : 50,
        message: hasBar
          ? "Bar association information found"
          : "Consider adding bar association details",
      };
    },
  },
  {
    id: "R-LG-06",
    name: "Legal schema present",
    description: "Page has LegalService or Attorney schema",
    category: "schema",
    weight: 1.0,
    severity: "medium",
    verticals: ["legal"],
    evaluate: (ctx) => {
      const legalSchemas = ["LegalService", "Attorney", "LawFirm"];
      const hasLegalSchema = ctx.metadata.schemas.some((s) =>
        legalSchemas.some(
          (ls) => s.includes(`"@type":"${ls}"`) || s.includes(`"@type": "${ls}"`)
        )
      );
      return {
        passed: hasLegalSchema,
        score: hasLegalSchema ? 100 : 50,
        message: hasLegalSchema
          ? "Legal schema found"
          : "Consider adding legal-specific schema",
      };
    },
  },
];
