/**
 * Goal type definitions for the web app.
 * Phase 22: Goal-Based Metrics System
 */

export interface GoalTemplateSelect {
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
  createdAt: string | null;
}

export interface ClientGoalSelect {
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
  createdAt: string | null;
  updatedAt: string | null;
}

export interface GoalWithTemplate {
  goal: ClientGoalSelect;
  template: GoalTemplateSelect;
}
