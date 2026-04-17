import { NextResponse } from "next/server";
import { getFastApi, FastApiError } from "@/lib/server-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;
  const url = new URL(req.url);
  const qs = url.search;
  try {
    const data = await getFastApi(
      `/api/clients/${clientId}/intelligence/keyword-ideas${qs}`
    );
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
