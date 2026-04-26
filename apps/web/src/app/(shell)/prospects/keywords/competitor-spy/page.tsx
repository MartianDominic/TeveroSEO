"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@tevero/ui";
import { Download, Search, Loader2, ExternalLink, TrendingUp } from "lucide-react";
import {
  spyOnCompetitor,
  exportCompetitorCsv,
  type CompetitorKeyword,
} from "./actions";

export default function CompetitorSpyPage() {
  const [domain, setDomain] = useState("");
  const [results, setResults] = useState<CompetitorKeyword[]>([]);
  const [resultDomain, setResultDomain] = useState("");
  const [estimatedTraffic, setEstimatedTraffic] = useState(0);
  const [costCents, setCostCents] = useState(0);
  const [cached, setCached] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSpy = async () => {
    if (!domain.trim()) {
      setError("Enter a competitor domain");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await spyOnCompetitor(domain);
      setResults(result.keywords);
      setResultDomain(result.domain);
      setEstimatedTraffic(result.estimatedTraffic);
      setCostCents(result.costCents);
      setCached(result.cached);
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !loading) {
      handleSpy();
    }
  };

  const handleExport = async () => {
    const csv = await exportCompetitorCsv(resultDomain, results);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `competitor-spy-${resultDomain.replace(/\./g, "-")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getPositionBadge = (position: number) => {
    if (position <= 3) {
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          #{position}
        </Badge>
      );
    }
    if (position <= 10) {
      return (
        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          #{position}
        </Badge>
      );
    }
    return <Badge variant="outline">#{position}</Badge>;
  };

  const formatUrl = (url: string) => {
    if (!url) return "-";
    try {
      const urlObj = new URL(url);
      return urlObj.pathname + urlObj.search;
    } catch {
      return url;
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Competitor Spy</h1>
        <p className="text-muted-foreground mt-2">
          Discover what keywords your competitors are ranking for
        </p>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Enter Competitor Domain</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="competitor.com"
              className="flex-1"
            />
            <Button onClick={handleSpy} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Spy
                </>
              )}
            </Button>
          </div>

          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                {resultDomain}
                {cached && (
                  <Badge variant="outline" className="text-xs">
                    cached
                  </Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                <span>{results.length} keywords</span>
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {estimatedTraffic.toLocaleString()} est. visitors/mo
                </span>
                {!cached && <span>Cost: ${(costCents / 100).toFixed(2)}</span>}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button size="sm">Create Gap Analysis</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Keyword</TableHead>
                    <TableHead className="text-center w-[100px]">Position</TableHead>
                    <TableHead className="text-right w-[100px]">Volume</TableHead>
                    <TableHead className="text-right w-[100px]">Est. Traffic</TableHead>
                    <TableHead className="w-[200px]">URL</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((kw, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{kw.keyword}</TableCell>
                      <TableCell className="text-center">
                        {getPositionBadge(kw.position)}
                      </TableCell>
                      <TableCell className="text-right">
                        {kw.searchVolume.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {Math.round(kw.trafficShare).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {kw.url ? (
                          <a
                            href={kw.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center text-blue-600 hover:underline text-sm truncate max-w-[180px]"
                            title={kw.url}
                          >
                            {formatUrl(kw.url)}
                            <ExternalLink className="h-3 w-3 ml-1 flex-shrink-0" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
