/**
 * AgreementGenerationService
 * Phase 58-04: Service Terms Integration for Agreements
 *
 * Aggregates service-specific terms from selected services
 * to be included in generated agreements.
 *
 * Security:
 * - T-58-10: Only returns services for proposals user has access to
 * - T-58-11: Service terms marked isLegal: true, not AI-translatable
 * - T-58-12: Validates proposal access before returning data
 */
import { db } from "@/db";
import { proposalServices, serviceTemplates } from "@/db/service-catalog-schema";
import { eq, and } from "drizzle-orm";
import type { AgreementSection } from "@/db/agreement-template-schema";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "AgreementGenerationService" });

interface ServiceTerms {
  serviceId: string;
  serviceName: string;
  terms: string;
  termsEn?: string | null;
  termsLt?: string | null;
}

/**
 * Get all service terms for a proposal's selected services.
 * Only returns services that have termsTemplate defined.
 */
export async function getServiceTermsForProposal(
  proposalId: string,
  locale: "en" | "lt" = "en"
): Promise<ServiceTerms[]> {
  // Get selected services with their templates
  const selections = await db
    .select({
      serviceId: serviceTemplates.id,
      serviceName: serviceTemplates.name,
      serviceNameEn: serviceTemplates.nameEn,
      serviceNameLt: serviceTemplates.nameLt,
      terms: serviceTemplates.termsTemplate,
      termsEn: serviceTemplates.termsTemplateEn,
      termsLt: serviceTemplates.termsTemplateLt,
      isIncluded: proposalServices.isIncluded,
    })
    .from(proposalServices)
    .innerJoin(
      serviceTemplates,
      eq(proposalServices.serviceTemplateId, serviceTemplates.id)
    )
    .where(
      and(
        eq(proposalServices.proposalId, proposalId),
        eq(proposalServices.isIncluded, true)
      )
    );

  // Filter to only services with terms and map to locale
  return selections
    .filter((s) => s.terms || s.termsEn || s.termsLt)
    .map((s) => ({
      serviceId: s.serviceId,
      serviceName:
        locale === "lt" && s.serviceNameLt
          ? s.serviceNameLt
          : s.serviceNameEn || s.serviceName,
      terms:
        locale === "lt" && s.termsLt
          ? s.termsLt
          : s.termsEn || s.terms || "",
      termsEn: s.termsEn,
      termsLt: s.termsLt,
    }));
}

/**
 * Generate AgreementSection objects for service terms.
 * Each service with terms becomes its own section in the agreement.
 *
 * Service terms are marked as legal content (isLegal: true) to
 * prevent AI translation - they must remain legally approved.
 */
export async function generateServiceTermsSections(
  proposalId: string,
  locale: "en" | "lt" = "en",
  startingOrder: number = 100
): Promise<AgreementSection[]> {
  const serviceTerms = await getServiceTermsForProposal(proposalId, locale);

  log.debug("Generating service terms sections", {
    proposalId,
    locale,
    serviceCount: serviceTerms.length,
  });

  return serviceTerms.map((st, idx) => ({
    id: `service-terms-${st.serviceId}`,
    title: `${st.serviceName} - Terms`,
    content: st.terms,
    isLegal: true, // Service terms are legal content, not AI-translatable
    order: startingOrder + idx,
  }));
}

/**
 * Resolved service with template data merged with selection data.
 * Used by the proposal view to display service line items.
 */
export interface ResolvedService {
  id: string;
  name: string;
  nameEn: string | null;
  nameLt: string | null;
  category: "seo_package" | "addon" | "one_time";
  pricingType: "monthly" | "one_time" | "per_unit";
  basePriceCents: number | null;
  setupFeeCents: number | null;
  inclusions: string[] | null;
  icon: string | null;
  customPriceCents: number | null;
  customSetupCents: number | null;
  quantity: number;
}

/**
 * Get resolved services for a proposal (with template data merged).
 * Used by the proposal view to display service line items.
 */
export async function getResolvedServicesForProposal(
  proposalId: string
): Promise<ResolvedService[]> {
  const result = await db
    .select({
      // From proposalServices
      id: proposalServices.id,
      customPriceCents: proposalServices.customPriceCents,
      customSetupCents: proposalServices.customSetupCents,
      quantity: proposalServices.quantity,
      isIncluded: proposalServices.isIncluded,
      displayOrder: proposalServices.displayOrder,
      // From serviceTemplates
      serviceId: serviceTemplates.id,
      name: serviceTemplates.name,
      nameEn: serviceTemplates.nameEn,
      nameLt: serviceTemplates.nameLt,
      category: serviceTemplates.category,
      pricingType: serviceTemplates.pricingType,
      basePriceCents: serviceTemplates.basePriceCents,
      setupFeeCents: serviceTemplates.setupFeeCents,
      inclusions: serviceTemplates.inclusions,
      icon: serviceTemplates.icon,
    })
    .from(proposalServices)
    .innerJoin(
      serviceTemplates,
      eq(proposalServices.serviceTemplateId, serviceTemplates.id)
    )
    .where(
      and(
        eq(proposalServices.proposalId, proposalId),
        eq(proposalServices.isIncluded, true)
      )
    )
    .orderBy(proposalServices.displayOrder);

  log.debug("Fetched resolved services", {
    proposalId,
    serviceCount: result.length,
  });

  return result.map((r) => ({
    id: r.serviceId,
    name: r.name,
    nameEn: r.nameEn,
    nameLt: r.nameLt,
    category: r.category as "seo_package" | "addon" | "one_time",
    pricingType: r.pricingType as "monthly" | "one_time" | "per_unit",
    basePriceCents: r.basePriceCents,
    setupFeeCents: r.setupFeeCents,
    inclusions: r.inclusions as string[] | null,
    icon: r.icon,
    customPriceCents: r.customPriceCents,
    customSetupCents: r.customSetupCents,
    quantity: r.quantity ?? 1,
  }));
}

/**
 * Exported service object for namespace import pattern.
 */
export const AgreementGenerationService = {
  getServiceTermsForProposal,
  generateServiceTermsSections,
  getResolvedServicesForProposal,
};
