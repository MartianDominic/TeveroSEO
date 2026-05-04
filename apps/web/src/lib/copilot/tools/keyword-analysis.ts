/**
 * CopilotKit Tool: Keyword Analysis
 * Phase 82: Chat Integration
 *
 * Defines the analyze_keywords tool for CopilotKit.
 * This tool is registered via useCopilotAction in the KeywordAnalysisChat component.
 */

import type { AnalysisConfig, AnalysisResult } from "@/lib/keyword-chat/types";

/**
 * Tool parameters schema for CopilotKit.
 */
export interface AnalyzeKeywordsParams {
  conversation: string;
  keywords: string[];
  targetCount?: number;
  cascadePreset?: "default" | "service" | "ecommerce" | "content";
  enablePSEODetection?: boolean;
  enableSideKeywords?: boolean;
}

/**
 * Tool definition for useCopilotAction.
 *
 * Usage in component:
 * ```tsx
 * import { useCopilotAction } from "@copilotkit/react-core";
 * import { analyzeKeywordsToolConfig } from "@/lib/copilot/tools/keyword-analysis";
 *
 * useCopilotAction({
 *   ...analyzeKeywordsToolConfig,
 *   handler: async (params) => {
 *     // Call your analysis function
 *     return await runAnalysis(params);
 *   },
 * });
 * ```
 */
export const analyzeKeywordsToolConfig = {
  name: "analyze_keywords",
  description:
    "Analyze keywords based on client conversation and constraints. " +
    "Extract business context, classify by funnel stage, filter by geographic and audience constraints, " +
    "and select the most relevant keywords for SEO.",
  parameters: [
    {
      name: "conversation",
      type: "string" as const,
      description:
        "Client conversation text describing their business, location, target audience, and needs.",
      required: true,
    },
    {
      name: "keywords",
      type: "string[]" as const,
      description: "Array of keywords to analyze (max 10,000).",
      required: true,
    },
    {
      name: "targetCount",
      type: "number" as const,
      description: "Target number of keywords to select (default: 100).",
      required: false,
    },
    {
      name: "cascadePreset",
      type: "string" as const,
      description:
        "Cascade selection preset: 'default', 'service', 'ecommerce', or 'content'.",
      required: false,
    },
    {
      name: "enablePSEODetection",
      type: "boolean" as const,
      description:
        "Whether to detect programmatic SEO opportunities (default: true).",
      required: false,
    },
    {
      name: "enableSideKeywords",
      type: "boolean" as const,
      description: "Whether to discover side keywords (default: true).",
      required: false,
    },
  ],
};

/**
 * Convert tool parameters to AnalysisConfig.
 */
export function toAnalysisConfig(params: AnalyzeKeywordsParams): AnalysisConfig {
  return {
    targetCount: params.targetCount,
    cascadePreset: params.cascadePreset,
    enablePSEODetection: params.enablePSEODetection,
    enableSideKeywords: params.enableSideKeywords,
  };
}

/**
 * Format analysis result for display in chat.
 */
export function formatResultForChat(result: AnalysisResult): string {
  const { stats, selection, pseoOpportunities, constraints } = result;

  const lines = [
    "## Analysis Complete",
    "",
    `**Keywords Analyzed:** ${stats.totalKeywords}`,
    `**Keywords Selected:** ${stats.selectedCount}`,
    `**Keywords Excluded:** ${stats.excludedCount}`,
    "",
    "### Funnel Breakdown",
    `- BOFU: ${selection.breakdown.byStage.bofu}`,
    `- MOFU: ${selection.breakdown.byStage.mofu}`,
    `- TOFU: ${selection.breakdown.byStage.tofu}`,
    "",
    "### Constraints Extracted",
    `- Business Type: ${constraints.businessType}`,
    `- Core Offering: ${constraints.coreOffering}`,
    `- Audience: ${constraints.audienceType}`,
    `- Geo Scope: ${constraints.geoConstraints.scope}`,
  ];

  if (pseoOpportunities.length > 0) {
    lines.push(
      "",
      `### pSEO Opportunities: ${pseoOpportunities.length} clusters`,
      ...pseoOpportunities
        .slice(0, 3)
        .map(
          (o) => `- ${o.pattern}: ${o.estimatedPages} pages, ${o.totalVolume} vol`
        )
    );
  }

  lines.push("", "Use the export buttons to download results as CSV.");

  return lines.join("\n");
}
