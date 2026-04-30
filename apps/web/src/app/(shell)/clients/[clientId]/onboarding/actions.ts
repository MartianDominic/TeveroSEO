"use server";

/**
 * Onboarding Server Actions
 * Phase 51-02: Onboarding Checklist
 *
 * Server actions for completing checklist items.
 */

import { z } from "zod";
import { postOpenSeo, FastApiError } from "@/lib/server-fetch";
import { revalidatePath } from "next/cache";

const completeItemResponseSchema = z.object({
  checklist: z.object({
    id: z.string(),
    completedCount: z.number(),
    totalCount: z.number(),
  }),
  conversionSummary: z
    .object({
      clientId: z.string(),
      clientName: z.string(),
      serviceTier: z.string(),
      completedAt: z.string(),
      connectedServices: z.array(z.string()),
      nextSteps: z.array(z.string()),
    })
    .nullable(),
});

export interface CompleteItemResult {
  success: boolean;
  error?: string;
  conversionSummary?: {
    clientId: string;
    clientName: string;
    serviceTier: string;
    completedAt: string;
    connectedServices: string[];
    nextSteps: string[];
  } | null;
}

/**
 * Complete a checklist item.
 * Returns the conversion summary if this completion triggered conversion.
 */
export async function completeChecklistItem(
  checklistId: string,
  itemId: string
): Promise<CompleteItemResult> {
  try {
    const response = await postOpenSeo<z.infer<typeof completeItemResponseSchema>>(
      `/api/checklists/${checklistId}/items/${itemId}/complete`,
      {},
      { schema: completeItemResponseSchema }
    );

    // Revalidate the onboarding page
    revalidatePath(`/clients/[clientId]/onboarding`, "page");

    return {
      success: true,
      conversionSummary: response.conversionSummary,
    };
  } catch (error) {
    if (error instanceof FastApiError) {
      return {
        success: false,
        error: error.sanitizedBody.error,
      };
    }
    return {
      success: false,
      error: "Failed to complete item",
    };
  }
}
