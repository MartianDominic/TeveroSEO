/**
 * ProposalAIGenerationService - AI content generation for proposal sections.
 * Phase 57-07: AI Content Generation
 *
 * Generates personalized proposal section content using Claude API.
 * Supports multiple sections with context-aware prompts and tone adaptation.
 *
 * Features:
 * - Section-specific prompt templates (hero, current_state, opportunities, roi)
 * - Context injection (audit, keywords, prospect, competitor)
 * - Tone presets (professional, friendly, technical, urgent)
 * - Locale-aware generation (EN/LT)
 * - Confidence scoring
 * - Variable extraction
 */
import Anthropic from "@anthropic-ai/sdk";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { proposals, type ProposalContent } from "@/db/proposal-schema";
import { prospects, prospectAnalyses } from "@/db/prospect-schema";
import { createLogger } from "@/server/lib/logger";
import { withRetry } from "@/server/lib/retry";

const log = createLogger({ module: "ProposalAIGenerationService" });

/**
 * Section types that can be AI-generated.
 */
export type GeneratableSectionType =
  | "hero"
  | "current_state"
  | "opportunities"
  | "roi";

/**
 * Context types for generation.
 */
export type ContextType = "audit" | "keywords" | "prospect" | "competitor";

/**
 * Tone presets.
 */
export type TonePreset = "professional" | "friendly" | "technical" | "urgent";

/**
 * Language options.
 */
export type GenerationLanguage = "en" | "lt";

/**
 * Generated content for a single section.
 */
export interface GeneratedContent {
  sectionType: GeneratableSectionType;
  content: string;
  language: GenerationLanguage;
  confidence: number;
  suggestedVariables: string[];
  generatedAt: string;
}

/**
 * Generation request input.
 */
export interface GenerationInput {
  proposalId: string;
  sections: GeneratableSectionType[];
  context: ContextType[];
  tone: TonePreset;
  language: GenerationLanguage;
}

/**
 * Generation result.
 */
export interface GenerationResult {
  success: boolean;
  generated: GeneratedContent[];
  errors: Array<{
    sectionType: GeneratableSectionType;
    message: string;
  }>;
  versionId?: string;
}

/**
 * Context data loaded for generation.
 */
interface GenerationContext {
  proposal: typeof proposals.$inferSelect | null;
  prospect: {
    companyName: string | null;
    domain: string;
    industry: string | null;
    contactName: string | null;
  } | null;
  analysis: {
    organicTraffic?: number;
    organicKeywords?: number;
    competitorDomains?: string[];
    keywordGaps?: Array<{
      keyword: string;
      searchVolume: number;
      difficulty: number;
    }>;
    domainMetrics?: {
      organicTraffic?: number;
      organicKeywords?: number;
      domainAuthority?: number;
    };
    auditScore?: number;
    issuesSummary?: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
  } | null;
}

/**
 * Tone instruction mapping.
 */
const TONE_INSTRUCTIONS: Record<TonePreset, string> = {
  professional: `
Write in a professional, consultative tone. Focus on ROI and business value.
Use formal language, back claims with data, and maintain authority.
Avoid casual phrases. Use "you" (formal) instead of informal alternatives.
`,
  friendly: `
Write in a warm, approachable tone. Be conversational and supportive.
Use friendly language while maintaining professionalism.
Show enthusiasm about helping the client succeed.
`,
  technical: `
Write in a data-driven, technical tone. Be specific with metrics and analysis.
Include detailed explanations and technical terminology where appropriate.
Focus on methodology and measurable outcomes.
`,
  urgent: `
Write with urgency and a clear call to action. Emphasize time-sensitivity.
Use compelling language about competitive advantage and opportunity cost.
Create a sense of scarcity without being pushy.
`,
};

/**
 * Section-specific prompt templates.
 */
