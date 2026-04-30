"use client";

/**
 * Revenue view toggle component.
 * Phase 51-01: MRR & Retention Dashboard
 *
 * D-17: Toggle between recognized revenue and cash received views.
 */

import { useState } from "react";
import { Button } from "@tevero/ui";

type RevenueView = "recognized" | "cash";

/**
 * Toggle for D-17 prepaid revenue display modes.
 * - Recognized: Spreads prepaid revenue over term (e.g., 2500/6mo = 417/mo)
 * - Cash Received: Shows full amount when paid (e.g., 2500 when paid)
 */
export function RevenueViewToggle() {
  const [view, setView] = useState<RevenueView>("recognized");

  return (
    <div className="flex items-center gap-1 bg-surface-2 rounded-lg p-1">
      <Button
        size="sm"
        variant={view === "recognized" ? "default" : "ghost"}
        onClick={() => setView("recognized")}
        className="h-8 px-3 text-sm"
      >
        Recognized
      </Button>
      <Button
        size="sm"
        variant={view === "cash" ? "default" : "ghost"}
        onClick={() => setView("cash")}
        className="h-8 px-3 text-sm"
      >
        Cash Received
      </Button>
    </div>
  );
}

RevenueViewToggle.displayName = "RevenueViewToggle";
