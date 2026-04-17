import { NextResponse } from "next/server";
import {
  getFastApi,
  patchFastApi,
  deleteFastApi,
  postFastApi,
  FastApiError,
} from "@/lib/server-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  try {
    const data = await getFastApi(`/api/articles/${eventId}`);
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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  try {
    const body = await req.json();
    const data = await patchFastApi(`/api/articles/${eventId}`, body);
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

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  try {
    const data = await deleteFastApi(`/api/articles/${eventId}`);
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

// Article action sub-routes are handled via POST to /api/content-calendar/[eventId]
// with an action body. However the CRA stores call /api/articles/{id}/approve etc.
// These are proxied by catching the action in the path. Since Next.js route params
// only catch a single segment, action sub-routes like /approve, /reject, etc. are
// separately proxied here via a POST fallback that forwards to FastAPI.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  // Extract action from URL path suffix if present
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const action = pathParts[pathParts.length - 1];
  // If the eventId segment IS the action (e.g. /api/content-calendar/approve)
  // this route won't be hit — only if the path is /api/content-calendar/{eventId}
  // with a POST body containing an action.
  const fastApiPath =
    action && action !== eventId
      ? `/api/articles/${eventId}/${action}`
      : `/api/articles/${eventId}`;
  try {
    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      // empty body is fine for action endpoints
    }
    const data = await postFastApi(fastApiPath, body);
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
