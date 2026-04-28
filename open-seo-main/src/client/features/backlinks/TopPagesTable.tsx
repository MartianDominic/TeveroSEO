import { useMemo, useState } from "react";
import { EmptyTableState } from "./BacklinksPageEmptyTableState";
import { BacklinksExternalLink } from "./BacklinksPageLinks";
import { TopPagesTableHeader } from "./BacklinksTableHeaders";
import type { BacklinksOverviewData } from "./backlinksPageTypes";
import {
  DEFAULT_TOP_PAGES_SORT,
  sortTopPageRows,
} from "./backlinksTableSorting";
import { formatNumber } from "./backlinksPageUtils";
import {
  Table,
  TableBody,
  TableRow,
  TableCell,
} from "@/client/components/ui/table";

export function TopPagesTable({
  rows,
}: {
  rows: BacklinksOverviewData["topPages"];
}) {
  const [sort, setSort] = useState(DEFAULT_TOP_PAGES_SORT);
  const sortedRows = useMemo(() => sortTopPageRows(rows, sort), [rows, sort]);

  if (rows.length === 0) {
    return <EmptyTableState label="No top pages match this filter." />;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TopPagesTableHeader sort={sort} onSortChange={setSort} />
        <TableBody>
          {sortedRows.map((row, index) => (
            <TableRow key={`${row.page ?? "page"}-${index}`}>
              <TableCell className="min-w-80">
                {row.page ? (
                  <BacklinksExternalLink
                    url={row.page}
                    label={row.page}
                    className="link link-hover break-all inline-flex items-center gap-1"
                  />
                ) : (
                  "-"
                )}
              </TableCell>
              <TableCell>{formatNumber(row.backlinks)}</TableCell>
              <TableCell>{formatNumber(row.referringDomains)}</TableCell>
              <TableCell>{formatNumber(row.rank)}</TableCell>
              <TableCell>{formatNumber(row.brokenBacklinks)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
