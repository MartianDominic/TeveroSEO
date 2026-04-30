/**
 * Onboarding Complete Page
 * Phase 51-02: Prospect Conversion
 *
 * Shows the conversion summary after successful onboarding completion.
 * Redirects back to onboarding page if checklist is not 100% complete.
 */
import { notFound, redirect } from "next/navigation";
import { ConversionSummary } from "@/components/onboarding/ConversionSummary";
import { getClientChecklist, getClient } from "@/lib/api/clients";

interface PageProps {
  params: Promise<{ clientId: string }>;
}

export default async function OnboardingCompletePage({ params }: PageProps) {
  const { clientId } = await params;

  const [checklist, client] = await Promise.all([
    getClientChecklist(clientId),
    getClient(clientId),
  ]);

  if (!checklist || !client) {
    notFound();
  }

  // If not complete, redirect back to onboarding
  const onboardingPath = `/clients/${clientId}/onboarding`;
  if (checklist.completedCount !== checklist.totalCount) {
    redirect(onboardingPath as never);
  }

  // If client not active, something went wrong - redirect to onboarding
  if (client.status !== "active") {
    redirect(onboardingPath as never);
  }

  // Determine connected services from credential items
  const connectedServices = checklist.items
    .filter((item) => item.category === "credentials" && item.completedAt)
    .map((item) => item.label.replace("Connect ", ""));

  // Next steps based on tier
  const nextSteps = getNextStepsForTier(checklist.serviceTier);

  return (
    <ConversionSummary
      clientId={client.id}
      clientName={client.name}
      serviceTier={checklist.serviceTier}
      completedAt={new Date(checklist.updatedAt)}
      connectedServices={connectedServices}
      nextSteps={nextSteps}
    />
  );
}

function getNextStepsForTier(tier: string): string[] {
  switch (tier) {
    case "enterprise":
      return [
        "Review competitor analysis in the dashboard",
        "Schedule first content strategy review",
        "Set up weekly reporting schedule",
        "Configure SEO automation rules",
      ];
    case "growth":
      return [
        "Review SEO audit results",
        "Submit first content brief",
        "Set up monthly reporting",
      ];
    case "starter":
    default:
      return [
        "Review SEO audit results",
        "Submit your first content request",
      ];
  }
}
