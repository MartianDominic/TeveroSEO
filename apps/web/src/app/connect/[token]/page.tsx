/**
 * Magic link landing page for client self-authorization.
 *
 * PUBLIC ROUTE - No Clerk authentication required.
 * Middleware already allows /connect/(.*) as public.
 *
 * Flow:
 * 1. Validate invite token via backend API
 * 2. If invalid/expired: show user-friendly error (not 500)
 * 3. If valid: show Connect with Google button
 */

import type { InviteValidation } from "@tevero/types";

type PageProps = {
  params: Promise<{ token: string }>;
};

const BACKEND_URL =
  process.env.AI_WRITER_BACKEND_URL || "http://ai-writer-backend:8000";

/**
 * Validate invite token - server-side fetch (no auth required).
 */
async function validateInvite(token: string): Promise<InviteValidation | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/invites/${token}/validate`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return null;
    }

    return res.json();
  } catch {
    return null;
  }
}

/**
 * Build the Google OAuth URL for the given token.
 */
function getGoogleOAuthUrl(token: string): string {
  const publicUrl =
    process.env.NEXT_PUBLIC_AI_WRITER_URL || "http://localhost:8000";
  return `${publicUrl}/api/auth/google/start?token=${encodeURIComponent(token)}`;
}

export default async function ConnectPage({ params }: PageProps) {
  const { token } = await params;
  const invite = await validateInvite(token);

  // Invalid or expired invite - show user-friendly error page
  if (!invite || !invite.valid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="max-w-md text-center p-8">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <svg
              className="h-8 w-8 text-destructive"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-foreground">
            Link Expired or Invalid
          </h1>
          <p className="mt-3 text-muted-foreground">
            This invite link has expired or has already been used. Please
            contact your agency for a new link.
          </p>
        </div>
      </div>
    );
  }

  // Valid invite - show connect page
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="max-w-md text-center p-8">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <svg
            className="h-8 w-8 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-foreground">
          Connect Your Accounts
        </h1>
        <p className="mt-3 text-muted-foreground">
          <span className="font-medium text-foreground">
            {invite.client_name}
          </span>{" "}
          has invited you to connect your Google accounts.
        </p>

        {invite.scopes_requested && invite.scopes_requested.length > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">
              Requested access:
            </p>
            <ul className="list-disc list-inside space-y-0.5">
              {invite.scopes_requested.includes("webmasters.readonly") && (
                <li>Search Console (read-only)</li>
              )}
              {invite.scopes_requested.includes("analytics.readonly") && (
                <li>Analytics (read-only)</li>
              )}
              {invite.scopes_requested.includes("business.manage") && (
                <li>Business Profile (manage)</li>
              )}
            </ul>
          </div>
        )}

        <a
          href={getGoogleOAuthUrl(token)}
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Connect with Google
        </a>

        <p className="mt-6 text-xs text-muted-foreground">
          By connecting, you authorize read-only access to your Google Search
          Console, Analytics, and Business Profile data.
        </p>
      </div>
    </div>
  );
}
