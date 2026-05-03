'use client';

import { PageErrorBoundary } from '@/components/page-error-boundary';

export default function PipelineError({
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
      pageTitle="Pipeline"
      pageRoute="pipeline"
      backHref="/dashboard"
      backLabel="Back to dashboard"
    />
  );
}
