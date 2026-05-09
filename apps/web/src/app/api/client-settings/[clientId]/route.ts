import { NextResponse } from "next/server";

import {
  badRequest,
  validationError,
  internalError,
} from "@/lib/api/responses";
import { validateCsrf } from "@/lib/api/security";
import { requireClientAccess, AuthError } from "@/lib/auth/api-auth";
import {
  getFastApi,
  putFastApi,
  patchFastApi,
  FastApiError,
} from "@/lib/server-fetch";
import {
  clientSettingsSchema,
  safeParseJson,
} from "@/lib/validations/api-schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;
  try {
    await requireClientAccess(clientId);
    const data = await getFastApi(`/api/clients/${clientId}/settings`);
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
    return internalError();
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  // CSRF protection for state-changing request
  const csrfError = validateCsrf(req);
  if (csrfError) return csrfError;

  const { clientId } = await params;
  try {
    await requireClientAccess(clientId);

    // Safe JSON parsing
    const jsonResult = await safeParseJson(req);
    if (!jsonResult.success) {
      return badRequest(jsonResult.error);
    }

    // Validate with Zod schema (422 for validation errors)
    const parsed = clientSettingsSchema.safeParse(jsonResult.data);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const body = parsed.data;
    const data = await patchFastApi(`/api/clients/${clientId}/settings`, body);
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
    return internalError();
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  // CSRF protection for state-changing request
  const csrfError = validateCsrf(req);
  if (csrfError) return csrfError;

  const { clientId } = await params;
  try {
    await requireClientAccess(clientId);

    // Safe JSON parsing
    const jsonResult = await safeParseJson(req);
    if (!jsonResult.success) {
      return badRequest(jsonResult.error);
    }

    // Validate with Zod schema (422 for validation errors)
    const parsed = clientSettingsSchema.safeParse(jsonResult.data);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const body = parsed.data;
    const data = await putFastApi(`/api/clients/${clientId}/settings`, body);
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
    return internalError();
  }
}
