/**
 * Client ID Layout - RSC wrapper for client-specific routes.
 *
 * FIX-06 H-NEXT-01: Converted to RSC by extracting client logic to ClientIdProvider.
 * This allows child routes to be Server Components when possible, improving
 * performance by reducing client-side JavaScript bundle size.
 *
 * The ClientIdProvider handles syncing the URL param to the global store.
 */
import type { ReactNode } from "react";

import { ClientIdProvider } from "./ClientIdProvider";

export default function ClientIdLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <ClientIdProvider>{children}</ClientIdProvider>;
}
