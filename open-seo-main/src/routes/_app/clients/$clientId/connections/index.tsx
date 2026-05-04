/**
 * Connections List Page
 * Phase 31-04: Connection Wizard UI
 *
 * Lists all site connections for a client with status badges.
 * Provides add/test/delete actions per connection.
 */
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, RefreshCw, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/client/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/client/components/ui/alert-dialog";
import { ConnectionStatus } from "@/client/components/connections";
import {
  getConnectionsFn,
  verifyConnectionFn,
  deleteConnectionFn,
} from "@/serverFunctions/connections";
import type { ConnectionWithoutCredentials } from "@/server/features/connections";

export const Route = createFileRoute("/_app/clients/$clientId/connections/")({
  component: ConnectionsListPage,
});

const PLATFORM_LABELS: Record<string, string> = {
  wordpress: "WordPress",
  shopify: "Shopify",
  wix: "Wix",
  squarespace: "Squarespace",
  webflow: "Webflow",
  custom: "Custom",
  pixel: "Pixel",
};

function ConnectionsListPage() {
  const { clientId } = useParams({
        from: "/_app/clients/$clientId/connections/",
  });
  const queryClient = useQueryClient();

  // Fetch connections
  const {
    data: connections,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["connections", clientId],
    queryFn: () => getConnectionsFn({ data: { clientId } }),
  });

  // Verify connection mutation
  const verifyMutation = useMutation({
    mutationFn: (connectionId: string) =>
      verifyConnectionFn({ data: { connectionId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connections", clientId] });
    },
  });

  // Delete connection mutation
  const deleteMutation = useMutation({
    mutationFn: (connectionId: string) =>
      deleteConnectionFn({ data: { connectionId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connections", clientId] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">
          Failed to load connections: {(error as Error).message}
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Site Connections</CardTitle>
              <CardDescription>
                Manage website connections for automated SEO updates
              </CardDescription>
            </div>
            <Button asChild>
              <Link
                                to="/clients/$clientId/connections/new"
                                params={{ clientId }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Connection
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!connections || connections.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                No connections yet. Add one to start automating SEO changes.
              </p>
              <Button asChild variant="outline">
                <Link
                                    to="/clients/$clientId/connections/new"
                                    params={{ clientId }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Connection
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Site</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {connections.map((conn: ConnectionWithoutCredentials) => (
                  <TableRow key={conn.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{conn.displayName}</span>
                        <a
                          href={conn.siteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1"
                        >
                          {conn.siteUrl}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </TableCell>
                    <TableCell>
                      {PLATFORM_LABELS[conn.platform] || conn.platform}
                    </TableCell>
                    <TableCell>
                      <ConnectionStatus connection={conn} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => verifyMutation.mutate(conn.id)}
                          disabled={verifyMutation.isPending}
                        >
                          {verifyMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                          <span className="ml-1">Test</span>
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Delete Connection?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                This will remove the connection to{" "}
                                {conn.displayName}. You can add it again later.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(conn.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
