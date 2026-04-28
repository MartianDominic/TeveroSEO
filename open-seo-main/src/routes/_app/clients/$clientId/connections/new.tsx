/**
 * New Connection Wizard Page
 * Phase 31-04: Connection Wizard UI
 *
 * Full-page wizard for adding a new site connection.
 * Uses ConnectionWizard component with navigation on complete/cancel.
 */
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { ConnectionWizard } from "@/client/components/connections";
import type { ConnectionWithoutCredentials } from "@/server/features/connections";

export const Route = createFileRoute("/_app/clients/$clientId/connections/new")({
  component: NewConnectionPage,
});

function NewConnectionPage() {
  const { clientId } = useParams({
    // @ts-ignore - Route not yet in generated route tree
    from: "/_app/clients/$clientId/connections/new",
  });
  const navigate = useNavigate();

  /**
   * Handle wizard completion - navigate to connections list.
   */
  const handleComplete = (_connection: ConnectionWithoutCredentials) => {
    navigate({
      // @ts-ignore - Route not yet in generated route tree
      to: "/clients/$clientId/connections",
      // @ts-ignore - Route not yet in generated route tree
      params: { clientId },
    });
  };

  /**
   * Handle wizard cancel - navigate back to client page or connections list.
   */
  const handleCancel = () => {
    navigate({
      // @ts-ignore - Route not yet in generated route tree
      to: "/clients/$clientId/connections",
      // @ts-ignore - Route not yet in generated route tree
      params: { clientId },
    });
  };

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6 text-center">Connect Website</h1>
      <ConnectionWizard
        clientId={clientId}
        onComplete={handleComplete}
        onCancel={handleCancel}
      />
    </div>
  );
}
