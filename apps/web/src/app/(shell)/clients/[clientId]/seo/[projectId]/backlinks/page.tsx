"use client";

import { useState } from "react";

import { useParams, useSearchParams, useRouter } from "next/navigation";

import { useQuery } from "@tanstack/react-query";
import { Link2, Globe, FileText, Loader2, ExternalLink } from "lucide-react";

import {
  getBacklinksOverview,
  getBacklinksReferringDomains,
  getBacklinksTopPages,
} from "@/actions/seo/backlinks";
import { extractHostname } from "@/lib/seo/shared";
import {
  BacklinksOverviewSchema,
  ReferringDomainArraySchema,
  TopPageArraySchema,
  type BacklinksOverview,
  type ReferringDomain,
  type TopPage,
} from "@/lib/validations/api-response-schemas";

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@tevero/ui";

export default function BacklinksPage() {
  const params = useParams<{ clientId: string; projectId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { clientId, projectId } = params;

  const [target, setTarget] = useState(searchParams.get("target") ?? "");
  const [scope, setScope] = useState(searchParams.get("scope") ?? "domain");
  const [activeTab, setActiveTab] = useState(
    searchParams.get("tab") ?? "overview"
  );

  const overviewQuery = useQuery({
    queryKey: ["backlinks-overview", projectId, clientId, target, scope],
    queryFn: () =>
      getBacklinksOverview({ projectId, clientId, target, scope }),
    enabled: !!target,
  });

  const domainsQuery = useQuery({
    queryKey: [
      "backlinks-referring-domains",
      projectId,
      clientId,
      target,
      scope,
    ],
    queryFn: () =>
      getBacklinksReferringDomains({ projectId, clientId, target, scope }),
    enabled: !!target && activeTab === "domains",
  });

  const pagesQuery = useQuery({
    queryKey: ["backlinks-top-pages", projectId, clientId, target, scope],
    queryFn: () => getBacklinksTopPages({ projectId, clientId, target, scope }),
    enabled: !!target && activeTab === "pages",
  });

  const handleAnalyze = () => {
    if (!target.trim()) return;
    // Update URL
    const newParams = new URLSearchParams();
    newParams.set("target", target);
    newParams.set("scope", scope);
    newParams.set("tab", activeTab);
    router.replace(`?${newParams.toString()}`);
    // Queries will auto-run due to enabled condition
  };

  // Validate API responses with Zod schemas instead of unsafe type assertions
  const overviewRaw = overviewQuery.data?.success ? overviewQuery.data.data : undefined;
  const overviewParsed = overviewRaw ? BacklinksOverviewSchema.safeParse(overviewRaw) : null;
  const overview: BacklinksOverview | undefined = overviewParsed?.success ? overviewParsed.data : undefined;

  const domainsRaw = domainsQuery.data?.success ? domainsQuery.data.data : [];
  const domainsParsed = ReferringDomainArraySchema.safeParse(domainsRaw);
  const domains: ReferringDomain[] = domainsParsed.success ? domainsParsed.data : [];

  const pagesRaw = pagesQuery.data?.success ? pagesQuery.data.data : [];
  const pagesParsed = TopPageArraySchema.safeParse(pagesRaw);
  const pages: TopPage[] = pagesParsed.success ? pagesParsed.data : [];

  return (
    <div className="px-4 py-4 md:px-6 md:py-6 pb-24 md:pb-8 overflow-auto">
      <div className="mx-auto max-w-5xl space-y-4">
        <h1 className="text-2xl font-semibold">Backlink Analysis</h1>

        {/* Search Form */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex gap-4">
              <div className="flex-1 space-y-2">
                <Label htmlFor="target">Target URL or Domain</Label>
                <Input
                  id="target"
                  placeholder="example.com or https://example.com/page"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                />
              </div>

              <div className="w-40 space-y-2">
                <Label htmlFor="scope">Scope</Label>
                <Select value={scope} onValueChange={setScope}>
                  <SelectTrigger id="scope">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="domain">Entire Domain</SelectItem>
                    <SelectItem value="url">Exact URL</SelectItem>
                    <SelectItem value="prefix">URL Prefix</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={handleAnalyze}
              disabled={!target.trim() || overviewQuery.isFetching}
            >
              {overviewQuery.isFetching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="mr-2 h-4 w-4" />
              )}
              Analyze Backlinks
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {target && (
          <Tabs
            value={activeTab}
            onValueChange={(tab) => {
              setActiveTab(tab);
              const newParams = new URLSearchParams(searchParams.toString());
              newParams.set("tab", tab);
              router.replace(`?${newParams.toString()}`);
            }}
          >
            <TabsList>
              <TabsTrigger value="overview">
                <Link2 className="mr-2 h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="domains">
                <Globe className="mr-2 h-4 w-4" />
                Referring Domains
              </TabsTrigger>
              <TabsTrigger value="pages">
                <FileText className="mr-2 h-4 w-4" />
                Top Pages
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              {overviewQuery.isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : overview ? (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs-safe uppercase tracking-wide text-muted-foreground">
                        Total Backlinks
                      </p>
                      <p className="text-2xl font-semibold">
                        {overview.totalBacklinks.toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs-safe uppercase tracking-wide text-muted-foreground">
                        Referring Domains
                      </p>
                      <p className="text-2xl font-semibold">
                        {overview.referringDomains.toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs-safe uppercase tracking-wide text-muted-foreground">
                        Domain Rank
                      </p>
                      <p className="text-2xl font-semibold">
                        {overview.domainRank}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs-safe uppercase tracking-wide text-muted-foreground">
                        Trust Rank
                      </p>
                      <p className="text-2xl font-semibold">
                        {overview.trustRank}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs-safe uppercase tracking-wide text-muted-foreground">
                        Spam Score
                      </p>
                      <p
                        className={`text-2xl font-semibold ${
                          overview.spamScore > 30
                            ? "text-red-600"
                            : overview.spamScore > 10
                              ? "text-yellow-600"
                              : "text-green-600"
                        }`}
                      >
                        {overview.spamScore}%
                      </p>
                    </CardContent>
                  </Card>
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="domains">
              <Card>
                <CardHeader>
                  <CardTitle>Referring Domains ({domains.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {domainsQuery.isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : domains.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">
                      No referring domains found.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {domains.slice(0, 100).map((domain) => (
                        <div
                          key={domain.domain}
                          className="flex items-center justify-between p-2 rounded hover:bg-muted/50"
                        >
                          <div className="flex items-center gap-2">
                            <ExternalLink className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{domain.domain}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{domain.backlinks} links</span>
                            <Badge variant="outline">DR {domain.domainRank}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pages">
              <Card>
                <CardHeader>
                  <CardTitle>Top Pages by Backlinks ({pages.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {pagesQuery.isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : pages.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">
                      No pages found.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {pages.slice(0, 100).map((page) => (
                        <div
                          key={page.url}
                          className="flex items-center justify-between p-2 rounded hover:bg-muted/50"
                        >
                          <span
                            className="truncate flex-1 mr-4"
                            title={page.url}
                          >
                            {page.url}
                          </span>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground shrink-0">
                            <span>{page.backlinks} links</span>
                            <span>{page.referringDomains} domains</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
