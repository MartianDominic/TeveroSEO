"use client";

/**
 * Portal Activity Page
 *
 * Full activity feed with category filtering and pagination.
 * Shows work entries grouped by date with artifact links.
 */

import * as React from "react";

import { useParams, useSearchParams } from "next/navigation";

import { ActivityFeed } from "@/components/portal/ActivityFeed";
import { useActivity } from "@/lib/portal/hooks";
import type { ActivityCategory } from "@/lib/portal/types";
import { cn } from "@/lib/utils";

export default function PortalActivityPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const clientId = params.clientId as string;

  // Token from query param or cookie
  const token = searchParams.get("token") || "";

  // Category filter state
  const [categoryFilter, setCategoryFilter] =
    React.useState<ActivityCategory | null>(null);
  const [offset, setOffset] = React.useState(0);
  const limit = 20;

  // Fetch activities with current filter
  const { data, isLoading, error, refetch, fetchNextPage, hasNextPage } =
    useActivityWithPagination(clientId, token, categoryFilter, limit);

  // Handle category filter change - reset pagination
  const handleCategoryFilterChange = (category: ActivityCategory | null) => {
    setCategoryFilter(category);
    setOffset(0);
  };

  // Handle load more
  const handleLoadMore = () => {
    setOffset((prev) => prev + limit);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page header */}
      <div>
        <h1 className="font-display text-[clamp(24px,2vw,32px)] font-medium text-text-1 tracking-[-0.02em]">
          Activity
        </h1>
        <p className="text-[13px] text-text-3 mt-1">
          See all work completed for your SEO campaign
        </p>
      </div>

      {/* Error state */}
      {error !== null && error !== undefined && (
        <div className="p-4 bg-error-soft rounded-[--radius-card] border border-error/20">
          <p className="text-[14px] text-error">
            Failed to load activity. Please try again.
          </p>
          <button
            onClick={() => refetch()}
            className="mt-2 text-[13px] text-error underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Activity feed */}
      <ActivityFeed
        activities={data?.activities || []}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={handleCategoryFilterChange}
        hasMore={data?.pagination?.hasMore || false}
        onLoadMore={handleLoadMore}
        isLoading={isLoading}
      />
    </div>
  );
}

/**
 * Custom hook to handle activity pagination
 * This is a wrapper that accumulates results as user loads more
 */
function useActivityWithPagination(
  clientId: string,
  token: string,
  category: ActivityCategory | null,
  limit: number
) {
  const [allActivities, setAllActivities] = React.useState<
    Array<{
      id: string;
      category: string;
      title: string;
      description: string | null;
      artifacts: Array<{ label: string; url: string }>;
      createdAt: string;
    }>
  >([]);
  const [offset, setOffset] = React.useState(0);

  const { data, isLoading, error, refetch } = useActivity(clientId, token, {
    category: category || undefined,
    limit,
    offset,
  });

  // Reset when category changes
  React.useEffect(() => {
    setAllActivities([]);
    setOffset(0);
  }, [category]);

  // Accumulate activities
  React.useEffect(() => {
    if (data?.activities) {
      if (offset === 0) {
        setAllActivities(data.activities);
      } else {
        setAllActivities((prev) => [...prev, ...data.activities]);
      }
    }
  }, [data?.activities, offset]);

  const fetchNextPage = () => {
    setOffset((prev) => prev + limit);
  };

  const hasNextPage = data?.pagination?.hasMore || false;

  return {
    data: {
      activities: allActivities,
      pagination: data?.pagination,
    },
    isLoading,
    error,
    refetch: () => {
      setAllActivities([]);
      setOffset(0);
      refetch();
    },
    fetchNextPage,
    hasNextPage,
  };
}
