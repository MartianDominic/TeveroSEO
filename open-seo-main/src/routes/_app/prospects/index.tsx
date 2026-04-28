/**
 * Prospects list page route
 * Phase 28: Keyword Gap Analysis UI
 * Phase 30.5: CSV Import, Bulk Actions UI
 *
 * Lists all prospects for the current workspace with bulk actions and pipeline chart.
 */
import { useState, useCallback, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Upload } from "lucide-react";
import { listProspects, getStageDistribution, getRemainingQuota } from "@/serverFunctions/prospects";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";
import {
  CsvImportDialog,
  ProspectsTable,
  BulkActionBar,
  PipelineStageChart,
} from "@/client/components/prospects";
import type { ProspectSelect } from "@/db/prospect-schema";

export const Route = createFileRoute("/_app/prospects/")({
  component: ProspectsListPage,
});

function ProspectsListPage() {
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const queryClient = useQueryClient();

  // Fetch prospects list
  const { data, isLoading, error } = useQuery({
    queryKey: ["prospects", "list"],
    queryFn: () => listProspects({ data: { page: 1, pageSize: 500 } }),
  });

  // Fetch pipeline stage distribution
  const { data: distributionData } = useQuery({
    queryKey: ["prospects", "distribution"],
    queryFn: () => getStageDistribution({ data: {} }),
  });

  // Fetch remaining analysis quota
  const { data: quotaData } = useQuery({
    queryKey: ["prospects", "quota"],
    queryFn: () => getRemainingQuota(),
  });

  const prospects = data?.data ?? [];
  const distribution = distributionData ?? [];
  const remainingQuota = quotaData?.remaining ?? 0;

  // Get selected prospects for BulkActionBar
  const selectedProspects = useMemo(() => {
    return prospects.filter((p) => selectedIds.includes(p.id));
  }, [prospects, selectedIds]);

  // Handle selection changes from ProspectsTable
  const handleSelectionChange = useCallback((ids: string[]) => {
    setSelectedIds(ids);
  }, []);

  // Clear selection
  const handleClearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  // Refresh data after bulk action completes
  const handleActionComplete = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["prospects"] });
    setSelectedIds([]);
  }, [queryClient]);

  // Navigate to prospect detail on row click
  const handleProspectClick = useCallback(
    (prospect: ProspectSelect) => {
      window.location.href = `/prospects/${prospect.id}`;
    },
    []
  );

  // Handle CSV import completion
  const handleImportComplete = useCallback(
    (_result: { created: number; skipped: number }) => {
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
    },
    [queryClient]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-destructive">Failed to load prospects</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Prospects</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setImportDialogOpen(true)}
          >
            <Upload className="h-4 w-4" />
            Import CSV
          </Button>
          <Button disabled className="gap-2">
            <Plus className="h-4 w-4" />
            Add Prospect
          </Button>
        </div>
      </div>

      <CsvImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportComplete={handleImportComplete}
      />

      {/* Pipeline Distribution Chart */}
      {prospects.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Pipeline Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <PipelineStageChart data={distribution} height={250} />
          </CardContent>
        </Card>
      )}

      {/* Prospects Table or Empty State */}
      {prospects.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No prospects yet.</p>
          <p className="text-sm mt-2">
            Add your first prospect to start analyzing keyword opportunities.
          </p>
        </div>
      ) : (
        <ProspectsTable
          prospects={prospects}
          onSelectionChange={handleSelectionChange}
          onProspectClick={handleProspectClick}
        />
      )}

      {/* Bulk Action Bar (shows when rows selected) */}
      <BulkActionBar
        selectedProspects={selectedProspects}
        remainingQuota={remainingQuota}
        onClear={handleClearSelection}
        onActionComplete={handleActionComplete}
      />
    </div>
  );
}

