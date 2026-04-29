/**
 * Goal update API route for optimistic updates.
 *
 * POST /api/goals/update - Update a goal by ID
 *
 * Used by useGoalMutations hook for optimistic UI updates.
 * The goalId in the body is used to look up and update the goal.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireClientAccess, AuthError } from "@/lib/auth/api-auth";
import { putFastApi, getFastApi, FastApiError } from "@/lib/server-fetch";
import { withRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import { validateCsrf } from "@/lib/api/security";
import {
  updateGoalSchema,
  safeParseJson,
  formatValidationErrors,
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
      return NextResponse.json(
        { error: jsonResult.error },
        { status: 400 }
      );
    }

    // Validate with Zod schema
    const parsed = updateGoalSchema.safeParse(jsonResult.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: formatValidationErrors(parsed.error) },
        { status: 400 }
      );
    }

    const body = parsed.data;

    // Extract clientId from updates if provided, otherwise fetch it from the goal
    let clientId = body.updates?.clientId;

    if (!clientId) {
      // Fetch the goal to get its clientId for access validation
      const goal = await getFastApi<{ client_id: string }>(`/api/goals/${body.goalId}`);
      clientId = goal.client_id;
    }

    // CRITICAL: Verify user has access to this client before allowing update
    await requireClientAccess(clientId);

    // Use client-specific endpoint for proper authorization
    const data = await putFastApi<{ id: string }>(
      `/api/clients/${clientId}/goals/${body.goalId}`,
      body.updates
    );
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    if (err instanceof FastApiError) {
      return NextResponse.json(err.sanitizedBody, { status: err.status });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export const POST = withRateLimit(handlePost, RATE_LIMITS.ACTION);