const SECTION_PROMPTS: Record<GeneratableSectionType, (ctx: GenerationContext, tone: string, lang: GenerationLanguage) => string> = {
  hero: (ctx, tone, lang) => `
<task>
Generate a personalized hero/introduction section for an SEO proposal.
</task>

<context>
Company: ${ctx.prospect?.companyName || ctx.prospect?.domain || "Client"}
Domain: ${ctx.prospect?.domain || "unknown"}
Industry: ${ctx.prospect?.industry || "not specified"}
${ctx.analysis?.organicTraffic ? `Current monthly traffic: ${ctx.analysis.organicTraffic}` : ""}
${ctx.analysis?.keywordGaps?.length ? `Quick win opportunities: ${ctx.analysis.keywordGaps.filter(k => k.difficulty < 50).length}` : ""}
${ctx.analysis?.auditScore !== undefined ? `Audit score: ${ctx.analysis.auditScore}/100` : ""}
</context>

<tone>
${tone}
</tone>

<requirements>
- Create a compelling headline (max 15 words)
- Write a personalized subheadline (max 30 words)
- Include one key metric or opportunity number
- Language: ${lang === "lt" ? "Lithuanian (formal business, use 'Jus' not 'tu')" : "English"}
- Output as JSON with fields: headline, subheadline, highlightMetric
</requirements>

<output-format>
{
  "headline": "...",
  "subheadline": "...",
  "highlightMetric": { "value": "...", "label": "..." }
}
</output-format>
`,

  current_state: (ctx, tone, lang) => `
<task>
Generate a current state analysis section for an SEO proposal.
</task>

<context>
Company: ${ctx.prospect?.companyName || "Client"}
Domain: ${ctx.prospect?.domain || "unknown"}
${ctx.analysis?.domainMetrics ? `
Domain metrics:
- Organic traffic: ${ctx.analysis.domainMetrics.organicTraffic || "N/A"}
- Organic keywords: ${ctx.analysis.domainMetrics.organicKeywords || "N/A"}
- Domain authority: ${ctx.analysis.domainMetrics.domainAuthority || "N/A"}
` : ""}
${ctx.analysis?.auditScore !== undefined ? `SEO audit score: ${ctx.analysis.auditScore}/100` : ""}
${ctx.analysis?.issuesSummary ? `
Issues found:
- Critical: ${ctx.analysis.issuesSummary.critical}
- High: ${ctx.analysis.issuesSummary.high}
- Medium: ${ctx.analysis.issuesSummary.medium}
- Low: ${ctx.analysis.issuesSummary.low}
` : ""}
</context>

<tone>
${tone}
</tone>

<requirements>
- Summarize current SEO health objectively (not judgmentally)
- Highlight 2-3 key findings from the audit
- Include specific numbers where available
- Be respectful of their current efforts
- Language: ${lang === "lt" ? "Lithuanian (formal business)" : "English"}
- Output as JSON with fields: summary, keyFindings (array), metrics (array)
</requirements>

<output-format>
{
  "summary": "...",
  "keyFindings": ["finding 1", "finding 2", "finding 3"],
  "metrics": [
    { "label": "...", "value": "...", "status": "good|warning|critical" }
  ]
}
</output-format>
`,

  opportunities: (ctx, tone, lang) => `
<task>
Generate an opportunities section for an SEO proposal.
</task>

<context>
Company: ${ctx.prospect?.companyName || "Client"}
Domain: ${ctx.prospect?.domain || "unknown"}
${ctx.analysis?.keywordGaps?.length ? `
Top keyword opportunities:
${ctx.analysis.keywordGaps.slice(0, 10).map(k =>
  `- "${k.keyword}" (volume: ${k.searchVolume}, difficulty: ${k.difficulty})`
).join("\n")}
` : "No keyword data available"}
${ctx.analysis?.competitorDomains?.length ? `
Competitors analyzed: ${ctx.analysis.competitorDomains.join(", ")}
` : ""}
</context>

<tone>
${tone}
</tone>

<requirements>
- Present 3-5 key opportunities with potential impact
- Group by difficulty: quick wins, medium-term, long-term
- Include estimated traffic/value where possible
- Make opportunities feel achievable, not miraculous
- Language: ${lang === "lt" ? "Lithuanian (formal business)" : "English"}
- Output as JSON with fields: intro, quickWins, mediumTerm, longTerm
</requirements>

<output-format>
{
  "intro": "...",
  "quickWins": [
    { "title": "...", "description": "...", "impact": "..." }
  ],
  "mediumTerm": [
    { "title": "...", "description": "...", "impact": "..." }
  ],
  "longTerm": [
    { "title": "...", "description": "...", "impact": "..." }
  ]
}
</output-format>
`,

  roi: (ctx, tone, lang) => `
<task>
Generate ROI projections section for an SEO proposal.
</task>

<context>
Company: ${ctx.prospect?.companyName || "Client"}
Domain: ${ctx.prospect?.domain || "unknown"}
Industry: ${ctx.prospect?.industry || "not specified"}
${ctx.analysis?.organicTraffic ? `Current monthly traffic: ${ctx.analysis.organicTraffic}` : ""}
${ctx.analysis?.keywordGaps?.length ? `
Opportunity traffic potential: ${ctx.analysis.keywordGaps.reduce((sum, k) => sum + k.searchVolume, 0)} monthly searches
Quick wins (low difficulty): ${ctx.analysis.keywordGaps.filter(k => k.difficulty < 50).length} keywords
` : ""}
${ctx.proposal?.monthlyFeeCents ? `Monthly investment: EUR ${ctx.proposal.monthlyFeeCents / 100}` : ""}
${ctx.proposal?.setupFeeCents ? `Setup fee: EUR ${ctx.proposal.setupFeeCents / 100}` : ""}
</context>

<tone>
${tone}
</tone>

<requirements>
- Project realistic traffic growth over 6-12 months
- Calculate estimated revenue using conservative assumptions
- Compare investment vs. potential return
- Include assumptions transparently
- Avoid overpromising - use ranges where appropriate
- Language: ${lang === "lt" ? "Lithuanian (formal business)" : "English"}
- Output as JSON with fields: projections, assumptions, comparison, summary
</requirements>

<output-format>
{
  "projections": {
    "month3": { "traffic": "...", "value": "..." },
    "month6": { "traffic": "...", "value": "..." },
    "month12": { "traffic": "...", "value": "..." }
  },
  "assumptions": ["assumption 1", "assumption 2"],
  "comparison": {
    "investment": "...",
    "potentialReturn": "...",
    "roi": "..."
  },
  "summary": "..."
}
</output-format>
`,
};

