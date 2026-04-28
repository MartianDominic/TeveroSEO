import { Clock, History, Link2, X } from "lucide-react";
import type { BacklinksSearchHistoryItem } from "@/client/hooks/useBacklinksSearchHistory";
import { Button } from "@/client/components/ui/button";

type Props = {
  history: BacklinksSearchHistoryItem[];
  historyLoaded: boolean;
  onRemoveHistoryItem: (timestamp: number) => void;
  onSelectHistoryItem: (item: BacklinksSearchHistoryItem) => void;
};

export function BacklinksHistorySection({
  history,
  historyLoaded,
  onRemoveHistoryItem,
  onSelectHistoryItem,
}: Props) {
  if (!historyLoaded) {
    return null;
  }

  if (history.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-border bg-background/70 p-6 text-center text-foreground/55 space-y-2">
        <Link2 className="size-9 mx-auto opacity-35" />
        <p className="text-base font-medium text-foreground/80">
          Enter a domain or URL to get started
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-background p-5 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <History className="size-4 text-foreground/45" />
          <span className="text-sm text-muted-foreground">
            {history.length} recent search{history.length !== 1 ? "es" : ""}
          </span>
        </div>
      </div>

      <div className="grid gap-2">
        {history.map((item) => (
          <div
            key={item.timestamp}
            className="group flex items-center gap-2 rounded-lg border border-border bg-background p-2"
          >
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-1 py-1 text-left transition-colors hover:bg-muted"
              onClick={() => onSelectHistoryItem(item)}
            >
              <Clock className="size-4 text-foreground/40 shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate">
                  {item.target}
                </p>
                <p className="text-sm text-muted-foreground truncate">
                  {item.scope === "domain" ? "Site-wide" : "Exact page"}
                </p>
              </div>
            </button>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-foreground/40">
                {new Date(item.timestamp).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 h-6 w-6"
                onClick={() => onRemoveHistoryItem(item.timestamp)}
              >
                <X className="size-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
