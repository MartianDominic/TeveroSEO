/**
 * Proposals list page route
 * Phase 30: Interactive Proposals - Builder UI
 *
 * Lists all proposals for the current workspace with status and actions.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus, Eye, Edit, Send, ExternalLink } from "lucide-react";
import { listProposals } from "@/serverFunctions/proposals";
import { Button } from "@/client/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/client/components/ui/table";
import { Badge } from "@/client/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/client/components/ui/dropdown-menu";

export const Route = createFileRoute("/_app/proposals/")({
  component: ProposalsListPage,
});

function ProposalsListPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["proposals", "list"],
    queryFn: () => listProposals({ data: { page: 1, pageSize: 50 } }),
  });

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
        <p className="text-destructive">Failed to load proposals</p>
      </div>
    );
  }

  const proposals = data?.data ?? [];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Proposals</h1>
          <p className="text-sm text-muted-foreground">
            Manage and track your SEO proposals
          </p>
        </div>
        <a href="/prospects">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Create from Prospect
          </Button>
        </a>
      </div>

      {proposals.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No proposals yet.</p>
          <p className="text-sm mt-2">
            Create your first proposal from a prospect to start converting leads.
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prospect</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proposals.map((proposal) => (
                <TableRow key={proposal.id}>
                  <TableCell className="font-medium">
                    {proposal.prospectId ? (
                      <a
                        href={`/prospects/${proposal.prospectId}`}
                        className="hover:underline"
                      >
                        View Prospect
                      </a>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="capitalize">
                    {proposal.template ?? "standard"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={proposal.status} />
                  </TableCell>
                  <TableCell>
                    {proposal.currency}{" "}
                    {((proposal.setupFeeCents ?? 0) / 100).toLocaleString()} +{" "}
                    {((proposal.monthlyFeeCents ?? 0) / 100).toLocaleString()}/mo
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(proposal.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          Actions
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <a href={`/proposals/${proposal.id}/edit`}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <a
                            href={`/p/${proposal.token}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Preview
                          </a>
                        </DropdownMenuItem>
                        {proposal.status === "draft" && (
                          <DropdownMenuItem>
                            <Send className="h-4 w-4 mr-2" />
                            Send
                          </DropdownMenuItem>
                        )}
                        {proposal.status !== "draft" && (
                          <DropdownMenuItem asChild>
                            <a
                              href={`/p/${proposal.token}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Copy Link
                            </a>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<
    string,
    "default" | "secondary" | "destructive" | "outline"
  > = {
    draft: "secondary",
    sent: "outline",
    viewed: "outline",
    accepted: "default",
    signed: "default",
    paid: "default",
    onboarded: "default",
    expired: "destructive",
    declined: "destructive",
  };

  const labels: Record<string, string> = {
    draft: "Draft",
    sent: "Sent",
    viewed: "Viewed",
    accepted: "Accepted",
    signed: "Signed",
    paid: "Paid",
    onboarded: "Onboarded",
    expired: "Expired",
    declined: "Declined",
  };

  return (
    <Badge variant={variants[status] ?? "secondary"}>
      {labels[status] ?? status}
    </Badge>
  );
}
