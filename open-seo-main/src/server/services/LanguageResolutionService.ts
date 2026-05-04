/**
 * Language Resolution Service
 * Phase 55-04: Multi-Tenant Language Settings
 *
 * Resolves language preferences using a 6-step hierarchy:
 * 1. User's explicit selection (language switcher)
 * 2. Prospect's preferred language
 * 3. Client's preferred language
 * 4. Workspace default language
 * 5. Browser Accept-Language header
 * 6. Platform default (English)
 */

import { db } from "../../db";
import { organization } from "../../db/user-schema";
import { prospects } from "../../db/prospect-schema";
import { clients } from "../../db/client-schema";
import { eq } from "drizzle-orm";
import type { SupportedLocale, Formality } from "./translation/types";

// Re-export types for convenience
export type { SupportedLocale, Formality };

/**
 * Context for language resolution.
 */
export interface LanguageContext {
  /** User's explicit language selection (from UI switcher) */
  userSelection?: SupportedLocale;
  /** Prospect ID for outbound communications */
  prospectId?: string;
  /** Client ID for outbound communications */
  clientId?: string;
  /** Workspace ID (required) */
  workspaceId: string;
  /** Browser Accept-Language header */
  acceptLanguage?: string;
  /** User ID for user-level preferences (future) */
  userId?: string;
}

/**
 * Result of language resolution.
 */
export interface ResolvedLanguage {
  /** Resolved locale */
  locale: SupportedLocale;
  /** Resolved formality level */
  formality: Formality;
  /** Source of the resolution */
  source: "user" | "prospect" | "client" | "workspace" | "browser" | "default";
}

/**
 * Workspace language settings from database.
 */
interface WorkspaceLanguageSettings {
  defaultLanguage: SupportedLocale;
  supportedLanguages: SupportedLocale[];
  formality: Formality;
  country: string | null;
}

/**
 * Entity language preferences (prospect or client).
 */
interface EntityLanguagePreference {
  preferredLanguage: SupportedLocale | null;
  country: string | null;
}

/**
 * Service for resolving language preferences across the multi-tenant hierarchy.
 */
export class LanguageResolutionService {
  /** Supported locale codes */
  static readonly SUPPORTED_LOCALES: readonly SupportedLocale[] = ["en", "lt"];

  /** Platform default locale */
  static readonly DEFAULT_LOCALE: SupportedLocale = "en";

  /** Platform default formality */
  static readonly DEFAULT_FORMALITY: Formality = "formal";

  /**
   * Resolves language for a given context using 6-step hierarchy.
   *
   * Resolution order:
   * 1. User's explicit selection (language switcher in UI)
   * 2. Prospect's preferred language (for outbound communications)
   * 3. Client's preferred language (for outbound communications)
   * 4. Workspace default language
   * 5. Browser Accept-Language header
   * 6. Platform default (English)
   *
   * FIX-04 (H-PERF-01): Batches DB lookups to reduce sequential queries from 4 to 1-2.
   */
  async resolveLanguage(context: LanguageContext): Promise<ResolvedLanguage> {
    // FIX-04 (H-PERF-01): Batch fetch all needed data in parallel
    // This reduces up to 4 sequential DB calls to 1-2 parallel calls
    const [workspaceSettings, prospectLang, clientLang] = await Promise.all([
      this.getWorkspaceLanguageSettings(context.workspaceId),
      context.prospectId ? this.getProspectLanguage(context.prospectId) : Promise.resolve(null),
      context.clientId ? this.getClientLanguage(context.clientId) : Promise.resolve(null),
    ]);

    const formality = workspaceSettings?.formality ?? LanguageResolutionService.DEFAULT_FORMALITY;

    // 1. User's explicit selection
    if (context.userSelection && this.isSupported(context.userSelection)) {
      return {
        locale: context.userSelection,
        formality,
        source: "user",
      };
    }

    // 2. Prospect's preferred language
    if (prospectLang?.preferredLanguage && this.isSupported(prospectLang.preferredLanguage)) {
      return {
        locale: prospectLang.preferredLanguage,
        formality,
        source: "prospect",
      };
    }

    // 3. Client's preferred language
    if (clientLang?.preferredLanguage && this.isSupported(clientLang.preferredLanguage)) {
      return {
        locale: clientLang.preferredLanguage,
        formality,
        source: "client",
      };
    }

    // 4. Workspace default language
    if (workspaceSettings && this.isSupported(workspaceSettings.defaultLanguage)) {
      return {
        locale: workspaceSettings.defaultLanguage,
        formality: workspaceSettings.formality,
        source: "workspace",
      };
    }

    // 5. Browser Accept-Language header
    if (context.acceptLanguage) {
      const browserLocales = this.parseAcceptLanguage(context.acceptLanguage);
      const match = browserLocales.find((lang) => this.isSupported(lang as SupportedLocale));
      if (match) {
        return {
          locale: match as SupportedLocale,
          formality,
          source: "browser",
        };
      }
    }

    // 6. Platform default
    return {
      locale: LanguageResolutionService.DEFAULT_LOCALE,
      formality,
      source: "default",
    };
  }

