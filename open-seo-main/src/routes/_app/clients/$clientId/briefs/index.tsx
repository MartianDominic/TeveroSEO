/**
 * Content Briefs List Page
 * Phase 36: Content Brief Generation
 *
 * Lists all content briefs for a project with status badges.
 * Provides create/view/delete actions.
 */
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, FileText, Eye } from "lucide-react";
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
import { Badge } from "@/client/components/ui/badge";
import { getBriefsFn, deleteBriefFn, type Brief } from "@/serverFunctions/briefs";

export const Route = createFileRoute("/_app/clients/$clientId/briefs/")({
  component: BriefsListPage,
});

const STATUS_VARIANTS: Record<Brief["status"], "default" | "secondary" | "outline" | "destructive"> = {
  draft: "secondary",
  ready: "default",
  generating: "outline",
  published: "default",
};

const STATUS_LABELS: Record<Brief["status"], string> = {
  draft: "Draft",
  ready: "Ready",
  generating: "Generating...",
  published: "Published",
};

const VOICE_MODE_LABELS: Record<Brief["voiceMode"], string> = {
  preservation: "Voice Preservation",
  application: "Brand Application",
  best_practices: "SEO Best Practices",
};

function BriefsListPage() {
  const { clientId } = useParams({
    from: "/_app/clients/$clientId/briefs/",
  });
  const queryClient = useQueryClient();

  const {
    data: briefs,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["briefs", clientId],
    queryFn: () => getBriefsFn({ data: { projectId: clientId } }),
  });

  const deleteMutation = useMutation({
    mutationFn: (briefId: string) => deleteBriefFn({ data: { briefId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["briefs", clientId] });
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
          Failed to load briefs: {(error as Error).message}
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-5xl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Content Briefs
              </CardTitle>
              <CardDescription>
                Create and manage content briefs for SEO-optimized articles
              </CardDescription>
            </div>
            <Button asChild>
              <Link
                                to="/clients/$clientId/briefs/new"
                                params={{ clientId }}
              >
                <Plus className="w-4 h-4 mr-2" />
                New Brief
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!briefs || briefs.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                No content briefs yet. Create one to start generating optimized content.
              </p>
              <Button asChild variant="outline">
                <Link
                                    to="/clients/$clientId/briefs/new"
                                    params={{ clientId }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Brief
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Keyword</TableHead>
                  <TableHead>Word Count</TableHead>
                  <TableHead>Voice Mode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {briefs.map((brief) => (
                  <TableRow key={brief.id}>
                    <TableCell>
                      <span className="font-medium">{brief.keyword}</span>
                    </TableCell>
                    <TableCell>{brief.targetWordCount.toLocaleString()} words</TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {VOICE_MODE_LABELS[brief.voiceMode]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[brief.status]}>
                        {STATUS_LABELS[brief.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <Link
                                                        to="/clients/$clientId/briefs/$briefId"
                                                        params={{ clientId, briefId: brief.id }}
                          >
                            <Eye className="w-4 h-4" />
                            <span className="ml-1">View</span>
                          </Link>
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
                              <AlertDialogTitle>Delete Brief?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete the content brief for
                                &quot;{brief.keyword}&quot;. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(brief.id)}
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
