/**
 * Gemini AI client for Lithuanian proposal generation.
 * Phase 30-02: AI Lithuanian Generation
 *
 * Uses Gemini 1.5 Pro for generating SEO proposal content in Lithuanian.
 * Includes rate limiting (60 RPM free tier) and brand voice customization.
 */

import { GoogleGenerativeAI, type GenerativeModel } from "@google/generative-ai";
import { redis } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import type { ProspectWithAnalyses } from "@/server/features/prospects/services/ProspectService";
import type { OpportunityKeyword } from "@/db/prospect-schema";
import { sanitizeUserInput, validateOutput, sanitizeForLogging } from "@/lib/llm/safety";
import { CircuitBreaker, CircuitOpenError as CircuitBreakerOpenError } from "@/server/features/scraping/resilience/CircuitBreaker";

const log = createLogger({ module: "gemini" });

// --- Constants ---

/** Rate limit: 60 requests per minute (free tier) */
const RATE_LIMIT_RPM = 60;
const RATE_LIMIT_KEY_PREFIX = "gemini:ratelimit:";
const RATE_LIMIT_WINDOW_SECONDS = 60;

/** Maximum retry attempts for transient failures */
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

/**
 * Circuit breaker for Gemini API calls.
 * Opens after 5 consecutive failures, recovers after 2 minutes.
 */
const geminiCircuitBreaker = new CircuitBreaker({
  name: "gemini-api",
  failureThreshold: 5,
  timeout: 120000, // 2 minutes
  successThreshold: 1,
  volumeThreshold: 1,
});

// --- Lithuanian Terminology ---

/**
 * SEO terminology translations for Lithuanian.
 * These are injected into the system prompt.
 */
export const LITHUANIAN_TERMINOLOGY: Record<string, string> = {
  keywords: "raktazodziai",
  organic_traffic: "organinis srautas",
  conversion_rate: "konversijos rodiklis",
  domain_authority: "domeno autoritetas",
  backlinks: "nuorodos",
  search_volume: "paiesku skaicius",
  landing_page: "nukreipimo puslapis",
  meta_description: "meta aprasymas",
  bounce_rate: "atmetimo rodiklis",
  click_through_rate: "paspaudimu rodiklis",
  impressions: "rodymai",
  rankings: "pozicijos",
  indexing: "indeksavimas",
  crawling: "narsymas",
  sitemap: "svetaines struktura",
  internal_links: "vidines nuorodos",
  external_links: "isorines nuorodos",
  anchor_text: "inkaro tekstas",
  page_speed: "puslapio greitis",
  mobile_friendly: "pritaikytas mobiliesiems",
  website: "svetaine",
  monthly: "per menesi",
  traffic: "srautas",
  visitors: "lankytojai",
  potential: "potencialas",
  value: "verte",
  investment: "investicija",
  results: "rezultatai",
  analysis: "analize",
  strategy: "strategija",
  optimization: "optimizavimas",
  proposal: "pasiulymas",
  opportunity: "galimybe",
  growth: "augimas",
};

/**
 * Terms to keep in English (industry standard).
 */
export const TERMS_KEEP_ENGLISH = [
  "SEO",
  "ROI",
  "CPC",
  "CTR",
  "Google Search Console",
  "Google Analytics",
  "URL",
  "HTML",
  "CSS",
  "HTTP",
  "HTTPS",
  "SSL",
  "DNS",
  "CDN",
  "API",
  "CMS",
  "WordPress",
  "Shopify",
] as const;

/**
 * Forbidden marketing phrases in Lithuanian.
 * These should never appear in generated content.
 */
export const FORBIDDEN_PHRASES = [
  "Garantuojame rezultatus",
  "Geriausi specialistai",
  "Unikalus sprendimai",
  "Nepakartuojami rezultatai",
  "Pirmoje vietoje per 30 dienu",
  "100% garantija",
  "Greitai ir pigiai",
  "Nenuilstantys profesionalai",
  "Lyderiai rinkoje",
] as const;

// --- Tone Guidelines ---

export const ENTHUSIASM_LEVELS = ["confident", "enthusiastic", "understated"] as const;
export type EnthusiasmLevel = (typeof ENTHUSIASM_LEVELS)[number];

export const FORMALITY_LEVELS = ["formal", "semi_formal"] as const;
export type FormalityLevel = (typeof FORMALITY_LEVELS)[number];

