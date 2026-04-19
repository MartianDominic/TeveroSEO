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
    const { scheduleId } = await params;
    const data = await getOpenSeo<ScheduleResponse>(`/api/schedules/${scheduleId}`);
    return NextResponse.json(data);
  } catch (err) {
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
    const { scheduleId } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    const data = await putOpenSeo<ScheduleResponse>(`/api/schedules/${scheduleId}`, body);
    return NextResponse.json(data);
  } catch (err) {
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
    const { scheduleId } = await params;
    const data = await deleteOpenSeo<{ success: boolean }>(`/api/schedules/${scheduleId}`);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof FastApiError) {
      return NextResponse.json(err.body ?? { error: err.message }, {
        status: err.status,
      });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
