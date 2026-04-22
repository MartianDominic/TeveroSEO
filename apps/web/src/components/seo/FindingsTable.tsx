"use client";

import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@tevero/ui";
import { Download, ChevronDown, ChevronRight, Wrench } from "lucide-react";
import type { AuditFinding } from "@/actions/seo/findings";

interface FindingsTableProps {
  findings: AuditFinding[];
  onExport?: () => void;
}

type SeverityFilter = "all" | "critical" | "high" | "medium" | "low" | "info";
type TierFilter = "all" | "1" | "2" | "3" | "4";
type PassFilter = "all" | "passed" | "failed";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-600 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-yellow-500 text-black",
  low: "bg-blue-500 text-white",
  info: "bg-gray-500 text-white",
};

export function FindingsTable({ findings, onExport }: FindingsTableProps) {
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [passFilter, setPassFilter] = useState<PassFilter>("all");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const categories = useMemo(() => {
    const cats = new Set(findings.map((f) => f.category));
    return Array.from(cats).sort();
  }, [findings]);

  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return findings.filter((f) => {
      if (severityFilter !== "all" && f.severity !== severityFilter) return false;
      if (tierFilter !== "all" && f.tier.toString() !== tierFilter) return false;
      if (categoryFilter !== "all" && f.category !== categoryFilter) return false;
      if (passFilter === "passed" && !f.passed) return false;
      if (passFilter === "failed" && f.passed) return false;
      if (search && !f.message.toLowerCase().includes(search.toLowerCase()))
        return false;
      return true;
    });
  }, [findings, severityFilter, tierFilter, categoryFilter, passFilter, search]);

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const passedCount = findings.filter((f) => f.passed).length;
  const failedCount = findings.filter((f) => !f.passed).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Findings ({filtered.length})</CardTitle>
        {onExport && (
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="flex gap-4 text-sm">
          <span className="text-green-600 font-medium">{passedCount} passed</span>
          <span className="text-red-600 font-medium">{failedCount} failed</span>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Search messages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48"
          />
          <Select
            value={severityFilter}
            onValueChange={(v) => setSeverityFilter(v as SeverityFilter)}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severity</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={tierFilter}
            onValueChange={(v) => setTierFilter(v as TierFilter)}
          >
            <SelectTrigger className="w-28">
              <SelectValue placeholder="Tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tiers</SelectItem>
              <SelectItem value="1">Tier 1</SelectItem>
              <SelectItem value="2">Tier 2</SelectItem>
              <SelectItem value="3">Tier 3</SelectItem>
              <SelectItem value="4">Tier 4</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={categoryFilter}
            onValueChange={setCategoryFilter}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={passFilter}
            onValueChange={(v) => setPassFilter(v as PassFilter)}
          >
            <SelectTrigger className="w-28">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="passed">Passed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-hidden">
          <div className="max-h-[500px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No findings match your filters.
              </div>
            ) : (
              filtered.map((f) => {
                const isExpanded = expandedRows.has(f.id);
                return (
                  <div key={f.id} className="border-b last:border-b-0">
                    <div
                      className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 ${
                        f.passed ? "bg-green-50/50 dark:bg-green-950/20" : ""
                      }`}
                      onClick={() => toggleRow(f.id)}
                    >
                      {f.details && Object.keys(f.details).length > 0 ? (
                        isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )
                      ) : (
                        <div className="w-4" />
                      )}
                      <Badge
                        className={`text-xs ${SEVERITY_COLORS[f.severity] || ""}`}
                      >
                        {f.severity}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        T{f.tier}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {f.category}
                      </Badge>
                      <span
                        className={`flex-1 text-sm ${f.passed ? "text-green-700 dark:text-green-400" : ""}`}
                      >
                        {f.message}
                      </span>
                      {f.autoEditable && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Wrench className="h-3 w-3" />
                          Auto-fix
                        </Badge>
                      )}
                      <span className="text-xs font-mono text-muted-foreground">
                        {f.checkId}
                      </span>
                    </div>
                    {isExpanded && f.details && (
                      <div className="px-10 py-3 bg-muted/30 text-sm">
                        <pre className="whitespace-pre-wrap text-xs">
                          {JSON.stringify(f.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
