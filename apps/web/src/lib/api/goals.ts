/**
 * Goal management API functions.
 * Phase 22: Goal-Based Metrics System
 *
 * NOTE: Goals are routed to open-seo-main (the source of truth for goal CRUD).
 * The GoalService in open-seo-main provides full persistence via Drizzle/PostgreSQL.
 * Rich goal features (trends, projections, notifications) are planned for Phase 40+.
 */

import { z } from "zod";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

import { logger } from '@/lib/logger';
// Default timeout for goal API calls (30 seconds)
const GOAL_API_TIMEOUT = 30_000;

// --- Zod Schemas for API Response Validation ---

const goalStatusSchema = z.enum(["active", "achieved", "abandoned"]);

const goalTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  metric: z.string(),
  description: z.string().nullable(),
});

const clientGoalSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  templateId: z.string().nullable(),
  customName: z.string().nullable(),
  targetValue: z.string(),
  currentValue: z.string(),
  startDate: z.string().nullable(),
  targetDate: z.string().nullable(),
  status: goalStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

const goalWithTemplateSchema = z.object({
  goal: clientGoalSchema,
  template: goalTemplateSchema,
});

const getGoalTemplatesResponseSchema = z.object({
  templates: z.array(goalTemplateSchema).optional(),
});

const getClientGoalsResponseSchema = z.object({
  goals: z.array(goalWithTemplateSchema).optional(),
});

const getSingleGoalResponseSchema = z.object({
  goal: goalWithTemplateSchema.nullable().optional(),
});

const createGoalResponseSchema = z.object({
  id: z.string(),
});

const updateGoalResponseSchema = z.object({
  id: z.string(),
});

const bulkCreateResultSchema = z.object({
  success: z.boolean(),
  id: z.string().optional(),
  error: z.string().optional(),
});

const bulkCreateGoalsResponseSchema = z.object({
  results: z.array(bulkCreateResultSchema).optional(),
});

/**
 * Goal template from API.
 * Maps to GoalTemplateResponse in backend.
 */
export interface GoalTemplate {
  id: string;
  name: string;
  metric: string;
  description: string | null;
  // TODO: Phase 40+ - Backend will add these fields when full goal system is implemented
  // goalType: string;
  // unit: string | null;
  // defaultTarget: string | null;
  // hasDenominator: boolean;
  // computationMethod: string;
  // isActive: boolean;
  // displayOrder: number;
}

/**
 * Client goal from API.
 * Maps to GoalResponse in backend.
 */
export interface ClientGoal {
  id: string;
  clientId: string;
  templateId: string | null;
  customName: string | null;
  targetValue: string;
  currentValue: string;
  startDate: string | null;
  targetDate: string | null;
  status: "active" | "achieved" | "abandoned";
  createdAt: string;
  updatedAt: string;
  // TODO: Phase 40+ - Backend will add these fields when full goal system is implemented
  // workspaceId: string;
  // targetDenominator: number | null;
  // customDescription: string | null;
  // attainmentPct: string | null;
  // trendDirection: string | null;
  // trendValue: string | null;
  // lastComputedAt: string | null;
  // isPrimary: boolean;
  // isClientVisible: boolean;
  // notifyOnRegression: boolean;
  // regressionThreshold: string;
}

/**
 * Goal with template data.
 */
export interface GoalWithTemplate {
  goal: ClientGoal;
  template: GoalTemplate;
}

/**
 * Goal creation input.
 * Matches what the backend API expects.
 */
export interface CreateGoalInput {
  templateId: string;
  targetValue: number;
  customName?: string;
  workspaceId: string;
  // TODO: Phase 40+ - Re-enable when backend supports these fields
  // targetDenominator?: number;
  // customDescription?: string;
  // isPrimary?: boolean;
  // isClientVisible?: boolean;
}

/**
 * Goal update input.
 * Matches what the backend API expects.
 */
export interface UpdateGoalInput {
  targetValue?: number;
  customName?: string;
  status?: "active" | "achieved" | "abandoned";
  // TODO: Phase 40+ - Re-enable when backend supports these fields
  // targetDenominator?: number;
  // customDescription?: string;
  // isPrimary?: boolean;
  // isClientVisible?: boolean;
  // currentValue?: number;
}

/**
 * Fetch all goal templates.
 */
export async function getGoalTemplates(): Promise<GoalTemplate[]> {
  const res = await fetchWithTimeout("/api/goal-templates", { timeout: GOAL_API_TIMEOUT });
  if (!res.ok) {
    return [];
  }
  const json = await res.json();
  const parsed = getGoalTemplatesResponseSchema.safeParse(json);
  if (!parsed.success) {
    logger.error("[goals] Invalid goal templates response", { error: parsed.error });
    return [];
  }
  return (parsed.data.templates ?? []) as GoalTemplate[];
}

/**
 * Fetch all goals for a client.
 */