export interface ToneGuidelines {
  formality: FormalityLevel;
  enthusiasm: EnthusiasmLevel;
  useJusForm: boolean;
}

export const DEFAULT_TONE_GUIDELINES: ToneGuidelines = {
  formality: "formal",
  enthusiasm: "confident",
  useJusForm: true,
};

// --- Brand Voice Config ---

export interface BrandVoiceConfig {
  agencyId: string;
  formality: FormalityLevel;
  enthusiasm: EnthusiasmLevel;
  customTerminology: Record<string, string>;
  forbiddenPhrases: string[];
  customInstructions: string;
  exampleProposals?: string[];
}

/**
 * Validate brand voice configuration.
 * @throws AppError if configuration is invalid.
 */
export function validateBrandVoiceConfig(config: BrandVoiceConfig): void {
  if (!FORMALITY_LEVELS.includes(config.formality)) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Invalid formality level: ${config.formality}. Must be one of: ${FORMALITY_LEVELS.join(", ")}`,
    );
  }
  if (!ENTHUSIASM_LEVELS.includes(config.enthusiasm)) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Invalid enthusiasm level: ${config.enthusiasm}. Must be one of: ${ENTHUSIASM_LEVELS.join(", ")}`,
    );
  }
}

// --- System Prompt Builder ---

const BASE_SYSTEM_PROMPT = `Esi profesionalus SEO pasiulymu rasytojas lietuviu kalba.

TONAS:
- Profesionalus, bet siltas
- Oficialus "Jus" (ne "tu")
- Konkretus skaiciai, ne tuscios frazes
- Pasitikintis, bet ne arogantiskas

TERMINOLOGIJA (neversk, naudok anglu kalba):
${TERMS_KEEP_ENGLISH.map((term) => `- ${term}`).join("\n")}

TERMINOLOGIJA (versk i lietuviu kalba):
${Object.entries(LITHUANIAN_TERMINOLOGY)
  .map(([en, lt]) => `- ${en} -> ${lt}`)
  .join("\n")}

VENGTI (niekada nenaudok siu fraziu):
${FORBIDDEN_PHRASES.map((phrase) => `- "${phrase}"`).join("\n")}

SVARBU:
- Rasyk tikslius skaiciais, ne "daug" ar "mazai"
- Naudok eurais (EUR arba €), ne litais
- Visada kreipkis "Jus" forma
- Nenaudok anglu kalbos terminu be reikalo
- Tekstas turi buti skaitomas ir aiškus
`;

/**
 * Build a complete system prompt with brand voice customization.
 */
export function buildSystemPrompt(brandVoice?: BrandVoiceConfig): string {
  let prompt = BASE_SYSTEM_PROMPT;

  if (brandVoice) {
    // Add custom terminology
    if (Object.keys(brandVoice.customTerminology).length > 0) {
      prompt += "\n\nPAPIDOMA TERMINOLOGIJA:\n";
      prompt += Object.entries(brandVoice.customTerminology)
        .map(([en, lt]) => `- ${en} -> ${lt}`)
        .join("\n");
    }

    // Add forbidden phrases
    if (brandVoice.forbiddenPhrases.length > 0) {
      prompt += "\n\nPAPIDOMOS DRAUDZIAMOS FRAZES:\n";
      prompt += brandVoice.forbiddenPhrases.map((p) => `- "${p}"`).join("\n");
    }

    // Add custom instructions
    if (brandVoice.customInstructions) {
      prompt += `\n\nAGENTUROS INSTRUKCIJOS:\n${brandVoice.customInstructions}`;
    }

    // Add enthusiasm adjustment
    if (brandVoice.enthusiasm === "enthusiastic") {
      prompt += "\n\nTONAS: Buk ikvepiancis ir entuziastingas, bet realus.";
    } else if (brandVoice.enthusiasm === "understated") {
      prompt += "\n\nTONAS: Buk santurus ir dalykiskas, leisk skaiciams kalbeti.";
    }
  }

  return prompt;
}

// --- Prospect Data Types ---

export interface ProspectGenerationData {
  domain: string;
  companyName: string;
  traffic: number;
  keywords: number;
  currentValue: number;
  trafficValue: number;
  opportunities: Array<{
    keyword: string;
    searchVolume: number;
    difficulty: number;
    cpc: number;
    opportunityScore: number;
  }>;
  projectedTrafficGain: number;
  monthlyFee: number;
  setupFee: number;
  inclusions: string[];
}

