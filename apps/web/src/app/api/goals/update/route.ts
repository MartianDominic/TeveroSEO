/**
 * Goal update API route for optimistic updates.
 *
 * POST /api/goals/update - Update a goal by ID
 *
 * Used by useGoalMutations hook for optimistic UI updates.
 * The goalId in the body is used to look up and update the goal.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/api-auth";
import { putFastApi, FastApiError } from "@/lib/server-fetch";
import { withRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface UpdateGoalInput {
  goalId: string;
  updates: {
    targetValue?: number;
    targetDenominator?: number;
    customName?: string;
    customDescription?: string;
    isPrimary?: boolean;
    isClientVisible?: boolean;
    currentValue?: number;
    clientId?: string;
  };
}

async function handlePost(req: NextRequest) {
  try {
    await requireAuth();

    const body: UpdateGoalInput = await req.json();

    if (!body.goalId) {
      return NextResponse.json(
        { error: "goalId is required" },
        { status: 400 }
      );
    }

    // Extract clientId from updates if provided, otherwise we need to look it up
    // For now, we'll require clientId in the updates for proper routing
    const clientId = body.updates?.clientId;

    if (!clientId) {
      // If no clientId provided, attempt to use a generic update endpoint
      // The backend should be able to handle goal lookup by ID
      const data = await putFastApi<{ id: string }>(
        `/api/goals/${body.goalId}`,
        body.updates
      );
      return NextResponse.json(data);
    }

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
