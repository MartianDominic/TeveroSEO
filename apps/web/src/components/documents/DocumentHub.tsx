/**
 * DocumentHub Component
 * Phase 101: Document Management (D-04)
 *
 * Client folder view for documents with engagement analytics.
 * Displays files attached to a client with heatmap visualization.
 */
"use client";

import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Plus, FolderOpen, Search, Filter, LayoutGrid, List } from "lucide-react";
import { Button, Input } from "@tevero/ui";
import { DocumentCard, type DocumentData } from "./DocumentCard";
import { SectionHeatmap, type HeatmapSection } from "./SectionHeatmap";

// ============================================================================
// Types
// ============================================================================

interface DocumentHubProps {
  documents: DocumentData[];
  heatmapData?: HeatmapSection[];
  clientName?: string;
  onLinkDocument?: () => void;
  onUploadDocument?: () => void;
  onViewDocument?: (doc: DocumentData) => void;
  onEditDocument?: (doc: DocumentData) => void;
  onDeleteDocument?: (doc: DocumentData) => void;
  onSyncDocument?: (doc: DocumentData) => void;
  isLoading?: boolean;
  className?: string;
}

type ViewMode = "grid" | "list";
type SortBy = "name" | "date" | "views";

// ============================================================================
// Component
// ============================================================================

export function DocumentHub({
  documents,
  heatmapData = [],
  clientName,
  onLinkDocument,
  onUploadDocument,
  onViewDocument,
  onEditDocument,
  onDeleteDocument,
  onSyncDocument,
  isLoading = false,
  className,
}: DocumentHubProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortBy, setSortBy] = useState<SortBy>("date");

  // Filter and sort documents
  const filteredDocuments = useMemo(() => {
    let filtered = documents;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((doc) =>
        doc.name.toLowerCase().includes(query)
      );
    }

    // Sort
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "views":
          return b.viewCount - a.viewCount;
        case "date":
        default:
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
      }
    });
  }, [documents, searchQuery, sortBy]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
    },
    []
  );

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-2">
            <FolderOpen className="h-5 w-5 text-text-3" />
          </div>
          <div>
            <h2 className="text-[17px] font-semibold text-text-1">
              {clientName ? `${clientName} Documents` : "Documents"}
            </h2>
            <p className="text-[13px] text-text-3">
              {documents.length} document{documents.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {onLinkDocument && (
            <Button variant="outline" size="sm" onClick={onLinkDocument}>
              <Plus className="mr-1.5 h-4 w-4" />
              Link from Drive
            </Button>
          )}
          {onUploadDocument && (
            <Button size="sm" onClick={onUploadDocument}>
              <Plus className="mr-1.5 h-4 w-4" />
              Upload
            </Button>
          )}
        </div>
      </div>

      {/* Heatmap Section (if data available) */}
      {heatmapData.length > 0 && (
        <SectionHeatmap sections={heatmapData} />
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-3" />
          <Input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="pl-9"
          />
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1 rounded-lg border border-hairline bg-surface p-1">
          <Button
            variant={sortBy === "date" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2 text-[12px]"
            onClick={() => setSortBy("date")}
          >
            Recent
          </Button>
          <Button
            variant={sortBy === "name" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2 text-[12px]"
            onClick={() => setSortBy("name")}
          >
            Name
          </Button>
          <Button
            variant={sortBy === "views" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2 text-[12px]"
            onClick={() => setSortBy("views")}
          >
            Views
          </Button>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-hairline bg-surface p-1">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Documents Grid/List */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-lg bg-surface-2"
            />
          ))}
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-hairline bg-surface-2 p-12 text-center">
          {searchQuery ? (
            <>
              <p className="text-[14px] text-text-2">No documents found</p>
              <p className="mt-1 text-[13px] text-text-3">
                Try adjusting your search query
              </p>
            </>
          ) : (
            <>
              <FolderOpen className="mx-auto h-12 w-12 text-text-3" />
              <p className="mt-4 text-[14px] text-text-2">No documents yet</p>
              <p className="mt-1 text-[13px] text-text-3">
                Link files from Google Drive or upload directly
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                {onLinkDocument && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onLinkDocument}
                  >
                    <Plus className="mr-1.5 h-4 w-4" />
                    Link from Drive
                  </Button>
                )}
                {onUploadDocument && (
                  <Button size="sm" onClick={onUploadDocument}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    Upload
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        <div
          className={cn(
            viewMode === "grid"
              ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              : "space-y-3"
          )}
        >
          {filteredDocuments.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              onView={onViewDocument}
              onEdit={onEditDocument}
              onDelete={onDeleteDocument}
              onSync={onSyncDocument}
            />
          ))}
        </div>
      )}
    </div>
  );
}
