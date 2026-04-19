"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@tevero/ui";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { TopQuery } from "@/lib/analytics/types";

interface QueriesTableProps {
  queries: TopQuery[];
}

function PositionDelta({ delta }: { delta: number }) {
  // Negative delta = improved (position went from e.g. 10 to 5)
  // Positive delta = worsened (position went from e.g. 5 to 10)
  if (Math.abs(delta) < 0.1) {
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  }
  if (delta < 0) {
    return (
      <span className="flex items-center text-emerald-600">
        <TrendingUp className="h-4 w-4 mr-1" />
        {Math.abs(delta).toFixed(1)}
      </span>
    );
  }
  return (
    <span className="flex items-center text-red-600">
      <TrendingDown className="h-4 w-4 mr-1" />
      {delta.toFixed(1)}
    </span>
  );
}

export function QueriesTable({ queries }: QueriesTableProps) {
  if (queries.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No query data available
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[250px]">Query</TableHead>
          <TableHead className="text-right">Clicks</TableHead>
          <TableHead className="text-right">Impressions</TableHead>
          <TableHead className="text-right">CTR</TableHead>
          <TableHead className="text-right">Position</TableHead>
          <TableHead className="text-right">WoW</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {queries.map((q) => (
          <TableRow key={q.query}>
            <TableCell
              className="font-medium max-w-[250px] truncate"
              title={q.query}
            >
              {q.query}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {q.clicks.toLocaleString()}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {q.impressions.toLocaleString()}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {(q.ctr * 100).toFixed(1)}%
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {q.position.toFixed(1)}
            </TableCell>
            <TableCell className="text-right">
              <PositionDelta delta={q.position_delta} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
