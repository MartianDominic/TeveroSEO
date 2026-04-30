/**
 * Checklist validation schemas.
 * Phase 45: Data Foundation
 */
import { z } from "zod";
import { SERVICE_TIERS, CHECKLIST_CATEGORIES } from "@/db/onboarding-schema";

const checklistItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1, "Label is required"),
  category: z.enum(CHECKLIST_CATEGORIES),
  autoCompleteEvent: z.string().optional(),
  completedAt: z.string().datetime().optional(),
  completedBy: z.string().optional(),
});

export const createChecklistSchema = z.object({
  clientId: z.string().uuid("Invalid client ID"),
  serviceTier: z.enum(SERVICE_TIERS, {
    errorMap: () => ({ message: "Invalid service tier" }),
  }),
  items: z.array(checklistItemSchema).min(1, "At least one item required"),
  totalCount: z.number().int().positive(),
});

export const completeChecklistItemSchema = z.object({
  checklistId: z.string().min(1, "Checklist ID is required"),
  itemId: z.string().min(1, "Item ID is required"),
  completedBy: z.string().optional(),
});

export type CreateChecklistInput = z.infer<typeof createChecklistSchema>;
export type CompleteChecklistItemInput = z.infer<
  typeof completeChecklistItemSchema
>;
