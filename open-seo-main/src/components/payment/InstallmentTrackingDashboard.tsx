/**
 * Installment Tracking Dashboard Component
 * Phase 60-03: Agency Installment Tracking Dashboard
 *
 * Full page dashboard for agency payment tracking:
 * - PaymentStatsCards at top (upcoming, overdue, this month, YTD)
 * - "Upcoming Payments" section with status filter
 * - InstallmentTable with filtered results
 * - "Recently Paid" section showing last paid installments
 *
 * Design reference: D-11 from 60-CONTEXT.md
 */
"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/client/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { PaymentStatsCards } from "./PaymentStatsCards";
import { InstallmentTable, type InstallmentRow } from "./InstallmentTable";
import { cn } from "@/client/lib/utils";

/**
 * Stats data shape from /api/payments/stats
 */
interface PaymentStats {
  upcoming: { count: number; amountCents: number };
  overdue: { count: number; amountCents: number };
  thisMonth: { count: number; amountCents: number };
  ytd: { count: number; amountCents: number };
}

/**
 * Filter options for the installment table
 */
type FilterStatus = "all" | "upcoming" | "overdue" | "paid";

/**
 * Props for the InstallmentTrackingDashboard component
 */
export interface InstallmentTrackingDashboardProps {
  /** Default currency for display (default: EUR) */
  currency?: string;
  /** Additional class names */
  className?: string;
  /** Optional callback when an installment row is clicked */
  onInstallmentClick?: (installment: InstallmentRow) => void;
}

/**
 * API response shape for stats
 */
interface StatsApiResponse {
  success: boolean;
  data?: PaymentStats;
}

/**
 * API response shape for installments
 */
interface InstallmentsApiResponse {
  success: boolean;
  data?: InstallmentRow[];
  pagination?: {
    total: number;
    limit: number;
    offset: number;
  };
}

/**
 * Fetches payment stats from the API
 */
async function fetchStats(): Promise<PaymentStats | null> {
  try {
    const response = await fetch("/api/payments/stats");
    const data = (await response.json()) as StatsApiResponse;
    if (data.success && data.data) {
      return data.data;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetches installments from the API with optional filters
 */
async function fetchInstallments(params: {
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: InstallmentRow[]; total: number }> {
  try {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.set("status", params.status);
    if (params.from) searchParams.set("from", params.from);
    if (params.to) searchParams.set("to", params.to);
    if (params.limit) searchParams.set("limit", String(params.limit));
    if (params.offset) searchParams.set("offset", String(params.offset));

    const response = await fetch(`/api/payments/installments?${searchParams}`);
    const result = (await response.json()) as InstallmentsApiResponse;
    if (result.success && result.data) {
      return { data: result.data, total: result.pagination?.total ?? 0 };
    }
    return { data: [], total: 0 };
  } catch {
    return { data: [], total: 0 };
  }
}

/**
 * Filter label mapping
 */
const FILTER_LABELS: Record<FilterStatus, string> = {
  all: "All Installments",
  upcoming: "Upcoming (7 days)",
  overdue: "Overdue",
  paid: "Paid",
};

/**
 * InstallmentTrackingDashboard provides a full-page view for agency payment tracking.
 *
 * Layout:
 * - Stats cards at top showing payment totals
 * - Filter dropdown for installment status
 * - Main table showing filtered installments
 * - Recently paid section at bottom
 *
 * @example
 * <InstallmentTrackingDashboard
 *   currency="EUR"
 *   onInstallmentClick={(row) => navigate(`/invoices/${row.invoiceId}`)}
 * />
 */
export function InstallmentTrackingDashboard({
  currency = "EUR",
  className,
  onInstallmentClick,
}: InstallmentTrackingDashboardProps): React.ReactElement {
  // Stats state
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Filter state
  const [filter, setFilter] = useState<FilterStatus>("all");

  // Main installments state
  const [installments, setInstallments] = useState<InstallmentRow[]>([]);
  const [installmentsLoading, setInstallmentsLoading] = useState(true);

  // Recently paid state
  const [recentlyPaid, setRecentlyPaid] = useState<InstallmentRow[]>([]);
  const [recentlyPaidLoading, setRecentlyPaidLoading] = useState(true);

  /**
   * Load stats on mount
   */
  useEffect(() => {
    setStatsLoading(true);
    fetchStats().then((data) => {
      setStats(data);
      setStatsLoading(false);
    });
  }, []);

  /**
   * Load installments when filter changes
   */
  const loadInstallments = useCallback(async () => {
    setInstallmentsLoading(true);

    // Build query params based on filter
    const params: Parameters<typeof fetchInstallments>[0] = { limit: 20 };

    if (filter === "upcoming") {
      // Pending + due within 7 days
      params.status = "pending";
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      params.from = now.toISOString();
      params.to = sevenDaysFromNow.toISOString();
    } else if (filter === "overdue") {
      params.status = "overdue";
    } else if (filter === "paid") {
      params.status = "paid";
    }
    // "all" doesn't add status filter

    const result = await fetchInstallments(params);
    setInstallments(result.data);
    setInstallmentsLoading(false);
  }, [filter]);

  useEffect(() => {
    loadInstallments();
  }, [loadInstallments]);

  /**
   * Load recently paid on mount
   */
  useEffect(() => {
    setRecentlyPaidLoading(true);
    fetchInstallments({ status: "paid", limit: 10 }).then((result) => {
      setRecentlyPaid(result.data);
      setRecentlyPaidLoading(false);
    });
  }, []);

  /**
   * Handle filter change
   */
  const handleFilterChange = (value: string) => {
    setFilter(value as FilterStatus);
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Stats Cards */}
      <PaymentStatsCards
        stats={stats}
        currency={currency}
        isLoading={statsLoading}
      />

      {/* Upcoming Payments Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-semibold">
            Upcoming Payments
          </CardTitle>
          <Select value={filter} onValueChange={handleFilterChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{FILTER_LABELS.all}</SelectItem>
              <SelectItem value="upcoming">{FILTER_LABELS.upcoming}</SelectItem>
              <SelectItem value="overdue">{FILTER_LABELS.overdue}</SelectItem>
              <SelectItem value="paid">{FILTER_LABELS.paid}</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <InstallmentTable
            installments={installments}
            isLoading={installmentsLoading}
            onRowClick={onInstallmentClick}
          />
        </CardContent>
      </Card>

      {/* Recently Paid Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Recently Paid</CardTitle>
        </CardHeader>
        <CardContent>
          <InstallmentTable
            installments={recentlyPaid}
            isLoading={recentlyPaidLoading}
            onRowClick={onInstallmentClick}
          />
        </CardContent>
      </Card>
    </div>
  );
}
