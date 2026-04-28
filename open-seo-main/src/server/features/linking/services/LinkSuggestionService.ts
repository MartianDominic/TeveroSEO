/**
 * Link suggestion service for generating internal link recommendations.
 * Phase 35-04: Auto-Insert + Velocity Control
 *
 * Generates suggestions from opportunities with:
 * - Anchor text selection based on distribution rules
 * - Auto-applicability detection for safe automatic insertion
 * - Insertion method determination (wrap_existing vs append_sentence)
 */
import { eq, and, count } from "drizzle-orm";
import { db as appDb } from "@/db";
import { linkGraph } from "@/db/link-schema";
import { CannibalizationService } from "./CannibalizationService";
import type {
  LinkOpportunitiesSelect,
  LinkSuggestionsInsert,
} from "@/db/link-schema";
import type {
  AnchorSelection,
  AnchorDistribution,
  SelectAnchorParams,
  SourcePageData,
} from "@/server/lib/linking/types";

type AppDb = typeof appDb;

/**
 * Parameters for generating a link suggestion.
 */
export interface GenerateSuggestionParams {
  opportunity: LinkOpportunitiesSelect;
  sourcePageId: string;
  sourceUrl: string;
  sourceContent: string;
  targetKeyword: string | null;
  targetTitle: string;
  brandName: string;
  currentDistribution: AnchorDistribution;
}

/**
 * Parameters for auto-applicability check.
 */
export interface AutoApplicableParams {
  insertionMethod: string;
  confidence: number;
  sourceUrl: string;
  targetUrl: string;
  clientId: string;
}

/**
 * Insertion method types.
 */
export type InsertionMethod = "wrap_existing" | "append_sentence";

/**
 * LinkSuggestionService generates link suggestions from opportunities.
 */
export class LinkSuggestionService {
  constructor(
    readonly db: AppDb,
    private anchorSelector: (params: SelectAnchorParams) => AnchorSelection
  ) {}

  /**
   * Generate a link suggestion from an opportunity.
   */
  async generateSuggestion(
    params: GenerateSuggestionParams
  ): Promise<LinkSuggestionsInsert> {
    const {
      opportunity,
      sourcePageId,
      sourceUrl,
      sourceContent,
      targetKeyword,
      targetTitle,
      brandName,
      currentDistribution,
    } = params;

    const sourcePage: SourcePageData = {
      pageId: sourcePageId,
      pageUrl: sourceUrl,
      bodyText: sourceContent,
      brandName,
    };

    const anchor = this.anchorSelector({
      sourcePage,
      targetKeyword,
      targetTitle,
      anchorDistribution: currentDistribution,
    });

    const insertionMethod: InsertionMethod = anchor.existingTextMatch
      ? "wrap_existing"
      : "append_sentence";

    const isAutoApplicable = await this.isAutoApplicable({
      insertionMethod,
      confidence: anchor.confidence,
      sourceUrl,
      targetUrl: opportunity.pageUrl,
      clientId: opportunity.clientId,
    });

    const replacementText = anchor.existingTextMatch
      ? this.generateReplacementHtml(anchor.existingTextMatch, opportunity.pageUrl)
      : null;

    const newSentence = !anchor.existingTextMatch
      ? this.generateLinkSentence(anchor.anchorText, opportunity.pageUrl)
      : null;

    return {
      id: crypto.randomUUID(),
      clientId: opportunity.clientId,
      auditId: opportunity.auditId,
      sourceUrl,
      sourcePageId,
      targetUrl: opportunity.pageUrl,
      targetPageId: opportunity.pageId,
      anchorText: anchor.anchorText,
      anchorType: anchor.anchorType,
      anchorConfidence: anchor.confidence,
      score: 0,
      linkDeficitScore: 0,
      exactMatchScore: 0,
      orphanScore: 0,
      depthScore: 0,
      relevanceScore: 0,
      reasons: [],
      existingTextMatch: anchor.existingTextMatch,
      insertionContext: anchor.insertionContext,
      status: "pending",
      opportunityId: opportunity.id,
      insertionMethod,
      replacementText,
      newSentence,
      isAutoApplicable,
    };
  }

  /**
   * Check if a suggestion can be auto-applied safely.
   * Returns true only for:
   * - wrap_existing method (safest, modifies existing text)
   * - confidence >= 0.85
   * - page has < 10 links
   * - target not in cannibalization set
   */
  async isAutoApplicable(params: AutoApplicableParams): Promise<boolean> {
    const { insertionMethod, confidence, sourceUrl, targetUrl, clientId } = params;

    if (insertionMethod !== "wrap_existing") {
      return false;
    }

    if (confidence < 0.85) {
      return false;
    }

    const pageLinksCount = await this.getPageLinkCount(sourceUrl, clientId);
    if (pageLinksCount >= 10) {
      return false;
    }

    const isCannibalized = await this.isTargetCannibalized(targetUrl, clientId);
    if (isCannibalized) {
      return false;
    }

    return true;
  }

  /**
   * Count internal links on a page.
   */
  private async getPageLinkCount(
    sourceUrl: string,
    clientId: string
  ): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(linkGraph)
      .where(
        and(eq(linkGraph.clientId, clientId), eq(linkGraph.sourceUrl, sourceUrl))
      );

    return result[0]?.count ?? 0;
  }

  /**
   * Check if target URL is in a cannibalization set.
   * Uses CannibalizationService to check active cannibalization issues.
   */
  private async isTargetCannibalized(
    targetUrl: string,
    clientId: string
  ): Promise<boolean> {
    const cannibalizationService = new CannibalizationService(this.db);
    return cannibalizationService.isTargetCannibalized(targetUrl, clientId);
  }

  /**
   * Generate HTML replacement for wrapping existing text.
   */
  private generateReplacementHtml(text: string, targetUrl: string): string {
    return `<a href="${targetUrl}">${text}</a>`;
  }

  /**
   * Generate a natural sentence containing the link.
   */
  private generateLinkSentence(anchorText: string, targetUrl: string): string {
    return `Learn more about <a href="${targetUrl}">${anchorText}</a>.`;
  }
}

/**
 * Extended LinkSuggestion type with insertion fields.
 */
export interface ExtendedLinkSuggestion extends LinkSuggestionsInsert {
  opportunityId: string;
  insertionMethod: InsertionMethod;
  replacementText: string | null;
  newSentence: string | null;
  isAutoApplicable: boolean;
}
