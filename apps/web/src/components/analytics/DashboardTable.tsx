"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
} from "@tevero/ui";
import { ArrowUpDown, Send, ChevronRight, Search } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import type { DashboardClient } from "@/lib/analytics/types";

type SortKey = "name" | "clicks_30d" | "wow_change" | "avg_position";
type SortDir = "asc" | "desc";

interface DashboardTableProps {
  clients: DashboardClient[];
  showAttentionHeader?: boolean;
}

export function DashboardTable({ clients, showAttentionHeader = false }: DashboardTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("clicks_30d");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return clients;
    return clients.filter((c) => c.name.toLowerCase().includes(query));
  }, [clients, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      const aNum = aVal as number;
      const bNum = bVal as number;
      return sortDir === "asc" ? aNum - bNum : bNum - aNum;
    });
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const formatWoW = (change: number) => {
    const pct = (change * 100).toFixed(1);
    if (change > 0) return <span className="text-emerald-600">+{pct}%</span>;
    if (change < 0) return <span className="text-red-600">{pct}%</span>;
    return <span className="text-muted-foreground">0%</span>;
  };

  const handleRowClick = (clientId: string) => {
    router.push(`/clients/${clientId}/analytics` as Parameters<typeof router.push>[0]);
  };

  const handleSendInvite = (e: React.MouseEvent, clientId: string) => {
    e.stopPropagation();
    router.push(`/clients/${clientId}/connections` as Parameters<typeof router.push>[0]);
  };

  return (
    <div className="space-y-4">
      {/* Search - only show for main table, not attention section */}
      {!showAttentionHeader && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">
                <button
                  onClick={() => toggleSort("name")}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  Client
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button
                  onClick={() => toggleSort("clicks_30d")}
                  className="flex items-center gap-1 ml-auto hover:text-foreground"
                >
                  Clicks (30d)
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button
                  onClick={() => toggleSort("wow_change")}
                  className="flex items-center gap-1 ml-auto hover:text-foreground"
                >
                  WoW
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button
                  onClick={() => toggleSort("avg_position")}
                  className="flex items-center gap-1 ml-auto hover:text-foreground"
                >
                  Avg Position
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No clients found
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((client) => (
                <TableRow
                  key={client.id}
                  onClick={() => handleRowClick(client.id)}
                  className="cursor-pointer hover:bg-muted/50"
                >
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {client.clicks_30d.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatWoW(client.wow_change)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {client.avg_position.toFixed(1)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={client.status} />
                  </TableCell>
                  <TableCell>
                    {client.status === "no_gsc" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleSendInvite(e, client.id)}
                        className="h-8 px-2"
                      >
                        <Send className="h-3.5 w-3.5 mr-1" />
                        Invite
                      </Button>
                    ) : client.status === "stale" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleSendInvite(e, client.id)}
                        className="h-8 px-2"
                      >
                        Reconnect
                      </Button>
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
