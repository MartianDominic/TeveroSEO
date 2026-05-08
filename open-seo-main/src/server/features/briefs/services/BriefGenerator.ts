/**
 * Brief generator service for creating content briefs from SERP analysis.
 * Phase 36: Content Brief Generation
 * Phase 37-04: Voice constraints integration
 * BRIEF-01: CorrelationId propagation for distributed tracing
 */

import { db } from "@/db";
import { keywordPageMapping } from "@/db/mapping-schema";
import type { KeywordPageMappingSelect } from "@/db/mapping-schema";
import type {
  SerpAnalysisData,
  ContentBriefSelect,
  VoiceMode,
} from "@/db/brief-schema";
import { eq } from "drizzle-orm";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";
import { analyzeSerpForKeyword, type SerpAnalysisResult } from "./SerpAnalyzer";
import type { BriefRepository } from "./BriefRepository";
import { voiceProfileService } from "@/server/features/voice/services/VoiceProfileService";
import { buildVoiceConstraints } from "@/server/features/voice/services/VoiceConstraintBuilder";
import { voiceComplianceService, type ComplianceScore } from "@/server/features/voice/services/VoiceComplianceService";

const log = createLogger({ module: "BriefGenerator" });

/**
 * Generate a unique correlation ID for tracing requests across services.
 * Format: brief-{timestamp}-{random}
 */
export function generateCorrelationId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `brief-${timestamp}-${random}`;
}

export interface BriefGeneratorInput {
  mappingId: string;
  voiceMode: VoiceMode;
  locationCode?: number;
  /** Client ID for voice profile lookup and cache isolation (required) */
  clientId: string;
  /** Blend ratio with template (0.0 = pure client, 1.0 = pure template) */
  templateBlend?: number;
  /** Template ID for blending */
  templateId?: string;
  /** Correlation ID for distributed tracing (auto-generated if not provided) */
  correlationId?: string;
}

export interface GeneratedBrief {
  brief: ContentBriefSelect;
  suggestedH2s: string[];
  paaQuestions: string[];
  competitorAvgWordCount: number;
  /** Voice constraints for AI prompt injection */
  voiceConstraints?: string;
}

export interface GeneratedBriefWithCompliance extends GeneratedBrief {
  /** Compliance score if voice profile exists */
  compliance?: ComplianceScore;
}

/**
 * Validate that a keyword mapping exists.
 * @throws AppError NOT_FOUND if mapping doesn't exist
 */
export async function validateMapping(
  mappingId: string,
  correlationId?: string
): Promise<KeywordPageMappingSelect> {
  const reqLog = correlationId ? log.child({ correlationId }) : log;

  const [mapping] = await db
    .select()
    .from(keywordPageMapping)
    .where(eq(keywordPageMapping.id, mappingId));

  if (!mapping) {
    reqLog.warn("Keyword mapping not found", { mappingId });
    throw new AppError("NOT_FOUND", `Keyword mapping ${mappingId} not found`);
  }

  return mapping;
}

/**
 * Preview SERP analysis without creating a brief.
 * Useful for showing competitor data before brief generation.
 *
 * @param clientId - Client ID for multi-tenant cache isolation
 * @param mappingId - Keyword mapping ID
 * @param locationCode - DataForSEO location code (default: 2840 = United States)
 * @param correlationId - Correlation ID for tracing (auto-generated if not provided)
 */
export async function previewSerp(
  clientId: string,
  mappingId: string,
  locationCode: number = 2840,
  correlationId?: string
): Promise<SerpAnalysisData> {
  const corrId = correlationId ?? generateCorrelationId();
  const reqLog = log.child({ correlationId: corrId });

  reqLog.info("Previewing SERP analysis", { clientId, mappingId, locationCode });

  const mapping = await validateMapping(mappingId, corrId);
  const result = await analyzeSerpForKeyword(clientId, mappingId, mapping.keyword, locationCode, undefined, corrId);

  reqLog.info("SERP preview complete", { keyword: mapping.keyword });
  return result.data;
}

/**
 * Generate a content brief from SERP analysis.
 *
 * 1. Validates mapping exists
 * 2. Fetches/caches SERP analysis
 * 3. Calculates target word count (avg + 20%)
 * 4. Loads voice profile and builds constraints (Phase 37-04)
 * 5. Creates brief in draft status
 */
export async function generateBrief(
  input: BriefGeneratorInput,
  repository: BriefRepository
): Promise<GeneratedBrief> {
  // BRIEF-01: Generate or use provided correlationId for distributed tracing
  const correlationId = input.correlationId ?? generateCorrelationId();
  const reqLog = log.child({ correlationId });

  reqLog.info("Starting brief generation", {
    mappingId: input.mappingId,
    clientId: input.clientId,
    voiceMode: input.voiceMode,
  });

  const mapping = await validateMapping(input.mappingId, correlationId);

  reqLog.info("Analyzing SERP for keyword", { keyword: mapping.keyword });
  const serpResult = await analyzeSerpForKeyword(
    input.clientId,
    input.mappingId,
    mapping.keyword,
    input.locationCode ?? 2840,
    undefined,
    correlationId
  );
  const serpAnalysis = serpResult.data;

  // P2.G16: Track accumulated scraping cost for persistence
  const scrapingCostUsd = serpResult.totalCostUsd;

  const avgWordCount =
    serpAnalysis.competitorWordCounts.length > 0
      ? Math.round(
          serpAnalysis.competitorWordCounts.reduce((a, b) => a + b, 0) /
            serpAnalysis.competitorWordCounts.length
        )
      : 1500;

  const targetWordCount = Math.round(avgWordCount * 1.2);

  // Load voice profile and build constraints
  let voiceConstraints: string | undefined;
  const voiceProfile = await voiceProfileService.getByClientId(input.clientId);
  if (voiceProfile) {
    reqLog.debug("Building voice constraints", { hasProfile: true });
    voiceConstraints = buildVoiceConstraints({
      profile: voiceProfile,
      templateBlend: input.templateBlend,
      templateId: input.templateId,
    });
  }

  const brief = await repository.create({
    mappingId: input.mappingId,
    keyword: mapping.keyword,
    targetWordCount,
    voiceMode: input.voiceMode,
    serpAnalysis,
    // P2.G16: Persist scraping cost for cost attribution
    scrapingCostUsd: scrapingCostUsd > 0 ? scrapingCostUsd.toFixed(6) : null,
  });

  reqLog.info("Brief generation complete", {
    briefId: brief.id,
    keyword: mapping.keyword,
    targetWordCount,
    scrapingCostUsd,
  });

  return {
    brief,
    suggestedH2s: serpAnalysis.commonH2s.map((h) => h.heading),
    paaQuestions: serpAnalysis.paaQuestions,
    competitorAvgWordCount: avgWordCount,
    voiceConstraints,
  };
}

/**
 * Score generated content against a client's voice profile.
 *
 * @param content - The generated content to score
 * @param clientId - Client ID to load voice profile from
 * @returns Compliance score or null if no profile exists
 */
export async function scoreContentCompliance(
  content: string,
  clientId: string
): Promise<ComplianceScore | null> {
  const voiceProfile = await voiceProfileService.getByClientId(clientId);
  if (!voiceProfile) {
    return null;
  }
  return voiceComplianceService.scoreContent(content, voiceProfile);
}
