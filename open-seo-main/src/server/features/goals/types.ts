/**
 * Goal management types and validation schemas.
 * Phase 22: Goal-Based Metrics System
 */
import { z } from "zod";

export const createGoalSchema = z.object({
  templateId: z.string().min(1, "Template is required"),
  targetValue: z.number().positive("Target must be positive"),
  targetDenominator: z.number().positive().optional(),
  customName: z.string().optional(),
  customDescription: z.string().optional(),
  isPrimary: z.boolean().default(false),
  isClientVisible: z.boolean().default(true),
});

export const updateGoalSchema = z.object({
  targetValue: z.number().positive().optional(),
  targetDenominator: z.number().positive().optional(),
  customName: z.string().optional(),
  customDescription: z.string().optional(),
  isPrimary: z.boolean().optional(),
  isClientVisible: z.boolean().optional(),
  currentValue: z.number().optional(),
});

export const bulkCreateGoalsSchema = z.object({
  goals: z.array(createGoalSchema).min(1).max(10),
});

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
export type BulkCreateGoalsInput = z.infer<typeof bulkCreateGoalsSchema>;
