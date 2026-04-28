/**
 * Voice Settings Route Layout
 * Phase 37-05: Voice Settings UI
 *
 * Provides the route wrapper for the voice settings page.
 */
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/clients/$clientId/voice")({
  component: VoiceLayout,
});

function VoiceLayout() {
  return <Outlet />;
}
