"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import { useClientStore, type ClientStore } from "@/stores";

export default function ClientIdLayout({
  children,
}: {
  children: ReactNode;
}) {
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
