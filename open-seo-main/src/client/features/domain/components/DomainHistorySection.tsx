import { Clock, History, X } from "lucide-react";
import { Globe } from "lucide-react";
import { Button } from "@/client/components/ui/button";
import type { DomainHistoryItem } from "@/client/features/domain/types";

type Props = {
  history: DomainHistoryItem[];
  historyLoaded: boolean;
  onRemoveHistoryItem: (timestamp: number) => void;
  onSelectHistoryItem: (item: DomainHistoryItem) => void;
};

export function DomainHistorySection({
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
        <Globe className="size-9 mx-auto opacity-35" />
        <p className="text-base font-medium text-foreground/80">
          Enter a domain to get started
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
                  {item.domain}
                </p>
                <p className="text-sm text-muted-foreground truncate">
                  {item.subdomains ? "Include subdomains" : "Root domain only"}
                  {item.search?.trim() ? ` - ${item.search}` : ""}
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
