import { NextResponse } from "next/server";
import { getFastApi, postFastApi, FastApiError } from "@/lib/server-fetch";
import { requireClientAccess, AuthError } from "@/lib/auth/api-auth";
import { validateCsrf } from "@/lib/api/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;
  try {
    await requireClientAccess(clientId);
    const data = await getFastApi(`/api/clients/${clientId}/intelligence`);
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
  { params }: { params: Promise<{ clientId: string }> }
) {
  // CSRF protection for state-changing request
  const csrfError = validateCsrf(req);
  if (csrfError) return csrfError;

  const { clientId } = await params;
  try {
    await requireClientAccess(clientId);
    // Determine action from URL path suffix
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const lastSegment = pathParts[pathParts.length - 1];
    // If POST is to .../intelligence/scrape, proxy appropriately
    const fastApiPath =
      lastSegment === "scrape"
        ? `/api/clients/${clientId}/intelligence/scrape`
        : `/api/clients/${clientId}/intelligence`;
    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      // empty body
    }
    const data = await postFastApi(fastApiPath, body);
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
