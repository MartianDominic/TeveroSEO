import { Skeleton } from "@tevero/ui";

/**
 * Loading state for client onboarding page.
 * Shows skeleton UI while checklist data loads.
 *
 * H-ONBOARD-02 FIX: Added loading.tsx to prevent blank page during slow fetches.
 */
export default function OnboardingLoading() {
  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Header skeleton */}
      <div className="mb-8">
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Progress card skeleton */}
      <div className="rounded-lg border border-border bg-card p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-4 w-8" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-3 w-20 mt-2" />
      </div>

      {/* Checklist category skeletons */}
      {[1, 2, 3].map((category) => (
        <div
          key={category}
          className="rounded-lg border border-border bg-card p-6 mb-4"
        >
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-8" />
          </div>
          <ul className="space-y-3">
            {[1, 2, 3].map((item) => (
              <li key={item} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-5 rounded-full" />
                  <Skeleton className="h-4 w-48" />
                </div>
                <Skeleton className="h-8 w-20 rounded-md" />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
