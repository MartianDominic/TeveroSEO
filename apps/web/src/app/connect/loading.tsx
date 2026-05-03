import { Skeleton } from "@tevero/ui";

/**
 * Loading state for connection wizard page.
 * Shows skeleton UI while wizard initializes.
 */
export default function ConnectLoading() {
  return (
    <div className="min-h-screen bg-[var(--surface-1)] py-12">
      <div className="max-w-2xl mx-auto">
        {/* Step indicator skeleton */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                {step < 4 && <Skeleton className="h-0.5 w-12" />}
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-8 mt-3">
            {[1, 2, 3, 4].map((step) => (
              <Skeleton key={step} className="h-3 w-16" />
            ))}
          </div>
        </div>

        {/* Main content card skeleton */}
        <div className="bg-[var(--surface)] rounded-[var(--radius-card)] shadow-card p-8">
          {/* Title */}
          <div className="text-center mb-8">
            <Skeleton className="h-7 w-64 mx-auto mb-3" />
            <Skeleton className="h-4 w-80 mx-auto" />
          </div>

          {/* URL input skeleton */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>

            <Skeleton className="h-10 w-full rounded-lg" />
          </div>

          {/* Help text */}
          <div className="mt-6 flex items-center justify-center gap-2">
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      </div>
    </div>
  );
}