export interface PricingConfig {
  setupFee: number;
  monthlyFee: number;
  inclusions: string[];
}

/**
 * Transform prospect with analyses to generation data format.
 */
export function transformProspectToGenerationData(
  prospect: ProspectWithAnalyses,
  pricingConfig: PricingConfig,
): ProspectGenerationData {
  const latestAnalysis = prospect.analyses?.[0];
  const metrics = latestAnalysis?.domainMetrics;
  const opportunityKeywords = latestAnalysis?.opportunityKeywords ?? [];

  // Calculate current and projected values
  const traffic = metrics?.organicTraffic ?? 0;
  const keywords = metrics?.organicKeywords ?? 0;

  const avgCpc =
    opportunityKeywords.length > 0
      ? opportunityKeywords.reduce((sum, o) => sum + (o.cpc ?? 0), 0) /
        opportunityKeywords.length
      : 2.5;

  const currentValue = Math.round(traffic * avgCpc);

  // Map opportunity keywords
  const opportunities = opportunityKeywords.map((opp: OpportunityKeyword) => ({
    keyword: opp.keyword,
    searchVolume: opp.searchVolume,
    difficulty: opp.difficulty,
    cpc: opp.cpc,
    opportunityScore: opp.opportunityScore,
  }));

  // Calculate traffic value and projected gain
  const projectedTrafficGain = opportunities.reduce(
    (sum, o) => sum + Math.round(o.searchVolume * 0.1),
    0,
  );
  const trafficValue = Math.round(projectedTrafficGain * avgCpc);

  return {
    domain: prospect.domain,
    companyName: prospect.companyName ?? prospect.domain,
    traffic,
    keywords,
    currentValue,
    trafficValue,
    opportunities,
    projectedTrafficGain,
    monthlyFee: pricingConfig.monthlyFee,
    setupFee: pricingConfig.setupFee,
    inclusions: pricingConfig.inclusions,
  };
}

// --- Segment Prompt Builders ---

export type SegmentType =
  | "hero"
  | "current_state"
  | "opportunities"
  | "roi"
  | "investment"
  | "next_steps";

export function buildHeroPrompt(data: ProspectGenerationData): string {
  // Sanitize user-provided data to prevent prompt injection
  const safeDomain = sanitizeUserInput(data.domain, { maxLength: 255 });
  const safeCompanyName = sanitizeUserInput(data.companyName, { maxLength: 255 });

  if (safeDomain.injectionDetected || safeCompanyName.injectionDetected) {
    log.warn("Potential injection detected in prospect data", {
      domain: sanitizeForLogging(data.domain),
      companyName: sanitizeForLogging(data.companyName),
    });
  }

  return `Sugeneruok pasiulymo antraste ir paantraste.

DUOMENYS:
- Domenas: ${safeDomain.text}
- Imoniu pavadinimas: ${safeCompanyName.text}
- Neisanaudota srauto verte: ${data.trafficValue}/men.
- Galimybiu skaicius: ${data.opportunities.length} raktazodziu

FORMATAS (JSON):
{
  "headline": "Pagrindine antraste (max 10 zodziu)",
  "subheadline": "Paantraste su konkreciu skaiciumi (max 20 zodziu)"
}

Pavyzdys:
{
  "headline": "Jusu svetaine turi 10,800/men. neisanaudota potenciala",
  "subheadline": "Radome 156 raktazodzius, kuriais galetumete pritraukti nauju klientu"
}`;
}

export function buildCurrentStatePrompt(data: ProspectGenerationData): string {
  return `Aprasyk dabartine svetaines situacija 2-3 sakiniais.

DUOMENYS:
- Dabartinis srautas: ${data.traffic}/men.
- Raktazodziu skaicius: ${data.keywords}
- Dabartine srauto verte: €${data.currentValue}/men.

FORMATAS: Paprastas tekstas, 2-3 sakiniai. Neutralus tonas, tik faktai.`;
}

