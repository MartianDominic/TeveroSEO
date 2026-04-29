import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, AuthError } from "@/lib/auth/api-auth";
import { getFastApi, postFastApi, FastApiError } from "@/lib/server-fetch";
import { withRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import { validateCsrf } from "@/lib/api/security";
import type { Client } from "@tevero/types";

// Zod schema for creating a client
const createClientSchema = z.object({
  name: z.string().min(1, "Client name is required").max(255),
  website: z.string().url("Website must be a valid URL").optional(),
  industry: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  primaryContact: z.object({
    name: z.string().max(255).optional(),
    email: z.string().email().optional(),
    phone: z.string().max(50).optional(),
  }).optional(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGet() {
  try {
    await requireAuth();
    const data = await getFastApi<Client[]>("/api/clients");
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

async function handlePost(req: NextRequest) {
  // CSRF protection for state-changing request
  const csrfError = validateCsrf(req);
  if (csrfError) return csrfError;

  try {
    await requireAuth();

    // Parse JSON body with error handling
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Validate request body with Zod
    const parsed = createClientSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = await postFastApi<Client>("/api/clients", parsed.data);
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

// Rate limit: 100 requests per minute for GET (standard API limit)
export const GET = withRateLimit(handleGet, RATE_LIMITS.API);

// Rate limit: 20 requests per minute for POST (heavy operation - client creation)
export const POST = withRateLimit(handlePost, RATE_LIMITS.HEAVY);
