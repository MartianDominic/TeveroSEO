"use client";

/**
 * Content Library Panel Component
 * Phase 101-04: Content Library
 *
 * Slide-over panel for browsing and inserting content blocks.
 * Includes search, category filtering, and one-click insert.
 *
 * UI-SPEC compliance:
 * - Uses Sheet component for slide-over from right
 * - Panel width: 480px (default), 540px on sm+
 * - Search input with icon
 * - Category tabs with v6 styling
 * - Empty state per Copywriting Contract
 */
import { useCallback, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  Input,
  Tabs,
  TabsList,
  TabsTrigger,
  EmptyState,
} from "@tevero/ui";
import { Search, Library, Loader2 } from "lucide-react";
import { useContentLibraryStore } from "@/stores/contentLibraryStore";
import { useContentLibrary } from "./useContentLibrary";
import { ContentBlockCard, type ContentBlock } from "./ContentBlockCard";
import { useDebounce } from "@/hooks/useDebounce";

/**
 * Category options for filtering
 * "all" shows all categories
 */
const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "case_study", label: "Case Studies" },
  { value: "testimonial", label: "Testimonials" },
  { value: "pricing_table", label: "Pricing" },
  { value: "legal_clause", label: "Legal" },
  { value: "team_bio", label: "Team" },
  { value: "methodology", label: "Methodology" },
  { value: "faq", label: "FAQ" },
] as const;

interface ContentLibraryPanelProps {
  /** Type of entity the content will be inserted into */
  entityType: "proposal" | "contract" | "document";
  /** ID of the entity */
  entityId: string;
  /** Callback when content is inserted */
  onInsert: (content: string) => void;
}

/**
 * Content Library Panel - slide-over for browsing and inserting content blocks
 *
 * @example
 * ```tsx
 * // In ProposalBuilder.tsx
 * <ContentLibraryPanel
 *   entityType="proposal"
 *   entityId={proposalId}
 *   onInsert={(content) => editor.insertContent(content)}
 * />
 * ```
 */
export function ContentLibraryPanel({
  entityType,
  entityId,
  onInsert,
}: ContentLibraryPanelProps) {
  const {
    isOpen,
    close,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    isLoading,
  } = useContentLibraryStore();

  const { blocks, recordUsage, refetch } = useContentLibrary();

  // Debounce search query to avoid excessive API calls
  const debouncedQuery = useDebounce(searchQuery, 300);

  // Refetch when debounced query or category changes
  useEffect(() => {
    if (isOpen) {
      refetch();
    }
  }, [isOpen, debouncedQuery, selectedCategory, refetch]);

  /**
   * Handle block insertion:
   * 1. Call onInsert with block content
   * 2. Record usage for analytics
   * 3. Close panel
   */
  const handleInsert = useCallback(
    (block: ContentBlock) => {
      onInsert(block.content);
      recordUsage({ blockId: block.id, entityType, entityId });
      close();
    },
    [onInsert, recordUsage, entityType, entityId, close]
  );

  /**
   * Handle category change
   * "all" means no category filter
   */
  const handleCategoryChange = useCallback(
    (value: string) => {
      setSelectedCategory(value === "all" ? null : value);
    },
    [setSelectedCategory]
  );

  // Filter blocks by selected category (client-side for instant feedback)
  const filteredBlocks =
    selectedCategory && selectedCategory !== "all"
      ? blocks.filter((b) => b.category === selectedCategory)
      : blocks;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
      <SheetContent
        className="w-[480px] sm:w-[540px] flex flex-col"
        aria-describedby="content-library-description"
      >
        <SheetHeader>
          <div className="flex items-center gap-2">
            <Library className="h-5 w-5 text-text-2" aria-hidden="true" />
            <SheetTitle>Content Library</SheetTitle>
          </div>
          <SheetDescription id="content-library-description">
            Browse and insert reusable content blocks into your document.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex flex-col gap-4 flex-1 min-h-0">
          {/* Search Input */}
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-3"
              aria-hidden="true"
            />
            <Input
              placeholder="Search blocks..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search content blocks"
            />
          </div>

          {/* Category Tabs */}
          <Tabs
            value={selectedCategory ?? "all"}
            onValueChange={handleCategoryChange}
          >
            <TabsList className="flex flex-wrap h-auto gap-1 bg-surface-2 p-1">
              {CATEGORIES.map((cat) => (
                <TabsTrigger
                  key={cat.value}
                  value={cat.value}
                  className="text-xs px-2 py-1.5"
                >
                  {cat.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Block List */}
          <div
            className="flex-1 overflow-y-auto space-y-3 pb-4"
            role="list"
            aria-label="Content blocks"
          >
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2
                  className="h-6 w-6 animate-spin text-text-3"
                  aria-label="Loading content blocks"
                />
              </div>
            ) : filteredBlocks.length === 0 ? (
              <EmptyState
                icon={Library}
                title="Build your library"
                description="Add reusable blocks like case studies, testimonials, and pricing tables."
              />
            ) : (
              filteredBlocks.map((block) => (
                <div key={block.id} role="listitem">
                  <ContentBlockCard block={block} onInsert={handleInsert} />
                </div>
              ))
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