export function buildOpportunitiesPrompt(data: ProspectGenerationData): string {
  // Sanitize keywords which could contain user-provided data
  const topKeywords = data.opportunities
    .slice(0, 3)
    .map((o) => {
      const sanitized = sanitizeUserInput(o.keyword, { maxLength: 100 });
      return sanitized.text;
    })
    .join(", ");

  return `Aprasyk rastas galimybes 2-3 sakiniais.

DUOMENYS:
- Galimybiu skaicius: ${data.opportunities.length}
- Top 3 raktazodziai: ${topKeywords}
- Bendra potenciali verte: ${data.trafficValue}/men.

FORMATAS: Paprastas tekstas, 2-3 sakiniai. Ikvepiancis, bet realus tonas.`;
}

export function buildRoiPrompt(data: ProspectGenerationData): string {
  return `Aprasyk investiciju graza 2-3 sakiniais.

DUOMENYS:
- Prognozuojamas srauto prieaugis: +${data.projectedTrafficGain}/men.
- Srauto verte: €${data.trafficValue}/men.
- Menesine investicija: €${data.monthlyFee}

FORMATAS: Paprastas tekstas, 2-3 sakiniai. Aiskus, konkretus.`;
}

export function buildInvestmentPrompt(data: ProspectGenerationData): string {
  // Sanitize inclusions which could be user-defined
  const safeInclusions = data.inclusions
    .map((inc) => {
      const sanitized = sanitizeUserInput(inc, { maxLength: 200 });
      return sanitized.text;
    })
    .join(", ");

  return `Aprasyk investicija ir kas ieina i paslauga.

DUOMENYS:
- Idiegimo mokestis: ${data.setupFee}
- Menesinis mokestis: ${data.monthlyFee}
- Paslaugos: ${safeInclusions}

FORMATAS (JSON):
{
  "description": "1-2 sakiniai apie investicija",
  "value_proposition": "1 sakinys kodel verta"
}`;
}

export function buildNextStepsPrompt(_data: ProspectGenerationData): string {
  return `Sugeneruok 3 aiskius zingsnius, ka klientas turetu daryti toliau.

FORMATAS (JSON array):
["Pirmas zingsnis", "Antras zingsnis", "Trecias zingsnis"]

Pavyzdys:
["Perziurekite pasiulyma", "Pasirasykite sutarti elektroniniu parasu", "Pradesime per 48 valandas"]`;
}

const SEGMENT_PROMPT_BUILDERS: Record<
  SegmentType,
  (data: ProspectGenerationData) => string
> = {
  hero: buildHeroPrompt,
  current_state: buildCurrentStatePrompt,
  opportunities: buildOpportunitiesPrompt,
  roi: buildRoiPrompt,
  investment: buildInvestmentPrompt,
  next_steps: buildNextStepsPrompt,
};

// --- Gemini Client ---

let geminiInstance: GoogleGenerativeAI | null = null;

/**
 * Get the Gemini client singleton.
 * @throws Error if GOOGLE_API_KEY is not set.
 */
export function getGeminiClient(): GoogleGenerativeAI {
  if (geminiInstance) {
    return geminiInstance;
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing required environment variable: GOOGLE_API_KEY. " +
        "Set it in .env or the deployment environment before starting.",
    );
  }

  geminiInstance = new GoogleGenerativeAI(apiKey);
  return geminiInstance;
}

/**
 * Reset the Gemini client singleton (for testing).
 */
export function resetGeminiClient(): void {
  geminiInstance = null;
}

// --- Rate Limiting ---

/**
 * Check rate limit before making API call.
 * @throws AppError if rate limit exceeded.
 */
export async function checkRateLimit(): Promise<void> {
  const minuteKey = `${RATE_LIMIT_KEY_PREFIX}${Math.floor(Date.now() / 60000)}`;

  const currentCount = await redis.get(minuteKey);
  const count = currentCount ? parseInt(currentCount, 10) : 0;

  if (count >= RATE_LIMIT_RPM) {
    throw new AppError(
      "RATE_LIMITED",
      `Rate limit exceeded: ${RATE_LIMIT_RPM} requests per minute. Please wait.`,
    );
  }

  // Increment counter
  const newCount = await redis.incr(minuteKey);
  if (newCount === 1) {
    // Set expiry on first request of the minute
    await redis.expire(minuteKey, RATE_LIMIT_WINDOW_SECONDS);
  }
}

// --- Generation Service ---

/**
 * Generate a single proposal segment.
 */
