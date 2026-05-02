/**
 * Service Catalog Service
 * Phase 58-01: Service Catalog & Extra Services - Business Logic Layer
 *
 * Business logic for service catalog operations.
 * Handles validation, default service seeding, and workspace template management.
 */
import { ServiceRepository } from "../repositories/service.repository";
import {
  type ServiceTemplateInsert,
  type ServiceTemplateSelect,
  type ServiceCategory,
  type PricingType,
  SERVICE_CATEGORIES,
  PRICING_TYPES,
} from "@/db/service-catalog-schema";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import { seedDefaultServices, DEFAULT_SERVICES } from "@/db/seeds/default-services";
import { db } from "@/db";

const log = createLogger({ module: "ServiceCatalogService" });

// Maximum price validation: 1 million EUR in cents
const MAX_PRICE_CENTS = 100_000_000;

/**
 * Input for creating a service.
 */
export interface CreateServiceInput {
  category: ServiceCategory;
  name: string;
  nameEn?: string;
  nameLt?: string;
  description?: string;
  descriptionEn?: string;
  descriptionLt?: string;
  pricingType: PricingType;
  basePriceCents?: number;
  setupFeeCents?: number;
  currency?: string;
  unitLabel?: string;
  inclusions?: string[];
  termsTemplate?: string;
  termsTemplateEn?: string;
  termsTemplateLt?: string;
  icon?: string;
  displayOrder?: number;
}

/**
 * Input for updating a service.
 */
export interface UpdateServiceInput {
  category?: ServiceCategory;
  name?: string;
  nameEn?: string | null;
  nameLt?: string | null;
  description?: string | null;
  descriptionEn?: string | null;
  descriptionLt?: string | null;
  pricingType?: PricingType;
  basePriceCents?: number | null;
  setupFeeCents?: number | null;
  currency?: string | null;
  unitLabel?: string | null;
  inclusions?: string[] | null;
  termsTemplate?: string | null;
  termsTemplateEn?: string | null;
  termsTemplateLt?: string | null;
  icon?: string | null;
  displayOrder?: number | null;
  isActive?: boolean;
}

/**
 * Options for listing services.
 */
export interface ListServicesOptions {
  category?: ServiceCategory;
  includeInactive?: boolean;
}

/**
 * Validate service category.
 */
function validateCategory(category: string): ServiceCategory {
  if (!SERVICE_CATEGORIES.includes(category as ServiceCategory)) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Invalid service category: ${category}. Valid categories: ${SERVICE_CATEGORIES.join(", ")}`
    );
  }
  return category as ServiceCategory;
}

/**
 * Validate pricing type.
 */
function validatePricingType(pricingType: string): PricingType {
  if (!PRICING_TYPES.includes(pricingType as PricingType)) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Invalid pricing type: ${pricingType}. Valid types: ${PRICING_TYPES.join(", ")}`
    );
  }
  return pricingType as PricingType;
}

/**
 * Validate price values.
 */
function validatePrice(priceCents: number | undefined | null, fieldName: string): void {
  if (priceCents !== undefined && priceCents !== null) {
    if (priceCents < 0) {
      throw new AppError(
        "VALIDATION_ERROR",
        `${fieldName} cannot be negative`
      );
    }
    if (priceCents > MAX_PRICE_CENTS) {
      throw new AppError(
        "VALIDATION_ERROR",
        `${fieldName} exceeds maximum allowed value`
      );
    }
  }
}

/**
 * Service Catalog Service with business logic methods.
 */
