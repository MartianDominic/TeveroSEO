import { Skeleton } from "@tevero/ui";

/**
 * Loading state for clients list page.
 * Shows skeleton UI while client data loads.
 */
export default function ClientsLoading() {
  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-28" />
      </div>

      {/* Getting started card placeholder */}
      <Skeleton className="h-32 w-full rounded-lg" />

      {/* Client grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="bg-card border border-border rounded-lg p-4 space-y-3"
          >
            <div className="flex items-start justify-between">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-3.5 w-3.5 rounded-full" />
              <Skeleton className="h-4 w-full" />
            </div>
            <div className="flex items-center justify-between pt-2">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
