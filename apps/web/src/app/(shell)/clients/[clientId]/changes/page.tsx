/**
 * Changes Page
 * Phase 33: Auto-Fix System
 *
 * Displays all site changes with filtering and revert capabilities.
 */
import { Suspense } from 'react';

import { getChanges, type ChangeFilters } from '@/actions/changes';
import { getOpenSeo } from '@/lib/server-fetch';

import { PageHeader } from '@tevero/ui';

import { ChangeFilters as ChangeFiltersComponent } from './components/ChangeFilters';
import { ChangeList } from './components/ChangeList';

interface SiteConnection {
  id: string;
  status: 'pending' | 'active' | 'error' | 'disconnected';
}

interface ChangesPageProps {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<ChangeFilters>;
}

export default async function ChangesPage({ params, searchParams: searchParamsPromise }: ChangesPageProps) {
  const { clientId } = await params;
  const searchParams = await searchParamsPromise;

  // Fetch changes with filters
  const changesResult = await getChanges(clientId, searchParams);

  // Fetch site connections to get active connection for revert
  let connectionId: string | null = null;
  try {
    const connections = await getOpenSeo<SiteConnection[]>(
      `/api/connections?clientId=${clientId}`
    );
    const activeConnection = connections.find((c) => c.status === 'active');
    connectionId = activeConnection?.id ?? null;
  } catch {
    // Silent fail - revert will be disabled
  }

  const changes = changesResult.success ? changesResult.data ?? [] : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Changes"
        subtitle="View and manage SEO changes applied to your site"
      />

      {!connectionId && changes.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            No active site connection. Revert functionality is disabled.
            <a
              href={`/clients/${clientId}/connections`}
              className="ml-1 underline hover:text-yellow-900"
            >
              Connect a site
            </a>
          </p>
        </div>
      )}

      <Suspense fallback={<div>Loading filters...</div>}>
        <ChangeFiltersComponent clientId={clientId} />
      </Suspense>

      {changesResult.success ? (
        <ChangeList changes={changes} connectionId={connectionId} clientId={clientId} />
      ) : (
        <div className="text-center py-12 text-red-500">
          Error loading changes: {changesResult.error}
        </div>
      )}
    </div>
  );
}
