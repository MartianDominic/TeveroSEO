/**
 * Email Service
 * Phase 55-05: Dynamic Content Translation Integration
 *
 * Sends localized emails using language resolution and templates.
 * Supports dynamic content translation for custom messages.
 */

import { getEmailTemplate, substituteVariables, type EmailTemplateId } from "./templates";
import { getLanguageResolutionService } from "../LanguageResolutionService";
import { getTranslationService } from "../translation/TranslationService";
import type { SupportedLocale, TranslationContext } from "../translation/types";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "EmailService" });

/**
 * Options for sending an email.
 */
export interface SendEmailOptions {
  /** Email template ID */
  templateId: EmailTemplateId;
  /** Recipient email address */
  to: string;
  /** Prospect ID for language resolution (optional) */
  prospectId?: string;
  /** Client ID for language resolution (optional) */
  clientId?: string;
  /** Workspace ID for language settings */
  workspaceId: string;
  /** Template variables */
  variables: Record<string, string>;
  /** Dynamic content to translate (custom messages) */
  dynamicContent?: string;
  /** Force specific language (overrides resolution) */
  forceLanguage?: SupportedLocale;
}

/**
 * Result of sending an email.
 */
export interface SendEmailResult {
  success: boolean;
  language: SupportedLocale;
  subject: string;
  messageId?: string;
  error?: string;
}

/**
 * Prepared email ready for sending.
 */
export interface PreparedEmail {
  to: string;
  subject: string;
  body: string;
  language: SupportedLocale;
}

/**
 * Email service with language resolution and template support.
 */
export class EmailService {
  private langService = getLanguageResolutionService();
  private translationService = getTranslationService();

  /**
   * Send an email using a template with language resolution.
   *
   * @param options - Email options including template, recipient, and variables
   * @returns Result with success status and message ID
   */
  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    try {
      // Resolve recipient language
      const language = await this.resolveLanguage(options);

      // Get and prepare template
      const template = getEmailTemplate(options.templateId, language);
      const subject = substituteVariables(template.subject, options.variables);
      let body = substituteVariables(template.body, options.variables);

      // Translate dynamic content if provided and not English
      if (options.dynamicContent && language !== "en") {
        const translatedContent = await this.translateDynamicContent(
          options.dynamicContent,
          language,
          options.workspaceId
        );
        body += `\n\n${translatedContent}`;
      } else if (options.dynamicContent) {
        body += `\n\n${options.dynamicContent}`;
      }

      // Send via provider
      const messageId = await this.sendViaProvider({
        to: options.to,
        subject,
        body,
        language,
      });

      log.info("Email sent", {
        templateId: options.templateId,
        to: options.to,
        language,
        messageId,
      });

      return {
        success: true,
        language,
        subject,
        messageId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error("Failed to send email", error instanceof Error ? error : new Error(errorMessage));

      return {
        success: false,
        language: "en",
        subject: "",
        error: errorMessage,
      };
    }
  }

  /**
   * Prepare an email without sending (for preview).
   *
   * @param options - Email options
   * @returns Prepared email content
   */
  async prepareEmail(options: SendEmailOptions): Promise<PreparedEmail> {
    const language = await this.resolveLanguage(options);
    const template = getEmailTemplate(options.templateId, language);
    const subject = substituteVariables(template.subject, options.variables);
    let body = substituteVariables(template.body, options.variables);

    if (options.dynamicContent && language !== "en") {
      const translatedContent = await this.translateDynamicContent(
        options.dynamicContent,
        language,
        options.workspaceId
      );
      body += `\n\n${translatedContent}`;
    } else if (options.dynamicContent) {
      body += `\n\n${options.dynamicContent}`;
    }

    return {
      to: options.to,
      subject,
      body,
      language,
    };
  }

  /**
   * Resolve recipient language from options.
   */
  private async resolveLanguage(options: SendEmailOptions): Promise<SupportedLocale> {
    // Use forced language if provided
    if (options.forceLanguage) {
      return options.forceLanguage;
    }

    // Resolve based on prospect or client
    if (options.prospectId) {
      const resolved = await this.langService.resolveForCommunication(
        options.workspaceId,
        options.prospectId,
        "prospect"
      );
      return resolved.locale;
    }

    if (options.clientId) {
      const resolved = await this.langService.resolveForCommunication(
        options.workspaceId,
        options.clientId,
        "client"
      );
      return resolved.locale;
    }

    // Default to workspace language
    const settings = await this.langService.getWorkspaceLanguageSettings(options.workspaceId);
    return settings?.defaultLanguage ?? "en";
  }

  /**
   * Translate dynamic content to target language.
   */
  private async translateDynamicContent(
    content: string,
    targetLang: SupportedLocale,
    workspaceId: string
  ): Promise<string> {
    const context: TranslationContext = {
      type: "email",
      formality: "formal",
      domain: "seo",
      workspaceId,
    };

    const result = await this.translationService.translate({
      text: content,
      sourceLang: "en",
      targetLang,
      context,
    });

    return result.text;
  }

  /**
   * Send email via provider.
   * TODO: Integrate with actual email provider (Resend, SendGrid, etc.)
   */
  private async sendViaProvider(email: PreparedEmail): Promise<string> {
    // Placeholder for actual email sending
    // In production, this would integrate with Resend, SendGrid, etc.
    log.debug("Email prepared for sending", {
      to: email.to,
      subject: email.subject,
      language: email.language,
    });

    // Return mock message ID for now
    return `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

// Singleton instance
let emailServiceInstance: EmailService | null = null;

/**
 * Get the singleton EmailService instance.
 */
export function getEmailService(): EmailService {
  if (!emailServiceInstance) {
    emailServiceInstance = new EmailService();
  }
  return emailServiceInstance;
}
