"use client";

/**
 * Client ID Provider - Syncs URL clientId param with client store.
 *
 * FIX-06 H-NEXT-01: Extracted from layout.tsx to keep layout as RSC.
 * This allows child routes to remain Server Components when possible,
 * improving performance by reducing client-side JavaScript.
 *
 * The provider only handles the side effect of syncing the URL param
 * to the global store - it does not render any UI.
 */
import { useEffect } from "react";
import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import { useClientStore } from "@/stores";

interface ClientIdProviderProps {
  children: ReactNode;
}

export function ClientIdProvider({ children }: ClientIdProviderProps) {
  const { clientId } = useParams<{ clientId: string }>();
  const activeClientId = useClientStore((s) => s.activeClientId);
  const setActiveClient = useClientStore((s) => s.setActiveClient);

  useEffect(() => {
    if (clientId && clientId !== activeClientId) {
      setActiveClient(clientId);
    }
  }, [clientId, activeClientId, setActiveClient]);

  return <>{children}</>;
}
