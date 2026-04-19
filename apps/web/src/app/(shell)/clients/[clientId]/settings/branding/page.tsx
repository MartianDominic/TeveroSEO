import { type ClientBranding } from "@/lib/api/branding";
import { BrandingForm } from "@/components/settings/BrandingForm";
import { PageHeader, Skeleton } from "@tevero/ui";
import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

// Type for redirect with any route (Next.js typed routes)
type AnyRoute = Parameters<typeof redirect>[0];

export const metadata = {
  title: "Branding Settings",
};

interface BrandingSettingsPageProps {
  params: Promise<{ clientId: string }>;
}

/**
 * Server component that fetches branding data and renders the form.
 */
async function BrandingContent({ clientId }: { clientId: string }) {
  // Fetch branding from API (server-side)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Get auth token for server-side request
  const { getToken } = await auth();
  const token = await getToken();

  const res = await fetch(`${baseUrl}/api/clients/${clientId}/branding`, {
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
    },
    cache: "no-store",
  });

  let branding: ClientBranding;
  if (res.ok) {
    branding = await res.json();
  } else {
    // Use defaults if fetch fails
    branding = {
      clientId,
      logoUrl: null,
      primaryColor: "#3b82f6",
      secondaryColor: "#10b981",
      footerText: null,
      createdAt: null,
      updatedAt: null,
    };
  }

  return <BrandingForm clientId={clientId} initialData={branding} />;
}

/**
 * Loading skeleton for branding form.
 */
function BrandingFormSkeleton() {
  return (
    <div className="space-y-6">
      {/* Preview skeleton */}
      <Skeleton className="h-48 w-full rounded-lg" />

      {/* Two-column cards skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>

      {/* Footer text skeleton */}
      <Skeleton className="h-32 rounded-lg" />

      {/* Buttons skeleton */}
      <div className="flex justify-between pt-4">
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-10 w-28" />
      </div>
    </div>
  );
}

/**
 * Branding settings page.
 *
 * Allows agencies to customize report branding:
 * - Logo upload with drag-and-drop
 * - Primary and secondary color pickers
 * - Custom footer text
 * - Live preview of branded report header
 */
export default async function BrandingSettingsPage({
  params,
}: BrandingSettingsPageProps) {
  const { clientId } = await params;

  // Validate UUID format
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(clientId)) {
    redirect("/clients" as AnyRoute);
  }

  return (
    <div className="container max-w-4xl py-8">
      <PageHeader
        title="Branding Settings"
        subtitle="Customize how your reports look with your own branding"
        backHref={`/clients/${clientId}/settings`}
      />

      <div className="mt-8">
        <Suspense fallback={<BrandingFormSkeleton />}>
          <BrandingContent clientId={clientId} />
        </Suspense>
      </div>
    </div>
  );
}
