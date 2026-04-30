/**
 * Template Substitution Service
 * Phase 55-06: Safe variable substitution for legal agreement templates
 *
 * Provides secure variable substitution with HTML escaping.
 * Only non-legal sections with translateValue: true get translated.
 */
import type {
  AgreementSection,
  TemplateVariable,
  AgreementLanguage,
} from "@/db/agreement-template-schema";
import { getTranslationService } from "@/server/services/translation/TranslationService";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "TemplateSubstitutionService" });

/**
 * Result of template substitution
 */
export interface SubstitutionResult {
  success: boolean;
  content: string;
  errors: string[];
  warnings: string[];
}

/**
 * Formality level for translation context
 */
export type Formality = "formal" | "informal";

/**
 * TemplateSubstitutionService - safe variable substitution for legal templates
 *
 * Security: All variable values are HTML-escaped before substitution (T-55-12).
 * Legal sections are never AI-translated - only pre-approved template text is used.
 */
export class TemplateSubstitutionService {
  /**
   * Substitute variables in template sections.
   *
   * @param sections - Template sections to process
   * @param variables - Variable definitions from template
   * @param values - Actual values to substitute
   * @param targetLanguage - Target language for translation
   * @param formality - Formal/informal for translation context
   * @returns SubstitutionResult with concatenated content
   */
  async substituteVariables(
    sections: AgreementSection[],
    variables: TemplateVariable[],
    values: Record<string, string | number | string[]>,
    targetLanguage: AgreementLanguage,
    formality: Formality = "formal"
  ): Promise<SubstitutionResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const processedSections: string[] = [];

    // Validate required variables are present
    const missingRequired = this.validateRequiredVariables(variables, values);
    if (missingRequired.length > 0) {
      return {
        success: false,
        content: "",
        errors: missingRequired.map((key) => `Missing required variable: ${key}`),
        warnings: [],
      };
    }

    // Sort sections by order
    const sortedSections = [...sections].sort((a, b) => a.order - b.order);

    // Process each section
    for (const section of sortedSections) {
      try {
        let content = section.content;

        // Substitute all variables in the section
        for (const variable of variables) {
          const value = values[variable.key];
          if (value !== undefined) {
            const formattedValue = this.formatValue(value, variable);
            const escapedValue = this.escapeHtml(formattedValue);

            // Check if value should be translated (non-legal section + translateValue)
            let finalValue = escapedValue;
            if (
              !section.isLegal &&
              variable.translateValue &&
              targetLanguage !== "en" &&
              typeof value === "string" &&
              value.length > 0
            ) {
              try {
                const translationService = getTranslationService();
                const translated = await translationService.translate({
                  text: escapedValue,
                  sourceLang: "en",
                  targetLang: targetLanguage,
                  context: {
                    type: "agreement",
                    formality,
                    domain: "seo",
                  },
                });
                finalValue = translated.text;
              } catch (translationError) {
                log.warn("Translation failed, using original value", {
                  variable: variable.key,
                  error: translationError,
                });
                warnings.push(
                  `Translation failed for ${variable.key}, using original value`
                );
              }
            }

            // Replace all occurrences of the placeholder
            const placeholder = `{{${variable.key}}}`;
            content = content.split(placeholder).join(finalValue);
          }
        }

        // Check for unsubstituted variables
        const unsubstituted = content.match(/\{\{[a-zA-Z_][a-zA-Z0-9_]*\}\}/g);
        if (unsubstituted) {
          for (const placeholder of unsubstituted) {
            warnings.push(`Unsubstituted variable in section ${section.id}: ${placeholder}`);
          }
        }

        // Add section title and content
        processedSections.push(`${section.title}\n\n${content}`);
      } catch (sectionError) {
        errors.push(`Error processing section ${section.id}: ${sectionError}`);
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        content: "",
        errors,
        warnings,
      };
    }

    return {
      success: true,
      content: processedSections.join("\n\n---\n\n"),
      errors: [],
      warnings,
    };
  }

  /**
   * Validate that all required variables have values.
   */
  private validateRequiredVariables(
    variables: TemplateVariable[],
    values: Record<string, string | number | string[]>
  ): string[] {
    const missing: string[] = [];
    for (const variable of variables) {
      if (variable.required && values[variable.key] === undefined) {
        missing.push(variable.key);
      }
    }
    return missing;
  }

  /**
   * Format a value based on its type.
   */
  private formatValue(
    value: string | number | string[],
    variable: TemplateVariable
  ): string {
    switch (variable.type) {
      case "date":
        return this.formatDate(value as string, "lt");
      case "currency":
        return this.formatCurrency(value as number, "EUR", "lt");
      case "number":
        return String(value);
      case "list":
        return Array.isArray(value) ? value.join(", ") : String(value);
      case "text":
      default:
        return String(value);
    }
  }

  /**
   * Escape HTML special characters to prevent XSS.
   * T-55-12: All variable values must be escaped.
   */
  escapeHtml(text: string): string {
    const htmlEntities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return text.replace(/[&<>"']/g, (char) => htmlEntities[char] || char);
  }

  /**
   * Escape regex special characters.
   */
  escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Format a date for the given locale.
   */
  formatDate(date: string | Date, locale: string): string {
    const d = typeof date === "string" ? new Date(date) : date;
    if (isNaN(d.getTime())) {
      return String(date);
    }
    return d.toLocaleDateString(locale === "lt" ? "lt-LT" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  /**
   * Format a currency amount for the given locale.
   */
  formatCurrency(amount: number, currency: string, locale: string): string {
    return new Intl.NumberFormat(locale === "lt" ? "lt-LT" : "en-US", {
      style: "currency",
      currency,
    }).format(amount);
  }
}

// Singleton instance
let instance: TemplateSubstitutionService | null = null;

export function getTemplateSubstitutionService(): TemplateSubstitutionService {
  if (!instance) {
    instance = new TemplateSubstitutionService();
  }
  return instance;
}
