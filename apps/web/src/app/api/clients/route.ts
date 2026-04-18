import { NextResponse } from "next/server";
import { getFastApi, postFastApi, FastApiError } from "@/lib/server-fetch";
import type { Client } from "@tevero/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getFastApi<Client[]>("/api/clients");
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
    const body = await req.json();
    const data = await postFastApi<Client>("/api/clients", body);
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
