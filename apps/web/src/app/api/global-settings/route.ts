import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getFastApi, patchFastApi, FastApiError } from "@/lib/server-fetch";

/**
 * Schema for global settings updates.
 * Uses .strict() to reject unknown fields (prevent injection of arbitrary data).
 */
const updateSettingsSchema = z.object({
  defaultLanguage: z.string().max(10).optional(),
  timezone: z.string().max(64).optional(),
  dateFormat: z.string().max(32).optional(),
  currency: z.string().max(3).optional(),
  notificationsEnabled: z.boolean().optional(),
  emailDigestFrequency: z.enum(["daily", "weekly", "monthly", "never"]).optional(),
  defaultQualityThreshold: z.number().int().min(0).max(100).optional(),
  autoPublishEnabled: z.boolean().optional(),
  maxConcurrentJobs: z.number().int().min(1).max(50).optional(),
}).strict();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await getFastApi("/api/settings/global");
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

export async function PATCH(req: Request) {
  const { userId, orgRole } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Global settings modification requires admin role
  if (orgRole !== "org:admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate request body against schema
  const parseResult = updateSettingsSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parseResult.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const data = await patchFastApi("/api/settings/global", parseResult.data);
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
