/**
 * Loading state for signing success page.
 * FIX-06 H-NEXT-04: Added loading.tsx for slow routes.
 */
import { Skeleton } from "@tevero/ui";

export default function SigningSuccessLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-lg shadow-[var(--shadow-card)] p-8">
        {/* Success icon placeholder */}
        <div className="flex justify-center mb-6">
          <Skeleton className="w-16 h-16 rounded-full" />
        </div>

        {/* Title and message */}
        <div className="space-y-2 mb-6">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-4 w-64 mx-auto" />
        </div>

        {/* Agreement info */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-32 mt-3" />
          <Skeleton className="h-5 w-40" />
        </div>

        {/* Progress bar */}
        <div className="mb-6 space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-12" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>

        {/* Action button */}
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    </div>
  );
}
