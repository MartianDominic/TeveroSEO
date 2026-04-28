/**
 * Schedule API proxy route.
 * Proxies to open-seo backend following existing patterns.
 *
 * GET /api/clients/:clientId/schedules - List schedules for client
 * POST /api/clients/:clientId/schedules - Create a new schedule
 */
import { NextResponse } from "next/server";
import { getOpenSeo, postOpenSeo, FastApiError } from "@/lib/server-fetch";
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

interface ScheduleListResponse {
  schedules: ScheduleResponse[];
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  try {
    const { clientId } = await params;

    // Verify user has access to this client
    await requireClientAccess(clientId);

    const data = await getOpenSeo<ScheduleListResponse>(
      `/api/schedules?client_id=${clientId}`,
    );
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

export async function POST(
  req: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  try {
    const { clientId } = await params;

    // Verify user has access to this client
    await requireClientAccess(clientId);

    const body = (await req.json()) as Record<string, unknown>;

    // Inject clientId from path into body
    const data = await postOpenSeo<ScheduleResponse>("/api/schedules", {
      ...body,
      clientId,
    });
    return NextResponse.json(data, { status: 201 });
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
