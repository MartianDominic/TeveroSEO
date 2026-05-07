/**
 * Healthcare Vertical Rules (YMYL)
 * Phase 92-04: RuleEngineService
 *
 * Rules specific to healthcare/medical content.
 * These rules enforce YMYL (Your Money or Your Life) requirements
 * for medical accuracy, expert attribution, and regulatory compliance.
 */

import type { RuleDefinition } from "./types";

/**
 * Healthcare-specific rules (YMYL requirements).
 * Higher weights due to YMYL criticality.
 */
export const healthcareRules: RuleDefinition[] = [
  {
    id: "R-HC-01",
    name: "Medical reviewer required",
    description: "Healthcare content requires medical reviewer attribution",
    category: "trust",
    weight: 3.0, // High weight for YMYL
    severity: "critical",
    verticals: ["healthcare"],
    evaluate: (ctx) => {
      const patterns = [
        /reviewed by.*?(dr\.|md|nurse|physician|phd|do\b|rn\b)/i,
        /medical reviewer/i,
        /clinically reviewed/i,
        /medically reviewed/i,
        /fact.?checked by.*?(doctor|physician|nurse)/i,
        /verified by.*?(medical|healthcare|clinical)/i,
      ];
      const hasReviewer = patterns.some((p) => p.test(ctx.text));
      return {
        passed: hasReviewer,
        score: hasReviewer ? 100 : 0,
        message: hasReviewer
          ? "Medical reviewer attribution found"
          : "Missing medical reviewer",
      };
    },
  },
  {
    id: "R-HC-02",
    name: "Citations to authoritative sources",
    description: "Links to .gov, .edu, or peer-reviewed sources",
    category: "trust",
    weight: 2.5,
    severity: "high",
    verticals: ["healthcare"],
    evaluate: (ctx) => {
      const authoritativeLinks = ctx.$(
        'a[href*=".gov"], a[href*=".edu"], a[href*="nih.gov"], a[href*="pubmed"], a[href*="cdc.gov"], a[href*="who.int"], a[href*="ncbi.nlm"]'
      ).length;
      const passed = authoritativeLinks >= 2;
      return {
        passed,
        score: Math.min(100, authoritativeLinks * 50),
        message: `${authoritativeLinks} authoritative citations`,
        details: { authoritativeLinks },
      };
    },
  },
  {
    id: "R-HC-03",
    name: "Medical disclaimer present",
    description: "Content includes medical disclaimer",
    category: "compliance",
    weight: 2.0,
    severity: "high",
    verticals: ["healthcare"],
    evaluate: (ctx) => {
      const disclaimerPatterns = [
        /not (a substitute|intended to replace).*medical advice/i,
        /consult.*healthcare provider/i,
        /for informational purposes only/i,
        /not intended to diagnose/i,
        /seek professional medical/i,
        /consult.*doctor.*before/i,
        /this content is not medical advice/i,
      ];
      const hasDisclaimer = disclaimerPatterns.some((p) => p.test(ctx.text));
      return {
        passed: hasDisclaimer,
        score: hasDisclaimer ? 100 : 0,
        message: hasDisclaimer
          ? "Medical disclaimer present"
          : "Missing medical disclaimer",
      };
    },
  },
  {
    id: "R-HC-04",
    name: "Last updated date",
    description: "Medical content shows when it was last updated",
    category: "trust",
    weight: 1.5,
    severity: "high",
    verticals: ["healthcare"],
    evaluate: (ctx) => {
      const updatePatterns = [
        /last (updated|reviewed|modified)/i,
        /updated on/i,
        /medically reviewed.*\d{4}/i,
        /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/,
      ];
      const hasUpdate =
        updatePatterns.some((p) => p.test(ctx.text)) ||
        ctx.$('time[datetime], [itemprop="dateModified"]').length > 0;
      return {
        passed: hasUpdate,
        score: hasUpdate ? 100 : 0,
        message: hasUpdate
          ? "Last updated date found"
          : "Missing last updated date",
      };
    },
  },
  {
    id: "R-HC-05",
    name: "No outcome guarantees",
    description: "Content does not make guaranteed health outcome claims",
    category: "compliance",
    weight: 2.0,
    severity: "critical",
    verticals: ["healthcare"],
    evaluate: (ctx) => {
      const guaranteePatterns = [
        /guaranteed? (to )?(cure|heal|fix|treat|eliminate)/i,
        /100% (effective|success)/i,
        /will definitely (cure|heal|fix)/i,
        /miracle cure/i,
        /instant (cure|relief|healing)/i,
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
    id: "R-HC-06",
    name: "Healthcare schema present",
    description: "Page has MedicalEntity or related schema",
    category: "schema",
    weight: 1.0,
    severity: "medium",
    verticals: ["healthcare"],
    evaluate: (ctx) => {
      const healthSchemas = [
        "MedicalWebPage",
        "MedicalCondition",
        "Drug",
        "MedicalEntity",
        "Physician",
        "Hospital",
        "MedicalClinic",
      ];
      const hasHealthSchema = ctx.metadata.schemas.some((s) =>
        healthSchemas.some((hs) => s.includes(`"@type":"${hs}"`) || s.includes(`"@type": "${hs}"`))
      );
      return {
        passed: hasHealthSchema,
        score: hasHealthSchema ? 100 : 50,
        message: hasHealthSchema
          ? "Healthcare schema found"
          : "Consider adding healthcare-specific schema",
      };
    },
  },
  {
    id: "R-HC-07",
    name: "Author credentials visible",
    description: "Author medical credentials are displayed",
    category: "trust",
    weight: 2.0,
    severity: "high",
    verticals: ["healthcare"],
    evaluate: (ctx) => {
      const credentialPatterns = [
        /\b(md|m\.d\.|phd|ph\.d\.|do\b|d\.o\.|rn\b|r\.n\.|np\b|n\.p\.)/i,
        /\b(doctor|physician|nurse practitioner|registered nurse)\b/i,
        /board.?certified/i,
      ];
      const hasCredentials = credentialPatterns.some((p) => p.test(ctx.text));
      return {
        passed: hasCredentials,
        score: hasCredentials ? 100 : 0,
        message: hasCredentials
          ? "Author credentials visible"
          : "Missing visible author credentials",
      };
    },
  },
];
