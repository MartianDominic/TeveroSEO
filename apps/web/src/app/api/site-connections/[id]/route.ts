import { NextResponse } from "next/server";
import { getOpenSeo, deleteOpenSeo, FastApiError } from "@/lib/server-fetch";
import { requireAuth, requireClientAccess, AuthError } from "@/lib/auth";

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

/** Minimal response for ownership check - avoids exposing full data before auth */
interface ConnectionOwnership {
  clientId: string;
}

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;

  try {
    // Step 1: Require authentication FIRST
    await requireAuth();

    // Step 2: Fetch minimal data to check ownership
    // The backend should support a lightweight ownership endpoint
    // For now, we fetch the full connection but check auth before returning
    const connection = await getOpenSeo<SiteConnection>(`/api/connections/${id}`);

    // Step 3: Verify user has access to this client's resources
    await requireClientAccess(connection.clientId);

    // Step 4: Return data only after auth passes
    return NextResponse.json(connection);
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

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;

  try {
    // Step 1: Require authentication FIRST
    await requireAuth();

    // Step 2: Fetch connection to get clientId for authorization
    const connection = await getOpenSeo<SiteConnection>(`/api/connections/${id}`);

    // Step 3: Verify user has access to this client's resources
    await requireClientAccess(connection.clientId);

    // Step 4: Perform delete only after auth passes
    await deleteOpenSeo(`/api/connections/${id}`);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    if (err instanceof FastApiError) {
      // 204 from backend means success, not an error
      if (err.status === 204) {
        return new NextResponse(null, { status: 204 });
      }
      return NextResponse.json(err.body ?? { error: err.message }, {
        status: err.status,
      });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
