/**
 * Client API functions.
 * Phase 51-02: Onboarding Checklist
 *
 * Fetch client and checklist data from open-seo-main backend.
 */
import "server-only";
import { z } from "zod";

import { getOpenSeo, FastApiError } from "@/lib/server-fetch";

// --- Zod Schemas for API Response Validation ---

const clientStatusSchema = z.enum(["onboarding", "active", "paused", "churned"]);

const clientSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  domain: z.string(),
  contactEmail: z.string().nullable(),
  contactName: z.string().nullable(),
  industry: z.string().nullable(),
  status: clientStatusSchema,
  convertedFromProspectId: z.string().nullable(),
  gscRefreshToken: z.string().nullable(),
  gscSiteUrl: z.string().nullable(),
  gscConnectedAt: z.string().nullable(),
  kickoffScheduledAt: z.string().nullable(),
  kickoffCompletedAt: z.string().nullable(),
  onboardingCompletedAt: z.string().nullable(),
  baselineMetrics: z
    .object({
      traffic: z.number(),
      keywords: z.number(),
      domainRank: z.number(),
    })
    .nullable(),
  targetKeywords: z.array(z.string()).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  isDeleted: z.boolean(),
  deletedAt: z.string().nullable(),
});

const checklistCategorySchema = z.enum([
  "setup",
  "credentials",
  "kickoff",
  "content",
]);

const checklistItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  category: checklistCategorySchema,
  autoCompleteEvent: z.string().optional(),
  completedAt: z.string().optional(),
  completedBy: z.string().optional(),
});

const checklistSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  clientId: z.string(),
  serviceTier: z.string(),
  items: z.array(checklistItemSchema),
  completedCount: z.number(),
  totalCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Client = z.infer<typeof clientSchema>;
export type OnboardingChecklist = z.infer<typeof checklistSchema>;
export type ChecklistItem = z.infer<typeof checklistItemSchema>;

// --- API Response Schemas ---

const getClientResponseSchema = z.object({
  client: clientSchema,
});

const getChecklistResponseSchema = z.object({
  checklist: checklistSchema.nullable(),
});

const completeItemResponseSchema = z.object({
  checklist: checklistSchema,
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

export type CompleteItemResponse = z.infer<typeof completeItemResponseSchema>;

// --- API Functions ---

/**
 * Get a client by ID.
 */
export async function getClient(clientId: string): Promise<Client | null> {
  try {
    const response = await getOpenSeo<{ client: Client }>(
      `/api/clients/${clientId}`,
      { schema: getClientResponseSchema }
    );
    return response.client;
  } catch (error) {
    if (error instanceof FastApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Get the onboarding checklist for a client.
 */
export async function getClientChecklist(
  clientId: string
): Promise<OnboardingChecklist | null> {
  try {
    const response = await getOpenSeo<{ checklist: OnboardingChecklist | null }>(
      `/api/clients/${clientId}/checklist`,
      { schema: getChecklistResponseSchema }
    );
    return response.checklist;
  } catch (error) {
    if (error instanceof FastApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}
