import { NextResponse } from "next/server";
import { getFastApi, postFastApi, FastApiError } from "@/lib/server-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : "";
    const data = await getFastApi(`/api/articles${qs}`);
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

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : "";
    const body = await req.json();
    const data = await postFastApi(`/api/articles${qs}`, body);
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    if (err instanceof FastApiError) {
      return NextResponse.json(err.body ?? { error: err.message }, {
        status: err.status,
      });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
