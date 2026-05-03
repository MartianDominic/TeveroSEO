/**
 * Goals API route for client-specific goals.
 *
 * GET  /api/clients/:clientId/goals - List all goals for a client
 * POST /api/clients/:clientId/goals - Create a new goal or bulk create goals
 *
 * FIX CRIT-API-01: Uses Zod schemas for runtime response validation.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireClientAccess, AuthError } from "@/lib/auth/api-auth";
import { getOpenSeo, postOpenSeo, FastApiError } from "@/lib/server-fetch";
import { withRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import { validateCsrf } from "@/lib/api/security";
import {
  goalBodySchema,
  safeParseJson,
  formatValidationErrors,
} from "@/lib/validations/api-schemas";
import {
  GoalsListResponseSchema,
  CreateGoalResponseSchema,
  BulkCreateGoalsResponseSchema,
  type GoalsListResponse,
  type CreateGoalResponse,
  type BulkCreateGoalsResponse,
} from "@/lib/api/schemas/cross-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ clientId: string }> };

async function handleGet(_req: Request, { params }: Params) {
  const { clientId } = await params;
  try {
    await requireClientAccess(clientId);
    // FIX CRIT-API-01: Use schema validation for runtime type safety
    const data = await getOpenSeo<GoalsListResponse>(
      `/api/clients/${clientId}/goals`,
      { schema: GoalsListResponseSchema }
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
  // CSRF protection for state-changing request
  const csrfError = validateCsrf(req);
  if (csrfError) return csrfError;

  const { clientId } = await params;
  try {
    await requireClientAccess(clientId);

    // Safe JSON parsing
    const jsonResult = await safeParseJson(req);
    if (!jsonResult.success) {
      return NextResponse.json(
        { error: jsonResult.error },
        { status: 400 }
      );
    }

    // Validate with Zod schema
    const parsed = goalBodySchema.safeParse(jsonResult.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: formatValidationErrors(parsed.error) },
        { status: 400 }
      );
    }

    const body = parsed.data;

    // Handle bulk create if goals array is present
    // FIX CRIT-API-01: Use schema validation for runtime type safety
    if ("goals" in body && Array.isArray(body.goals)) {
      const data = await postOpenSeo<BulkCreateGoalsResponse>(
        `/api/clients/${clientId}/goals`,
        {
          ...body,
          clientId,
        },
        { schema: BulkCreateGoalsResponseSchema }
      );
      return NextResponse.json(data, { status: 201 });
    }

    // Single goal creation
    // FIX CRIT-API-01: Use schema validation for runtime type safety
    const data = await postOpenSeo<CreateGoalResponse>(
      `/api/clients/${clientId}/goals`,
      {
        ...body,
        clientId,
      },
      { schema: CreateGoalResponseSchema }
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
