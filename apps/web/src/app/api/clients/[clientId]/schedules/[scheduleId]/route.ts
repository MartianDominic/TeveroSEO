/**
 * Individual schedule API proxy route.
 * Proxies to open-seo backend following existing patterns.
 *
 * GET /api/clients/:clientId/schedules/:scheduleId - Get schedule by ID
 * PUT /api/clients/:clientId/schedules/:scheduleId - Update schedule
 * DELETE /api/clients/:clientId/schedules/:scheduleId - Delete schedule
 */
import { NextRequest, NextResponse } from "next/server";

import { validateCsrf } from "@/lib/api/security";
import { requireClientAccess, AuthError } from "@/lib/auth";
import { checkRateLimit, getClientIpFromRequest, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import { getOpenSeo, putOpenSeo, deleteOpenSeo, FastApiError } from "@/lib/server-fetch";
import {
  updateScheduleSchema,
  safeParseJson,
  formatValidationErrors,
} from "@/lib/validations/api-schemas";

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
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string; scheduleId: string }> },
) {
  // Rate limit: 100 requests per minute
  const ip = getClientIpFromRequest(req);
  const rateLimitResult = await checkRateLimit(`${ip}:${req.nextUrl.pathname}`, RATE_LIMITS.API.limit, RATE_LIMITS.API.windowMs);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000) },
      { status: 429 }
    );
  }

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
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string; scheduleId: string }> },
) {
  // Rate limit: 20 requests per minute for mutations
  const ip = getClientIpFromRequest(req);
  const rateLimitResult = await checkRateLimit(`${ip}:${req.nextUrl.pathname}`, RATE_LIMITS.HEAVY.limit, RATE_LIMITS.HEAVY.windowMs);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000) },
      { status: 429 }
    );
  }

  // CSRF protection for state-changing request
  const csrfError = validateCsrf(req);
  if (csrfError) return csrfError;

  try {
    const { clientId, scheduleId } = await params;

    // Verify user has access to this client
    await requireClientAccess(clientId);

    // Verify schedule belongs to this client before update
    const existingSchedule = await getOpenSeo<ScheduleResponse>(`/api/schedules/${scheduleId}`);
    if (existingSchedule.clientId !== clientId) {
      return NextResponse.json({ error: "Forbidden: Schedule does not belong to this client" }, { status: 403 });
    }

    // Safe JSON parsing
    const jsonResult = await safeParseJson(req);
    if (!jsonResult.success) {
      return NextResponse.json(
        { error: jsonResult.error },
        { status: 400 }
      );
    }

    // Validate with Zod schema
    const parsed = updateScheduleSchema.safeParse(jsonResult.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: formatValidationErrors(parsed.error) },
        { status: 400 }
      );
    }

    const body = parsed.data;
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
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string; scheduleId: string }> },
) {
  // Rate limit: 20 requests per minute for mutations
  const ip = getClientIpFromRequest(req);
  const rateLimitResult = await checkRateLimit(`${ip}:${req.nextUrl.pathname}`, RATE_LIMITS.HEAVY.limit, RATE_LIMITS.HEAVY.windowMs);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000) },
      { status: 429 }
    );
  }

  // CSRF protection for state-changing request
  const csrfError = validateCsrf(req);
  if (csrfError) return csrfError;

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
