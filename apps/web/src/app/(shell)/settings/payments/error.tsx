'use client';

import { PageErrorBoundary } from '@/components/page-error-boundary';

export default function PaymentsError({
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
      pageTitle="Payment Settings"
      pageRoute="settings/payments"
      backHref="/settings"
      backLabel="Back to settings"
    />
  );
}
