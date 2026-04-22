import { NextResponse } from "next/server";
import { postOpenSeo, FastApiError } from "@/lib/server-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DetectionResult {
  platform: string;
  confidence: "high" | "medium" | "low";
  signals: Array<{
    type: string;
    platform: string;
    weight: number;
    found: string;
  }>;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.domain || typeof body.domain !== "string") {
      return NextResponse.json({ error: "domain required" }, { status: 400 });
    }

    const data = await postOpenSeo<DetectionResult>(
      "/api/detect-platform",
      body
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
