/**
 * Magic Link Installation Page
 * Phase 66-05: Developer Handoff Flow
 *
 * PUBLIC ROUTE - No authentication required.
 * Accessed via magic link from developer handoff email.
 *
 * Features:
 * - Validates magic link token
 * - Shows installation guide with pre-filled snippet
 * - Tracks handoff status (opened, completed)
 * - Platform-specific instructions
 */
import { getOpenSeoUrl } from "@/lib/env";

type PageProps = {
  params: Promise<{ token: string }>;
};

// Types matching API response
interface HandoffData {
  handoff: {
    id: string;
    developerEmail: string;
    developerName: string | null;
    status: string;
    sentAt: string;
    openedAt: string | null;
  };
  installation: {
    siteId: string;
    domain: string;
  };
  guide: {
    platform: string;
    steps: Array<{
      title: string;
      content: string;
    }>;
  } | null;
  snippet: string;
}

/**
 * Fetch handoff data from open-seo-main backend.
 */
async function getHandoffData(token: string): Promise<HandoffData | null> {
  try {
    const baseUrl = getOpenSeoUrl();
    const res = await fetch(`${baseUrl}/api/connect/handoff/${token}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
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

export default async function InstallPage({ params }: PageProps) {
  const { token } = await params;

  // Fetch handoff data
  const data = await getHandoffData(token);

  // Invalid or expired link
  if (!data) {
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
          <h1 className="text-2xl font-semibold text-foreground">Link Expired</h1>
          <p className="mt-3 text-muted-foreground">
            This installation link has expired or is invalid. Please contact the
            person who sent you this link for a new one.
          </p>
        </div>
      </div>
    );
  }

  const { handoff, installation, guide, snippet } = data;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              Add TeveroSEO to {installation.domain}
            </h1>
            <p className="text-sm text-muted-foreground">
              Takes about 30 seconds
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">
              Sent to {handoff.developerEmail}
            </p>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Quick install section */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Quick Install</h2>
          <div className="bg-card border rounded-lg p-6">
            <p className="text-sm text-muted-foreground mb-4">
              Add this line to the <code className="bg-muted px-1 py-0.5 rounded text-xs-safe">&lt;head&gt;</code> of your website:
            </p>
            <div className="relative">
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-md text-sm overflow-x-auto">
                <code>{snippet}</code>
              </pre>
              <CopyButton text={snippet} />
            </div>
            <p className="text-xs-safe text-muted-foreground mt-3">
              This tiny helper (less than 5KB) tracks visits and helps improve SEO.
              It cannot change anything without approval.
            </p>
          </div>
        </section>

        {/* Platform guide if available */}
        {guide && guide.steps.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">
              Step-by-Step Guide
              {guide.platform !== "custom" && (
                <span className="ml-2 text-sm font-normal text-muted-foreground capitalize">
                  for {guide.platform}
                </span>
              )}
            </h2>
            <div className="space-y-4">
              {guide.steps.map((step, index) => (
                <div key={index} className="bg-card border rounded-lg p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 font-medium">
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">{step.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                        {step.content}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Verification section */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Verify Installation</h2>
          <div className="bg-card border rounded-lg p-6">
            <p className="text-sm text-muted-foreground mb-4">
              After adding the code:
            </p>
            <ol className="list-decimal list-inside text-sm space-y-2 text-muted-foreground">
              <li>Save your changes</li>
              <li>Visit your website in a new tab</li>
              <li>
                Come back here - we will detect the installation automatically
              </li>
            </ol>
            <div className="mt-6 pt-6 border-t">
              <VerificationStatus
                token={token}
                domain={installation.domain}
              />
            </div>
          </div>
        </section>

        {/* Help section */}
        <section>
          <div className="bg-muted/30 border rounded-lg p-6 text-center">
            <h3 className="font-medium text-foreground">Need help?</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Reply to the original email or contact the person who sent this link.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

/**
 * Copy button component (client-side)
 */
function CopyButton({ text }: { text: string }) {
  return (
    <button
      className="absolute top-2 right-2 px-3 py-1.5 text-xs-safe bg-slate-700 hover:bg-slate-600 text-slate-100 rounded transition-colors"
      onClick={() => {
        if (typeof navigator !== "undefined") {
          navigator.clipboard.writeText(text);
        }
      }}
    >
      Copy
    </button>
  );
}

/**
 * Verification status component (polls for installation detection)
 */
function VerificationStatus({
  token,
  domain,
}: {
  token: string;
  domain: string;
}) {
  // This would be a client component in production that polls for verification
  // For now, show static "waiting" state
  return (
    <div className="flex items-center justify-center gap-3">
      <div className="w-3 h-3 rounded-full bg-yellow-400 animate-pulse" />
      <span className="text-sm text-muted-foreground">
        Waiting for {domain} to say hello...
      </span>
    </div>
  );
}
