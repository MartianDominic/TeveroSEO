/**
 * Changes Page
 * Phase 33: Auto-Fix System
 *
 * Displays all site changes with filtering and revert capabilities.
 */
import { Suspense } from 'react';
import { PageHeader } from '~/components/PageHeader';
import { getChanges, type ChangeFilters } from '~/actions/changes';
import { ChangeFilters as ChangeFiltersComponent } from './components/ChangeFilters';
import { ChangeList } from './components/ChangeList';

interface ChangesPageProps {
  params: { clientId: string };
  searchParams: ChangeFilters;
}

export default async function ChangesPage({ params, searchParams }: ChangesPageProps) {
  const { clientId } = params;

  // Fetch changes with filters
  const changesResult = await getChanges(clientId, searchParams);

  // Get connection ID - for now, we'll use a placeholder
  // In production, this would come from getClientConnection
  const connectionId = 'connection-placeholder';

  const changes = changesResult.success ? changesResult.data ?? [] : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Changes"
        description="View and manage SEO changes applied to your site"
      />

      <Suspense fallback={<div>Loading filters...</div>}>
        <ChangeFiltersComponent clientId={clientId} />
      </Suspense>

      {changesResult.success ? (
        <ChangeList changes={changes} connectionId={connectionId} />
      ) : (
        <div className="text-center py-12 text-red-500">
          Error loading changes: {changesResult.error}
        </div>
      )}
    </div>
  );
}