export const ServiceCatalogService = {
  /**
   * List all services available to a workspace.
   */
  async listServices(
    workspaceId: string,
    options?: ListServicesOptions
  ): Promise<ServiceTemplateSelect[]> {
    log.debug("Listing services", { workspaceId, options });
    return await ServiceRepository.findAllServices(workspaceId, options);
  },

  /**
   * Get a service by ID.
   */
  async getService(serviceId: string): Promise<ServiceTemplateSelect | undefined> {
    log.debug("Getting service", { serviceId });
    return await ServiceRepository.findServiceById(serviceId);
  },

  /**
   * Create a new service template.
   */
  async createService(
    workspaceId: string,
    data: CreateServiceInput
  ): Promise<ServiceTemplateSelect> {
    log.info("Creating service", { workspaceId, name: data.name });

    // Validate inputs
    const category = validateCategory(data.category);
    const pricingType = validatePricingType(data.pricingType);
    validatePrice(data.basePriceCents, "basePriceCents");
    validatePrice(data.setupFeeCents, "setupFeeCents");

    const serviceInsert: ServiceTemplateInsert = {
      id: crypto.randomUUID(),
      workspaceId,
      category,
      name: data.name,
      nameEn: data.nameEn,
      nameLt: data.nameLt,
      description: data.description,
      descriptionEn: data.descriptionEn,
      descriptionLt: data.descriptionLt,
      pricingType,
      basePriceCents: data.basePriceCents,
      setupFeeCents: data.setupFeeCents,
      currency: data.currency ?? "EUR",
      unitLabel: data.unitLabel,
      inclusions: data.inclusions,
      termsTemplate: data.termsTemplate,
      termsTemplateEn: data.termsTemplateEn,
      termsTemplateLt: data.termsTemplateLt,
      icon: data.icon,
      displayOrder: data.displayOrder,
      isActive: true,
    };

    const service = await ServiceRepository.createService(serviceInsert);
    log.info("Service created", { serviceId: service.id });
    return service;
  },

  /**
   * Update a service template.
   */
  async updateService(
    serviceId: string,
    workspaceId: string,
    data: UpdateServiceInput
  ): Promise<ServiceTemplateSelect> {
    log.info("Updating service", { serviceId, workspaceId });

    // Verify ownership
    const existing = await ServiceRepository.findServiceById(serviceId);
    if (!existing) {
      throw new AppError("NOT_FOUND", `Service not found: ${serviceId}`);
    }
    if (existing.workspaceId !== workspaceId) {
      throw new AppError(
        "FORBIDDEN",
        "Cannot update service from another workspace"
      );
    }

    // Validate inputs
    if (data.category) {
      validateCategory(data.category);
    }
    if (data.pricingType) {
      validatePricingType(data.pricingType);
    }
    validatePrice(data.basePriceCents, "basePriceCents");
    validatePrice(data.setupFeeCents, "setupFeeCents");

    const updated = await ServiceRepository.updateService(serviceId, data);
    if (!updated) {
      throw new AppError("INTERNAL_ERROR", "Failed to update service");
    }

    log.info("Service updated", { serviceId });
    return updated;
  },

  /**
   * Delete a service template (soft delete).
   */
  async deleteService(serviceId: string, workspaceId: string): Promise<void> {
    log.info("Deleting service", { serviceId, workspaceId });

    // Verify ownership
    const existing = await ServiceRepository.findServiceById(serviceId);
    if (!existing) {
      throw new AppError("NOT_FOUND", `Service not found: ${serviceId}`);
    }
    if (existing.workspaceId === null) {
      throw new AppError("FORBIDDEN", "Cannot delete system templates");
    }
    if (existing.workspaceId !== workspaceId) {
      throw new AppError(
        "FORBIDDEN",
        "Cannot delete service from another workspace"
      );
    }

    const success = await ServiceRepository.deleteService(serviceId, workspaceId);
    if (!success) {
      throw new AppError("INTERNAL_ERROR", "Failed to delete service");
    }

    log.info("Service deleted", { serviceId });
  },

  /**
   * Duplicate a service template to a workspace.
   */
  async duplicateService(
    serviceId: string,
    workspaceId: string,
    newName?: string
  ): Promise<ServiceTemplateSelect> {
    log.info("Duplicating service", { serviceId, workspaceId });

    const duplicated = await ServiceRepository.duplicateService(
      serviceId,
      workspaceId,
      newName
    );
    if (!duplicated) {
      throw new AppError("NOT_FOUND", `Source service not found: ${serviceId}`);
    }

    log.info("Service duplicated", {
      sourceId: serviceId,
      newId: duplicated.id,
    });
    return duplicated;
  },

  /**
   * Ensure default services exist for a workspace.
   * Seeds system templates if count = 0.
   */
  async ensureDefaultServices(workspaceId: string): Promise<void> {
    log.debug("Checking default services", { workspaceId });

    const count = await ServiceRepository.countServicesForWorkspace(workspaceId);

    if (count === 0) {
      log.info("Seeding default services", { workspaceId });
      await seedDefaultServices(db);
    }
  },
};
