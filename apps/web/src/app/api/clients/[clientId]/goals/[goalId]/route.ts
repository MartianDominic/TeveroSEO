/**
 * Single goal API route.
 *
 * GET    /api/clients/:clientId/goals/:goalId - Get a single goal
 * PUT    /api/clients/:clientId/goals/:goalId - Update a goal
 * DELETE /api/clients/:clientId/goals/:goalId - Delete a goal
 */
import { NextResponse } from "next/server";
import { requireClientAccess, AuthError } from "@/lib/auth/api-auth";
import {
  getOpenSeo,
  putOpenSeo,
  deleteOpenSeo,
  FastApiError,
} from "@/lib/server-fetch";
import { validateCsrf } from "@/lib/api/security";
import {
  updateGoalByIdSchema,
  safeParseJson,
  formatValidationErrors,
} from "@/lib/validations/api-schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ clientId: string; goalId: string }> };

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

export async function GET(_req: Request, { params }: Params) {
  const { clientId, goalId } = await params;
  try {
    await requireClientAccess(clientId);
    const data = await getOpenSeo<{ goal: GoalWithTemplate }>(
      `/api/clients/${clientId}/goals/${goalId}`
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

export async function PUT(req: Request, { params }: Params) {
  // CSRF protection for state-changing request
  const csrfError = validateCsrf(req);
  if (csrfError) return csrfError;

  const { clientId, goalId } = await params;
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
    const parsed = updateGoalByIdSchema.safeParse(jsonResult.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: formatValidationErrors(parsed.error) },
        { status: 400 }
      );
    }

    const body = parsed.data;
    const data = await putOpenSeo<{ id: string }>(
      `/api/clients/${clientId}/goals/${goalId}`,
      body
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

export async function DELETE(req: Request, { params }: Params) {
  // CSRF protection for state-changing request
  const csrfError = validateCsrf(req);
  if (csrfError) return csrfError;

  const { clientId, goalId } = await params;
  try {
    await requireClientAccess(clientId);
    await deleteOpenSeo(`/api/clients/${clientId}/goals/${goalId}`);
    return new NextResponse(null, { status: 204 });
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
