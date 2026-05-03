'use client';

import { PageErrorBoundary } from '@/components/page-error-boundary';

export default function OnboardingError({
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
      pageTitle="Onboarding"
      pageRoute="clients/[clientId]/onboarding"
      backHref="/clients"
      backLabel="Back to clients"
    />
  );
}
