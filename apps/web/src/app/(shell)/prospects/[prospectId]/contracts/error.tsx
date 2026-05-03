'use client';

import { PageErrorBoundary } from '@/components/page-error-boundary';

export default function ContractsError({
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
      pageTitle="Contracts"
      pageRoute="prospects/[prospectId]/contracts"
      backHref="/prospects"
      backLabel="Back to prospects"
    />
  );
}
