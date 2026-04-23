"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@tevero/ui";
import { Link2, FileQuestion, CheckCircle, AlertCircle } from "lucide-react";
import { getMappings } from "@/actions/seo/mapping";
import { MappingTable } from "@/components/mapping/MappingTable";
import { SuggestMappingButton } from "@/components/mapping/SuggestMappingButton";

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
  currentUrl: string | null;
  isManualOverride: boolean;
  updatedAt: string;
}

interface MappingStats {
  optimize: number;
  create: number;
  total: number;
}

interface GetMappingsResponse {
  mappings: MappingItem[];
  stats: MappingStats;
}

export default function KeywordMappingPage() {
  const params = useParams<{ clientId: string; projectId: string }>();
  const queryClient = useQueryClient();
  const { clientId, projectId } = params;

  const [actionFilter, setActionFilter] = useState<"all" | "optimize" | "create">("all");

  // Fetch mappings
  const mappingsQuery = useQuery({
    queryKey: ["keyword-mappings", projectId, clientId, actionFilter],
    queryFn: () =>
      getMappings({
        projectId,
        clientId,
        action: actionFilter === "all" ? undefined : actionFilter,
      }),
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["keyword-mappings"] });
  };

  const mappings = mappingsQuery.data?.mappings ?? [];
  const stats = mappingsQuery.data?.stats ?? { optimize: 0, create: 0, total: 0 };

  // Extract pages from mappings that have targetUrl for the override dialog
  const pages = Array.from(
    new Map(
      mappings
        .filter((m): m is MappingItem & { targetUrl: string } => m.targetUrl !== null)
        .map((m) => [m.targetUrl, { url: m.targetUrl, title: null }])
    ).values()
  );

  return (
    <div className="px-4 py-4 md:px-6 md:py-6 pb-24 md:pb-8 overflow-auto">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Link2 className="h-6 w-6" />
              Keyword-to-Page Mapping
            </h1>
            <p className="text-muted-foreground mt-1">
              Map keywords to target pages for optimization or flag gaps for new content.
            </p>
          </div>
          <SuggestMappingButton
            projectId={projectId}
            clientId={clientId}
            onComplete={handleRefresh}
          />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Mappings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                To Optimize
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.optimize}</div>
              <p className="text-xs text-muted-foreground">
                Existing pages to improve
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                Needs Content
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.create}</div>
              <p className="text-xs text-muted-foreground">
                Keywords without matching pages
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filter and Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Keyword Mappings</CardTitle>
              <div className="flex items-center gap-2">
                <Select
                  value={actionFilter}
                  onValueChange={(v) => setActionFilter(v as "all" | "optimize" | "create")}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Keywords</SelectItem>
                    <SelectItem value="optimize">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        Optimize
                      </div>
                    </SelectItem>
                    <SelectItem value="create">
                      <div className="flex items-center gap-2">
                        <FileQuestion className="h-4 w-4 text-yellow-500" />
                        Create
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {mappingsQuery.isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading mappings...
              </div>
            ) : mappingsQuery.isError ? (
              <div className="text-center py-8 text-destructive">
                Error loading mappings. Please try again.
              </div>
            ) : (
              <MappingTable
                mappings={mappings}
                pages={pages}
                projectId={projectId}
                clientId={clientId}
                onOverride={handleRefresh}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
