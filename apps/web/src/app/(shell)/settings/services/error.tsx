'use client';

import { PageErrorBoundary } from '@/components/page-error-boundary';

export default function ServicesError({
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
      pageTitle="Services"
      pageRoute="settings/services"
      backHref="/settings"
      backLabel="Back to settings"
    />
  );
}
