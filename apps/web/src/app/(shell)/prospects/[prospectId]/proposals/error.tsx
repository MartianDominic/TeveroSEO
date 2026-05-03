'use client';

import { PageErrorBoundary } from '@/components/page-error-boundary';

export default function ProposalsError({
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
      pageTitle="Proposals"
      pageRoute="prospects/[prospectId]/proposals"
      backHref="/prospects"
      backLabel="Back to prospects"
    />
  );
}
