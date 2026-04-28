import { Checkbox } from "@/client/components/ui/checkbox";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/client/components/ui/table";
import { DifficultyBadge } from "@/client/features/domain/components/DifficultyBadge";
import { SortableHeader } from "@/client/features/domain/components/SortableHeader";
import { formatFloat, formatNumber } from "@/client/features/domain/utils";
import type {
  DomainSortMode,
  KeywordRow,
  SortOrder,
} from "@/client/features/domain/types";

type Props = {
  rows: KeywordRow[];
  selectedKeywords: Set<string>;
  visibleKeywords: string[];
  sortMode: DomainSortMode;
  currentSortOrder: SortOrder;
  onSortClick: (sort: DomainSortMode) => void;
  onToggleKeyword: (keyword: string) => void;
  onToggleAllVisible: () => void;
};

export function DomainKeywordsTable({
  rows,
  selectedKeywords,
  visibleKeywords,
  sortMode,
  currentSortOrder,
  onSortClick,
  onToggleKeyword,
  onToggleAllVisible,
}: Props) {
  return (
    <div className="overflow-x-auto">
      <div className="mb-2 text-xs text-muted-foreground">
        {selectedKeywords.size > 0
          ? `${selectedKeywords.size} selected`
          : "Select keywords to save"}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">
              <Checkbox
                className="h-3 w-3"
                checked={
                  visibleKeywords.length > 0 &&
                  visibleKeywords.every((keyword) =>
                    selectedKeywords.has(keyword),
                  )
                }
                onCheckedChange={onToggleAllVisible}
              />
            </TableHead>
            <TableHead>Keyword</TableHead>
            <TableHead>
              <SortableHeader
                label="Rank"
                isActive={sortMode === "rank"}
                order={currentSortOrder}
                onClick={() => onSortClick("rank")}
              />
            </TableHead>
            <TableHead>
              <SortableHeader
                label="Volume"
                isActive={sortMode === "volume"}
                order={currentSortOrder}
                onClick={() => onSortClick("volume")}
              />
            </TableHead>
            <TableHead>
              <SortableHeader
                label="Traffic"
                isActive={sortMode === "traffic"}
                order={currentSortOrder}
                onClick={() => onSortClick("traffic")}
              />
            </TableHead>
            <TableHead>
              <SortableHeader
                label="CPC"
                helpText="Cost per click in USD."
                isActive={sortMode === "cpc"}
                order={currentSortOrder}
                onClick={() => onSortClick("cpc")}
              />
            </TableHead>
            <TableHead>URL</TableHead>
            <TableHead>
              <SortableHeader
                label="Score"
                helpText="Keyword difficulty score."
                isActive={sortMode === "score"}
                order={currentSortOrder}
                onClick={() => onSortClick("score")}
              />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="py-6 text-center text-muted-foreground">
                No keywords match this search.
              </TableCell>
            </TableRow>
          ) : (
            rows.slice(0, 100).map((row) => (
              <TableRow key={`${row.keyword}-${row.url ?? ""}`}>
                <TableCell>
                  <Checkbox
                    className="h-3 w-3"
                    checked={selectedKeywords.has(row.keyword)}
                    onCheckedChange={() => onToggleKeyword(row.keyword)}
                    aria-label={`Select ${row.keyword}`}
                  />
                </TableCell>
                <TableCell className="font-medium">{row.keyword}</TableCell>
                <TableCell>{row.position ?? "-"}</TableCell>
                <TableCell>{formatNumber(row.searchVolume)}</TableCell>
                <TableCell>{formatFloat(row.traffic)}</TableCell>
                <TableCell>{row.cpc == null ? "-" : `$${row.cpc.toFixed(2)}`}</TableCell>
                <TableCell
                  className="max-w-[260px] truncate"
                  title={row.url ?? undefined}
                >
                  {row.relativeUrl ?? row.url ?? "-"}
                </TableCell>
                <TableCell>
                  <DifficultyBadge value={row.keywordDifficulty} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
