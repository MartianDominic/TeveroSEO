/**
 * SEO Chat Session Loading State
 * Phase 98: Loading skeleton for individual session route
 *
 * Displays a skeleton UI while session data is being fetched,
 * preventing blank screen flash during navigation.
 */

import { Skeleton } from '@/components/ui/skeleton';

export default function SessionLoading() {
  return (
    <div className="flex h-full">
      {/* Chat area skeleton */}
      <div className="flex-1 flex flex-col">
        {/* Chat header */}
        <div className="border-b px-4 py-3 flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div>
            <Skeleton className="h-5 w-32 mb-1" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 p-4 space-y-4 overflow-hidden">
          {/* Assistant message */}
          <div className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="space-y-2 flex-1 max-w-[80%]">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>

          {/* User message */}
          <div className="flex gap-3 justify-end">
            <div className="space-y-2 max-w-[80%]">
              <Skeleton className="h-4 w-48 ml-auto" />
              <Skeleton className="h-4 w-32 ml-auto" />
            </div>
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          </div>

          {/* Another assistant message */}
          <div className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="space-y-2 flex-1 max-w-[80%]">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          </div>
        </div>

        {/* Input area */}
        <div className="border-t p-4">
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
