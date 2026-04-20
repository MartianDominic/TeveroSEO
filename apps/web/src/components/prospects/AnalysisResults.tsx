"use client";

import {
  Card,
  CardContent,
  CardDescription,
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
import { Globe, TrendingUp, Users, DollarSign, Target } from "lucide-react";
import type { ProspectAnalysis } from "@/app/(shell)/prospects/actions";

interface AnalysisResultsProps {
  analysis: ProspectAnalysis;
}

export function AnalysisResults({ analysis }: AnalysisResultsProps) {
  const { domainMetrics, organicKeywords, competitorDomains } = analysis;

  return (
    <div className="space-y-6">
      {domainMetrics && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Domain Metrics
            </CardTitle>
            <CardDescription>
              Overview of the prospect&apos;s current SEO performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {domainMetrics.domainRank !== undefined && (
                <MetricCard
                  label="Domain Rank"
                  value={domainMetrics.domainRank.toLocaleString()}
                  icon={<Target className="h-4 w-4" />}
                />
              )}
              {domainMetrics.organicTraffic !== undefined && (
                <MetricCard
                  label="Est. Traffic"
                  value={domainMetrics.organicTraffic.toLocaleString()}
                  icon={<TrendingUp className="h-4 w-4" />}
                />
              )}
              {domainMetrics.organicKeywords !== undefined && (
                <MetricCard
                  label="Keywords"
                  value={domainMetrics.organicKeywords.toLocaleString()}
                  icon={<Users className="h-4 w-4" />}
                />
              )}
              {domainMetrics.backlinks !== undefined && (
                <MetricCard
                  label="Backlinks"
                  value={domainMetrics.backlinks.toLocaleString()}
                  icon={<Globe className="h-4 w-4" />}
                />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {organicKeywords && organicKeywords.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Top Keywords ({organicKeywords.length})
            </CardTitle>
            <CardDescription>
              Keywords this domain currently ranks for
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Keyword</TableHead>
                  <TableHead className="text-right">Position</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead className="text-right">CPC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organicKeywords.slice(0, 20).map((kw, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{kw.keyword}</TableCell>
                    <TableCell className="text-right">
                      <PositionBadge position={kw.position} />
                    </TableCell>
                    <TableCell className="text-right">
                      {kw.searchVolume.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {kw.cpc ? `$${kw.cpc.toFixed(2)}` : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {organicKeywords.length > 20 && (
              <p className="text-sm text-muted-foreground mt-4 text-center">
                Showing top 20 of {organicKeywords.length} keywords
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {competitorDomains && competitorDomains.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Competitors ({competitorDomains.length})
            </CardTitle>
            <CardDescription>
              Domains competing for similar keywords
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {competitorDomains.map((domain, idx) => (
                <Badge key={idx} variant="secondary" className="text-sm">
                  {domain}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {analysis.costCents !== null && (
        <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
          <DollarSign className="h-4 w-4" />
          <span>Analysis cost: ${(analysis.costCents / 100).toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-muted/50 rounded-lg p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs font-medium uppercase">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function PositionBadge({ position }: { position: number }) {
  const variant =
    position <= 3 ? "default" : position <= 10 ? "secondary" : "outline";

  return <Badge variant={variant}>{position}</Badge>;
}
