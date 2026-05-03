'use client';

import { PageErrorBoundary } from '@/components/page-error-boundary';

export default function AgreementsError({
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
      pageTitle="Agreements"
      pageRoute="clients/[clientId]/agreements"
      backHref="/clients"
      backLabel="Back to clients"
    />
  );
}
