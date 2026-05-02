/**
 * Agreement Variable Service
 * Phase 59: Agreement & Signing Excellence
 *
 * Resolves {{variable.key}} placeholders to actual values from agreement context.
 * Supports categories: client, provider, services, agreement, signatures, payment per D-12-D-15.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db/index";
import { generatedAgreements } from "@/db/agreement-template-schema";
import { proposals } from "@/db/proposal-schema";
import { prospects } from "@/db/prospect-schema";
import { organization } from "@/db/user-schema";
import { agreementSigners } from "@/db/schema/agreement-signers-schema";
import { proposalServices, serviceTemplates } from "@/db/service-catalog-schema";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "AgreementVariableService" });

/**
 * Context for agreement variable resolution.
 */
export interface AgreementResolutionContext {
  agreement: {
    id: string;
    startDate?: Date | null;
    endDate?: Date | null;
    durationMonths?: number | null;
    signingCity?: string | null;
    paymentTerms?: string | null;
    paymentDueDays?: number | null;
  } | null;
  proposal: {
    id: string;
    setupFeeCents?: number | null;
    monthlyFeeCents?: number | null;
    currency?: string | null;
  } | null;
  prospect: {
    id: string;
    companyName: string | null;
    companyCode?: string | null;
    vatNumber?: string | null;
    address?: string | null;
    contactName: string | null;
    contactEmail: string | null;
  } | null;
  workspace: {
    id: string;
    name: string;
    companyName?: string | null;
    companyCode?: string | null;
    vatNumber?: string | null;
    address?: string | null;
    email?: string | null;
    phone?: string | null;
    bankAccount?: string | null;
    bankName?: string | null;
    city?: string | null;
  } | null;
  signers: Array<{
    id: string;
    role: string;
    name: string;
    title: string | null;
    email: string;
    companyName: string | null;
  }>;
  services: Array<{
    name: string;
    monthlyFeeCents: number | null;
    setupFeeCents: number | null;
  }>;
  locale: "en" | "lt";
}

/**
 * Resolved variable structure.
 */
export interface ResolvedAgreementVariable {
  key: string;
  value: string;
  isEmpty: boolean;
}

export type ResolvedAgreementVariables = Record<string, ResolvedAgreementVariable>;

// Translations for fallback values
const TRANSLATIONS = {
  notProvided: { en: "Not provided", lt: "Nepateikta" },
  authorizedRep: { en: "Authorized Representative", lt: "Igaliotas atstovas" },
  director: { en: "Director", lt: "Direktorius" },
  indefinite: { en: "Indefinite", lt: "Neterminuota" },
  months: { en: "months", lt: "men." },
  days: { en: "days", lt: "d." },
} as const;

function t(key: keyof typeof TRANSLATIONS, locale: "en" | "lt"): string {
  return TRANSLATIONS[key][locale];
}

/**
 * Format a currency value.
 */
