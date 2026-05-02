"use client";

/**
 * KeywordReviewPanel: Human review UI for classified keywords.
 *
 * Allows users to:
 * - Review AI classifications
 * - Override include/exclude decisions
 * - Bulk select/deselect all
 * - Approve final keyword selection
 */

import { useState } from "react";
import { Button, Badge, Checkbox } from "@tevero/ui";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, X, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface ClassifiedKeyword {
  keyword: string;
  include: boolean;
  confidence: number;
  type: string | null;
  reasoning: string;
  pass: 1 | 2;
}

interface KeywordReviewPanelProps {
  keywords: ClassifiedKeyword[];
  onApprove: (approved: ClassifiedKeyword[]) => void;
  onCancel: () => void;
}

export function KeywordReviewPanel({
  keywords,
  onApprove,
  onCancel,
}: KeywordReviewPanelProps) {
  const [selections, setSelections] = useState<Map<string, boolean>>(
    new Map(keywords.map((k) => [k.keyword, k.include]))
  );

  const toggleKeyword = (keyword: string) => {
    const newSelections = new Map(selections);
    newSelections.set(keyword, !newSelections.get(keyword));
    setSelections(newSelections);
  };

  const handleApprove = () => {
    const approved = keywords.map((k) => ({
      ...k,
      include: selections.get(k.keyword) ?? k.include,
    }));
    onApprove(approved);
  };

  const handleSelectAll = () => {
    setSelections(new Map(keywords.map((k) => [k.keyword, true])));
  };

  const handleDeselectAll = () => {
    setSelections(new Map(keywords.map((k) => [k.keyword, false])));
  };

  const selectedCount = Array.from(selections.values()).filter(Boolean).length;

  const getConfidenceBadgeVariant = (
    confidence: number
  ): "default" | "secondary" | "outline" => {
    if (confidence >= 0.85) return "default";
    if (confidence >= 0.7) return "secondary";
    return "outline";
  };

  const getTypeBadgeColor = (type: string | null): string => {
    switch (type) {
      case "product":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "long_tail":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "question":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "local":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      case "comparison":
        return "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h3 className="font-semibold">Review Keywords</h3>
          <p className="text-sm text-muted-foreground">
            {selectedCount} of {keywords.length} selected
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSelectAll}>
            <Check className="h-4 w-4 mr-1" />
            All
          </Button>
          <Button variant="outline" size="sm" onClick={handleDeselectAll}>
            <X className="h-4 w-4 mr-1" />
            None
          </Button>
        </div>
      </div>

      {/* Keyword List */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-2">
          {keywords.map((keyword) => (
            <div
              key={keyword.keyword}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                selections.get(keyword.keyword)
                  ? "bg-accent/10 border-accent/30"
                  : "bg-muted/30 border-transparent"
              } hover:bg-accent/20`}
            >
              <Checkbox
                checked={selections.get(keyword.keyword)}
                onCheckedChange={() => toggleKeyword(keyword.keyword)}
                aria-label={`Select keyword: ${keyword.keyword}`}
              />

              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{keyword.keyword}</div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground cursor-help">
                        <Info className="h-3 w-3" />
                        <span className="truncate max-w-[200px]">
                          {keyword.reasoning}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <p>{keyword.reasoning}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {keyword.type && (
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeBadgeColor(
                      keyword.type
                    )}`}
                  >
                    {keyword.type.replace("_", " ")}
                  </span>
                )}
                <Badge
                  variant={getConfidenceBadgeVariant(keyword.confidence)}
                  className="text-xs"
                >
                  {(keyword.confidence * 100).toFixed(0)}%
                </Badge>
                <Badge variant="outline" className="text-xs">
                  P{keyword.pass}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="flex justify-between items-center gap-2 p-4 border-t bg-background">
        <div className="text-sm text-muted-foreground">
          {selectedCount === 0 && "No keywords selected"}
          {selectedCount > 0 &&
            selectedCount < keywords.length &&
            `${selectedCount} keyword${selectedCount === 1 ? "" : "s"} selected`}
          {selectedCount === keywords.length && "All keywords selected"}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleApprove} disabled={selectedCount === 0}>
            Approve {selectedCount} Keyword{selectedCount === 1 ? "" : "s"}
          </Button>
        </div>
      </div>
    </div>
  );
}
