/**
 * Goal management server functions.
 * Phase 22: Goal-Based Metrics System
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { GoalService } from "@/server/features/goals/service";
import { createGoalSchema, updateGoalSchema } from "@/server/features/goals/types";
import { requireAuthenticatedContext } from "@/serverFunctions/middleware";

export const getGoalTemplates = createServerFn({ method: "GET" })
  .middleware(requireAuthenticatedContext)
  .handler(async () => {
    return GoalService.listTemplates();
  });

export const getClientGoals = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) =>
    z.object({ clientId: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    return GoalService.listClientGoals(data.clientId);
  });

export const createGoal = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) =>
    z
      .object({
        clientId: z.string().min(1),
        goal: createGoalSchema,
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    return GoalService.createGoal(
      data.clientId,
      context.organizationId,
      data.goal,
    );
  });

export const updateGoal = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) =>
    z
      .object({
        goalId: z.string().min(1),
        updates: updateGoalSchema,
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    return GoalService.updateGoal(data.goalId, data.updates);
  });

export const deleteGoal = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) =>
    z.object({ goalId: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    return GoalService.deleteGoal(data.goalId);
  });

export const bulkCreateGoals = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) =>
    z
      .object({
        clientId: z.string().min(1),
        goals: z.array(createGoalSchema).min(1).max(10),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    return GoalService.bulkCreateGoals(
      data.clientId,
      context.organizationId,
      data.goals,
    );
  });
