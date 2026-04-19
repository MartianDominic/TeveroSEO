/**
 * Branding API proxy route.
 * Proxies to open-seo backend following existing patterns.
 *
 * GET /api/clients/:clientId/branding - Get branding for client
 * PUT /api/clients/:clientId/branding - Create/update branding
 * DELETE /api/clients/:clientId/branding - Delete branding
 */
import { NextResponse } from "next/server";
import {
  getOpenSeo,
  putOpenSeo,
  deleteOpenSeo,
  FastApiError,
} from "@/lib/server-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface BrandingResponse {
  id?: string;
  clientId: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  footerText: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  try {
    const { clientId } = await params;
    const data = await getOpenSeo<BrandingResponse>(
      `/api/branding?client_id=${clientId}`,
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

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  try {
    const { clientId } = await params;
    const body = (await req.json()) as Record<string, unknown>;

    // Inject clientId from path into body
    const data = await putOpenSeo<BrandingResponse>("/api/branding", {
      ...body,
      clientId,
    });

    // Return 201 for new, 200 for update (based on presence of id before call)
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
  { params }: { params: Promise<{ clientId: string }> },
) {
  try {
    const { clientId } = await params;
    const data = await deleteOpenSeo<{ success: boolean }>(
      `/api/branding?client_id=${clientId}`,
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
