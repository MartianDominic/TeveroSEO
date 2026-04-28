import { useMemo, useState } from "react";
import { EmptyTableState } from "./BacklinksPageEmptyTableState";
import { ReferringDomainsTableHeader } from "./BacklinksTableHeaders";
import type { BacklinksOverviewData } from "./backlinksPageTypes";
import {
  DEFAULT_REFERRING_DOMAINS_SORT,
  sortReferringDomainRows,
} from "./backlinksTableSorting";
import {
  formatCompactDate,
  formatDecimal,
  formatNumber,
} from "./backlinksPageUtils";
import {
  Table,
  TableBody,
  TableRow,
  TableCell,
} from "@/client/components/ui/table";

export function ReferringDomainsTable({
  rows,
}: {
  rows: BacklinksOverviewData["referringDomains"];
}) {
  const [sort, setSort] = useState(DEFAULT_REFERRING_DOMAINS_SORT);
  const sortedRows = useMemo(
    () => sortReferringDomainRows(rows, sort),
    [rows, sort],
  );

  if (rows.length === 0) {
    return <EmptyTableState label="No referring domains match this filter." />;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <ReferringDomainsTableHeader sort={sort} onSortChange={setSort} />
        <TableBody>
          {sortedRows.map((row, index) => (
            <TableRow key={`${row.domain ?? "domain"}-${index}`}>
              <TableCell className="font-medium break-all">{row.domain ?? "-"}</TableCell>
              <TableCell>{formatNumber(row.backlinks)}</TableCell>
              <TableCell>{formatNumber(row.referringPages)}</TableCell>
              <TableCell>{formatNumber(row.rank)}</TableCell>
              <TableCell>{formatDecimal(row.spamScore)}</TableCell>
              <TableCell>{formatCompactDate(row.firstSeen)}</TableCell>
              <TableCell>
                <div className="text-sm">
                  <div>Broken links: {formatNumber(row.brokenBacklinks)}</div>
                  <div className="text-foreground/55">
                    Broken pages: {formatNumber(row.brokenPages)}
                  </div>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
