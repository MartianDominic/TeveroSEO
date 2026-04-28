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
  getFastApi,
  putFastApi,
  deleteFastApi,
  FastApiError,
} from "@/lib/server-fetch";

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
    const data = await getFastApi<{ goal: GoalWithTemplate }>(
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
  const { clientId, goalId } = await params;
  try {
    await requireClientAccess(clientId);
    const body = await req.json();
    const data = await putFastApi<{ id: string }>(
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

export async function DELETE(_req: Request, { params }: Params) {
  const { clientId, goalId } = await params;
  try {
    await requireClientAccess(clientId);
    await deleteFastApi(`/api/clients/${clientId}/goals/${goalId}`);
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
