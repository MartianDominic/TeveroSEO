/**
 * Brief Detail Page
 * Phase 36: Content Brief Generation
 *
 * Shows full brief details with SERP analysis and generate button.
 */
import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  Loader2,
  ArrowLeft,
  Sparkles,
  Check,
  ExternalLink,
  FileText,
} from "lucide-react";
import { Button } from "@/client/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import { Badge } from "@/client/components/ui/badge";
import {
  getBriefFn,
  generateContentFn,
  getGenerationStatusFn,
  type Brief,
} from "@/serverFunctions/briefs";

export const Route = createFileRoute("/_app/clients/$clientId/briefs/$briefId")({
  component: BriefDetailPage,
});

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "secondary",
  ready: "default",
  generating: "outline",
  published: "default",
};

const VOICE_MODE_LABELS: Record<string, string> = {
  preservation: "Voice Preservation",
  application: "Brand Application",
  best_practices: "SEO Best Practices",
};

function BriefDetailPage() {
  const { clientId, briefId } = useParams({
    // @ts-ignore - Route not yet in generated route tree
    from: "/_app/clients/$clientId/briefs/$briefId",
  });
  const queryClient = useQueryClient();
  const [isPolling, setIsPolling] = useState(false);

  const {
    data: brief,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["brief", briefId],
    queryFn: () => getBriefFn({ data: { briefId } }),
  });

  const generateMutation = useMutation({
    mutationFn: () => generateContentFn({ data: { briefId, clientId } }),
    onSuccess: () => {
      setIsPolling(true);
      queryClient.invalidateQueries({ queryKey: ["brief", briefId] });
    },
  });

  useEffect(() => {
    if (!isPolling || !brief || brief.status !== "generating") {
      setIsPolling(false);
      return;
    }

    const interval = setInterval(async () => {
      try {
        const status = await getGenerationStatusFn({ data: { briefId } });
        if (status.articleStatus === "generated" || status.articleStatus === "published") {
          setIsPolling(false);
          queryClient.invalidateQueries({ queryKey: ["brief", briefId] });
        } else if (status.articleStatus === "failed") {
          setIsPolling(false);
        }
      } catch {
        // Ignore polling errors
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isPolling, brief, briefId, queryClient]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (error || !brief) {
    return (
      <div className="container mx-auto py-8 max-w-4xl">
        <p className="text-destructive">
          Brief not found or failed to load.
        </p>
        <Button variant="outline" className="mt-4" asChild>
          <Link
            // @ts-ignore - Route not yet in generated route tree
            to="/clients/$clientId/briefs"
            // @ts-ignore - Route not yet in generated route tree
            params={{ clientId }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Briefs
          </Link>
        </Button>
      </div>
    );
  }

  const analysis = brief.serpAnalysis;
  const avgWordCount = analysis?.competitorWordCounts.length
    ? Math.round(
        analysis.competitorWordCounts.reduce((a: number, b: number) => a + b, 0) /
          analysis.competitorWordCounts.length
      )
    : 0;

  const canGenerate = brief.status === "draft" || brief.status === "ready";
  const isGenerating = brief.status === "generating" || generateMutation.isPending;

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link
            // @ts-ignore - Route not yet in generated route tree
            to="/clients/$clientId/briefs"
            // @ts-ignore - Route not yet in generated route tree
            params={{ clientId }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Briefs
          </Link>
        </Button>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  {brief.keyword}
                </CardTitle>
                <CardDescription>
                  Created {new Date(brief.createdAt).toLocaleDateString()}
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={STATUS_VARIANTS[brief.status] || "outline"}>
                  {brief.status}
                </Badge>
                {canGenerate && (
                  <Button
                    onClick={() => generateMutation.mutate()}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate Content
                      </>
                    )}
                  </Button>
                )}
                {brief.status === "published" && brief.articleId && (
                  <Button variant="outline" asChild>
                    <a href={`/clients/${clientId}/articles/${brief.articleId}`}>
                      <Check className="w-4 h-4 mr-2" />
                      View Article
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Target Word Count</p>
                <p className="text-2xl font-bold">{brief.targetWordCount.toLocaleString()}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Voice Mode</p>
                <p className="text-lg font-semibold">
                  {VOICE_MODE_LABELS[brief.voiceMode] ?? brief.voiceMode}
                </p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Competitor Avg</p>
                <p className="text-2xl font-bold">{avgWordCount.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">words</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {analysis && (
          <>
            {analysis.commonH2s.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Suggested H2 Headings</CardTitle>
                  <CardDescription>
                    Common headings from top-ranking competitors
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {analysis.commonH2s.map((h2: { heading: string; frequency: number }, i: number) => (
                      <li key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                        <span>{h2.heading}</span>
                        <Badge variant="outline">{h2.frequency} competitors</Badge>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {analysis.paaQuestions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">People Also Ask</CardTitle>
                  <CardDescription>
                    Questions to answer in your content
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {analysis.paaQuestions.map((q: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 py-2 border-b last:border-0">
                        <span className="text-primary">Q:</span>
                        <span className="text-muted-foreground">{q}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Meta Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Title Length</p>
                    <p className="text-lg font-medium">{analysis.metaLengths.title} characters</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Description Length</p>
                    <p className="text-lg font-medium">{analysis.metaLengths.description} characters</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Analyzed: {new Date(analysis.analyzedAt).toLocaleDateString()} • {analysis.location}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
