"use client";

import { PageErrorBoundary } from "@/components/page-error-boundary";

export default function ConnectError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PageErrorBoundary
      error={error}
      reset={reset}
      pageTitle="Connect"
      pageRoute="connect"
      backHref="/"
      backLabel="Back to home"
    />
  );
}
