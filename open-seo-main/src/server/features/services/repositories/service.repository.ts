/**
 * Service Repository
 * Phase 58-01: Service Catalog & Extra Services - Repository Layer
 *
 * CRUD operations for service_templates table.
 * Supports system templates (workspaceId=null) and workspace-specific templates.
 */
import { eq, and, or, isNull, asc } from "drizzle-orm";
import { db } from "@/db";
import {
  serviceTemplates,
  type ServiceTemplateInsert,
  type ServiceTemplateSelect,
  type ServiceCategory,
} from "@/db/service-catalog-schema";

/**
 * Get all service templates available to a workspace.
 * Includes system templates (workspaceId = null) and workspace-specific templates.
 */
export async function findAllServices(
  workspaceId: string,
  options?: {
    category?: ServiceCategory;
    includeInactive?: boolean;
  }
): Promise<ServiceTemplateSelect[]> {
  const conditions = [
    or(
      eq(serviceTemplates.workspaceId, workspaceId),
      isNull(serviceTemplates.workspaceId)
    ),
  ];

  if (!options?.includeInactive) {
    conditions.push(eq(serviceTemplates.isActive, true));
  }

  if (options?.category) {
    conditions.push(eq(serviceTemplates.category, options.category));
  }

  return await db
    .select()
    .from(serviceTemplates)
    .where(and(...conditions))
    .orderBy(
      // System templates first, then by displayOrder, then by name
      asc(serviceTemplates.workspaceId),
      asc(serviceTemplates.displayOrder),
      asc(serviceTemplates.name)
    );
}

/**
 * Get a service template by ID.
 */
export async function findServiceById(
  serviceId: string
): Promise<ServiceTemplateSelect | undefined> {
  const [service] = await db
    .select()
    .from(serviceTemplates)
    .where(eq(serviceTemplates.id, serviceId))
    .limit(1);

  return service;
}

/**
 * Create a new service template.
 */
export async function createService(
  service: ServiceTemplateInsert
): Promise<ServiceTemplateSelect> {
  const [inserted] = await db
    .insert(serviceTemplates)
    .values(service)
    .returning();

  return inserted;
}

/**
 * Update a service template.
 */
export async function updateService(
  serviceId: string,
  updates: Partial<
    Omit<ServiceTemplateInsert, "id" | "createdAt" | "workspaceId">
  >
): Promise<ServiceTemplateSelect | undefined> {
  const [updated] = await db
    .update(serviceTemplates)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(serviceTemplates.id, serviceId))
    .returning();

  return updated;
}

/**
 * Soft delete a service template (set isActive = false).
 * Only workspace templates can be deleted, not system templates.
 */
export async function deleteService(
  serviceId: string,
  workspaceId: string
): Promise<boolean> {
  const [updated] = await db
    .update(serviceTemplates)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(
        eq(serviceTemplates.id, serviceId),
        eq(serviceTemplates.workspaceId, workspaceId) // Prevent deleting system templates
      )
    )
    .returning();

  return !!updated;
}

/**
 * Duplicate a service template to a workspace.
 * Creates a copy of a system or existing template for workspace customization.
 */
export async function duplicateService(
  serviceId: string,
  targetWorkspaceId: string,
  newName?: string
): Promise<ServiceTemplateSelect | undefined> {
  // Get the source service
  const source = await findServiceById(serviceId);
  if (!source) {
    return undefined;
  }

  const newServiceId = crypto.randomUUID();

  // Create the new service
  const [newService] = await db
    .insert(serviceTemplates)
    .values({
      id: newServiceId,
      workspaceId: targetWorkspaceId,
      category: source.category as ServiceCategory,
      name: newName ?? `${source.name} (Copy)`,
      nameEn: source.nameEn,
      nameLt: source.nameLt,
      description: source.description,
      descriptionEn: source.descriptionEn,
      descriptionLt: source.descriptionLt,
      pricingType: source.pricingType,
      basePriceCents: source.basePriceCents,
      setupFeeCents: source.setupFeeCents,
      currency: source.currency,
      unitLabel: source.unitLabel,
      inclusions: source.inclusions,
      termsTemplate: source.termsTemplate,
      termsTemplateEn: source.termsTemplateEn,
      termsTemplateLt: source.termsTemplateLt,
      icon: source.icon,
      displayOrder: source.displayOrder,
      isActive: true,
    })
    .returning();

  return newService;
}

/**
 * Count services for a workspace (including system templates).
 */
export async function countServicesForWorkspace(
  workspaceId: string
): Promise<number> {
  const services = await db
    .select()
    .from(serviceTemplates)
    .where(
      and(
        or(
          eq(serviceTemplates.workspaceId, workspaceId),
          isNull(serviceTemplates.workspaceId)
        ),
        eq(serviceTemplates.isActive, true)
      )
    );

  return services.length;
}

/**
 * Update display order for a service.
 */
export async function updateDisplayOrder(
  serviceId: string,
  newOrder: number
): Promise<void> {
  await db
    .update(serviceTemplates)
    .set({ displayOrder: newOrder, updatedAt: new Date() })
    .where(eq(serviceTemplates.id, serviceId));
}

export const ServiceRepository = {
  findAllServices,
  findServiceById,
  createService,
  updateService,
  deleteService,
  duplicateService,
  countServicesForWorkspace,
  updateDisplayOrder,
};
