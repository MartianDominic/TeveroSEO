/**
 * Link apply service for executing link suggestions.
 * Phase 35-04: Auto-Insert + Velocity Control
 *
 * Applies link suggestions with:
 * - Velocity control enforcement
 * - site_changes record creation for revert capability
 * - Platform adapter integration
 * - Link graph updates
 */
import { eq } from "drizzle-orm";
import { db as appDb } from "@/db";
import { siteChanges } from "@/db/change-schema";
import { linkGraph, linkSuggestions } from "@/db/link-schema";
import type { LinkSuggestionsSelect } from "@/db/link-schema";
import type { VelocityService } from "./VelocityService";
import { assertFound } from "@/lib/type-guards";

type AppDb = typeof appDb;

/**
 * Result of applying a link suggestion.
 */
export interface ApplyResult {
  success: boolean;
  changeId?: string;
  error?: string;
}

/**
 * Connection service interface for platform adapters.
 */
export interface ConnectionService {
  getPageContent(connectionId: string, pageId: string): Promise<string>;
  updatePageContent(
    connectionId: string,
    pageId: string,
    content: string
  ): Promise<{ success: boolean; error?: string }>;
}

/**
 * LinkApplyService applies link suggestions via platform adapters.
 */
export class LinkApplyService {
  constructor(
    readonly db: AppDb,
    readonly velocityService: VelocityService,
    readonly connectionService: ConnectionService
  ) {}

  /**
   * Apply a link suggestion to the source page.
   */
  async applySuggestion(
    suggestion: LinkSuggestionsSelect,
    connectionId: string
  ): Promise<ApplyResult> {
    // 1. Check velocity limits
    const velocityCheck = await this.velocityService.checkLinkVelocity(
      suggestion.clientId,
      suggestion.sourceUrl
    );

    if (!velocityCheck.allowed) {
      return {
        success: false,
        error: velocityCheck.reason,
      };
    }

    // 2. Validate required fields before proceeding
    assertFound(suggestion.sourcePageId, "sourcePageId", suggestion.id);
    const sourcePageId = suggestion.sourcePageId;

    // 3. Get current page content
    const currentContent = await this.connectionService.getPageContent(
      connectionId,
      sourcePageId
    );

    // 4. Apply the link based on insertion method
    let newContent: string;

    if (suggestion.insertionMethod === "wrap_existing") {
      if (!suggestion.existingTextMatch || !currentContent.includes(suggestion.existingTextMatch)) {
        return await this.handleContentChanged(suggestion);
      }
      assertFound(suggestion.replacementText, "replacementText", suggestion.id);
      newContent = currentContent.replace(
        suggestion.existingTextMatch,
        suggestion.replacementText
      );
    } else if (suggestion.insertionMethod === "append_sentence") {
      assertFound(suggestion.newSentence, "newSentence", suggestion.id);
      newContent = this.insertAfterParagraph(
        currentContent,
        2, // Default to after 2nd paragraph
        suggestion.newSentence
      );
    } else {
      return { success: false, error: "Unknown insertion method" };
    }

    // 5. Create site_changes record
    const changeId = crypto.randomUUID();
    await this.db.insert(siteChanges).values({
      id: changeId,
      clientId: suggestion.clientId,
      connectionId,
      changeType: "internal_link",
      category: "links",
      resourceType: "post",
      resourceId: sourcePageId,
      resourceUrl: suggestion.sourceUrl,
      field: "content",
      beforeValue: currentContent,
      afterValue: newContent,
      triggeredBy: suggestion.isAutoApplicable ? "audit" : "manual",
      status: "pending",
    });

    // 6. Apply via platform adapter
    const result = await this.connectionService.updatePageContent(
      connectionId,
      sourcePageId,
      newContent
    );

    // 6. Update suggestion and change status
    if (result.success) {
      await this.db
        .update(linkSuggestions)
        .set({
          status: "applied",
          appliedAt: new Date(),
          appliedChangeId: changeId,
        })
        .where(eq(linkSuggestions.id, suggestion.id));

      await this.db
        .update(siteChanges)
        .set({
          status: "applied",
          appliedAt: new Date(),
        })
        .where(eq(siteChanges.id, changeId));

      // Update link graph
      await this.updateLinkGraph(suggestion, changeId);

      return { success: true, changeId };
    } else {
      await this.db
        .update(linkSuggestions)
        .set({
          status: "failed",
          failureReason: result.error,
        })
        .where(eq(linkSuggestions.id, suggestion.id));

      return { success: false, error: result.error };
    }
  }

  /**
   * Handle case where original text is no longer in content.
   */
  private async handleContentChanged(
    suggestion: LinkSuggestionsSelect
  ): Promise<ApplyResult> {
    await this.db
      .update(linkSuggestions)
      .set({
        status: "failed",
        failureReason: "Content changed since analysis - original text not found",
      })
      .where(eq(linkSuggestions.id, suggestion.id));

    return {
      success: false,
      error: "Content changed since analysis",
    };
  }

  /**
   * Insert content after the nth paragraph.
   */
  private insertAfterParagraph(
    content: string,
    paragraphIndex: number,
    sentence: string
  ): string {
    const paragraphRegex = /<\/p>/gi;
    let match: RegExpExecArray | null;
    let count = 0;
    let insertPosition = -1;

    while ((match = paragraphRegex.exec(content)) !== null) {
      count++;
      if (count === paragraphIndex) {
        insertPosition = match.index + match[0].length;
        break;
      }
    }

    if (insertPosition === -1) {
      return content + `<p>${sentence}</p>`;
    }

    return (
      content.slice(0, insertPosition) +
      `<p>${sentence}</p>` +
      content.slice(insertPosition)
    );
  }

  /**
   * Update link graph after successful link application.
   */
  private async updateLinkGraph(
    suggestion: LinkSuggestionsSelect,
    _changeId: string
  ): Promise<void> {
    await this.db.insert(linkGraph).values({
      id: crypto.randomUUID(),
      clientId: suggestion.clientId,
      auditId: suggestion.auditId,
      sourceUrl: suggestion.sourceUrl,
      sourcePageId: suggestion.sourcePageId,
      targetUrl: suggestion.targetUrl,
      targetPageId: suggestion.targetPageId,
      anchorText: suggestion.anchorText,
      anchorTextLower: suggestion.anchorText.toLowerCase(),
      position: "body",
      linkType: "contextual",
      isDoFollow: true,
      isExactMatch: suggestion.anchorType === "exact",
      isBranded: suggestion.anchorType === "branded",
    });
  }
}
