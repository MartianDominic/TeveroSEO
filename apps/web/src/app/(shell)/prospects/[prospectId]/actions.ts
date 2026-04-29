"use server";

import { z } from "zod";
import { getProspect as getProspectBase } from "../actions";
import { patchOpenSeo } from "@/lib/server-fetch";
import { revalidatePath } from "next/cache";
import { requireActionAuth, validateProspectOwnership, type ActionResult } from "@/lib/auth/action-auth";
import { sanitizeErrorForClient } from "@/lib/error-utils";

// Validation schemas
const prospectIdSchema = z.string().uuid("Invalid prospect ID format");
const analysisIdSchema = z.string().uuid("Invalid analysis ID format");

export async function getProspectDetail(id: string) {
  // Validation and ownership check is handled by getProspectBase
  return getProspectBase(id);
}

export interface ManualBusinessInfoInput {
  products: string[];
  brands: string[];
  services: string[];
  location: string;
  targetMarket: "residential" | "commercial" | "both" | "";
  summary: string;
}

// Business info validation schema with size limits
const manualBusinessInfoSchema = z.object({
  products: z.array(z.string().max(200, "Product name too long")).max(100, "Maximum 100 products allowed"),
  brands: z.array(z.string().max(200, "Brand name too long")).max(100, "Maximum 100 brands allowed"),
  services: z.array(z.string().max(200, "Service name too long")).max(100, "Maximum 100 services allowed"),
  location: z.string().max(500, "Location too long"),
  targetMarket: z.enum(["residential", "commercial", "both", ""]),
  summary: z.string().max(5000, "Summary too long"),
});

/**
 * Save manually entered business information to the analysis.
 */
export async function saveManualBusinessInfo(
  prospectId: string,
  analysisId: string,
  data: ManualBusinessInfoInput,
): Promise<ActionResult<void>> {
  const auth = await requireActionAuth();

  // Validate prospect ID format
  const validatedProspectId = prospectIdSchema.safeParse(prospectId);
  if (!validatedProspectId.success) {
    return { success: false, error: validatedProspectId.error.issues[0]?.message || "Invalid prospect ID" };
  }

  // Validate analysis ID format
  const validatedAnalysisId = analysisIdSchema.safeParse(analysisId);
  if (!validatedAnalysisId.success) {
    return { success: false, error: validatedAnalysisId.error.issues[0]?.message || "Invalid analysis ID" };
  }

  // Validate business info data
  const validatedData = manualBusinessInfoSchema.safeParse(data);
  if (!validatedData.success) {
    return { success: false, error: validatedData.error.issues[0]?.message || "Invalid input" };
  }

  try {
    // Validate ownership before saving
    await validateProspectOwnership(validatedProspectId.data, auth);

    await patchOpenSeo(`/api/prospects/${validatedProspectId.data}/analyses/${validatedAnalysisId.data}/business-info`, {
      businessInfo: {
        products: validatedData.data.products,
        brands: validatedData.data.brands,
        services: validatedData.data.services,
        location: validatedData.data.location || null,
        targetMarket: validatedData.data.targetMarket || null,
        summary: validatedData.data.summary,
        confidence: 1.0, // Manual entry is fully confident
      },
    });

    revalidatePath(`/prospects/${validatedProspectId.data}`);
    return { success: true, data: undefined };
  } catch (error) {
    console.error("[saveManualBusinessInfo] Error:", error);
    return {
      success: false,
      error: sanitizeErrorForClient(error),
    };
  }
}
