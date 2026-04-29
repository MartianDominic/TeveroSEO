import { Skeleton } from "@tevero/ui";

/**
 * Loading state for settings section.
 * Shows skeleton UI while settings data loads.
 */
export default function SettingsLoading() {
  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Navigation tabs */}
      <div className="flex gap-4 border-b border-border pb-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-8 w-24" />
        ))}
      </div>

      {/* Settings content */}
      <div className="space-y-6">
        {/* Section 1 */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-40" />
          <div className="rounded-lg border border-border p-4 space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </div>

        {/* Section 2 */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-48" />
          <div className="rounded-lg border border-border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-6 w-12" />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-6 w-12" />
            </div>
          </div>
        </div>

        {/* Save button */}
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}
