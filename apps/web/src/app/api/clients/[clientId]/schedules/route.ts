/**
 * Schedule API proxy route.
 * Proxies to open-seo backend following existing patterns.
 *
 * GET /api/clients/:clientId/schedules - List schedules for client
 * POST /api/clients/:clientId/schedules - Create a new schedule
 */
import { NextRequest, NextResponse } from "next/server";
import { getOpenSeo, postOpenSeo, FastApiError } from "@/lib/server-fetch";
import { requireClientAccess, AuthError } from "@/lib/auth";
import { validateCsrf } from "@/lib/api/security";
import {
  createScheduleSchema,
  safeParseJson,
  formatValidationErrors,
} from "@/lib/validations/api-schemas";
import { checkRateLimit, getClientIpFromRequest, RATE_LIMITS } from "@/lib/middleware/rate-limit";

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
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
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
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
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
    const { clientId } = await params;

    // Verify user has access to this client
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
    const parsed = createScheduleSchema.safeParse(jsonResult.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: formatValidationErrors(parsed.error) },
        { status: 400 }
      );
    }

    const body = parsed.data;

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