export async function getClientGoals(clientId: string): Promise<GoalWithTemplate[]> {
  const res = await fetchWithTimeout(`/api/clients/${clientId}/goals`, { timeout: GOAL_API_TIMEOUT });
  if (!res.ok) {
    return [];
  }
  const json = await res.json();
  const parsed = getClientGoalsResponseSchema.safeParse(json);
  if (!parsed.success) {
    logger.error("[goals] Invalid client goals response", { error: parsed.error });
    return [];
  }
  return (parsed.data.goals ?? []) as GoalWithTemplate[];
}

/**
 * Get a single goal.
 */
export async function getGoal(
  clientId: string,
  goalId: string,
): Promise<GoalWithTemplate | null> {
  const res = await fetchWithTimeout(`/api/clients/${clientId}/goals/${goalId}`, { timeout: GOAL_API_TIMEOUT });
  if (!res.ok) {
    return null;
  }
  const json = await res.json();
  const parsed = getSingleGoalResponseSchema.safeParse(json);
  if (!parsed.success) {
    logger.error("[goals] Invalid single goal response", { error: parsed.error });
    return null;
  }
  return (parsed.data.goal ?? null) as GoalWithTemplate | null;
}

/**
 * Create a new goal for a client.
 */
export async function createGoal(
  clientId: string,
  input: CreateGoalInput,
): Promise<{ id: string }> {
  const res = await fetchWithTimeout(`/api/clients/${clientId}/goals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    timeout: GOAL_API_TIMEOUT,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Create failed" }));
    throw new Error(err.error ?? "Failed to create goal");
  }
  const json = await res.json();
  const parsed = createGoalResponseSchema.safeParse(json);
  if (!parsed.success) {
    logger.error("[goals] Invalid create goal response", { error: parsed.error });
    throw new Error("Invalid response from server");
  }
  return parsed.data;
}

/**
 * Update an existing goal.
 */
export async function updateGoal(
  clientId: string,
  goalId: string,
  input: UpdateGoalInput,
): Promise<{ id: string }> {
  const res = await fetchWithTimeout(`/api/clients/${clientId}/goals/${goalId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    timeout: GOAL_API_TIMEOUT,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Update failed" }));
    throw new Error(err.error ?? "Failed to update goal");
  }
  const json = await res.json();
  const parsed = updateGoalResponseSchema.safeParse(json);
  if (!parsed.success) {
    logger.error("[goals] Invalid update goal response", { error: parsed.error });
    throw new Error("Invalid response from server");
  }
  return parsed.data;
}

/**
 * Delete a goal.
 */
export async function deleteGoal(
  clientId: string,
  goalId: string,
): Promise<void> {
  const res = await fetchWithTimeout(`/api/clients/${clientId}/goals/${goalId}`, {
    method: "DELETE",
    timeout: GOAL_API_TIMEOUT,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Delete failed" }));
    throw new Error(err.error ?? "Failed to delete goal");
  }
}

/**
 * Bulk create goals for a client.
 */
export async function bulkCreateGoals(
  clientId: string,
  workspaceId: string,
  goals: Omit<CreateGoalInput, "workspaceId">[],
): Promise<Array<{ success: boolean; id?: string; error?: string }>> {
  const res = await fetchWithTimeout(`/api/clients/${clientId}/goals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId,
      goals,
    }),
    timeout: GOAL_API_TIMEOUT,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Bulk create failed" }));
    throw new Error(err.error ?? "Failed to bulk create goals");
  }
  const json = await res.json();
  const parsed = bulkCreateGoalsResponseSchema.safeParse(json);
  if (!parsed.success) {
    logger.error("[goals] Invalid bulk create goals response", { error: parsed.error });
    throw new Error("Invalid response from server");
  }
  return parsed.data.results ?? [];
}

/**
 * Calculate attainment percentage from current/target values.
 */
export function calculateAttainment(currentValue: string, targetValue: string): number {
  const current = parseFloat(currentValue) || 0;
  const target = parseFloat(targetValue) || 0;
  if (target <= 0) return 0;
  return (current / target) * 100;
}

/**
 * Format attainment percentage for display.
 */
export function formatAttainment(currentValue: string, targetValue: string): string {
  const pct = calculateAttainment(currentValue, targetValue);
  return `${Math.round(pct)}%`;
}

/**
 * Get attainment color based on current/target values.
 */
export function getAttainmentColor(currentValue: string, targetValue: string): string {
  const pct = calculateAttainment(currentValue, targetValue);
  if (pct >= 100) return "text-emerald-600";
  if (pct >= 75) return "text-yellow-600";
  if (pct >= 50) return "text-orange-600";
  return "text-red-600";
}

/**
 * Get status icon based on goal status.
 */
export function getStatusIcon(status: string): string {
  switch (status) {
    case "achieved":
      return "check-circle";
    case "abandoned":
      return "pause-circle";
    default:
      return "target";
  }
}

/**
 * Get status color based on goal status.
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case "achieved":
      return "text-emerald-600";
    case "abandoned":
      return "text-muted-foreground";
    default:
      return "text-blue-600";
  }
}
