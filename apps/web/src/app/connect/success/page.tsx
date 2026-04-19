/**
 * OAuth success confirmation page.
 *
 * PUBLIC ROUTE - No Clerk authentication required.
 * Displayed after successful Google OAuth callback.
 *
 * This is a static page with no data fetching - the client
 * has completed their authorization and can close the tab.
 */

export default function ConnectSuccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="max-w-md text-center p-8">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
          <svg
            className="h-8 w-8 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-foreground">
          Connection Successful
        </h1>
        <p className="mt-3 text-muted-foreground">
          Your Google accounts have been connected successfully. You may now
          close this window.
        </p>
        <div className="mt-6 p-4 rounded-lg bg-muted/50">
          <p className="text-sm text-muted-foreground">
            Your agency can now access your Search Console, Analytics, and
            Business Profile data to help improve your online presence.
          </p>
        </div>
      </div>
    </div>
  );
}
