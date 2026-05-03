"use client";

import { PageErrorBoundary } from "@/components/page-error-boundary";

export default function DashboardError({
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
      pageTitle="Dashboard"
      pageRoute="dashboard"
      showHomeButton={false}
    />
  );
}
