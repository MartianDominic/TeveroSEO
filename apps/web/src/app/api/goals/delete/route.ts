/**
 * Goal delete API route for optimistic updates.
 *
 * POST /api/goals/delete - Delete a goal by ID
 *
 * Used by useGoalMutations hook for optimistic UI updates.
 * Uses POST instead of DELETE for simpler body parsing.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/api-auth";
import { deleteFastApi, FastApiError } from "@/lib/server-fetch";
import { withRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DeleteGoalInput {
  goalId: string;
  clientId?: string;
}

async function handlePost(req: NextRequest) {
  try {
    await requireAuth();

    const body: DeleteGoalInput = await req.json();

    if (!body.goalId) {
      return NextResponse.json(
        { error: "goalId is required" },
        { status: 400 }
      );
    }

    // If clientId is provided, use client-specific endpoint
    if (body.clientId) {
      await deleteFastApi(`/api/clients/${body.clientId}/goals/${body.goalId}`);
    } else {
      // Use generic endpoint - backend handles authorization
      await deleteFastApi(`/api/goals/${body.goalId}`);
    }

    return NextResponse.json({ success: true });
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
