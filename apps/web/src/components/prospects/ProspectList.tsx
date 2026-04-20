"use client";

import { useState } from "react";
import { ProspectCard } from "./ProspectCard";
import { Badge } from "@tevero/ui";
import type { Prospect } from "@/app/(shell)/prospects/actions";

interface ProspectListProps {
  prospects: Prospect[];
  remainingAnalyses: number;
}

export function ProspectList({
  prospects,
  remainingAnalyses,
}: ProspectListProps) {
  const [remaining, setRemaining] = useState(remainingAnalyses);

  const handleAnalyzeStart = () => {
    setRemaining((prev) => Math.max(0, prev - 1));
  };

  if (prospects.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg">No prospects yet</p>
        <p className="text-sm mt-1">
          Click &quot;Add Prospect&quot; to start building your pipeline
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Showing {prospects.length} prospect{prospects.length !== 1 ? "s" : ""}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">
            Analyses remaining today:
          </span>
          <Badge
            variant={
              remaining > 3
                ? "secondary"
                : remaining > 0
                  ? "outline"
                  : "destructive"
            }
          >
            {remaining} / 10
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {prospects.map((prospect) => (
          <ProspectCard
            key={prospect.id}
            prospect={prospect}
            canAnalyze={remaining > 0}
            onAnalyzeStart={handleAnalyzeStart}
          />
        ))}
      </div>
    </div>
  );
}
