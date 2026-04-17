"use client";

import { useParams } from "next/navigation";

export default function AnalyticsPage() {
  const { clientId } = useParams<{ clientId: string }>();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-2">Analytics</h1>
      <p className="text-muted-foreground text-sm">
        Client: {clientId} — Full analytics dashboard arrives in Phase 14.
      </p>
    </div>
  );
}
