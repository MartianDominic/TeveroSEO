/**
 * Translation Length Analysis Script
 *
 * Analyzes translation files to identify strings where Lithuanian (LT) translations
 * are significantly longer than English (EN), which may cause UI overflow issues.
 *
 * Usage: pnpm tsx scripts/analyze-translation-lengths.ts apps/web/messages/en.json apps/web/messages/lt.json
 */

import * as fs from "fs";
import * as path from "path";

type RiskLevel = "low" | "medium" | "high";

interface LengthReport {
  key: string;
  enLength: number;
  ltLength: number;
  ratio: number;
  risk: RiskLevel;
  enValue: string;
  ltValue: string;
}

interface AnalysisSummary {
  totalStrings: number;
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
  averageRatio: number;
  maxRatio: number;
}

type TranslationObject = { [key: string]: string | TranslationObject };

/**
 * Flatten nested object into dot-notation keys
 */
function flattenObject(
  obj: TranslationObject,
  prefix = ""
): Map<string, string> {
  const result = new Map<string, string>();

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === "string") {
      result.set(fullKey, value);
    } else if (typeof value === "object" && value !== null) {
      const nested = flattenObject(value as TranslationObject, fullKey);
      for (const [k, v] of nested) {
        result.set(k, v);
      }
    }
  }

  return result;
}

/**
 * Calculate risk level based on length ratio
 */
function calculateRisk(ratio: number): RiskLevel {
  if (ratio > 1.5) return "high";
  if (ratio > 1.3) return "medium";
  return "low";
}

/**
 * Analyze translations and return length reports
 */
function analyzeTranslations(
  enPath: string,
  ltPath: string
): { reports: LengthReport[]; summary: AnalysisSummary } {
  const enContent = JSON.parse(fs.readFileSync(enPath, "utf-8"));
  const ltContent = JSON.parse(fs.readFileSync(ltPath, "utf-8"));

  const enStrings = flattenObject(enContent);
  const ltStrings = flattenObject(ltContent);

  const reports: LengthReport[] = [];
  let totalRatio = 0;
  let maxRatio = 0;

  for (const [key, enValue] of enStrings) {
    const ltValue = ltStrings.get(key);

    if (!ltValue) continue;

    const enLength = enValue.length;
    const ltLength = ltValue.length;

    // Skip empty strings or pluralization patterns
    if (enLength === 0 || enValue.includes("{count, plural")) continue;

    const ratio = ltLength / enLength;
    const risk = calculateRisk(ratio);

    reports.push({
      key,
      enLength,
      ltLength,
      ratio,
      risk,
      enValue,
      ltValue,
    });

    totalRatio += ratio;
    maxRatio = Math.max(maxRatio, ratio);
  }

  // Sort by ratio descending
  reports.sort((a, b) => b.ratio - a.ratio);

  const summary: AnalysisSummary = {
    totalStrings: reports.length,
    highRisk: reports.filter((r) => r.risk === "high").length,
    mediumRisk: reports.filter((r) => r.risk === "medium").length,
    lowRisk: reports.filter((r) => r.risk === "low").length,
    averageRatio: reports.length > 0 ? totalRatio / reports.length : 0,
    maxRatio,
  };

  return { reports, summary };
}

/**
 * Format report for console output
 */
