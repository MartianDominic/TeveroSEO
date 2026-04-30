/**
 * Onboarding Page
 * Phase 51-02: Onboarding Checklist
 *
 * Displays the onboarding checklist for a client.
 * Redirects to complete page when 100% done.
 */
import { notFound, redirect } from "next/navigation";
import { getClientChecklist, getClient } from "@/lib/api/clients";
import { OnboardingChecklist } from "./onboarding-checklist";

interface PageProps {
  params: Promise<{ clientId: string }>;
}

export default async function OnboardingPage({ params }: PageProps) {
  const { clientId } = await params;

  const [checklist, client] = await Promise.all([
    getClientChecklist(clientId),
    getClient(clientId),
  ]);

  if (!checklist || !client) {
    notFound();
  }

  // Redirect to completion page if 100% done
  if (checklist.completedCount === checklist.totalCount) {
    redirect(`/clients/${clientId}/onboarding/complete`);
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">
          Onboarding: {client.name}
        </h1>
        <p className="text-muted-foreground mt-1">
          Complete the checklist below to finish setting up {client.name} as an
          active client.
        </p>
      </div>

      <OnboardingChecklist
        checklistId={checklist.id}
        clientId={clientId}
        items={checklist.items}
        completedCount={checklist.completedCount}
        totalCount={checklist.totalCount}
        serviceTier={checklist.serviceTier}
      />
    </div>
  );
}
