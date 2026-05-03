/**
 * Authenticated app route layout wrapper.
 * MED-OSM-03 FIX: Added error boundary for _app routes.
 */
import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthenticatedAppLayout } from "@/client/layout/AppShell";
import { useSession } from "@/lib/auth-client";
import { isHostedClientAuthMode } from "@/lib/auth-mode";
import { DefaultCatchBoundary } from "@/client/components/DefaultCatchBoundary";

export const Route = createFileRoute("/_app")({
  component: AppRouteLayout,
  errorComponent: DefaultCatchBoundary,
});

function AppRouteLayout() {
  const navigate = useNavigate();
  const { data: session, isPending } = useSession();
  const isHostedMode = isHostedClientAuthMode();

  useEffect(() => {
    if (isPending || !isHostedMode || session?.user?.id) {
      return;
    }

    // Auth handled by Clerk - redirect to root (Clerk middleware handles auth)
    void navigate({
      to: "/",
      replace: true,
    });
  }, [isPending, isHostedMode, session?.user?.id, navigate]);

  if (isHostedMode && (isPending || !session?.user?.id)) {
    return null;
  }

  return (
    <AuthenticatedAppLayout>
      <Outlet />
    </AuthenticatedAppLayout>
  );
}
