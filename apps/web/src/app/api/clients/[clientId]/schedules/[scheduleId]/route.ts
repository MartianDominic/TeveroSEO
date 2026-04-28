/**
 * Individual schedule API proxy route.
 * Proxies to open-seo backend following existing patterns.
 *
 * GET /api/clients/:clientId/schedules/:scheduleId - Get schedule by ID
 * PUT /api/clients/:clientId/schedules/:scheduleId - Update schedule
 * DELETE /api/clients/:clientId/schedules/:scheduleId - Delete schedule
 */
import { NextResponse } from "next/server";
import { getOpenSeo, putOpenSeo, deleteOpenSeo, FastApiError } from "@/lib/server-fetch";
import { requireClientAccess, AuthError } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ScheduleResponse {
  id: string;
  clientId: string;
  cronExpression: string;
  timezone: string;
  reportType: string;
  locale: string;
  recipients: string[];
  enabled: boolean;
  lastRun: string | null;
  nextRun: string;
  createdAt: string;
  updatedAt: string;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ clientId: string; scheduleId: string }> },
) {
  try {
    const { clientId, scheduleId } = await params;

    // Verify user has access to this client
    await requireClientAccess(clientId);

    const data = await getOpenSeo<ScheduleResponse>(`/api/schedules/${scheduleId}`);

    // Double-check the schedule belongs to the client from URL
    if (data.clientId !== clientId) {
      return NextResponse.json({ error: "Forbidden: Schedule does not belong to this client" }, { status: 403 });
    }

    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    if (err instanceof FastApiError) {
      return NextResponse.json(err.body ?? { error: err.message }, {
        status: err.status,
      });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ clientId: string; scheduleId: string }> },
) {
  try {
    const { clientId, scheduleId } = await params;

    // Verify user has access to this client
    await requireClientAccess(clientId);

    // Verify schedule belongs to this client before update
    const existingSchedule = await getOpenSeo<ScheduleResponse>(`/api/schedules/${scheduleId}`);
    if (existingSchedule.clientId !== clientId) {
      return NextResponse.json({ error: "Forbidden: Schedule does not belong to this client" }, { status: 403 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const data = await putOpenSeo<ScheduleResponse>(`/api/schedules/${scheduleId}`, body);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    if (err instanceof FastApiError) {
      return NextResponse.json(err.body ?? { error: err.message }, {
        status: err.status,
      });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ clientId: string; scheduleId: string }> },
) {
  try {
    const { clientId, scheduleId } = await params;

    // Verify user has access to this client
    await requireClientAccess(clientId);

    // Verify schedule belongs to this client before deletion
    const existingSchedule = await getOpenSeo<ScheduleResponse>(`/api/schedules/${scheduleId}`);
    if (existingSchedule.clientId !== clientId) {
      return NextResponse.json({ error: "Forbidden: Schedule does not belong to this client" }, { status: 403 });
    }

    const data = await deleteOpenSeo<{ success: boolean }>(`/api/schedules/${scheduleId}`);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    if (err instanceof FastApiError) {
      return NextResponse.json(err.body ?? { error: err.message }, {
        status: err.status,
      });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
