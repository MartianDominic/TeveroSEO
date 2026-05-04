/**
 * Goal delete API route for optimistic updates.
 *
 * POST /api/goals/delete - Delete a goal by ID
 *
 * Used by useGoalMutations hook for optimistic UI updates.
 * Uses POST instead of DELETE for simpler body parsing.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireClientAccess, AuthError } from "@/lib/auth/api-auth";
import { deleteFastApi, getFastApi, FastApiError } from "@/lib/server-fetch";
import { withRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import { validateCsrf } from "@/lib/api/security";
import {
  badRequest,
  validationError,
  internalError,
} from "@/lib/api/responses";
import {
  deleteGoalSchema,
  safeParseJson,
} from "@/lib/validations/api-schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handlePost(req: NextRequest) {
  // CSRF protection for state-changing request
  const csrfError = validateCsrf(req);
  if (csrfError) return csrfError;

  try {
    // Safe JSON parsing
    const jsonResult = await safeParseJson(req);
    if (!jsonResult.success) {
      return badRequest(jsonResult.error);
    }

    // Validate with Zod schema (422 for validation errors)
    const parsed = deleteGoalSchema.safeParse(jsonResult.data);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const body = parsed.data;

    // Get clientId from body or fetch it from the goal
    let clientId = body.clientId;

    if (!clientId) {
      // Fetch the goal to get its clientId for access validation
      const goal = await getFastApi<{ client_id: string }>(`/api/goals/${body.goalId}`);
      clientId = goal.client_id;
    }

    // CRITICAL: Verify user has access to this client before allowing delete
    await requireClientAccess(clientId);

    // Use client-specific endpoint for proper authorization
    await deleteFastApi(`/api/clients/${clientId}/goals/${body.goalId}`);

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    if (err instanceof FastApiError) {
      return NextResponse.json(err.sanitizedBody, { status: err.status });
    }
    return internalError();
  }
}

export const POST = withRateLimit(handlePost, RATE_LIMITS.ACTION);