function formatReport(
  reports: LengthReport[],
  summary: AnalysisSummary
): string {
  const lines: string[] = [];

  lines.push("=".repeat(80));
  lines.push("TRANSLATION LENGTH ANALYSIS");
  lines.push("=".repeat(80));
  lines.push("");

  // High risk section
  const highRisk = reports.filter((r) => r.risk === "high");
  if (highRisk.length > 0) {
    lines.push("HIGH RISK (>50% longer) - May cause UI overflow");
    lines.push("-".repeat(80));
    for (const r of highRisk) {
      lines.push(`  ${r.key}`);
      lines.push(`    EN (${r.enLength} chars): "${r.enValue}"`);
      lines.push(`    LT (${r.ltLength} chars): "${r.ltValue}"`);
      lines.push(`    Ratio: ${r.ratio.toFixed(2)}x`);
      lines.push("");
    }
  }

  // Medium risk section
  const mediumRisk = reports.filter((r) => r.risk === "medium");
  if (mediumRisk.length > 0) {
    lines.push("MEDIUM RISK (30-50% longer) - Monitor for issues");
    lines.push("-".repeat(80));
    for (const r of mediumRisk) {
      lines.push(`  ${r.key}`);
      lines.push(`    EN: "${r.enValue}" (${r.enLength})`);
      lines.push(`    LT: "${r.ltValue}" (${r.ltLength})`);
      lines.push(`    Ratio: ${r.ratio.toFixed(2)}x`);
      lines.push("");
    }
  }

  // Summary
  lines.push("=".repeat(80));
  lines.push("SUMMARY");
  lines.push("=".repeat(80));
  lines.push(`Total strings analyzed: ${summary.totalStrings}`);
  lines.push(`High risk (>1.5x):      ${summary.highRisk}`);
  lines.push(`Medium risk (1.3-1.5x): ${summary.mediumRisk}`);
  lines.push(`Low risk (<=1.3x):      ${summary.lowRisk}`);
  lines.push(`Average ratio:          ${summary.averageRatio.toFixed(2)}x`);
  lines.push(`Maximum ratio:          ${summary.maxRatio.toFixed(2)}x`);
  lines.push("");

  // Categorized recommendations
  lines.push("=".repeat(80));
  lines.push("RECOMMENDATIONS BY CATEGORY");
  lines.push("=".repeat(80));

  const navItems = highRisk.filter((r) => r.key.startsWith("nav."));
  const buttonItems = highRisk.filter(
    (r) =>
      r.key.includes("create") ||
      r.key.includes("send") ||
      r.key.includes("generate") ||
      r.key.includes("add")
  );
  const tableHeaders = highRisk.filter(
    (r) => r.key.includes("fields.") || r.key.includes("stats.")
  );
  const cardTitles = highRisk.filter(
    (r) => r.key.includes("title") || r.key.includes("Title")
  );

  if (navItems.length > 0) {
    lines.push("\nNavigation items at risk:");
    for (const r of navItems) {
      lines.push(
        `  - ${r.key}: "${r.enValue}" -> "${r.ltValue}" (${r.ratio.toFixed(2)}x)`
      );
    }
  }

  if (buttonItems.length > 0) {
    lines.push("\nButton labels at risk:");
    for (const r of buttonItems) {
      lines.push(
        `  - ${r.key}: "${r.enValue}" -> "${r.ltValue}" (${r.ratio.toFixed(2)}x)`
      );
    }
  }

  if (tableHeaders.length > 0) {
    lines.push("\nTable headers at risk:");
    for (const r of tableHeaders) {
      lines.push(
        `  - ${r.key}: "${r.enValue}" -> "${r.ltValue}" (${r.ratio.toFixed(2)}x)`
      );
    }
  }

  if (cardTitles.length > 0) {
    lines.push("\nCard titles at risk:");
    for (const r of cardTitles) {
      lines.push(
        `  - ${r.key}: "${r.enValue}" -> "${r.ltValue}" (${r.ratio.toFixed(2)}x)`
      );
    }
  }

  return lines.join("\n");
}

// Main execution
function main(): void {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error(
      "Usage: tsx scripts/analyze-translation-lengths.ts <en.json> <lt.json>"
    );
    process.exit(1);
  }

  const [enPath, ltPath] = args;

  if (!fs.existsSync(enPath)) {
    console.error(`English translation file not found: ${enPath}`);
    process.exit(1);
  }

  if (!fs.existsSync(ltPath)) {
    console.error(`Lithuanian translation file not found: ${ltPath}`);
    process.exit(1);
  }

  const { reports, summary } = analyzeTranslations(enPath, ltPath);
  const output = formatReport(reports, summary);

  console.log(output);

  // Also save to file for reference
  const outputPath = path.resolve(
    __dirname,
    "../.planning/phases/55-platform-i18n/length-analysis.txt"
  );
  const outputDir = path.dirname(outputPath);

  if (fs.existsSync(outputDir)) {
    fs.writeFileSync(outputPath, output, "utf-8");
    console.log(`\nReport saved to: ${outputPath}`);
  }
}

main();
