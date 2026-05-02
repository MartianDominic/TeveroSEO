"use server";

/**
 * Service Catalog Server Actions
 * Phase 58-02: Settings > Services CRUD operations
 *
 * Provides server actions for creating, reading, updating, deleting,
 * and duplicating service templates.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  getOpenSeo,
  postOpenSeo,
  patchOpenSeo,
  deleteOpenSeo,
} from "@/lib/server-fetch";
import {
  requireActionAuth,
  type ActionResult,
} from "@/lib/auth/action-auth";
import { sanitizeErrorForClient } from "@/lib/error-utils";
import { logError } from "@/lib/errors/handler";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const SERVICE_CATEGORIES = ["seo_package", "addon", "one_time"] as const;
export const PRICING_TYPES = ["monthly", "one_time", "per_unit"] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];
export type PricingType = (typeof PRICING_TYPES)[number];

export interface ServiceTemplateSelect {
  id: string;
  workspaceId: string | null;
  category: ServiceCategory;
  name: string;
  nameEn: string | null;
  nameLt: string | null;
  description: string | null;
  descriptionEn: string | null;
  descriptionLt: string | null;
  pricingType: PricingType;
  basePriceCents: number | null;
  setupFeeCents: number | null;
  currency: string | null;
  unitLabel: string | null;
  inclusions: string[] | null;
  termsTemplate: string | null;
  icon: string | null;
  displayOrder: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceListResponse {
  services: ServiceTemplateSelect[];
  total: number;
}

// ---------------------------------------------------------------------------
// Validation Schemas
// ---------------------------------------------------------------------------

const serviceIdSchema = z.string().uuid("Invalid service ID format");

const createServiceSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name too long"),
  nameEn: z.string().max(255).optional(),
  nameLt: z.string().max(255).optional(),
  description: z.string().max(2000).optional(),
  descriptionEn: z.string().max(2000).optional(),
  descriptionLt: z.string().max(2000).optional(),
  category: z.enum(SERVICE_CATEGORIES),
  pricingType: z.enum(PRICING_TYPES),
  basePriceCents: z.number().int().min(0, "Price cannot be negative"),
  setupFeeCents: z.number().int().min(0).optional(),
  currency: z.string().length(3).optional(),
  unitLabel: z.string().max(50).optional(),
  inclusions: z.array(z.string().max(500)).max(20).optional(),
  termsTemplate: z.string().max(10000).optional(),
  icon: z.string().max(50).optional(),
});

const updateServiceSchema = createServiceSchema.partial().extend({
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

// ---------------------------------------------------------------------------
// Server Actions
// ---------------------------------------------------------------------------

/**
 * Get all service templates for the current workspace.
 */
export async function getServices(): Promise<ActionResult<ServiceListResponse>> {
  await requireActionAuth();

  try {
    const data = await getOpenSeo<ServiceListResponse>("/api/services");
    return { success: true, data };
  } catch (error) {
    logError("getServices", error, {});
    return {
      success: false,
      error: sanitizeErrorForClient(error),
    };
  }
}

/**
 * Get a single service template by ID.
 */
export async function getService(
  serviceId: string
): Promise<ActionResult<ServiceTemplateSelect>> {
  await requireActionAuth();

  const validatedId = serviceIdSchema.safeParse(serviceId);
  if (!validatedId.success) {
    return {
      success: false,
      error: validatedId.error.issues[0]?.message || "Invalid service ID",
    };
  }

  try {
    const data = await getOpenSeo<ServiceTemplateSelect>(
      `/api/services/${validatedId.data}`
    );
    return { success: true, data };
  } catch (error) {
    logError("getService", error, { serviceId });
    return {
      success: false,
      error: sanitizeErrorForClient(error),
    };
  }
}

/**
 * Create a new service template.
 */
export async function createService(
  data: z.infer<typeof createServiceSchema>
): Promise<ActionResult<ServiceTemplateSelect>> {
  await requireActionAuth();

  const validated = createServiceSchema.safeParse(data);
  if (!validated.success) {
    return {
      success: false,
      error: validated.error.issues[0]?.message || "Invalid input",
    };
  }

  try {
    const result = await postOpenSeo<ServiceTemplateSelect>(
      "/api/services",
      validated.data
    );
    revalidatePath("/settings/services");
    return { success: true, data: result };
  } catch (error) {
    logError("createService", error, { name: data.name });
    return {
      success: false,
      error: sanitizeErrorForClient(error),
    };
  }
}

/**
 * Update an existing service template.
 */
export async function updateService(
  serviceId: string,
  data: z.infer<typeof updateServiceSchema>
): Promise<ActionResult<ServiceTemplateSelect>> {
  await requireActionAuth();

  const validatedId = serviceIdSchema.safeParse(serviceId);
  if (!validatedId.success) {
    return {
      success: false,
      error: validatedId.error.issues[0]?.message || "Invalid service ID",
    };
  }

  const validatedData = updateServiceSchema.safeParse(data);
  if (!validatedData.success) {
    return {
      success: false,
      error: validatedData.error.issues[0]?.message || "Invalid input",
    };
  }

  try {
    const result = await patchOpenSeo<ServiceTemplateSelect>(
      `/api/services/${validatedId.data}`,
      validatedData.data
    );
    revalidatePath("/settings/services");
    return { success: true, data: result };
  } catch (error) {
    logError("updateService", error, { serviceId });
    return {
      success: false,
      error: sanitizeErrorForClient(error),
    };
  }
}

/**
 * Delete a service template (soft delete via isActive=false).
 */
export async function deleteService(
  serviceId: string
): Promise<ActionResult<void>> {
  await requireActionAuth();

  const validatedId = serviceIdSchema.safeParse(serviceId);
  if (!validatedId.success) {
    return {
      success: false,
      error: validatedId.error.issues[0]?.message || "Invalid service ID",
    };
  }

  try {
    await deleteOpenSeo(`/api/services/${validatedId.data}`);
    revalidatePath("/settings/services");
    return { success: true, data: undefined };
  } catch (error) {
    logError("deleteService", error, { serviceId });
    return {
      success: false,
      error: sanitizeErrorForClient(error),
    };
  }
}

/**
 * Duplicate a service template with "(Copy)" suffix.
 */
export async function duplicateService(
  serviceId: string
): Promise<ActionResult<ServiceTemplateSelect>> {
  await requireActionAuth();

  const validatedId = serviceIdSchema.safeParse(serviceId);
  if (!validatedId.success) {
    return {
      success: false,
      error: validatedId.error.issues[0]?.message || "Invalid service ID",
    };
  }

  try {
    const result = await postOpenSeo<ServiceTemplateSelect>(
      `/api/services/${validatedId.data}/duplicate`,
      {}
    );
    revalidatePath("/settings/services");
    return { success: true, data: result };
  } catch (error) {
    logError("duplicateService", error, { serviceId });
    return {
      success: false,
      error: sanitizeErrorForClient(error),
    };
  }
}
