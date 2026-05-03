"use client";

import { PageErrorBoundary } from "@/components/page-error-boundary";

export default function ClientsError({
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
      pageTitle="Clients"
      pageRoute="clients"
      backHref="/dashboard"
      backLabel="Back to dashboard"
    />
  );
}
