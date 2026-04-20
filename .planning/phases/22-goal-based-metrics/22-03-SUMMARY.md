# Summary 22-03: Goal Management API

**Phase:** 22 - Goal-Based Metrics System  
**Status:** Complete  
**Completed:** 2026-04-20

---

## Overview

Implemented the Goal Management API with full CRUD operations, bulk creation support, and React Query hooks for client-side consumption.

---

## Files Created/Modified

### Types and Validation (Task 1)
- **`open-seo-main/src/server/features/goals/types.ts`**
  - Zod schemas: `createGoalSchema`, `updateGoalSchema`, `bulkCreateGoalsSchema`
  - TypeScript types: `CreateGoalInput`, `UpdateGoalInput`, `BulkCreateGoalsInput`

### Goal Service (Task 2)
- **`open-seo-main/src/server/features/goals/service.ts`**
  - `GoalService` class with static methods:
    - `listTemplates()` - List all active goal templates
    - `listClientGoals(clientId)` - Get all goals for a client with template data
    - `getGoal(goalId)` - Get a single goal by ID
    - `createGoal(clientId, workspaceId, input)` - Create a new goal
    - `updateGoal(goalId, input)` - Update an existing goal
    - `deleteGoal(goalId)` - Delete a goal
    - `bulkCreateGoals(clientId, workspaceId, goals)` - Bulk create goals
  - Primary goal logic (only one primary per client)
  - Duplicate template prevention (except for custom goals)
  - Triggers immediate goal computation via `processGoalImmediate()`

### API Routes (Task 3)
- **`open-seo-main/src/routes/api/goal-templates/index.ts`**
  - `GET /api/goal-templates` - List all active templates

- **`open-seo-main/src/routes/api/clients/$clientId/goals/index.ts`**
  - `GET /api/clients/:clientId/goals` - List client goals
  - `POST /api/clients/:clientId/goals` - Create single goal or bulk create

- **`open-seo-main/src/routes/api/clients/$clientId/goals/$goalId.ts`**
  - `GET /api/clients/:clientId/goals/:goalId` - Get goal details
  - `PUT /api/clients/:clientId/goals/:goalId` - Update goal
  - `DELETE /api/clients/:clientId/goals/:goalId` - Delete goal

### Server Functions (Task 4)
- **`open-seo-main/src/serverFunctions/goals.ts`**
  - Server functions using TanStack Start pattern (not Next.js server actions)
  - `getGoalTemplates`, `getClientGoals`, `createGoal`, `updateGoal`, `deleteGoal`, `bulkCreateGoals`
  - All functions require authentication via `requireAuthenticatedContext` middleware

### React Query Hooks (Task 5)
- **`apps/web/src/lib/hooks/useGoals.ts`**
  - Query key factory: `goalKeys`
  - Hooks: `useGoalTemplates`, `useClientGoals`, `useCreateGoal`, `useUpdateGoal`, `useDeleteGoal`, `useBulkCreateGoals`
  - Automatic cache invalidation on mutations
  - Dashboard metrics invalidation on goal changes

### API Client (Additional)
- **`apps/web/src/lib/api/goals.ts`**
  - TypeScript interfaces for API responses
  - Fetch functions for all goal operations
  - Utility functions: `formatAttainment`, `getAttainmentColor`, `getTrendIcon`, `getTrendColor`

---

## Key Implementation Details

1. **Authentication**: All routes use `requireApiAuth()` middleware to verify session
2. **Validation**: Zod schemas validate all input data with helpful error messages
3. **Primary Goal Logic**: When setting a goal as primary, existing primary is automatically unset
4. **Duplicate Prevention**: Non-custom goal types can only be added once per client
5. **Immediate Processing**: New/updated goals trigger immediate computation via BullMQ queue
6. **Error Handling**: Proper error responses with status codes (400, 401, 403, 404, 409, 500)

---

## Verification

- [x] TypeScript compilation passes (`pnpm typecheck`)
- [x] All required files created
- [x] Goal types and validation schemas complete
- [x] GoalService with all CRUD operations
- [x] API routes for templates and client goals
- [x] Server functions for SSR usage
- [x] React Query hooks for client-side state management
- [x] API client functions for fetch operations

---

## Dependencies

- **22-01 (Schema)**: Goal schema tables must exist in database
- **Goal Queue**: `processGoalImmediate()` from `@/server/queues/goalQueue` handles background computation

---

## Notes

- Server functions use `serverFunctions/goals.ts` instead of `server/actions/goals.ts` to match the existing project structure (TanStack Start pattern, not Next.js server actions)
- API client includes utility functions for formatting and color-coding goal attainment/trends for UI display
