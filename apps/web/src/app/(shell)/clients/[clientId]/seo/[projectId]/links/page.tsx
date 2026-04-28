"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link2, AlertTriangle, Loader2, Check, X, Zap } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@tevero/ui";

interface LinkHealthMetrics {
  totalPages: number;
  orphanPages: number;
  avgInboundLinks: number;
  deepPages: number;
}

interface LinkDistribution {
  bucket: string;
  count: number;
}

interface OpportunitySummary {
  total: number;
  byType: Record<string, number>;
}

interface LinkHealthData {
  success: boolean;
  data?: {
    metrics: LinkHealthMetrics;
    distribution: LinkDistribution[];
    opportunities: OpportunitySummary;
  };
}

interface Opportunity {
  id: string;
  pageUrl: string;
  opportunityType: string;
  urgency: number;
  reason: string;
  suggestedAnchorText: string | null;
}

interface OpportunitiesData {
  success: boolean;
  data?: Opportunity[];
  meta?: { total: number; page: number; limit: number };
}

async function getLinkHealth(clientId: string): Promise<LinkHealthData> {
  const res = await fetch(`/api/seo/links/health/${clientId}`, {
    headers: { "X-Client-ID": clientId },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch link health: ${res.status}`);
  }
  return res.json();
}

async function getOpportunities(clientId: string): Promise<OpportunitiesData> {
  const res = await fetch(`/api/seo/links/opportunities/${clientId}?status=pending&limit=20`, {
    headers: { "X-Client-ID": clientId },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch opportunities: ${res.status}`);
  }
  return res.json();
}

async function approveOpportunity(id: string, clientId: string): Promise<void> {
  const res = await fetch(`/api/seo/links/opportunities/${id}/approve`, {
    method: "POST",
    headers: { "X-Client-ID": clientId },
  });
  if (!res.ok) {
    throw new Error(`Failed to approve opportunity: ${res.status}`);
  }
}

async function rejectOpportunity(id: string, clientId: string): Promise<void> {
  const res = await fetch(`/api/seo/links/opportunities/${id}/reject`, {
    method: "POST",
    headers: { "X-Client-ID": clientId },
  });
  if (!res.ok) {
    throw new Error(`Failed to reject opportunity: ${res.status}`);
  }
}

function getStatusBadge(value: number, thresholds: { warning: number; critical: number }) {
  if (value >= thresholds.critical) {
    return <Badge variant="destructive">Critical</Badge>;
  }
  if (value >= thresholds.warning) {
    return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Warning</Badge>;
  }
  return <Badge variant="outline" className="border-green-500 text-green-600">Good</Badge>;
}

function getPriorityLabel(urgency: number): string {
  if (urgency >= 0.8) return "High";
  if (urgency >= 0.5) return "Medium";
  return "Low";
}

function getPriorityVariant(urgency: number): "destructive" | "outline" | "secondary" {
  if (urgency >= 0.8) return "destructive";
  if (urgency >= 0.5) return "outline";
  return "secondary";
}

function formatType(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function LinksPage() {
  const params = useParams<{ clientId: string; projectId: string }>();
  const { clientId } = params;
  const queryClient = useQueryClient();

  const healthQuery = useQuery({
    queryKey: ["link-health", clientId],
    queryFn: () => getLinkHealth(clientId),
    enabled: !!clientId,
  });

  const opportunitiesQuery = useQuery({
    queryKey: ["link-opportunities", clientId],
    queryFn: () => getOpportunities(clientId),
    enabled: !!clientId,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveOpportunity(id, clientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["link-opportunities", clientId] });
    },
    onError: (error) => {
      console.error("Failed to approve opportunity:", error);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectOpportunity(id, clientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["link-opportunities", clientId] });
    },
    onError: (error) => {
      console.error("Failed to reject opportunity:", error);
    },
  });

  const health = healthQuery.data?.data;
  const opportunities = opportunitiesQuery.data?.data ?? [];
  const totalOpportunities = opportunitiesQuery.data?.meta?.total ?? 0;

  return (
    <div className="px-4 py-4 md:px-6 md:py-6 pb-24 md:pb-8 overflow-auto">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Link2 className="h-6 w-6" />
            Internal Linking Health
          </h1>
        </div>

        {healthQuery.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : health ? (
          <>
            {/* Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Total Pages
                  </p>
                  <p className="text-2xl font-semibold">
                    {health.metrics.totalPages.toLocaleString()}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Orphan Pages
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-semibold">
                      {health.metrics.orphanPages}
                    </p>
                    {getStatusBadge(health.metrics.orphanPages, { warning: 1, critical: 5 })}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Avg Links/Page
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-semibold">
                      {health.metrics.avgInboundLinks.toFixed(1)}
                    </p>
                    {health.metrics.avgInboundLinks < 20 ? (
                      <Badge variant="outline" className="border-yellow-500 text-yellow-600">Warning</Badge>
                    ) : (
                      <Badge variant="outline" className="border-green-500 text-green-600">Good</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Deep Pages (&gt;3 clicks)
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-semibold">
                      {health.metrics.deepPages}
                    </p>
                    {getStatusBadge(health.metrics.deepPages, { warning: 5, critical: 20 })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Link Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Link Distribution</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Inbound links per page (target: 31-50 links)
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-1 h-32">
                  {health.distribution.map((bucket) => {
                    const maxCount = Math.max(...health.distribution.map((d) => d.count));
                    const height = maxCount > 0 ? (bucket.count / maxCount) * 100 : 0;
                    const isTarget = bucket.bucket === "31-40" || bucket.bucket === "41-50";
                    const isOrphan = bucket.bucket === "0";

                    return (
                      <div key={bucket.bucket} className="flex-1 flex flex-col items-center">
                        <div
                          className={`w-full rounded-t ${
                            isOrphan
                              ? "bg-red-500"
                              : isTarget
                                ? "bg-green-500"
                                : "bg-blue-400"
                          }`}
                          style={{ height: `${height}%` }}
                        />
                        <span className="text-xs mt-1 text-muted-foreground">
                          {bucket.bucket}
                        </span>
                        <span className="text-xs font-medium">{bucket.count}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Opportunities */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Opportunities ({totalOpportunities} detected)
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Internal linking opportunities sorted by priority
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                {opportunitiesQuery.isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : opportunities.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">
                    No pending opportunities found.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Priority</TableHead>
                        <TableHead>Page</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="hidden md:table-cell">Reason</TableHead>
                        <TableHead className="w-24">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {opportunities.map((opp) => (
                        <TableRow key={opp.id}>
                          <TableCell>
                            <Badge variant={getPriorityVariant(opp.urgency)}>
                              {getPriorityLabel(opp.urgency)}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate" title={opp.pageUrl}>
                            {opp.pageUrl.replace(/^https?:\/\/[^/]+/, "")}
                          </TableCell>
                          <TableCell>{formatType(opp.opportunityType)}</TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[300px] truncate">
                            {opp.reason}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => approveMutation.mutate(opp.id)}
                                disabled={approveMutation.isPending}
                              >
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => rejectMutation.mutate(opp.id)}
                                disabled={rejectMutation.isPending}
                              >
                                <X className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
              <p className="text-muted-foreground">
                Unable to load link health data. Please try again.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
