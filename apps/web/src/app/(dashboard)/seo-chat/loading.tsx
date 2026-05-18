/**
 * SEO Chat Loading State
 * Phase 98: Loading skeleton for SEO Chat route
 *
 * Displays a skeleton UI while the page data is being fetched,
 * preventing blank screen flash during navigation.
 */

import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare } from 'lucide-react';

export default function SeoChatLoading() {
  return (
    <div className="flex h-full">
      {/* Sidebar skeleton */}
      <aside className="w-80 border-r bg-muted/30 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
            <Skeleton className="h-6 w-24" />
          </div>
          <Skeleton className="h-10 w-full" />
        </div>

        {/* Session list skeleton */}
        <div className="p-4 space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </aside>

      {/* Main content skeleton */}
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Skeleton className="h-16 w-16 mx-auto mb-4 rounded-full" />
          <Skeleton className="h-6 w-48 mx-auto mb-2" />
          <Skeleton className="h-4 w-64 mx-auto" />
        </div>
      </main>
    </div>
  );
}
