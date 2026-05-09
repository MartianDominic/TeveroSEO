"use client";

import { useState } from "react";

import { Download, Share2, Plus, Loader2, Copy, Check } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from "@tevero/ui";

import {
  quickCheckKeywords,
  exportToCsv,
  type QuickCheckKeyword,
} from "./actions";

export default function QuickCheckPage() {
  const [input, setInput] = useState("");
  const [results, setResults] = useState<QuickCheckKeyword[]>([]);
  const [totalVolume, setTotalVolume] = useState(0);
  const [costCents, setCostCents] = useState(0);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const keywordCount = input
    .split("\n")
    .filter((k) => k.trim().length > 0).length;

  const handleCheck = async () => {
    setLoading(true);
    setError(null);
    setShareUrl(null);

    try {
      const keywords = input
        .split("\n")
        .map((k) => k.trim())
        .filter((k) => k.length > 0);

      if (keywords.length === 0) {
        setError("Enter at least one keyword");
        return;
      }

      if (keywords.length > 20) {
        setError("Maximum 20 keywords allowed");
        return;
      }

      const result = await quickCheckKeywords(keywords, false);
      setResults(result.keywords);
      setTotalVolume(result.totalVolume);
      setCostCents(result.costCents);
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (results.length === 0) return;

    setLoading(true);
    try {
      const keywords = results.map((k) => k.keyword);
      const result = await quickCheckKeywords(keywords, true);
      if (result.shareLink) {
        const fullUrl = `${window.location.origin}${result.shareLink.shareUrl}`;
        setShareUrl(fullUrl);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate share link");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = async () => {
    const csv = await exportToCsv(results);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "quick-check-keywords.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getCompetitionBadge = (level: "low" | "medium" | "high") => {
    const colors = {
      low: "bg-success-soft text-success",
      medium: "bg-warning-soft text-warning",
      high: "bg-error-soft text-error",
    };
    return (
      <Badge variant="outline" className={colors[level]}>
        {level}
      </Badge>
    );
  };

  const getDifficultyColor = (kd: number) => {
    if (kd < 30) return "text-success";
    if (kd < 60) return "text-warning";
    return "text-error";
  };

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Quick Keyword Check</h1>
        <p className="text-text-3 mt-2">
          Check up to 20 keywords instantly without creating a prospect
        </p>
      </div>

      <Card className="mb-8 shadow-card">
        <CardHeader>
          <CardTitle>Enter Keywords (one per line)</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="plauku dazai&#10;profesionalus plauku dazai&#10;loreal plauku dazai"
            className="min-h-[150px] font-mono text-sm"
          />

          <div className="flex justify-between items-center mt-4">
            <span
              className={`text-[12px] ${keywordCount > 20 ? "text-error" : "text-text-3"}`}
            >
              {keywordCount}/20 keywords
            </span>
            <Button onClick={handleCheck} disabled={loading || keywordCount === 0}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Check Keywords
            </Button>
          </div>

          {error && <p className="text-error text-[12px] mt-2">{error}</p>}
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle>Results</CardTitle>
              <p className="text-[12px] text-text-3 mt-1">
                Combined: {totalVolume.toLocaleString()}/mo search volume |
                Cost: ${(costCents / 100).toFixed(3)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Share2 className="h-4 w-4 mr-2" />
                )}
                Share Link
              </Button>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Create Prospect
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {shareUrl && (
              <div className="mb-4 p-3 bg-surface-2 rounded-[var(--radius-input)] flex items-center justify-between">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="text-sm font-medium">Share link:</span>
                  <code className="text-sm truncate">{shareUrl}</code>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyShareLink}
                  className="flex-shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}

            <div className="rounded-[var(--radius-card)] shadow-card bg-surface overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Keyword</TableHead>
                    <TableHead className="text-right">Volume</TableHead>
                    <TableHead className="text-right">KD</TableHead>
                    <TableHead className="text-right">CPC</TableHead>
                    <TableHead>Competition</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((kw, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{kw.keyword}</TableCell>
                      <TableCell className="text-right">
                        {kw.searchVolume.toLocaleString()}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${getDifficultyColor(kw.keywordDifficulty)}`}
                      >
                        {kw.keywordDifficulty.toFixed(0)}
                      </TableCell>
                      <TableCell className="text-right">
                        ${kw.cpc.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {getCompetitionBadge(kw.competitionLevel)}
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
