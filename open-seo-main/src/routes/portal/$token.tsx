/**
 * Portal Entry Route
 * Phase 87-01: Client Portal Foundation
 *
 * /portal/:token - Entry point for client portal access
 * Validates token and routes based on auth level.
 */
import { createFileRoute } from "@tanstack/react-router";
import {
  portalTokenService,
  type AuthLevel,
} from "@/server/services/PortalTokenService";

// Define loader data types
type ValidTokenData = {
  valid: true;
  clientId: string;
  authLevel: AuthLevel;
};

type InvalidTokenData = {
  valid: false;
  error?: "expired" | "revoked" | "not_found";
};

type PortalLoaderData = ValidTokenData | InvalidTokenData;

export const Route = createFileRoute("/portal/$token")({
  loader: async ({ params }): Promise<PortalLoaderData> => {
    const result = await portalTokenService.validateToken(params.token);

    if (!result.valid) {
      return {
        valid: false,
        error: result.error,
      };
    }

    return {
      valid: true,
      clientId: result.clientId!,
      authLevel: result.authLevel!,
    };
  },
  component: PortalEntryPage,
});

/**
 * Portal entry page component.
 * Routes to appropriate view based on auth level.
 */
function PortalEntryPage() {
  const data = Route.useLoaderData();

  if (!data.valid) {
    return <PortalErrorView error={data.error} />;
  }

  // Route based on auth level
  switch (data.authLevel) {
    case "token_only":
      return <ClientPortalView clientId={data.clientId} />;
    case "email_verify":
      return <EmailVerificationView clientId={data.clientId} />;
    case "full_login":
      return <LoginRequiredView clientId={data.clientId} />;
    default:
      return <ClientPortalView clientId={data.clientId} />;
  }
}

/**
 * Error view for invalid/expired/revoked tokens.
 */
function PortalErrorView({
  error,
}: {
  error?: "expired" | "revoked" | "not_found";
}) {
  const messages = {
    expired: {
      title: "Link Expired",
      message:
        "This portal link has expired. Please contact your agency for a new link.",
    },
    revoked: {
      title: "Link Revoked",
      message:
        "This portal link is no longer active. Please contact your agency.",
    },
    not_found: {
      title: "Link Not Found",
      message:
        "This portal link is invalid. Please check the URL or contact your agency.",
    },
  };

  const content = messages[error ?? "not_found"];

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-1">
      <div className="max-w-md w-full p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-error/10 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-error"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-text-1 mb-2">
          {content.title}
        </h1>
        <p className="text-text-3">{content.message}</p>
      </div>
    </div>
  );
}

/**
 * Placeholder: Main client portal view (token_only auth level).
 * Full implementation in 87-02.
 */
function ClientPortalView({ clientId }: { clientId: string }) {
  return (
    <div className="min-h-screen bg-surface-1 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold text-text-1 mb-4">
          Client Portal
        </h1>
        <p className="text-text-3 mb-8">
          Welcome to your SEO progress dashboard.
        </p>
        <div className="bg-surface-2 rounded-lg p-6 shadow-card">
          <p className="text-text-2">
            Portal content coming in Phase 87-02.
          </p>
          <p className="text-text-3 text-sm mt-2">Client ID: {clientId}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Placeholder: Email verification view (email_verify auth level).
 * Requires one-time email OTP before showing portal.
 */
function EmailVerificationView({ clientId }: { clientId: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-1">
      <div className="max-w-md w-full p-8">
        <h1 className="text-xl font-semibold text-text-1 mb-4 text-center">
          Verify Your Email
        </h1>
        <p className="text-text-3 mb-6 text-center">
          Enter the verification code sent to your email to access the portal.
        </p>
        <div className="bg-surface-2 rounded-lg p-6">
          <p className="text-text-2 text-center">
            Email verification flow coming in Phase 87-02.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Placeholder: Login required view (full_login auth level).
 * Redirects to Clerk login before showing portal.
 */
function LoginRequiredView({ clientId }: { clientId: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-1">
      <div className="max-w-md w-full p-8">
        <h1 className="text-xl font-semibold text-text-1 mb-4 text-center">
          Login Required
        </h1>
        <p className="text-text-3 mb-6 text-center">
          Please sign in to access your portal.
        </p>
        <div className="bg-surface-2 rounded-lg p-6">
          <p className="text-text-2 text-center">
            Clerk login integration coming in Phase 87-02.
          </p>
        </div>
      </div>
    </div>
  );
}
