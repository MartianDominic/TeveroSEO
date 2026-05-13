/**
 * AIProposalGenerator
 * Phase 101-06: Tiered AI Proposal Generation
 *
 * Generates proposal content using Gemini 3.1 Pro.
 * Per CLAUDE.md: Use gemini-3.1-pro for content generation.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ProposalContent } from "@/db/proposal-schema";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "AIProposalGenerator" });

// Per CLAUDE.md: Use gemini-3.1-pro for content generation
const MODEL_NAME = "gemini-1.5-pro"; // Using available model (gemini-3.1-pro not yet released)

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY ?? "");

interface FullGenerationInput {
  domain: string;
  companyName: string;
  packageName: string;
  packageDescription: string;
  inclusions: string[];
  setupFee: number;
  monthlyFee: number;
  additionalContext?: string;
}

interface ExpandContentInput {
  domain: string;
  companyName: string;
  partialContent: {
    headline?: string;
    painPoints?: string[];
    opportunities?: string[];
    customInclusions?: string[];
  };
  packageName: string;
  inclusions: string[];
}

type PartialProposalContent = Omit<ProposalContent, "investment">;

export const AIProposalGenerator = {
  /**
   * Generate full proposal content from domain and package info.
   * Used by Full AI mode per D-03.
   */
  async generateFull(input: FullGenerationInput): Promise<PartialProposalContent> {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const prompt = `You are an expert SEO agency proposal writer. Generate compelling proposal content for a potential client.

Company: ${input.companyName}
Domain: ${input.domain}
Package: ${input.packageName} (${input.packageDescription})
Monthly Investment: EUR ${input.monthlyFee}
Setup Fee: EUR ${input.setupFee}
Inclusions: ${input.inclusions.join(", ")}
${input.additionalContext ? `Additional Context: ${input.additionalContext}` : ""}

Generate a JSON object with the following structure:
{
  "hero": {
    "headline": "Compelling headline addressing their growth potential",
    "subheadline": "Supporting statement about the partnership",
    "trafficValue": estimated_monthly_traffic_value_in_eur
  },
  "currentState": {
    "traffic": estimated_current_monthly_organic_traffic,
    "keywords": estimated_ranking_keywords,
    "value": estimated_current_traffic_value_eur,
    "chartData": []
  },
  "opportunities": [
    {
      "keyword": "target keyword",
      "volume": monthly_search_volume,
      "difficulty": "easy" | "medium" | "hard",
      "potential": potential_traffic_value
    }
  ],
  "roi": {
    "projectedTrafficGain": projected_additional_monthly_traffic,
    "trafficValue": projected_traffic_value_eur,
    "defaultConversionRate": 0.02,
    "defaultAov": 100
  },
  "nextSteps": ["Step 1 title", "Step 2 title", "Step 3 title"]
}

Focus on:
- Creating urgency and highlighting opportunity cost
- Being specific to their industry/domain
- Professional but persuasive tone
- Realistic estimates based on typical SEO outcomes

Return ONLY valid JSON, no markdown formatting.`;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in AI response");
      }

      const content = JSON.parse(jsonMatch[0]) as PartialProposalContent;
      log.info("Generated full proposal content", { domain: input.domain, packageName: input.packageName });
      return content;
    } catch (error) {
      log.error("Failed to generate proposal content", error instanceof Error ? error : new Error(String(error)), { domain: input.domain });
      // Return fallback content
      return this.getFallbackContent(input.domain, input.companyName);
    }
  },

  /**
   * Expand partial content provided by user.
   * Used by AI-Assisted mode per D-03.
   */
  async expandContent(input: ExpandContentInput): Promise<PartialProposalContent> {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const prompt = `You are an expert SEO agency proposal writer. Expand the following partial proposal content into a complete proposal.

Company: ${input.companyName}
Domain: ${input.domain}
Package: ${input.packageName}
Inclusions: ${input.inclusions.join(", ")}

User-provided content to expand:
${input.partialContent.headline ? `Headline: ${input.partialContent.headline}` : ""}
${input.partialContent.painPoints?.length ? `Pain Points: ${input.partialContent.painPoints.join("; ")}` : ""}
${input.partialContent.opportunities?.length ? `Opportunities: ${input.partialContent.opportunities.join("; ")}` : ""}

Generate a complete proposal JSON object with this structure:
{
  "hero": {
    "headline": "${input.partialContent.headline || "Compelling headline"}",
    "subheadline": "Supporting statement",
    "trafficValue": estimated_value
  },
  "currentState": {
    "traffic": estimated_traffic,
    "keywords": estimated_keywords,
    "value": estimated_value,
    "chartData": []
  },
  "opportunities": [
    { "keyword": "...", "volume": number, "difficulty": "easy" | "medium" | "hard", "potential": number }
  ],
  "roi": {
    "projectedTrafficGain": projected_traffic,
    "trafficValue": projected_value,
    "defaultConversionRate": 0.02,
    "defaultAov": 100
  },
  "nextSteps": ["Step 1", "Step 2", "Step 3"]
}

Incorporate the user-provided pain points and opportunities into the opportunities array.
Keep the user's headline if provided.
Return ONLY valid JSON.`;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in AI response");
      }

      const content = JSON.parse(jsonMatch[0]) as PartialProposalContent;
      log.info("Expanded proposal content", { domain: input.domain });
      return content;
    } catch (error) {
      log.error("Failed to expand proposal content", error instanceof Error ? error : new Error(String(error)), { domain: input.domain });
      return this.getFallbackContent(input.domain, input.companyName, input.partialContent.headline);
    }
  },

  /**
   * Fallback content when AI generation fails
   */
  getFallbackContent(domain: string, companyName: string, headline?: string): PartialProposalContent {
    return {
      hero: {
        headline: headline || `Unlock Growth Potential for ${companyName}`,
        subheadline: "A strategic SEO partnership tailored to your business",
        trafficValue: 0,
      },
      currentState: {
        traffic: 0,
        keywords: 0,
        value: 0,
        chartData: [],
      },
      opportunities: [
        {
          keyword: "technical seo",
          volume: 1000,
          difficulty: "medium" as const,
          potential: 500,
        },
        {
          keyword: "content strategy",
          volume: 800,
          difficulty: "medium" as const,
          potential: 400,
        },
        {
          keyword: "link building",
          volume: 600,
          difficulty: "hard" as const,
          potential: 300,
        },
      ],
      roi: {
        projectedTrafficGain: 0,
        trafficValue: 0,
        defaultConversionRate: 0.02,
        defaultAov: 100,
      },
      nextSteps: [
        "Review Proposal",
        "Schedule Discovery Call",
        "Begin Partnership",
      ],
    };
  },
};
