/**
 * Goals API route for client-specific goals.
 *
 * GET  /api/clients/:clientId/goals - List all goals for a client
 * POST /api/clients/:clientId/goals - Create a new goal or bulk create goals
 */
import { NextRequest, NextResponse } from "next/server";
import { requireClientAccess, AuthError } from "@/lib/auth/api-auth";
import { getFastApi, postFastApi, FastApiError } from "@/lib/server-fetch";
import { withRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ clientId: string }> };

interface GoalTemplate {
  id: string;
  name: string;
  metric: string;
  description: string | null;
}

interface GoalResponse {
  id: string;
  clientId: string;
  templateId: string | null;
  customName: string | null;
  targetValue: string;
  currentValue: string;
  startDate: string | null;
  targetDate: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface GoalWithTemplate {
  goal: GoalResponse;
  template: GoalTemplate;
}

interface GoalsListResponse {
  goals: GoalWithTemplate[];
}

async function handleGet(_req: Request, { params }: Params) {
  const { clientId } = await params;
  try {
    await requireClientAccess(clientId);
    const data = await getFastApi<GoalsListResponse>(
      `/api/clients/${clientId}/goals`
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

async function handlePost(req: Request, { params }: Params) {
  const { clientId } = await params;
  try {
    await requireClientAccess(clientId);
    const body = await req.json();

    // Handle bulk create if goals array is present
    if (Array.isArray(body.goals)) {
      const data = await postFastApi<{ results: Array<{ success: boolean; id?: string; error?: string }> }>(
        `/api/clients/${clientId}/goals/bulk`,
        {
          ...body,
          clientId,
        }
      );
      return NextResponse.json(data, { status: 201 });
    }

    // Single goal creation
    const data = await postFastApi<{ id: string }>(
      `/api/clients/${clientId}/goals`,
      {
        ...body,
        clientId,
      }
    );
    return NextResponse.json(data, { status: 201 });
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

// Wrap with rate limiting
const rateLimitedGet = withRateLimit(
  (req: NextRequest) => handleGet(req, { params: Promise.resolve({ clientId: "" }) }),
  RATE_LIMITS.API
);

const rateLimitedPost = withRateLimit(
  (req: NextRequest) => handlePost(req, { params: Promise.resolve({ clientId: "" }) }),
  RATE_LIMITS.HEAVY
);

// Export handlers that properly extract params
export async function GET(req: Request, context: Params) {
  return handleGet(req, context);
}

export async function POST(req: Request, context: Params) {
  return handlePost(req, context);
}
