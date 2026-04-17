import { NextResponse } from "next/server";
import { getFastApi, FastApiError } from "@/lib/server-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SecretStatus {
  key_name: string;
  required: boolean;
  configured: boolean;
}

export async function GET() {
  try {
    const data = await getFastApi<SecretStatus[]>(
      "/api/platform-secrets/status"
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
