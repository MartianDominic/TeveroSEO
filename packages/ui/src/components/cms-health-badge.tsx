"use client";

import * as React from "react";
import { StatusChip } from "./status-chip";

interface CmsHealthBadgeProps {
  lastPublishedAt: string | null;
}

export const CmsHealthBadge: React.FC<CmsHealthBadgeProps> = ({
  lastPublishedAt,
}) => {
  if (!lastPublishedAt) {
    return <StatusChip status="error" label="No recent publishes" />;
  }

  const daysSince =
    (Date.now() - new Date(lastPublishedAt).getTime()) / 86_400_000;

  if (daysSince <= 7) {
    return <StatusChip status="connected" label="Healthy" />;
  }

  if (daysSince <= 30) {
    return <StatusChip status="warning" label="Stale" />;
  }

  return <StatusChip status="error" label="No recent publishes" />;
};
