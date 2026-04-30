/**
 * Proposal Translation Service
 * Phase 55-05: Dynamic Content Translation Integration
 *
 * Translates proposal content to prospect's preferred language.
 * Integrates with TranslationService for caching and quality scoring.
 */
import { getTranslationService, TranslationService } from "@/server/services/translation/TranslationService";
import { getLanguageResolutionService, LanguageResolutionService } from "@/server/services/LanguageResolutionService";
import type { TranslationContext, SupportedLocale, Formality } from "@/server/services/translation/types";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "ProposalTranslationService" });

/**
 * Hero section content.
 */
export interface HeroContent {
  headline: string;
  subheadline: string;
}

/**
 * Solution item in proposals.
 */
export interface SolutionItem {
  title: string;
  description: string;
}

/**
 * Investment line item.
 */
export interface InvestmentLineItem {
  name: string;
  description: string;
  price: number;
}

/**
 * Investment section content.
 */
export interface InvestmentContent {
  description: string;
  items: InvestmentLineItem[];
  total: number;
}

/**
 * Full proposal content structure for translation.
 */
export interface ProposalContent {
  hero: HeroContent;
  problemStatements: string[];
  solutions: SolutionItem[];
  investment: InvestmentContent;
  nextSteps: string[];
  closingStatement: string;
}

/**
 * Result of proposal translation.
 */
export interface TranslatedProposal {
  content: ProposalContent;
  language: SupportedLocale;
  formality: Formality;
}

/**
 * Service for translating proposal content to prospect's preferred language.
 */
export class ProposalTranslationService {
  private translationService: TranslationService;
  private langService: LanguageResolutionService;

  constructor() {
    this.translationService = getTranslationService();
    this.langService = getLanguageResolutionService();
  }

  /**
   * Translate proposal content to prospect's preferred language.
   *
   * @param content - Original English proposal content
   * @param prospectId - Prospect ID for language resolution
   * @param workspaceId - Workspace ID for language settings
   * @returns Translated content with language code
   */
  async translateProposal(
    content: ProposalContent,
    prospectId: string,
    workspaceId: string
  ): Promise<TranslatedProposal> {
    // Resolve language via LanguageResolutionService
    const resolved = await this.langService.resolveForCommunication(
      workspaceId,
      prospectId,
      "prospect"
    );

    // If English, return unchanged
    if (resolved.locale === "en") {
      return {
        content,
        language: "en",
        formality: resolved.formality,
      };
    }

    log.info("Translating proposal", {
      prospectId,
      targetLanguage: resolved.locale,
      formality: resolved.formality,
    });

    // Build translation context
    const context: TranslationContext = {
      type: "proposal",
      formality: resolved.formality,
      domain: "seo",
      workspaceId,
    };

    // Translate all sections in parallel
    const [
      translatedHero,
      translatedProblemStatements,
      translatedSolutions,
      translatedInvestment,
      translatedNextSteps,
      translatedClosingStatement,
    ] = await Promise.all([
      this.translateHero(content.hero, context, resolved.locale),
      this.translateArray(content.problemStatements, context, resolved.locale),
      this.translateSolutions(content.solutions, context, resolved.locale),
      this.translateInvestment(content.investment, context, resolved.locale),
      this.translateArray(content.nextSteps, context, resolved.locale),
      this.translateText(content.closingStatement, context, resolved.locale),
    ]);

    return {
      content: {
        hero: translatedHero,
        problemStatements: translatedProblemStatements,
        solutions: translatedSolutions,
        investment: translatedInvestment,
        nextSteps: translatedNextSteps,
        closingStatement: translatedClosingStatement,
      },
      language: resolved.locale,
      formality: resolved.formality,
    };
  }

  /**
   * Translate a single text string.
   */
  private async translateText(
    text: string,
    context: TranslationContext,
    targetLang: SupportedLocale,
    maxLength?: number
  ): Promise<string> {
    if (!text || text.trim() === "") return text;

    const result = await this.translationService.translate({
      text,
      sourceLang: "en",
      targetLang,
      context,
      maxLength,
    });

    return result.text;
  }

  /**
   * Translate an array of strings.
   */
  private async translateArray(
    items: string[],
    context: TranslationContext,
    targetLang: SupportedLocale
  ): Promise<string[]> {
    if (!items || items.length === 0) return [];

    const results = await Promise.all(
      items.map((item) => this.translateText(item, context, targetLang))
    );

    return results;
  }

  /**
   * Translate hero section.
   */
  private async translateHero(
    hero: HeroContent,
    context: TranslationContext,
    targetLang: SupportedLocale
  ): Promise<HeroContent> {
    const [headline, subheadline] = await Promise.all([
      this.translateText(hero.headline, context, targetLang, 100),
      this.translateText(hero.subheadline, context, targetLang, 200),
    ]);

    return { headline, subheadline };
  }

  /**
   * Translate solutions array.
   */
  private async translateSolutions(
    solutions: SolutionItem[],
    context: TranslationContext,
    targetLang: SupportedLocale
  ): Promise<SolutionItem[]> {
    if (!solutions || solutions.length === 0) return [];

    const results = await Promise.all(
      solutions.map(async (solution) => {
        const [title, description] = await Promise.all([
          this.translateText(solution.title, context, targetLang, 80),
          this.translateText(solution.description, context, targetLang, 500),
        ]);
        return { title, description };
      })
    );

    return results;
  }

  /**
   * Translate investment section.
   */
  private async translateInvestment(
    investment: InvestmentContent,
    context: TranslationContext,
    targetLang: SupportedLocale
  ): Promise<InvestmentContent> {
    const [description, items] = await Promise.all([
      this.translateText(investment.description, context, targetLang, 300),
      this.translateInvestmentItems(investment.items, context, targetLang),
    ]);

    return {
      description,
      items,
      total: investment.total, // Price unchanged
    };
  }

  /**
   * Translate investment line items.
   */
  private async translateInvestmentItems(
    items: InvestmentLineItem[],
    context: TranslationContext,
    targetLang: SupportedLocale
  ): Promise<InvestmentLineItem[]> {
    if (!items || items.length === 0) return [];

    const results = await Promise.all(
      items.map(async (item) => {
        const [name, description] = await Promise.all([
          this.translateText(item.name, context, targetLang, 60),
          this.translateText(item.description, context, targetLang, 200),
        ]);
        return {
          name,
          description,
          price: item.price, // Price unchanged
        };
      })
    );

    return results;
  }
}

// Singleton instance
let proposalTranslationServiceInstance: ProposalTranslationService | null = null;

/**
 * Get the singleton ProposalTranslationService instance.
 */
export function getProposalTranslationService(): ProposalTranslationService {
  if (!proposalTranslationServiceInstance) {
    proposalTranslationServiceInstance = new ProposalTranslationService();
  }
  return proposalTranslationServiceInstance;
}
