import { Skeleton } from "@tevero/ui";

export default function InvoiceLoading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>

      {/* Invoice content */}
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Invoice header */}
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>

        {/* Line items */}
        <div className="rounded-lg border border-border bg-card">
          <div className="p-4 border-b border-border">
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="p-4 space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="flex justify-between items-center">
                <div className="space-y-1">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-56" />
                </div>
                <Skeleton className="h-5 w-20" />
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-border flex justify-between">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-28" />
          </div>
        </div>

        {/* Payment button */}
        <div className="flex justify-center">
          <Skeleton className="h-12 w-48" />
        </div>
      </div>
    </div>
  );
}
