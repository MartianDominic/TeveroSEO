/**
 * Goal type definitions for the web app.
 * Phase 22: Goal-Based Metrics System
 *
 * NOTE: These types match the actual backend API responses from AI-Writer/backend/api/goals.py.
 * Rich goal features (trends, projections, notifications) are planned but not yet implemented.
 */

/**
 * Goal template from backend API.
 * Maps to GoalTemplateResponse in backend.
 */
export interface GoalTemplateSelect {
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
 * Client goal from backend API.
 * Maps to GoalResponse in backend.
 */
export interface ClientGoalSelect {
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

export interface GoalWithTemplate {
  goal: ClientGoalSelect;
  template: GoalTemplateSelect;
}
