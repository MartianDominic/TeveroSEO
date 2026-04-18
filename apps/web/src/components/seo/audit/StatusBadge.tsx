"use client";

import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { Badge } from "@tevero/ui";

export function StatusBadge({ status }: { status: string }) {
  if (status === "running") {
    return (
      <Badge className="bg-blue-500/20 text-blue-700 dark:text-blue-400 text-xs border-blue-500/30 gap-1">
        <Loader2 className="size-3 animate-spin" /> Running
      </Badge>
    );
  }

  if (status === "completed") {
    return (
      <Badge className="bg-green-500/5 text-green-700 dark:text-green-400 text-xs border-green-500/30 gap-1">
        <CheckCircle className="size-3" /> Done
      </Badge>
    );
  }

  return (
    <Badge variant="destructive" className="text-xs gap-1">
      <AlertCircle className="size-3" /> Failed
    </Badge>
  );
}

export function HttpStatusBadge({ code }: { code: number | null }) {
  if (!code)
    return (
      <Badge variant="secondary" className="text-xs">
        -
      </Badge>
    );
  if (code >= 200 && code < 300) {
    return (
      <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 text-xs border-green-500/30">
        {code}
      </Badge>
    );
  }
  if (code >= 300 && code < 400) {
    return (
      <Badge variant="outline" className="text-yellow-600 text-xs">
        {code}
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="text-xs">
      {code}
    </Badge>
  );
}

export function LighthouseScoreBadge({ score }: { score: number | null }) {
  if (score == null) {
    return <span className="text-xs text-foreground/40">-</span>;
  }
  const color =
    score >= 90
      ? "text-green-600"
      : score >= 50
        ? "text-yellow-600"
        : "text-red-600";
  return <span className={`font-medium text-sm ${color}`}>{score}</span>;
}