/**
 * Zod schema for validating LLM response.
 */
const LLMResponseSchema = z.object({
  type: z.literal("text"),
  text: z.string().min(1),
});

/**
 * ProposalAIGenerationService class.
 */
export class ProposalAIGenerationService {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic();
  }

  /**
   * Load context data for generation.
   */
  async loadContext(proposalId: string): Promise<GenerationContext> {
    // Load proposal
    const [proposal] = await db
      .select()
      .from(proposals)
      .where(eq(proposals.id, proposalId))
      .limit(1);

    if (!proposal) {
      return { proposal: null, prospect: null, analysis: null };
    }

    // Load prospect
    let prospect: GenerationContext["prospect"] = null;
    if (proposal.prospectId) {
      const [prospectRow] = await db
        .select({
          companyName: prospects.companyName,
          domain: prospects.domain,
          industry: prospects.industry,
          contactName: prospects.contactName,
        })
        .from(prospects)
        .where(eq(prospects.id, proposal.prospectId))
        .limit(1);

      prospect = prospectRow ?? null;
    }

    // Load analysis
    let analysis: GenerationContext["analysis"] = null;
    if (proposal.prospectId) {
      const [analysisRow] = await db
        .select({
          domainMetrics: prospectAnalyses.domainMetrics,
          keywordGaps: prospectAnalyses.keywordGaps,
          competitorDomains: prospectAnalyses.competitorDomains,
        })
        .from(prospectAnalyses)
        .where(eq(prospectAnalyses.prospectId, proposal.prospectId))
        .orderBy(desc(prospectAnalyses.createdAt))
        .limit(1);

      if (analysisRow) {
        analysis = {
          domainMetrics: analysisRow.domainMetrics ?? undefined,
          keywordGaps: analysisRow.keywordGaps ?? undefined,
          competitorDomains: analysisRow.competitorDomains ?? undefined,
        };
      }
    }

    return { proposal, prospect, analysis };
  }

  /**
   * Generate content for a single section.
   */
  async generateSection(
    sectionType: GeneratableSectionType,
    context: GenerationContext,
    tone: TonePreset,
    language: GenerationLanguage
  ): Promise<GeneratedContent> {
    const toneInstructions = TONE_INSTRUCTIONS[tone];
    const promptBuilder = SECTION_PROMPTS[sectionType];

    if (!promptBuilder) {
      throw new Error(`Unknown section type: ${sectionType}`);
    }

    const prompt = promptBuilder(context, toneInstructions, language);

    log.info("Generating section content", {
      sectionType,
      tone,
      language,
      domain: context.prospect?.domain,
    });

    const response = await withRetry(
      () =>
        this.anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          messages: [{ role: "user", content: prompt }],
        }),
      { maxRetries: 3, baseDelayMs: 1000 }
    );

    // Validate response
    if (!response.content || response.content.length === 0) {
      throw new Error("Empty response from Claude API");
    }

    const content = response.content[0];
    const validation = LLMResponseSchema.safeParse(content);

    if (!validation.success) {
      throw new Error(`Invalid LLM response: ${validation.error.message}`);
    }

    let generatedText = validation.data.text;

    // Try to extract JSON content
    const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      generatedText = jsonMatch[0];
    }

    // Extract suggested variables (patterns like {{variable.key}})
    const variableMatches = generatedText.match(/\{\{[^}]+\}\}/g) || [];
    const suggestedVariables = [...new Set(variableMatches.map((m) => m.slice(2, -2)))];

    // Calculate confidence based on content quality signals
    const confidence = this.calculateConfidence(generatedText, sectionType);

    log.info("Section generated", {
      sectionType,
      language,
      contentLength: generatedText.length,
      confidence,
      variablesFound: suggestedVariables.length,
    });

    return {
      sectionType,
      content: generatedText,
      language,
      confidence,
      suggestedVariables,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Calculate confidence score for generated content.
   */
  private calculateConfidence(content: string, sectionType: GeneratableSectionType): number {
    let score = 0.5; // Base score

    // Check for valid JSON structure
    try {
      JSON.parse(content);
      score += 0.2;
    } catch {
      // Not valid JSON, reduce confidence
      score -= 0.1;
    }

    // Check for reasonable length
    const minLength: Record<GeneratableSectionType, number> = {
      hero: 100,
      current_state: 200,
      opportunities: 300,
      roi: 300,
    };

    if (content.length >= minLength[sectionType]) {
      score += 0.15;
    }

    // Check for numbers (data-driven content)
    const hasNumbers = /\d+/.test(content);
    if (hasNumbers) {
      score += 0.1;
    }

    // Check for structured fields
    const hasStructure = /["'](?:headline|summary|projections|quickWins)["']/.test(content);
    if (hasStructure) {
      score += 0.05;
    }

    return Math.min(1, Math.max(0, score));
  }

  /**
   * Generate content for multiple sections.
   */
  async generateContent(input: GenerationInput): Promise<GenerationResult> {
    log.info("Starting content generation", {
      proposalId: input.proposalId,
      sections: input.sections,
      context: input.context,
      tone: input.tone,
      language: input.language,
    });

    // Load context
    const context = await this.loadContext(input.proposalId);

    if (!context.proposal) {
      return {
        success: false,
        generated: [],
        errors: [{ sectionType: input.sections[0], message: "Proposal not found" }],
      };
    }

    const generated: GeneratedContent[] = [];
    const errors: Array<{ sectionType: GeneratableSectionType; message: string }> = [];

    // Generate each section
    for (const sectionType of input.sections) {
      try {
        const content = await this.generateSection(
          sectionType,
          context,
          input.tone,
          input.language
        );
        generated.push(content);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        log.error(
          "Failed to generate section",
          error instanceof Error ? error : new Error(String(error)),
          { sectionType, proposalId: input.proposalId }
        );
        errors.push({ sectionType, message });
      }
    }

    log.info("Content generation complete", {
      proposalId: input.proposalId,
      generatedCount: generated.length,
      errorCount: errors.length,
    });

    return {
      success: errors.length === 0,
      generated,
      errors,
    };
  }
}

// Lazy singleton
let _instance: ProposalAIGenerationService | null = null;

export function getProposalAIGenerationService(): ProposalAIGenerationService {
  if (!_instance) {
    _instance = new ProposalAIGenerationService();
  }
  return _instance;
}

// Export convenience wrapper
export const proposalAIGenerationService = {
  loadContext: (proposalId: string) =>
    getProposalAIGenerationService().loadContext(proposalId),
  generateContent: (input: GenerationInput) =>
    getProposalAIGenerationService().generateContent(input),
  generateSection: (
    sectionType: GeneratableSectionType,
    context: GenerationContext,
    tone: TonePreset,
    language: GenerationLanguage
  ) =>
    getProposalAIGenerationService().generateSection(
      sectionType,
      context,
      tone,
      language
    ),
};

// Re-export types for consumers
export type { GenerationContext };

export default ProposalAIGenerationService;
