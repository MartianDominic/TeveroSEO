"use client";

import { useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Globe, Search, Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Badge,
} from "@tevero/ui";
import { getDomainOverview } from "@/actions/seo/domain";

interface DomainOverview {
  domain: string;
  organicTraffic: number;
  organicKeywords: number;
  paidTraffic: number;
  paidKeywords: number;
  backlinks: number;
  referringDomains: number;
  domainRank: number;
  trafficTrend?: "up" | "down" | "stable";
  trafficChange?: number;
  topKeywords?: Array<{
    keyword: string;
    position: number;
    searchVolume: number;
    traffic: number;
  }>;
  competitors?: Array<{
    domain: string;
    commonKeywords: number;
    organicTraffic: number;
  }>;
}

export default function DomainOverviewPage() {
  const params = useParams<{ clientId: string; projectId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { clientId, projectId } = params;

  const [domain, setDomain] = useState(searchParams.get("domain") ?? "");

  const overviewQuery = useQuery({
    queryKey: ["domain-overview", projectId, clientId, domain],
    queryFn: () => getDomainOverview({ projectId, clientId, domain }),
    enabled: !!domain,
  });

  const handleAnalyze = () => {
    if (!domain.trim()) return;
    // Update URL
    const newParams = new URLSearchParams();
    newParams.set("domain", domain);
    router.replace(`?${newParams.toString()}`);
  };

  const data = overviewQuery.data as DomainOverview | undefined;

  return (
    <div className="px-4 py-4 md:px-6 md:py-6 pb-24 md:pb-8 overflow-auto">
      <div className="mx-auto max-w-5xl space-y-4">
        <h1 className="text-2xl font-semibold">Domain Overview</h1>

        {/* Search Form */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex gap-4">
              <div className="flex-1 space-y-2">
                <Label htmlFor="domain">Domain</Label>
                <Input
                  id="domain"
                  placeholder="example.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                />
              </div>
            </div>

            <Button
              onClick={handleAnalyze}
              disabled={!domain.trim() || overviewQuery.isFetching}
            >
              {overviewQuery.isFetching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Analyze Domain
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {overviewQuery.isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        )}

        {data && (
          <div className="space-y-4">
            {/* Main Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Organic Traffic
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-semibold">
                      {data.organicTraffic.toLocaleString()}
                    </p>
                    {data.trafficTrend && (
                      <span
                        className={
                          data.trafficTrend === "up"
                            ? "text-green-600"
                            : data.trafficTrend === "down"
                              ? "text-red-600"
                              : "text-muted-foreground"
                        }
                      >
                        {data.trafficTrend === "up" ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : data.trafficTrend === "down" ? (
                          <TrendingDown className="h-4 w-4" />
                        ) : (
                          <Minus className="h-4 w-4" />
                        )}
                      </span>
                    )}
                  </div>
                  {data.trafficChange !== undefined && (
                    <p
                      className={`text-xs ${
                        data.trafficChange >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {data.trafficChange >= 0 ? "+" : ""}
                      {data.trafficChange}% vs last month
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Organic Keywords
                  </p>
                  <p className="text-2xl font-semibold">
                    {data.organicKeywords.toLocaleString()}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Backlinks
                  </p>
                  <p className="text-2xl font-semibold">
                    {data.backlinks.toLocaleString()}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Domain Rank
                  </p>
                  <p className="text-2xl font-semibold">{data.domainRank}</p>
                </CardContent>
              </Card>
            </div>

            {/* Top Keywords */}
            {data.topKeywords && data.topKeywords.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Top Organic Keywords</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {data.topKeywords.slice(0, 20).map((kw) => (
                      <div
                        key={kw.keyword}
                        className="flex items-center justify-between p-2 rounded hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <Badge
                            variant={kw.position <= 3 ? "default" : "secondary"}
                            className="w-8 justify-center"
                          >
                            {kw.position}
                          </Badge>
                          <span className="font-medium">{kw.keyword}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{kw.searchVolume.toLocaleString()} vol</span>
                          <span>{kw.traffic.toLocaleString()} traffic</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Competitors */}
            {data.competitors && data.competitors.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Organic Competitors</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {data.competitors.slice(0, 10).map((comp) => (
                      <div
                        key={comp.domain}
                        className="flex items-center justify-between p-2 rounded hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{comp.domain}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{comp.commonKeywords} common keywords</span>
                          <span>
                            {comp.organicTraffic.toLocaleString()} traffic
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
