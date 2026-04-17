"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * InitialRouteHandler — redirects authenticated users to /clients.
 *
 * In the Next.js App Router, route redirect logic lives in `apps/web/src/app/page.tsx`
 * (plan 08-02 Task 2), but this component is kept for compatibility with any consumer
 * that may import it (e.g. plan 08-06 global settings flow). If it remains unused after
 * plan 08-06, it will be removed in plan 08-08.
 */
export default function InitialRouteHandler() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/clients" as Parameters<typeof router.replace>[0]);
  }, [router]);

  return null;
}
