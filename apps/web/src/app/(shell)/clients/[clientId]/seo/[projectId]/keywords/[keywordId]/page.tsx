"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, ExternalLink } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
} from "@tevero/ui";
import { RankHistoryChart } from "@/components/keywords/RankHistoryChart";
import { PositionBadge } from "@/components/keywords/PositionBadge";
import {
  getKeywordHistory,
  getKeywordLatestRanking,
} from "@/actions/seo/keywords";

export default function KeywordDetailPage() {
  const params = useParams<{
    clientId: string;
    projectId: string;
    keywordId: string;
  }>();
  const router = useRouter();
  const { clientId, projectId, keywordId } = params;

  // Fetch 30-day history
  const history30Query = useQuery({
    queryKey: ["keyword-history", keywordId, 30],
    queryFn: () => getKeywordHistory({ keywordId, clientId, days: 30 }),
  });

  // Fetch 90-day history
  const history90Query = useQuery({
    queryKey: ["keyword-history", keywordId, 90],
    queryFn: () => getKeywordHistory({ keywordId, clientId, days: 90 }),
  });

  // Fetch latest ranking
  const latestQuery = useQuery({
    queryKey: ["keyword-latest", keywordId],
    queryFn: () => getKeywordLatestRanking({ keywordId, clientId }),
  });

  const isLoading =
    history30Query.isLoading ||
    history90Query.isLoading ||
    latestQuery.isLoading;

  const data30 = history30Query.data?.rows ?? [];
  const data90 = history90Query.data?.rows ?? [];
  const latest = latestQuery.data;

  return (
    <div className="px-4 py-4 md:px-6 md:py-6 pb-24 md:pb-8 overflow-auto">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              router.push(
                `/clients/${clientId}/seo/${projectId}/keywords` as Parameters<
                  typeof router.push
                >[0],
              )
            }
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <>
            {/* Current Position Card */}
            <Card>
              <CardHeader>
                <CardTitle>Current Position</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <PositionBadge
                    position={latest?.position ?? null}
                    change={latest?.change ?? null}
                    className="text-2xl py-2 px-4"
                  />
                  {latest?.url && (
                    <a
                      href={latest.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      {(() => {
                        try {
                          return new URL(latest.url).hostname;
                        } catch {
                          return latest.url;
                        }
                      })()}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>

                {/* SERP Features */}
                {latest?.serpFeatures && latest.serpFeatures.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground mb-2">
                      SERP Features Present
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {latest.serpFeatures.map((feature) => (
                        <Badge key={feature} variant="secondary">
                          {feature.replace(/_/g, " ")}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Position History Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Position History</CardTitle>
              </CardHeader>
              <CardContent>
                <RankHistoryChart data30={data30} data90={data90} />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
