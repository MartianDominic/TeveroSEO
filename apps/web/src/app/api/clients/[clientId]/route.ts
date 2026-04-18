import { NextResponse } from "next/server";
import {
  getFastApi,
  patchFastApi,
  deleteFastApi,
  FastApiError,
} from "@/lib/server-fetch";
import type { Client } from "@tevero/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ clientId: string }> };

export async function GET(_: Request, { params }: Params) {
  const { clientId } = await params;
  try {
    const data = await getFastApi<Client>(`/api/clients/${clientId}`);
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

export async function PATCH(req: Request, { params }: Params) {
  const { clientId } = await params;
  try {
    const body = await req.json();
    const data = await patchFastApi<Client>(`/api/clients/${clientId}`, body);
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

export async function DELETE(_: Request, { params }: Params) {
  const { clientId } = await params;
  try {
    await deleteFastApi(`/api/clients/${clientId}`);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof FastApiError) {
      return NextResponse.json(err.body ?? { error: err.message }, {
        status: err.status,
      });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
