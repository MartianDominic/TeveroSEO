import { Skeleton } from "@tevero/ui";

export default function AnalyticsLoading() {
  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header with date range selector */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Stats grid - 4 cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>

      {/* Chart area */}
      <Skeleton className="h-[280px] rounded-lg" />

      {/* Table area */}
      <Skeleton className="h-[280px] rounded-lg" />
    </div>
  );
}
