"use client";

/**
 * /clients/[clientId]/seo — SEO iframe stub.
 *
 * Renders the open-seo app (app.openseo.so) inside a full-bleed iframe.
 * Passes the active client UUID and Clerk JWT as query params so open-seo
 * can resolve the client context without custom request headers (which
 * cross-origin iframes cannot set).
 *
 * TEMPORARY: This iframe stub is replaced in Phase 10 when open-seo routes
 * are absorbed directly into apps/web. At that point, NEXT_PUBLIC_OPEN_SEO_URL
 * and this page file are both deleted.
 *
 * Cross-frame postMessage sync (nav events, theme, etc.) is deferred to
 * Phase 10 — Phase 8 provides a raw embed only.
 */

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function SeoAuditPage() {
  const params = useParams<{ clientId: string }>();
  const clientId = params.clientId;
  const { getToken, isLoaded } = useAuth();
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    (async () => {
      const token = await getToken();
      const base =
        process.env.NEXT_PUBLIC_OPEN_SEO_URL ?? "https://app.openseo.so";
      const url = new URL(base);
      if (clientId) url.searchParams.set("client_id", clientId);
      if (token) url.searchParams.set("token", token);
      setSrc(url.toString());
    })();
  }, [clientId, getToken, isLoaded]);

  if (!src) {
    return <div className="p-6 text-sm text-muted-foreground">Loading SEO tools...</div>;
  }

  return (
    <iframe
      src={src}
      title="SEO Audit"
      className="h-[calc(100vh-4rem)] w-full border-0 block"
    />
  );
}
