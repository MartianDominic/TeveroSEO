import { NextResponse } from "next/server";
import { getFastApi, FastApiError } from "@/lib/server-fetch";
import { requireClientAccess, AuthError } from "@/lib/auth/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;
  try {
    await requireClientAccess(clientId);
    const data = await getFastApi(
      `/api/clients/${clientId}/publishing-logs`
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
