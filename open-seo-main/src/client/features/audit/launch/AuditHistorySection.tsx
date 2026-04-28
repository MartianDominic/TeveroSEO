import { MoreHorizontal, ScanSearch, Trash2 } from "lucide-react";
import type { getAuditHistory } from "@/serverFunctions/audit";
import { formatDate, StatusBadge } from "@/client/features/audit/shared";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent, CardTitle } from "@/client/components/ui/card";

export function AuditHistorySection({
  history,
  isLoading,
  onView,
  onDelete,
}: {
  history: Awaited<ReturnType<typeof getAuditHistory>>;
  isLoading: boolean;
  onView: (auditId: string) => void;
  onDelete: (auditId: string) => void;
}) {
  if (history.length === 0 && !isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center text-foreground/40 space-y-3">
          <ScanSearch className="size-12 mx-auto opacity-30" />
          <p className="text-lg font-medium">No audits yet</p>
        </div>
      </div>
    );
  }

  if (history.length === 0) return null;

  return (
    <Card>
      <CardContent className="gap-3">
        <CardTitle className="text-base">Previous Audits</CardTitle>
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Date</th>
                <th>URL</th>
                <th>Status</th>
                <th>Pages</th>
                <th>Lighthouse</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {history.map((audit) => (
                <tr key={audit.id} className="hover group">
                  <td className="text-xs text-foreground/70">
                    {formatDate(audit.startedAt)}
                  </td>
                  <td className="max-w-[220px] truncate">{audit.startUrl}</td>
                  <td>
                    <StatusBadge status={audit.status} />
                  </td>
                  <td>{audit.pagesTotal || audit.pagesCrawled}</td>
                  <td>
                    {audit.ranLighthouse ? (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0">Yes</Badge>
                    ) : null}
                  </td>
                  <td>
                    <HistoryActions
                      auditId={audit.id}
                      onView={onView}
                      onDelete={onDelete}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function HistoryActions({
  auditId,
  onView,
  onDelete,
}: {
  auditId: string;
  onView: (auditId: string) => void;
  onDelete: (auditId: string) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-2 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
      <Button
        size="sm"
        onClick={() => onView(auditId)}
      >
        View
      </Button>
      <div className="dropdown dropdown-end">
        <div
          tabIndex={0}
          role="button"
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring hover:bg-accent hover:text-accent-foreground h-8 w-8"
          aria-label="Audit actions"
        >
          <MoreHorizontal className="size-3.5" />
        </div>
        <ul
          tabIndex={0}
          className="dropdown-content z-10 menu p-2 shadow-lg bg-background border border-border rounded-lg w-40"
        >
          <li>
            <button
              className="text-destructive"
              onClick={(event) => {
                event.stopPropagation();
                onDelete(auditId);
              }}
            >
              <Trash2 className="size-3.5" />
              Delete audit
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}