export async function generateProposalSegment(
  segment: SegmentType,
  data: ProspectGenerationData,
  brandVoice?: BrandVoiceConfig,
): Promise<string> {
  // Check rate limit
  await checkRateLimit();

  const client = getGeminiClient();
  const systemPrompt = buildSystemPrompt(brandVoice);

  const model: GenerativeModel = client.getGenerativeModel({
    model: "gemini-1.5-pro",
    systemInstruction: systemPrompt,
  });

  const promptBuilder = SEGMENT_PROMPT_BUILDERS[segment];
  const prompt = promptBuilder(data);

  let lastError: Error | null = null;

  // Check circuit breaker state before attempting
  if (geminiCircuitBreaker.getState() === "open") {
    const stats = geminiCircuitBreaker.getStats();
    throw new AppError(
      "SERVICE_UNAVAILABLE",
      `Gemini API circuit breaker is open. Will recover in ${Math.ceil((stats.openedAt ? 120000 - (Date.now() - stats.openedAt.getTime()) : 120000) / 1000)}s`,
    );
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await geminiCircuitBreaker.execute(
        () => model.generateContent(prompt)
      );
      const rawText = result.response.text();

      // Validate output before returning
      const validated = validateOutput(rawText, { maxLength: 50000 });
      if (validated.warnings.length > 0) {
        log.warn("Output validation warnings", { segment, warnings: validated.warnings });
      }

      log.info("Segment generated", { segment, attempt });
      return validated.text;
    } catch (error) {
      // If circuit breaker is open, don't retry
      if (error instanceof CircuitBreakerOpenError) {
        throw new AppError(
          "SERVICE_UNAVAILABLE",
          `Gemini API circuit breaker is open: ${error.message}`,
        );
      }

      lastError = error instanceof Error ? error : new Error(String(error));
      log.warn("Generation attempt failed", {
        segment,
        attempt,
        error: lastError.message,
        circuitState: geminiCircuitBreaker.getState(),
      });

      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)),
        );
      }
    }
  }

  throw new AppError(
    "INTERNAL_ERROR",
    `Proposal segment generation failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`,
  );
}

// --- Full Proposal Generation ---

/** JSON segments that need parsing */
const JSON_SEGMENTS: SegmentType[] = ["hero", "investment", "next_steps"];

export interface GeneratedProposalContent {
  hero: {
    headline: string;
    subheadline: string;
  };
  current_state: string;
  opportunities: string;
  roi: string;
  investment: {
    description: string;
    value_proposition: string;
  };
  next_steps: string[];
}

/**
 * Generate full proposal content for all segments.
 */
export async function generateFullProposal(
  data: ProspectGenerationData,
  brandVoice?: BrandVoiceConfig,
): Promise<GeneratedProposalContent> {
  const segments: SegmentType[] = [
    "hero",
    "current_state",
    "opportunities",
    "roi",
    "investment",
    "next_steps",
  ];

  const content: Partial<GeneratedProposalContent> = {};

  // Generate segments sequentially to maintain consistency
  for (const segment of segments) {
    const text = await generateProposalSegment(segment, data, brandVoice);

    if (JSON_SEGMENTS.includes(segment)) {
      try {
        // Extract JSON from response (may have markdown code blocks)
        const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (!jsonMatch) {
          throw new Error("No JSON found in response");
        }
        (content as Record<string, unknown>)[segment] = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        log.error("Failed to parse JSON segment", undefined, { segment, text });
        throw new AppError(
          "INTERNAL_ERROR",
          `Failed to parse ${segment} segment: invalid JSON`,
        );
      }
    } else {
      (content as Record<string, unknown>)[segment] = text;
    }
  }

  return content as GeneratedProposalContent;
}

// --- Public API for ProposalService Integration ---

/**
 * Generate proposal content from a prospect.
 * This is the main entry point for ProposalService.
 */
export async function generateProposalContent(
  prospect: ProspectWithAnalyses,
  pricingConfig: PricingConfig,
  brandVoice?: BrandVoiceConfig,
): Promise<GeneratedProposalContent> {
  if (brandVoice) {
    validateBrandVoiceConfig(brandVoice);
  }

  const data = transformProspectToGenerationData(prospect, pricingConfig);

  log.info("Starting proposal generation", {
    domain: data.domain,
    opportunities: data.opportunities.length,
  });

  const content = await generateFullProposal(data, brandVoice);

  log.info("Proposal generation complete", { domain: data.domain });

  return content;
}