  /**
   * Convenience method for resolving language for outbound communications.
   * Automatically determines whether to use prospect or client preferences.
   */
  async resolveForCommunication(
    workspaceId: string,
    entityId: string,
    entityType: "prospect" | "client"
  ): Promise<ResolvedLanguage> {
    const context: LanguageContext = {
      workspaceId,
      ...(entityType === "prospect" ? { prospectId: entityId } : { clientId: entityId }),
    };
    return this.resolveLanguage(context);
  }

  /**
   * Checks if a locale is supported.
   */
  isSupported(locale: string): locale is SupportedLocale {
    return LanguageResolutionService.SUPPORTED_LOCALES.includes(locale as SupportedLocale);
  }

  /**
   * Parses Accept-Language header into ordered list of language codes.
   * Example: "lt,en-US;q=0.9,en;q=0.8" -> ["lt", "en-US", "en"]
   */
  parseAcceptLanguage(header: string): string[] {
    if (!header) return [];

    const languages = header.split(",").map((lang) => {
      const [code, qValue] = lang.trim().split(";q=");
      const quality = qValue ? parseFloat(qValue) : 1.0;
      // Extract base language code (e.g., "en" from "en-US")
      const baseCode = code.split("-")[0].toLowerCase();
      return { code: baseCode, quality };
    });

    // Sort by quality descending, then return codes
    languages.sort((a, b) => b.quality - a.quality);
    return languages.map((l) => l.code);
  }

  /**
   * Gets workspace language settings from database.
   */
  async getWorkspaceLanguageSettings(workspaceId: string): Promise<WorkspaceLanguageSettings | null> {
    const result = await db
      .select({
        defaultLanguage: organization.defaultLanguage,
        supportedLanguages: organization.supportedLanguages,
        formality: organization.formality,
        country: organization.country,
      })
      .from(organization)
      .where(eq(organization.id, workspaceId))
      .limit(1);

    if (result.length === 0) return null;

    const row = result[0];
    return {
      defaultLanguage: (row.defaultLanguage as SupportedLocale) ?? LanguageResolutionService.DEFAULT_LOCALE,
      supportedLanguages: (row.supportedLanguages as SupportedLocale[]) ?? [LanguageResolutionService.DEFAULT_LOCALE],
      formality: (row.formality as Formality) ?? LanguageResolutionService.DEFAULT_FORMALITY,
      country: row.country,
    };
  }

  /**
   * Gets workspace formality setting.
   */
  async getWorkspaceFormality(workspaceId: string): Promise<Formality> {
    const settings = await this.getWorkspaceLanguageSettings(workspaceId);
    return settings?.formality ?? LanguageResolutionService.DEFAULT_FORMALITY;
  }

  /**
   * Gets prospect language preferences from database.
   */
  async getProspectLanguage(prospectId: string): Promise<EntityLanguagePreference | null> {
    const result = await db
      .select({
        preferredLanguage: prospects.preferredLanguage,
        country: prospects.country,
      })
      .from(prospects)
      .where(eq(prospects.id, prospectId))
      .limit(1);

    if (result.length === 0) return null;

    const row = result[0];
    return {
      preferredLanguage: row.preferredLanguage as SupportedLocale | null,
      country: row.country,
    };
  }

  /**
   * Gets client language preferences from database.
   */
  async getClientLanguage(clientId: string): Promise<EntityLanguagePreference | null> {
    const result = await db
      .select({
        preferredLanguage: clients.preferredLanguage,
        country: clients.country,
      })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (result.length === 0) return null;

    const row = result[0];
    return {
      preferredLanguage: row.preferredLanguage as SupportedLocale | null,
      country: row.country,
    };
  }
}

// Singleton instance
let languageResolutionService: LanguageResolutionService | null = null;

/**
 * Gets the singleton instance of LanguageResolutionService.
 */
export function getLanguageResolutionService(): LanguageResolutionService {
  if (!languageResolutionService) {
    languageResolutionService = new LanguageResolutionService();
  }
  return languageResolutionService;
}