function formatCurrency(amountCents: number | null | undefined, locale: "en" | "lt", currency = "EUR"): string {
  if (amountCents === null || amountCents === undefined) return "";
  const amount = amountCents / 100;
  const localeStr = locale === "lt" ? "lt-LT" : "en-US";
  return new Intl.NumberFormat(localeStr, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a date.
 */
function formatDate(date: Date | null | undefined, locale: "en" | "lt"): string {
  if (!date) return "";
  const localeStr = locale === "lt" ? "lt-LT" : "en-US";
  return new Intl.DateTimeFormat(localeStr, { dateStyle: "long" }).format(date);
}

/**
 * Format service list as bullet points.
 */
function formatServiceList(
  services: AgreementResolutionContext["services"],
  locale: "en" | "lt"
): string {
  if (!services.length) return "";
  return services
    .map((s) => {
      const monthly = s.monthlyFeeCents
        ? ` (${formatCurrency(s.monthlyFeeCents, locale)}/men.)`
        : "";
      return `- ${s.name}${monthly}`;
    })
    .join("\n");
}

export const AgreementVariableService = {
  /**
   * Load resolution context for an agreement.
   */
  async loadContext(
    agreementId: string,
    locale: "en" | "lt" = "en"
  ): Promise<AgreementResolutionContext> {
    // Load agreement
    const [agreement] = await db
      .select()
      .from(generatedAgreements)
      .where(eq(generatedAgreements.id, agreementId))
      .limit(1);

    if (!agreement) {
      return {
        agreement: null,
        proposal: null,
        prospect: null,
        workspace: null,
        signers: [],
        services: [],
        locale,
      };
    }

    // Load related data in parallel
    const [proposalResult, workspaceResult, signersResult] = await Promise.all([
      // Proposal
      agreement.proposalId
        ? db
            .select({
              id: proposals.id,
              setupFeeCents: proposals.setupFeeCents,
              monthlyFeeCents: proposals.monthlyFeeCents,
              currency: proposals.currency,
              prospectId: proposals.prospectId,
            })
            .from(proposals)
            .where(eq(proposals.id, agreement.proposalId))
            .limit(1)
        : Promise.resolve([]),

      // Workspace
      db
        .select({
          id: organization.id,
          name: organization.name,
        })
        .from(organization)
        .where(eq(organization.id, agreement.workspaceId))
        .limit(1),

      // Signers
      db
        .select({
          id: agreementSigners.id,
          role: agreementSigners.role,
          name: agreementSigners.name,
          title: agreementSigners.title,
          email: agreementSigners.email,
          companyName: agreementSigners.companyName,
        })
        .from(agreementSigners)
        .where(eq(agreementSigners.agreementId, agreementId)),
    ]);

    const proposal = proposalResult[0] ?? null;

    // Load prospect from proposal
    let prospect = null;
    if (proposal?.prospectId) {
      const [prospectRow] = await db
        .select({
          id: prospects.id,
          companyName: prospects.companyName,
          contactName: prospects.contactName,
          contactEmail: prospects.contactEmail,
        })
        .from(prospects)
        .where(eq(prospects.id, proposal.prospectId))
        .limit(1);
      prospect = prospectRow ?? null;
    }

    // Load services from proposal
    let services: AgreementResolutionContext["services"] = [];
    if (proposal) {
      try {
        const serviceRows = await db
          .select({
            name: serviceTemplates.name,
            monthlyFeeCents: proposalServices.customPriceCents,
            setupFeeCents: proposalServices.customSetupCents,
          })
          .from(proposalServices)
          .leftJoin(serviceTemplates, eq(proposalServices.serviceTemplateId, serviceTemplates.id))
          .where(eq(proposalServices.proposalId, proposal.id));

        services = serviceRows.map(row => ({
          name: row.name ?? "Service",
          monthlyFeeCents: row.monthlyFeeCents,
          setupFeeCents: row.setupFeeCents,
        }));
      } catch {
        // Table may not exist or be empty - services will remain empty
        log.debug("No services found for proposal", { proposalId: proposal.id });
      }
    }

    return {
      agreement: {
        id: agreement.id,
        startDate: null, // Will be extended when agreement schema has these fields
        endDate: null,
        durationMonths: null,
        signingCity: null,
        paymentTerms: null,
        paymentDueDays: null,
      },
      proposal: proposal ? {
        id: proposal.id,
        setupFeeCents: proposal.setupFeeCents,
        monthlyFeeCents: proposal.monthlyFeeCents,
        currency: proposal.currency,
      } : null,
      prospect,
      workspace: workspaceResult[0] ?? null,
      signers: signersResult,
      services,
      locale,
    };
  },

  /**
   * Resolve all variables for an agreement.
   */
  async resolveVariables(
    agreementId: string,
    locale: "en" | "lt" = "en"
  ): Promise<ResolvedAgreementVariables> {
    const ctx = await this.loadContext(agreementId, locale);
    return this.resolveWithContext(ctx);
  },

  /**
   * Resolve variables with a provided context.
   */
  resolveWithContext(ctx: AgreementResolutionContext): ResolvedAgreementVariables {
    const { locale, signers, services } = ctx;

    const providerSigner = signers.find((s) => s.role === "provider");
    const clientSigners = signers.filter((s) => s.role === "client");

    const sumMonthly = services.reduce((acc, s) => acc + (s.monthlyFeeCents ?? 0), 0);
    const sumSetup = services.reduce((acc, s) => acc + (s.setupFeeCents ?? 0), 0);
    const currency = ctx.proposal?.currency ?? "EUR";

    const variables: Record<string, string> = {
      // Client variables (D-13)
      "client.name": ctx.prospect?.companyName ?? t("notProvided", locale),
      "client.companyCode": (ctx.prospect as Record<string, unknown>)?.companyCode as string ?? t("notProvided", locale),
      "client.vatNumber": (ctx.prospect as Record<string, unknown>)?.vatNumber as string ?? t("notProvided", locale),
      "client.address": (ctx.prospect as Record<string, unknown>)?.address as string ?? t("notProvided", locale),
      "client.representative": clientSigners[0]?.name ?? ctx.prospect?.contactName ?? t("notProvided", locale),
      "client.representativeTitle": clientSigners[0]?.title ?? t("authorizedRep", locale),

      // Provider variables (D-13)
      "provider.name": (ctx.workspace as Record<string, unknown>)?.companyName as string ?? ctx.workspace?.name ?? t("notProvided", locale),
      "provider.companyCode": (ctx.workspace as Record<string, unknown>)?.companyCode as string ?? t("notProvided", locale),
      "provider.vatNumber": (ctx.workspace as Record<string, unknown>)?.vatNumber as string ?? t("notProvided", locale),
      "provider.address": (ctx.workspace as Record<string, unknown>)?.address as string ?? t("notProvided", locale),
      "provider.representative": providerSigner?.name ?? t("notProvided", locale),
      "provider.representativeTitle": providerSigner?.title ?? t("director", locale),
      "provider.email": (ctx.workspace as Record<string, unknown>)?.email as string ?? "",
      "provider.phone": (ctx.workspace as Record<string, unknown>)?.phone as string ?? "",
      "provider.bankAccount": (ctx.workspace as Record<string, unknown>)?.bankAccount as string ?? "",
      "provider.bankName": (ctx.workspace as Record<string, unknown>)?.bankName as string ?? "",

      // Service variables (D-15)
      "services.list": formatServiceList(services, locale),
      "services.monthly": formatCurrency(sumMonthly || ctx.proposal?.monthlyFeeCents, locale, currency),
      "services.setup": formatCurrency(sumSetup || ctx.proposal?.setupFeeCents, locale, currency),
      "services.total": formatCurrency((sumMonthly || ctx.proposal?.monthlyFeeCents || 0) + (sumSetup || ctx.proposal?.setupFeeCents || 0), locale, currency),

      // Agreement variables (D-13)
      "agreement.startDate": formatDate(ctx.agreement?.startDate, locale) || t("notProvided", locale),
      "agreement.endDate": ctx.agreement?.endDate
        ? formatDate(ctx.agreement.endDate, locale)
        : t("indefinite", locale),
      "agreement.duration": ctx.agreement?.durationMonths
        ? `${ctx.agreement.durationMonths} ${t("months", locale)}`
        : t("indefinite", locale),
      "agreement.city": ctx.agreement?.signingCity ?? (ctx.workspace as Record<string, unknown>)?.city as string ?? "",
      "agreement.date": formatDate(new Date(), locale),

      // Signer variables (D-13)
      "signer1.name": providerSigner?.name ?? "",
      "signer1.title": providerSigner?.title ?? "",
      "signer2.name": clientSigners[0]?.name ?? "",
      "signer2.title": clientSigners[0]?.title ?? "",
      "signer3.name": clientSigners[1]?.name ?? "",
      "signer3.title": clientSigners[1]?.title ?? "",

      // Payment variables
      "payment.terms": ctx.agreement?.paymentTerms ?? "",
      "payment.dueDate": ctx.agreement?.paymentDueDays
        ? `${ctx.agreement.paymentDueDays} ${t("days", locale)}`
        : `14 ${t("days", locale)}`,
    };

    // Convert to ResolvedAgreementVariables format
    const resolved: ResolvedAgreementVariables = {};
    for (const [key, value] of Object.entries(variables)) {
      resolved[key] = {
        key,
        value,
        isEmpty: !value || value === t("notProvided", locale),
      };
    }

    log.info("Variables resolved", {
      agreementId: ctx.agreement?.id,
      locale,
      count: Object.keys(resolved).length,
    });

    return resolved;
  },

  /**
   * Replace variable placeholders in text.
   * Supports both {{key}} and {{category.key}} formats.
   */
  replaceInText(text: string, resolved: ResolvedAgreementVariables): string {
    return text.replace(/\{\{([^}]+)\}\}/g, (match, key: string) => {
      const trimmedKey = key.trim();
      const variable = resolved[trimmedKey];

      if (!variable) {
        log.warn("Unknown variable in text", { key: trimmedKey });
        return match; // Keep original if not found
      }

      return variable.value;
    });
  },

  /**
   * Get available variable keys for palette UI.
   */
  getAvailableVariables(locale: "en" | "lt"): Array<{ key: string; label: string; category: string }> {
    const categories = {
      client: locale === "lt" ? "Klientas" : "Client",
      provider: locale === "lt" ? "Teikjas" : "Provider",
      services: locale === "lt" ? "Paslaugos" : "Services",
      agreement: locale === "lt" ? "Sutartis" : "Agreement",
      signatures: locale === "lt" ? "Parasai" : "Signatures",
      payment: locale === "lt" ? "Mokjimas" : "Payment",
    };

    return [
      { key: "client.name", label: locale === "lt" ? "Imones pavadinimas" : "Company name", category: categories.client },
      { key: "client.companyCode", label: locale === "lt" ? "Imones kodas" : "Company code", category: categories.client },
      { key: "client.representative", label: locale === "lt" ? "Atstovas" : "Representative", category: categories.client },
      { key: "provider.name", label: locale === "lt" ? "Teikjo pavadinimas" : "Provider name", category: categories.provider },
      { key: "provider.companyCode", label: locale === "lt" ? "Teikjo kodas" : "Provider code", category: categories.provider },
      { key: "provider.representative", label: locale === "lt" ? "Teikjo atstovas" : "Provider rep", category: categories.provider },
      { key: "services.list", label: locale === "lt" ? "Paslaugu sarasas" : "Service list", category: categories.services },
      { key: "services.monthly", label: locale === "lt" ? "Menesine imoka" : "Monthly fee", category: categories.services },
      { key: "services.setup", label: locale === "lt" ? "Pradine imoka" : "Setup fee", category: categories.services },
      { key: "agreement.startDate", label: locale === "lt" ? "Pradzios data" : "Start date", category: categories.agreement },
      { key: "agreement.city", label: locale === "lt" ? "Pasirasymo miestas" : "Signing city", category: categories.agreement },
      { key: "signer1.name", label: locale === "lt" ? "Pasirasytojas 1" : "Signer 1 name", category: categories.signatures },
      { key: "signer2.name", label: locale === "lt" ? "Pasirasytojas 2" : "Signer 2 name", category: categories.signatures },
    ];
  },
};
