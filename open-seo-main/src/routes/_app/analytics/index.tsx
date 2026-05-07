/**
 * Analytics Dashboard Route
 * Phase 96-02: Master Dashboard
 *
 * Route: /analytics
 * Renders MasterDashboard component with all sites aggregation.
 */
import { createFileRoute } from '@tanstack/react-router';
import { MasterDashboard } from '@/client/features/analytics/components/MasterDashboard';

export const Route = createFileRoute('/_app/analytics/' as never)({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  return <MasterDashboard />;
}
