/**
 * Financial Vertical Rules (YMYL)
 * Phase 92-04: RuleEngineService
 *
 * Rules specific to financial services content.
 * These rules enforce YMYL requirements for regulatory disclosures,
 * risk disclaimers, and fiduciary statements.
 */

import type { RuleDefinition } from "./types";

/**
 * Financial-specific rules (YMYL requirements).
 * Higher weights due to YMYL criticality.
 */
export const financialRules: RuleDefinition[] = [
  {
    id: "R-FN-01",
    name: "Financial advisor disclosure",
    description: "Content discloses author financial credentials",
    category: "trust",
    weight: 3.0,
    severity: "critical",
    verticals: ["financial"],
    evaluate: (ctx) => {
      const patterns = [
        /\b(cfa|cfp|cpa|series \d+|finra|sec registered)\b/i,
        /licensed (financial|investment) (advisor|planner)/i,
        /certified financial/i,
        /registered investment advisor/i,
        /fiduciary/i,
      ];
      const hasCredential = patterns.some((p) => p.test(ctx.text));
      return {
        passed: hasCredential,
        score: hasCredential ? 100 : 0,
        message: hasCredential
          ? "Financial credentials disclosed"
          : "Missing financial advisor credentials",
      };
    },
  },
  {
    id: "R-FN-02",
    name: "Risk disclaimer present",
    description: "Content includes investment risk disclaimer",
    category: "compliance",
    weight: 2.5,
    severity: "high",
    verticals: ["financial"],
    evaluate: (ctx) => {
      const disclaimerPatterns = [
        /past performance.*not.*guarantee/i,
        /investment.*risk/i,
        /may lose (money|value|principal)/i,
        /not (a |)guarantee of future/i,
        /consult.*financial advisor/i,
        /for informational purposes only/i,
        /this is not financial advice/i,
      ];
      const hasDisclaimer = disclaimerPatterns.some((p) => p.test(ctx.text));
      return {
        passed: hasDisclaimer,
        score: hasDisclaimer ? 100 : 0,
        message: hasDisclaimer
          ? "Risk disclaimer present"
          : "Missing risk disclaimer",
      };
    },
  },
  {
    id: "R-FN-03",
    name: "Regulatory disclosure",
    description: "Content includes regulatory disclosures (SEC, FINRA, etc.)",
    category: "compliance",
    weight: 2.0,
    severity: "high",
    verticals: ["financial"],
    evaluate: (ctx) => {
      const regulatoryPatterns = [
        /\b(sec|finra|sipc|fdic|ncua)\b/i,
        /securities and exchange/i,
        /registered with/i,
        /member (sipc|finra)/i,
        /fdic insured/i,
      ];
      const hasRegulatory = regulatoryPatterns.some((p) => p.test(ctx.text));
      return {
        passed: hasRegulatory,
        score: hasRegulatory ? 100 : 50,
        message: hasRegulatory
          ? "Regulatory disclosure found"
          : "Consider adding regulatory disclosures",
      };
    },
  },
  {
    id: "R-FN-04",
    name: "No return guarantees",
    description: "Content does not guarantee specific returns",
    category: "compliance",
    weight: 2.0,
    severity: "critical",
    verticals: ["financial"],
    evaluate: (ctx) => {
      const guaranteePatterns = [
        /guaranteed? (return|profit|gain|yield)/i,
        /100% (return|profit|safe)/i,
        /risk.?free (return|investment|profit)/i,
        /will definitely (gain|profit|make money)/i,
        /double your money/i,
      ];
      const hasGuarantee = guaranteePatterns.some((p) => p.test(ctx.text));
      return {
        passed: !hasGuarantee,
        score: hasGuarantee ? 0 : 100,
        message: hasGuarantee
          ? "Warning: Content contains return guarantees"
          : "No return guarantees detected",
      };
    },
  },
  {
    id: "R-FN-05",
    name: "Financial schema present",
    description: "Page has FinancialService or related schema",
    category: "schema",
    weight: 1.0,
    severity: "medium",
    verticals: ["financial"],
    evaluate: (ctx) => {
      const financialSchemas = [
        "FinancialService",
        "BankOrCreditUnion",
        "InsuranceAgency",
        "AccountingService",
        "FinancialProduct",
      ];
      const hasFinancialSchema = ctx.metadata.schemas.some((s) =>
        financialSchemas.some(
          (fs) => s.includes(`"@type":"${fs}"`) || s.includes(`"@type": "${fs}"`)
        )
      );
      return {
        passed: hasFinancialSchema,
        score: hasFinancialSchema ? 100 : 50,
        message: hasFinancialSchema
          ? "Financial schema found"
          : "Consider adding financial-specific schema",
      };
    },
  },
  {
    id: "R-FN-06",
    name: "APR/fee disclosure",
    description: "Interest rates and fees are clearly disclosed",
    category: "compliance",
    weight: 1.5,
    severity: "high",
    verticals: ["financial"],
    evaluate: (ctx) => {
      const feePatterns = [
        /\b(apr|apy|interest rate)\b/i,
        /\d+(\.\d+)?%\s*(apr|apy|interest)/i,
        /fee(s)?:?\s*\$/i,
        /annual (fee|percentage)/i,
      ];
      // Only check for pages that likely need fee disclosure
      const isProductPage =
        ctx.url.includes("loan") ||
        ctx.url.includes("credit") ||
        ctx.url.includes("mortgage") ||
        ctx.text.toLowerCase().includes("apply now");

      if (!isProductPage) {
        return {
          passed: true,
          score: 100,
          message: "Not a financial product page",
        };
      }

      const hasFeeDisclosure = feePatterns.some((p) => p.test(ctx.text));
      return {
        passed: hasFeeDisclosure,
        score: hasFeeDisclosure ? 100 : 0,
        message: hasFeeDisclosure
          ? "Fee disclosure found"
          : "Missing APR/fee disclosure",
      };
    },
  },
];
