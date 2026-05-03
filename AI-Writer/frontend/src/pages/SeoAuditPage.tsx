import React, { useMemo, useState, useCallback } from 'react';
import { useClientStore } from '../stores/clientStore';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';

const DEFAULT_SEO_AUDIT_URL = 'https://app.openseo.so';

/**
 * SeoAuditPage — renders the open-seo app inside an iframe.
 *
 * SHELL-02: Owns the /clients/:clientId/seo route in AI-Writer.
 * SHELL-03: Renders inside AppShell chrome (sidebar + TopBar remain visible).
 * SHELL-04: Passes the active client's UUID as ?client_id=<uuid> to open-seo;
 *           open-seo's resolveClientId() reads this query param as a fallback to
 *           the X-Client-ID header (cross-origin iframes can't set custom headers).
 * SHELL-05: open-seo-main already uses shadcn/ui tokens (Phase 2), so no additional
 *           styling is needed here beyond a borderless full-bleed container.
 * HIGH-05: Added loading spinner and error fallback for iframe.
 */
const SeoAuditPage: React.FC = () => {
  const activeClientId = useClientStore((s) => s.activeClientId);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const iframeSrc = useMemo(() => {
    const base =
      process.env.REACT_APP_SEO_AUDIT_URL || DEFAULT_SEO_AUDIT_URL;
    if (!activeClientId) return base;
    const url = new URL(base);
    url.searchParams.set('client_id', activeClientId);
    return url.toString();
  }, [activeClientId]);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
  }, []);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  const handleRetry = useCallback(() => {
    setIsLoading(true);
    setHasError(false);
    setRetryKey((prev) => prev + 1);
  }, []);

  return (
    <div className="flex-1 h-full w-full overflow-hidden relative">
      {/* Loading spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading SEO Audit...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
          <div className="flex flex-col items-center gap-4 text-center px-4">
            <AlertTriangle className="h-10 w-10 text-destructive" />
            <div>
              <p className="text-base font-semibold text-foreground">Failed to load SEO Audit</p>
              <p className="mt-1 text-sm text-muted-foreground max-w-md">
                The SEO audit tool could not be loaded. Please check your connection and try again.
              </p>
            </div>
            <Button variant="outline" onClick={handleRetry}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      )}

      <iframe
        key={`${activeClientId ?? 'no-client'}-${retryKey}`}
        src={iframeSrc}
        title="SEO Audit"
        className="w-full h-full border-0 block"
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  );
};

export default SeoAuditPage;
