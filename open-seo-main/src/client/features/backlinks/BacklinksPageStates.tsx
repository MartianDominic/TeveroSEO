import { ShieldAlert, Wrench } from "lucide-react";
import type { BacklinksAccessStatusData } from "./backlinksPageTypes";
import { formatRelativeTimestamp } from "./backlinksPageUtils";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent } from "@/client/components/ui/card";

export function BacklinksAccessLoadingState() {
  return (
    <Card className="bg-background border border-border">
      <CardContent className="gap-4">
        <div className="skeleton h-6 w-48" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-4/5" />
        <div className="skeleton h-10 w-48" />
      </CardContent>
    </Card>
  );
}

export function BacklinksSetupGate({
  status,
  isTesting,
  testError,
  onTest,
}: {
  status: BacklinksAccessStatusData | undefined;
  isTesting: boolean;
  testError: string | null;
  onTest: () => void;
}) {
  return (
    <section>
      <div className="rounded-2xl border border-border bg-background p-6 md:p-7 space-y-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-warning/15 p-2.5 text-warning shrink-0">
            <Wrench className="size-5" />
          </div>
          <div className="max-w-3xl space-y-1.5">
            <h2 className="text-xl font-semibold">Enable Backlinks</h2>
            <p className="text-sm text-foreground/68">
              Backlinks is not enabled for your DataForSEO account yet. Turn it
              on in DataForSEO, then test access here.
            </p>
            <p className="text-xs text-foreground/50">
              DataForSEO offers a free 14-day trial for Backlinks. Then, it's
              $100/month. We're gauging interest in building out a lower-cost
              alternative, <InlineMailingListLink /> if you're interested.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={onTest} disabled={isTesting}>
            {isTesting ? "Confirming..." : "Confirm Backlinks Access"}
          </Button>
          <Button variant="outline" asChild>
            <a
              href="https://app.dataforseo.com/api-access-subscriptions"
              target="_blank"
              rel="noreferrer"
            >
              Open DataForSEO Backlinks
            </a>
          </Button>
        </div>

        <BacklinksSetupFeedback status={status} testError={testError} />
      </div>
    </section>
  );
}

export function BacklinksLoadingState() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Card key={index} className="bg-background border border-border">
            <CardContent className="gap-3 p-4">
              <div className="skeleton h-3 w-24" />
              <div className="skeleton h-8 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <Card key={index} className="bg-background border border-border">
            <CardContent className="gap-3">
              <div className="skeleton h-4 w-32" />
              <div className="skeleton h-64 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="bg-background border border-border">
        <CardContent className="gap-3">
          <div className="skeleton h-8 w-60" />
          <div className="skeleton h-80 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export function BacklinksErrorState({
  errorMessage,
  onRetry,
}: {
  errorMessage: string | null;
  onRetry: () => void;
}) {
  return (
    <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 space-y-3">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-destructive/10 p-2.5 text-destructive shrink-0">
          <ShieldAlert className="size-5" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Could not load backlinks</h2>
          <p className="text-sm text-foreground/70">
            {errorMessage ?? "Please try again in a moment."}
          </p>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </section>
  );
}

function BacklinksSetupFeedback({
  status,
  testError,
}: {
  status: BacklinksAccessStatusData | undefined;
  testError: string | null;
}) {
  return (
    <div className="space-y-3">
      {status?.lastCheckedAt ? (
        <div className="text-sm text-muted-foreground">
          Last checked {formatRelativeTimestamp(status.lastCheckedAt)}.
        </div>
      ) : null}
      {status?.lastErrorMessage ? (
        <div className="alert alert-warning">
          <ShieldAlert className="size-4 shrink-0" />
          <span>{status.lastErrorMessage}</span>
        </div>
      ) : null}
      {testError ? (
        <div className="alert alert-error">
          <ShieldAlert className="size-4 shrink-0" />
          <span>{testError}</span>
        </div>
      ) : null}
    </div>
  );
}

function InlineMailingListLink() {
  return (
    <a
      className="underline underline-offset-2 hover:text-foreground/70"
      href="https://openseo.so"
      target="_blank"
      rel="noreferrer"
    >
      join the OpenSEO mailing list
    </a>
  );
}
