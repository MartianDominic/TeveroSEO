/**
 * Client Analytics Route
 * Phase 96-05: Client Portal
 *
 * Client-facing analytics dashboard with visibility controls.
 * Can also be accessed via public token for white-label portal.
 */
import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import {
  ClientPortalDashboard,
  ClientPortalDashboardSkeleton,
} from '@/client/features/analytics/components/ClientPortalDashboard';
import { useClientVisibility } from '@/client/features/analytics/hooks/useClientVisibility';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)('/_app/clients/$clientId/analytics')({
  component: ClientAnalyticsPage,
});

function ClientAnalyticsPage() {
  const { clientId } = Route.useParams();
  // In a real app, get workspaceId from auth context
  const workspaceId = 'current-workspace'; // TODO: Get from auth

  const { visibilityConfig, isLoading: visibilityLoading } = useClientVisibility(
    clientId,
    workspaceId
  );

  const [metrics, setMetrics] = useState<any>(null);
  const [brandedData, setBrandedData] = useState<any>(null);
  const [ctrBenchmarkData, setCtrBenchmarkData] = useState<any[]>([]);
  const [clientInfo, setClientInfo] = useState<{ name: string; logo?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!clientId || !workspaceId) return;

      setIsLoading(true);
      const headers = { 'X-Workspace-ID': workspaceId };

      try {
        // Fetch all data in parallel
        const [brandedRes, ctrRes] = await Promise.all([
          fetch(`/api/analytics/branded-split/${clientId}`, { headers }),
          fetch(`/api/analytics/ctr-benchmark/${clientId}`, { headers }),
        ]);

        if (brandedRes.ok) {
          const branded = await brandedRes.json() as { success: boolean; data?: any };
          if (branded.success) {
            setBrandedData(branded.data);
          }
        }

        if (ctrRes.ok) {
          const ctr = await ctrRes.json() as { success: boolean; data?: { pages?: any[]; curve?: any[] } };
          if (ctr.success && ctr.data) {
            // Transform pages to CTR benchmark format
            const benchmarkData = (ctr.data.pages || []).map((page: any) => ({
              position: page.position || 1,
              benchmarkCtr: page.comparison?.benchmarkCtr || 0,
              actualCtr: page.ctr || 0,
              status: page.comparison?.status || 'at',
            }));

            // Also include the curve data
            const curveData = (ctr.data.curve || []).map((point: any) => ({
              position: point.position,
              benchmarkCtr: point.ctr,
            }));

            // Merge: use curve as base, overlay actual data
            const mergedData = curveData.map((point: any) => {
              const actual = benchmarkData.find((b: any) => b.position === point.position);
              return {
                ...point,
                actualCtr: actual?.actualCtr,
                status: actual?.status,
              };
            });

            setCtrBenchmarkData(mergedData);
          }
        }

        // Mock client info and metrics for now
        // In production, fetch from client API
        setClientInfo({ name: 'Client Analytics' });
        setMetrics({
          clicks: 12500,
          clicksChange: 15.2,
          impressions: 450000,
          impressionsChange: 8.5,
          position: 4.2,
          positionChange: -0.8,
          ctr: 0.028,
          ctrChange: 5.1,
          trend: generateMockTrend(),
        });
      } catch (error) {
        console.error('Failed to fetch analytics data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [clientId, workspaceId]);

  const handleExport = async (type: 'csv' | 'sheets') => {
    const endpoint = type === 'csv' ? '/api/analytics/export/csv' : '/api/analytics/export/sheets';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Workspace-ID': workspaceId,
        },
        body: JSON.stringify({
          clientId,
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
          type: 'queries',
        }),
      });

      if (type === 'csv' && response.ok) {
        // Download CSV
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-${clientId}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (type === 'sheets' && response.ok) {
        const result = await response.json() as { data?: { spreadsheetUrl?: string } };
        if (result.data?.spreadsheetUrl) {
          window.open(result.data.spreadsheetUrl, '_blank');
        }
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  if (visibilityLoading || isLoading) {
    return (
      <div className="p-6">
        <ClientPortalDashboardSkeleton />
      </div>
    );
  }

  return (
    <div className="p-6">
      <ClientPortalDashboard
        clientId={clientId}
        clientName={clientInfo?.name || 'Analytics'}
        clientLogo={clientInfo?.logo}
        workspaceId={workspaceId}
        visibilityConfig={visibilityConfig}
        metrics={metrics}
        brandedData={brandedData}
        ctrBenchmarkData={ctrBenchmarkData}
        onExport={handleExport}
        isLoading={false}
      />
    </div>
  );
}

// Generate mock trend data for development
function generateMockTrend() {
  const data = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toISOString().split('T')[0],
      clicks: Math.floor(300 + Math.random() * 200 + i * 5),
    });
  }
  return data;
}
