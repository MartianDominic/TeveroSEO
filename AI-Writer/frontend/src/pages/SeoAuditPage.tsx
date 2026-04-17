import React, { useMemo } from 'react';
import { useClientStore } from '../stores/clientStore';

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
 */
const SeoAuditPage: React.FC = () => {
  const activeClientId = useClientStore((s) => s.activeClientId);

  const iframeSrc = useMemo(() => {
    const base =
      process.env.REACT_APP_SEO_AUDIT_URL || DEFAULT_SEO_AUDIT_URL;
    if (!activeClientId) return base;
    const url = new URL(base);
    url.searchParams.set('client_id', activeClientId);
    return url.toString();
  }, [activeClientId]);

  return (
    <div className="flex-1 h-full w-full overflow-hidden">
      <iframe
        key={activeClientId ?? 'no-client'}
        src={iframeSrc}
        title="SEO Audit"
        className="w-full h-full border-0 block"
      />
    </div>
  );
};

export default SeoAuditPage;
