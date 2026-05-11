/**
 * Tier 1 Schema Basics Checks (T1-48 to T1-54)
 * Category I: Structured data basics
 * Phase 100: Added runV2 for JSON-based extraction
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult, SEODataContext } from "../types";
import type { CheerioAPI } from "cheerio";

function parseJsonLd($: CheerioAPI): unknown[] {
  const schemas: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const text = $(el).html() ?? "";
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) schemas.push(...parsed);
      else schemas.push(parsed);
    } catch {
      // Malformed JSON-LD - threat model T-32-03
    }
  });
  return schemas;
}

function findSchemaByType(schemas: unknown[], type: string): unknown | undefined {
  for (const s of schemas) {
    if (typeof s === "object" && s !== null) {
      const obj = s as Record<string, unknown>;
      if (obj["@type"] === type) return obj;
      if (Array.isArray(obj["@type"]) && obj["@type"].includes(type)) return obj;
      // Check @graph
      if (Array.isArray(obj["@graph"])) {
        for (const g of obj["@graph"]) {
          if (typeof g === "object" && g !== null) {
            const gobj = g as Record<string, unknown>;
            if (gobj["@type"] === type) return gobj;
          }
        }
      }
    }
  }
  return undefined;
}

// T1-48: JSON-LD present
registerCheck({
  id: "T1-48",
  name: "JSON-LD schema present",
  tier: 1,
  category: "schema-basics",
  severity: "high",
  autoEditable: true,
  editRecipe: "Add JSON-LD structured data to the page",
  run: (ctx: CheckContext): CheckResult => {
    const $ = ctx.$;
    const count = $('script[type="application/ld+json"]').length;
    const passed = count > 0;
    return {
      checkId: "T1-48",
      passed,
      severity: passed ? "info" : "high",
      message: passed ? `${count} JSON-LD schema block(s) found` : "No JSON-LD schema found",
      details: { count },
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Add JSON-LD structured data to the page",
    };
  },
  runV2: (ctx: SEODataContext): CheckResult => {
    const hasSchema = ctx.data.has_schema;
    const count = ctx.data.schemas.length;
    return {
      checkId: "T1-48",
      passed: hasSchema,
      severity: hasSchema ? "info" : "high",
      message: hasSchema ? `${count} JSON-LD schema block(s) found` : "No JSON-LD schema found",
      details: { count, types: ctx.data.schema_types },
      autoEditable: !hasSchema,
      editRecipe: hasSchema ? undefined : "Add JSON-LD structured data to the page",
    };
  },
});

// T1-49: Article schema has author
registerCheck({
  id: "T1-49",
  name: "Article schema has author",
  tier: 1,
  category: "schema-basics",
  severity: "high",
  autoEditable: true,
  editRecipe: "Add author property to Article schema",
  run: (ctx: CheckContext): CheckResult => {
    const schemas = parseJsonLd(ctx.$);
    const article = findSchemaByType(schemas, "Article") ?? findSchemaByType(schemas, "BlogPosting") ?? findSchemaByType(schemas, "NewsArticle");
    if (!article) {
      return { checkId: "T1-49", passed: true, severity: "info", message: "No Article schema found", autoEditable: false };
    }
    const obj = article as Record<string, unknown>;
    const hasAuthor = obj.author !== undefined && obj.author !== null;
    return {
      checkId: "T1-49",
      passed: hasAuthor,
      severity: hasAuthor ? "info" : "high",
      message: hasAuthor ? "Article schema has author" : "Article schema missing author",
      autoEditable: !hasAuthor,
      editRecipe: hasAuthor ? undefined : "Add author property to Article schema",
    };
  },
  runV2: (ctx: SEODataContext): CheckResult => {
    const articleTypes = ["Article", "BlogPosting", "NewsArticle"];
    const hasArticle = ctx.data.schema_types.some((t) => articleTypes.includes(t));
    if (!hasArticle) {
      return { checkId: "T1-49", passed: true, severity: "info", message: "No Article schema found", autoEditable: false };
    }
    // Find article schema and check for author
    const articleSchema = ctx.data.schemas.find((s) => articleTypes.includes(s.type));
    const hasAuthor = articleSchema?.raw?.author !== undefined && articleSchema?.raw?.author !== null;
    return {
      checkId: "T1-49",
      passed: hasAuthor,
      severity: hasAuthor ? "info" : "high",
      message: hasAuthor ? "Article schema has author" : "Article schema missing author",
      autoEditable: !hasAuthor,
      editRecipe: hasAuthor ? undefined : "Add author property to Article schema",
    };
  },
});

// T1-50: datePublished in ISO 8601
registerCheck({
  id: "T1-50",
  name: "datePublished is ISO 8601",
  tier: 1,
  category: "schema-basics",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Format datePublished as ISO 8601 (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ)",
  run: (ctx: CheckContext): CheckResult => {
    const schemas = parseJsonLd(ctx.$);
    const article = findSchemaByType(schemas, "Article") ?? findSchemaByType(schemas, "BlogPosting");
    if (!article) {
      return { checkId: "T1-50", passed: true, severity: "info", message: "No Article schema found", autoEditable: false };
    }
    const obj = article as Record<string, unknown>;
    const date = obj.datePublished;
    if (!date) {
      return { checkId: "T1-50", passed: false, severity: "medium", message: "datePublished missing", autoEditable: true, editRecipe: "Add datePublished to Article schema" };
    }
    // ISO 8601 pattern
    const iso8601 = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;
    const passed = typeof date === "string" && iso8601.test(date);
    return {
      checkId: "T1-50",
      passed,
      severity: passed ? "info" : "medium",
      message: passed ? "datePublished is valid ISO 8601" : "datePublished is not valid ISO 8601",
      details: { datePublished: date },
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Format datePublished as ISO 8601 (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ)",
    };
  },
  runV2: (ctx: SEODataContext): CheckResult => {
    const articleTypes = ["Article", "BlogPosting"];
    const articleSchema = ctx.data.schemas.find((s) => articleTypes.includes(s.type));
    if (!articleSchema) {
      return { checkId: "T1-50", passed: true, severity: "info", message: "No Article schema found", autoEditable: false };
    }
    const date = articleSchema.raw?.datePublished;
    if (!date) {
      return { checkId: "T1-50", passed: false, severity: "medium", message: "datePublished missing", autoEditable: true, editRecipe: "Add datePublished to Article schema" };
    }
    // ISO 8601 pattern
    const iso8601 = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;
    const passed = typeof date === "string" && iso8601.test(date);
    return {
      checkId: "T1-50",
      passed,
      severity: passed ? "info" : "medium",
      message: passed ? "datePublished is valid ISO 8601" : "datePublished is not valid ISO 8601",
      details: { datePublished: date },
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Format datePublished as ISO 8601 (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ)",
    };
  },
});

// T1-51: dateModified present
registerCheck({
  id: "T1-51",
  name: "dateModified present",
  tier: 1,
  category: "schema-basics",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Add dateModified to Article schema",
  run: (ctx: CheckContext): CheckResult => {
    const schemas = parseJsonLd(ctx.$);
    const article = findSchemaByType(schemas, "Article") ?? findSchemaByType(schemas, "BlogPosting");
    if (!article) {
      return { checkId: "T1-51", passed: true, severity: "info", message: "No Article schema found", autoEditable: false };
    }
    const obj = article as Record<string, unknown>;
    const passed = obj.dateModified !== undefined && obj.dateModified !== null;
    return {
      checkId: "T1-51",
      passed,
      severity: passed ? "info" : "medium",
      message: passed ? "dateModified present in schema" : "dateModified missing from schema",
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Add dateModified to Article schema",
    };
  },
  runV2: (ctx: SEODataContext): CheckResult => {
    const articleTypes = ["Article", "BlogPosting"];
    const articleSchema = ctx.data.schemas.find((s) => articleTypes.includes(s.type));
    if (!articleSchema) {
      return { checkId: "T1-51", passed: true, severity: "info", message: "No Article schema found", autoEditable: false };
    }
    const passed = articleSchema.raw?.dateModified !== undefined && articleSchema.raw?.dateModified !== null;
    return {
      checkId: "T1-51",
      passed,
      severity: passed ? "info" : "medium",
      message: passed ? "dateModified present in schema" : "dateModified missing from schema",
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Add dateModified to Article schema",
    };
  },
});

// T1-52: BreadcrumbList present
registerCheck({
  id: "T1-52",
  name: "BreadcrumbList schema present",
  tier: 1,
  category: "schema-basics",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Add BreadcrumbList schema for +40% CTR in SERPs",
  run: (ctx: CheckContext): CheckResult => {
    const schemas = parseJsonLd(ctx.$);
    const breadcrumb = findSchemaByType(schemas, "BreadcrumbList");
    const passed = breadcrumb !== undefined;
    return {
      checkId: "T1-52",
      passed,
      severity: passed ? "info" : "medium",
      message: passed ? "BreadcrumbList schema found" : "BreadcrumbList schema missing",
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Add BreadcrumbList schema for +40% CTR in SERPs",
    };
  },
  runV2: (ctx: SEODataContext): CheckResult => {
    const passed = ctx.data.schema_types.includes("BreadcrumbList");
    return {
      checkId: "T1-52",
      passed,
      severity: passed ? "info" : "medium",
      message: passed ? "BreadcrumbList schema found" : "BreadcrumbList schema missing",
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Add BreadcrumbList schema for +40% CTR in SERPs",
    };
  },
});

// T1-53: No HowTo schema (deprecated Sep 2023)
registerCheck({
  id: "T1-53",
  name: "No deprecated HowTo schema",
  tier: 1,
  category: "schema-basics",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Remove HowTo schema (deprecated September 2023)",
  run: (ctx: CheckContext): CheckResult => {
    const schemas = parseJsonLd(ctx.$);
    const howTo = findSchemaByType(schemas, "HowTo");
    const passed = howTo === undefined;
    return {
      checkId: "T1-53",
      passed,
      severity: passed ? "info" : "medium",
      message: passed ? "No deprecated HowTo schema" : "HowTo schema found (deprecated Sep 2023)",
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Remove HowTo schema (deprecated September 2023)",
    };
  },
  runV2: (ctx: SEODataContext): CheckResult => {
    const passed = !ctx.data.schema_types.includes("HowTo");
    return {
      checkId: "T1-53",
      passed,
      severity: passed ? "info" : "medium",
      message: passed ? "No deprecated HowTo schema" : "HowTo schema found (deprecated Sep 2023)",
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Remove HowTo schema (deprecated September 2023)",
    };
  },
});

// T1-54: FAQPage only for gov/health
registerCheck({
  id: "T1-54",
  name: "FAQPage schema appropriate use",
  tier: 1,
  category: "schema-basics",
  severity: "medium",
  autoEditable: false,
  run: (ctx: CheckContext): CheckResult => {
    const schemas = parseJsonLd(ctx.$);
    const faq = findSchemaByType(schemas, "FAQPage");
    if (!faq) {
      return { checkId: "T1-54", passed: true, severity: "info", message: "No FAQPage schema found", autoEditable: false };
    }
    // Check if site is gov/health (restricted Aug 2023)
    const url = ctx.url.toLowerCase();
    const isGovHealth = url.includes(".gov") || url.includes("health") || url.includes("medical");
    return {
      checkId: "T1-54",
      passed: isGovHealth,
      severity: isGovHealth ? "info" : "medium",
      message: isGovHealth ? "FAQPage schema on appropriate site" : "FAQPage schema restricted to gov/health sites (Aug 2023)",
      autoEditable: false,
    };
  },
  runV2: (ctx: SEODataContext): CheckResult => {
    const hasFaq = ctx.data.schema_types.includes("FAQPage");
    if (!hasFaq) {
      return { checkId: "T1-54", passed: true, severity: "info", message: "No FAQPage schema found", autoEditable: false };
    }
    // Check if site is gov/health (restricted Aug 2023)
    const url = ctx.url.toLowerCase();
    const isGovHealth = url.includes(".gov") || url.includes("health") || url.includes("medical");
    return {
      checkId: "T1-54",
      passed: isGovHealth,
      severity: isGovHealth ? "info" : "medium",
      message: isGovHealth ? "FAQPage schema on appropriate site" : "FAQPage schema restricted to gov/health sites (Aug 2023)",
      autoEditable: false,
    };
  },
});
