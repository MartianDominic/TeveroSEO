"use client";

import { PageErrorBoundary } from "@/components/page-error-boundary";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function SeoSetupError({ error, reset }: ErrorProps) {
  return (
    <PageErrorBoundary
      error={error}
      reset={reset}
      pageTitle="SEO Setup"
      pageRoute="clients/[clientId]/seo/setup"
      backHref="../"
      backLabel="Back to SEO"
    />
  );
}
