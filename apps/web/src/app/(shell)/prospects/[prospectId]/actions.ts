"use server";

import { getProspect as getProspectBase } from "../actions";
import { patchOpenSeo } from "@/lib/server-fetch";
import { revalidatePath } from "next/cache";

export async function getProspectDetail(id: string) {
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

/**
 * Save manually entered business information to the analysis.
 */
export async function saveManualBusinessInfo(
  prospectId: string,
  analysisId: string,
  data: ManualBusinessInfoInput,
) {
  await patchOpenSeo(`/api/prospects/${prospectId}/analyses/${analysisId}/business-info`, {
    businessInfo: {
      products: data.products,
      brands: data.brands,
      services: data.services,
      location: data.location || null,
      targetMarket: data.targetMarket || null,
      summary: data.summary,
      confidence: 1.0, // Manual entry is fully confident
    },
  });

  revalidatePath(`/prospects/${prospectId}`);
}
