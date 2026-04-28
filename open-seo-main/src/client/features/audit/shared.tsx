import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { Badge } from "@/client/components/ui/badge";
import { Card, CardContent } from "@/client/components/ui/card";

export const SUPPORT_URL = "https://everyapp.dev/support";

export function extractPathname(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

export function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function formatDate(dateStr: string | Date): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatStartedAt(dateStr: string | Date): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

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
      <Badge className="bg-success/5 text-green-700 dark:text-green-400 text-xs border-success/30 gap-1">
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
  if (!code) return <Badge variant="secondary" className="text-xs">-</Badge>;
  if (code >= 200 && code < 300) {
    return <Badge className="bg-success/20 text-green-700 dark:text-green-400 text-xs border-success/30">{code}</Badge>;
  }
  if (code >= 300 && code < 400) {
    return <Badge variant="outline" className="text-yellow-600 text-xs">{code}</Badge>;
  }
  return <Badge variant="destructive" className="text-xs">{code}</Badge>;
}

export function LighthouseScoreBadge({ score }: { score: number | null }) {
  if (score == null) {
    return <span className="text-xs text-foreground/40">-</span>;
  }
  const color =
    score >= 90 ? "text-success" : score >= 50 ? "text-warning" : "text-error";
  return <span className={`font-medium text-sm ${color}`}>{score}</span>;
}

export function StatCard({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className={`text-2xl font-semibold ${className}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
