import { Skeleton } from "@tevero/ui";

/**
 * Loading state for pipeline kanban page.
 * Shows skeleton UI while pipeline data loads.
 */
export default function PipelineLoading() {
  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Kanban board skeleton */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {[1, 2, 3, 4, 5].map((column) => (
          <div
            key={column}
            className="min-w-[280px] max-w-[320px] bg-surface-2/50 rounded-lg p-4 shrink-0"
          >
            {/* Column header */}
            <div className="flex items-center gap-2 mb-4">
              <Skeleton className="h-2 w-2 rounded-full" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-8 ml-auto rounded" />
            </div>

            {/* Cards in column */}
            <div className="space-y-2">
              {[1, 2, 3].map((card) => (
                <div
                  key={card}
                  className="bg-card border border-border rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-3" />
                  </div>
                  <Skeleton className="h-3 w-full" />
                  <div className="flex items-center justify-between pt-1">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-5 rounded-full" />
                  </div>
                </div>
              ))}
            </div>

            {/* Add card button */}
            <Skeleton className="h-8 w-full mt-3 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
