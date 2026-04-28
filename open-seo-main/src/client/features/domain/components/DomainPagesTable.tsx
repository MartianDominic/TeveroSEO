import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/client/components/ui/table";
import { SortableHeader } from "@/client/features/domain/components/SortableHeader";
import {
  formatFloat,
  formatNumber,
  toPageSortMode,
} from "@/client/features/domain/utils";
import type {
  DomainSortMode,
  PageRow,
  SortOrder,
} from "@/client/features/domain/types";

type Props = {
  rows: PageRow[];
  sortMode: DomainSortMode;
  currentSortOrder: SortOrder;
  onSortClick: (sort: DomainSortMode) => void;
};

export function DomainPagesTable({
  rows,
  sortMode,
  currentSortOrder,
  onSortClick,
}: Props) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Page</TableHead>
            <TableHead>
              <SortableHeader
                label="Organic Traffic"
                isActive={toPageSortMode(sortMode) === "traffic"}
                order={currentSortOrder}
                onClick={() => onSortClick("traffic")}
              />
            </TableHead>
            <TableHead>
              <SortableHeader
                label="Keywords"
                isActive={toPageSortMode(sortMode) === "volume"}
                order={currentSortOrder}
                onClick={() => onSortClick("volume")}
              />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                No pages match this search.
              </TableCell>
            </TableRow>
          ) : (
            rows.slice(0, 100).map((row) => (
              <TableRow key={row.page}>
                <TableCell className="max-w-[420px] truncate" title={row.page}>
                  {row.relativePath ?? row.page}
                </TableCell>
                <TableCell>{formatFloat(row.organicTraffic)}</TableCell>
                <TableCell>{formatNumber(row.keywords)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
