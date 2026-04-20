/**
 * Goal management API functions.
 * Phase 22: Goal-Based Metrics System
 */

/**
 * Goal template from API.
 */
export interface GoalTemplate {
  id: string;
  goalType: string;
  name: string;
  description: string | null;
  unit: string | null;
  defaultTarget: string | null;
  hasDenominator: boolean;
  computationMethod: string;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
}

/**
 * Client goal from API.
 */
export interface ClientGoal {
  id: string;
  clientId: string;
  workspaceId: string;
  templateId: string;
  targetValue: string;
  targetDenominator: number | null;
  customName: string | null;
  customDescription: string | null;
  currentValue: string | null;
  attainmentPct: string | null;
  trendDirection: string | null;
  trendValue: string | null;
  lastComputedAt: string | null;
  isPrimary: boolean;
  isClientVisible: boolean;
  notifyOnRegression: boolean;
  regressionThreshold: string;
  createdAt: string;
  updatedAt: string;
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
 */
export interface CreateGoalInput {
  templateId: string;
  targetValue: number;
  targetDenominator?: number;
  customName?: string;
  customDescription?: string;
  isPrimary?: boolean;
  isClientVisible?: boolean;
  workspaceId: string;
}

/**
 * Goal update input.
 */
export interface UpdateGoalInput {
  targetValue?: number;
  targetDenominator?: number;
  customName?: string;
  customDescription?: string;
  isPrimary?: boolean;
  isClientVisible?: boolean;
  currentValue?: number;
}

/**
 * Fetch all goal templates.
 */
export async function getGoalTemplates(): Promise<GoalTemplate[]> {
  const res = await fetch("/api/goal-templates");
  if (!res.ok) {
    return [];
  }
  const data = await res.json();
  return data.templates ?? [];
}

/**
 * Fetch all goals for a client.
 */
export async function getClientGoals(clientId: string): Promise<GoalWithTemplate[]> {
  const res = await fetch(`/api/clients/${clientId}/goals`);
  if (!res.ok) {
    return [];
  }
  const data = await res.json();
  return data.goals ?? [];
}

/**
 * Get a single goal.
 */
export async function getGoal(
  clientId: string,
  goalId: string,
): Promise<GoalWithTemplate | null> {
  const res = await fetch(`/api/clients/${clientId}/goals/${goalId}`);
  if (!res.ok) {
    return null;
  }
  const data = await res.json();
  return data.goal ?? null;
}

/**
 * Create a new goal for a client.
 */
export async function createGoal(
  clientId: string,
  input: CreateGoalInput,
): Promise<{ id: string }> {
  const res = await fetch(`/api/clients/${clientId}/goals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Create failed" }));
    throw new Error(err.error ?? "Failed to create goal");
  }
  return res.json();
}

/**
 * Update an existing goal.
 */
export async function updateGoal(
  clientId: string,
  goalId: string,
  input: UpdateGoalInput,
): Promise<{ id: string }> {
  const res = await fetch(`/api/clients/${clientId}/goals/${goalId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Update failed" }));
    throw new Error(err.error ?? "Failed to update goal");
  }
  return res.json();
}

/**
 * Delete a goal.
 */
export async function deleteGoal(
  clientId: string,
  goalId: string,
): Promise<void> {
  const res = await fetch(`/api/clients/${clientId}/goals/${goalId}`, {
    method: "DELETE",
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
  const res = await fetch(`/api/clients/${clientId}/goals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId,
      goals,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Bulk create failed" }));
    throw new Error(err.error ?? "Failed to bulk create goals");
  }
  const data = await res.json();
  return data.results ?? [];
}

/**
 * Format attainment percentage for display.
 */
export function formatAttainment(attainmentPct: string | null): string {
  if (!attainmentPct) return "N/A";
  const pct = parseFloat(attainmentPct);
  return `${Math.round(pct)}%`;
}

/**
 * Get attainment color based on percentage.
 */
export function getAttainmentColor(attainmentPct: string | null): string {
  if (!attainmentPct) return "text-muted-foreground";
  const pct = parseFloat(attainmentPct);
  if (pct >= 100) return "text-emerald-600";
  if (pct >= 75) return "text-yellow-600";
  if (pct >= 50) return "text-orange-600";
  return "text-red-600";
}

/**
 * Get trend icon based on direction.
 */
export function getTrendIcon(trendDirection: string | null): string {
  switch (trendDirection) {
    case "up":
      return "arrow-up";
    case "down":
      return "arrow-down";
    default:
      return "minus";
  }
}

/**
 * Get trend color based on direction.
 */
export function getTrendColor(trendDirection: string | null): string {
  switch (trendDirection) {
    case "up":
      return "text-emerald-600";
    case "down":
      return "text-red-600";
    default:
      return "text-muted-foreground";
  }
}
