"use client";

import { PageErrorBoundary } from "@/components/page-error-boundary";

export default function SettingsError({
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
      pageTitle="Settings"
      pageRoute="settings"
      backHref="/dashboard"
      backLabel="Back to dashboard"
    />
  );
}
