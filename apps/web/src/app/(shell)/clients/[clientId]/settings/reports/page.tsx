import { type ReportSchedule } from "@/lib/api/schedules";
import { ScheduleForm } from "@/components/settings/ScheduleForm";
import { PageHeader, Skeleton } from "@tevero/ui";
import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

// Type for redirect with any route (Next.js typed routes)
type AnyRoute = Parameters<typeof redirect>[0];

export const metadata = {
  title: "Report Schedule",
};

interface ReportSettingsPageProps {
  params: Promise<{ clientId: string }>;
}

/**
 * Server component that fetches schedules and renders the form.
 */
async function ScheduleContent({ clientId }: { clientId: string }) {
  // Fetch schedules from API (server-side)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Get auth token for server-side request
  const { getToken } = await auth();
  const token = await getToken();

  const res = await fetch(`${baseUrl}/api/clients/${clientId}/schedules`, {
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
    },
    cache: "no-store",
  });

  let schedules: ReportSchedule[] = [];
  if (res.ok) {
    const data = await res.json();
    schedules = data.schedules ?? [];
  }

  return <ScheduleForm clientId={clientId} initialSchedules={schedules} />;
}

/**
 * Loading skeleton for schedule form.
 */
function ScheduleFormSkeleton() {
  return (
    <div className="space-y-6">
      {/* Weekly schedule card skeleton */}
      <Skeleton className="h-64 rounded-lg" />

      {/* Monthly schedule card skeleton */}
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}

/**
 * Report schedule settings page.
 *
 * Allows configuration of automated report delivery:
 * - Enable/disable weekly and monthly schedules
 * - Day/time selection (user-friendly, not raw cron)
 * - Timezone selection with auto-detect
 * - Recipients email configuration
 * - Next delivery preview
 */
export default async function ReportSettingsPage({
  params,
}: ReportSettingsPageProps) {
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
        title="Report Schedule"
        subtitle="Configure automated report delivery"
        backHref={`/clients/${clientId}/settings`}
      />

      <div className="mt-8">
        <Suspense fallback={<ScheduleFormSkeleton />}>
          <ScheduleContent clientId={clientId} />
        </Suspense>
      </div>
    </div>
  );
}
