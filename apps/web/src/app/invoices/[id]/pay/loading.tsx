import { Skeleton } from "@tevero/ui";

export default function InvoicePayLoading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Card header */}
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <div className="text-center space-y-2">
            <Skeleton className="h-7 w-40 mx-auto" />
            <Skeleton className="h-4 w-56 mx-auto" />
          </div>

          {/* Amount display */}
          <div className="text-center py-4">
            <Skeleton className="h-10 w-32 mx-auto" />
          </div>

          {/* Payment form skeleton */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          </div>

          {/* Submit button */}
          <Skeleton className="h-12 w-full" />
        </div>

        {/* Security note */}
        <div className="flex items-center justify-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
    </div>
  );
}
