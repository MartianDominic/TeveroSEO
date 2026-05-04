import { z } from "zod";

/**
 * Schema for creating SEO projects.
 *
 * H-ONBOARD-01 FIX: Added idempotencyKey field to prevent duplicate
 * project creation when users retry after network errors.
 */
export const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(120),
  domain: z
    .string()
    .trim()
    .max(255)
    .transform((value) => value || undefined)
    .optional(),
  // H-ONBOARD-01: Idempotency key to prevent duplicates on retry
  // Format: seo-project:{client_id}:{normalized_domain}:{5min_window}
  idempotencyKey: z
    .string()
    .max(255)
    .optional(),
});

export const deleteProjectSchema = z.object({
  projectId: z.string().min(1),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type DeleteProjectInput = z.infer<typeof deleteProjectSchema>;
