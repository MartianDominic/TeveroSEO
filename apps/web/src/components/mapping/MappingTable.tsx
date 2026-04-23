"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
  Button,
} from "@tevero/ui";
import { Edit2, ExternalLink } from "lucide-react";
import { OverrideDialog } from "./OverrideDialog";

interface MappingItem {
  id: string;
  keyword: string;
  targetUrl: string | null;
  action: "optimize" | "create";
  relevanceScore: number | null;
  reason: string | null;
  searchVolume: number | null;
  difficulty: number | null;
  currentPosition: number | null;
  isManualOverride: boolean;
}

interface MappingTableProps {
  mappings: MappingItem[];
  pages: Array<{ url: string; title: string | null }>;
  projectId: string;
  clientId: string;
  onOverride: () => void;
}

export function MappingTable({
  mappings,
  pages,
  projectId,
  clientId,
  onOverride,
}: MappingTableProps) {
  const [overrideKeyword, setOverrideKeyword] = useState<string | null>(null);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);

  const handleOverrideClick = (keyword: string) => {
    setOverrideKeyword(keyword);
    setOverrideDialogOpen(true);
  };

  const handleOverrideComplete = () => {
    setOverrideDialogOpen(false);
    setOverrideKeyword(null);
    onOverride();
  };

  if (mappings.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No keyword mappings yet. Click &quot;Suggest Mapping&quot; to auto-map keywords.
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Keyword</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Target URL</TableHead>
            <TableHead className="text-right">Relevance</TableHead>
            <TableHead className="text-right">Volume</TableHead>
            <TableHead className="text-right">Position</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead className="w-[80px]">Override</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mappings.map((mapping) => (
            <TableRow key={mapping.id}>
              <TableCell className="font-medium">{mapping.keyword}</TableCell>
              <TableCell>
                <Badge
                  variant={mapping.action === "optimize" ? "default" : "secondary"}
                  className={
                    mapping.action === "optimize"
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                      : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"
                  }
                >
                  {mapping.action}
                </Badge>
                {mapping.isManualOverride && (
                  <Badge variant="outline" className="ml-1 text-xs">
                    manual
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                {mapping.targetUrl ? (
                  <a
                    href={mapping.targetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-1"
                  >
                    {truncateUrl(mapping.targetUrl, 30)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-muted-foreground italic">
                    Needs new page
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {mapping.relevanceScore !== null
                  ? `${Math.round(mapping.relevanceScore)}%`
                  : "-"}
              </TableCell>
              <TableCell className="text-right">
                {mapping.searchVolume?.toLocaleString() ?? "-"}
              </TableCell>
              <TableCell className="text-right">
                {mapping.currentPosition ?? "-"}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                {mapping.reason}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOverrideClick(mapping.keyword)}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <OverrideDialog
        open={overrideDialogOpen}
        onOpenChange={setOverrideDialogOpen}
        keyword={overrideKeyword ?? ""}
        pages={pages}
        projectId={projectId}
        clientId={clientId}
        onComplete={handleOverrideComplete}
      />
    </>
  );
}

/**
 * Truncate URL to show pathname only, with length limit.
 */
function truncateUrl(url: string, maxLength: number): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    if (path.length > maxLength) {
      return path.slice(0, maxLength) + "...";
    }
    return path;
  } catch {
    // If URL parsing fails, just truncate the string
    if (url.length > maxLength) {
      return url.slice(0, maxLength) + "...";
    }
    return url;
  }
}
