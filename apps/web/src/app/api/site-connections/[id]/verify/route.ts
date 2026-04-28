import { NextResponse } from "next/server";
import { getOpenSeo, postOpenSeo, FastApiError } from "@/lib/server-fetch";
import { requireClientAccess, AuthError } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SiteConnection {
  id: string;
  clientId: string;
  platform: string;
  siteUrl: string;
  displayName: string | null;
  hasCredentials: boolean;
  capabilities: string[] | null;
  status: string;
  lastVerifiedAt: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

interface VerifyResult {
  success: boolean;
  error?: string;
}

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;

  try {
    // Fetch connection first to get clientId for authorization
    const connection = await getOpenSeo<SiteConnection>(`/api/connections/${id}`);

    // Verify user has access to this client's resources
    await requireClientAccess(connection.clientId);

    const data = await postOpenSeo<VerifyResult>(
      `/api/connections/${id}/verify`,
      {}
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
