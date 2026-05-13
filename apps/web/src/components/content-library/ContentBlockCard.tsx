"use client";

/**
 * Content Block Card Component
 * Phase 101-04: Content Library
 *
 * Displays a single content block with category icon, name, tags,
 * and usage count. Supports one-click insert into documents.
 *
 * UI-SPEC compliance:
 * - Uses v6 design tokens (--surface, --text-*, --shadow-card)
 * - Card hover lifts per design-system-v6
 * - Touch targets >= 44px
 */
import { Card, CardContent, Badge, Button } from "@tevero/ui";
import {
  Plus,
  FileText,
  Scale,
  Users,
  MessageSquare,
  BookOpen,
  HelpCircle,
  Blocks,
} from "lucide-react";

/**
 * Content block data structure matching API response
 */
export interface ContentBlock {
  id: string;
  name: string;
  category: string;
  content: string;
  contentEn?: string;
  contentLt?: string;
  tags: string[];
  usageCount: number;
  lastUsedAt: string | null;
}

interface ContentBlockCardProps {
  /** The content block to display */
  block: ContentBlock;
  /** Callback when the block is inserted */
  onInsert: (block: ContentBlock) => void;
}

/**
 * Category icon mapping per UI-SPEC Component Inventory
 */
const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  case_study: FileText,
  testimonial: MessageSquare,
  pricing_table: Blocks,
  legal_clause: Scale,
  team_bio: Users,
  methodology: BookOpen,
  faq: HelpCircle,
  custom: FileText,
};

/**
 * Category display labels
 */
const categoryLabels: Record<string, string> = {
  case_study: "Case Study",
  testimonial: "Testimonial",
  pricing_table: "Pricing",
  legal_clause: "Legal",
  team_bio: "Team",
  methodology: "Methodology",
  faq: "FAQ",
  custom: "Custom",
};

/**
 * Content block card with category icon, name, tags, usage count,
 * and one-click insert action.
 *
 * @example
 * ```tsx
 * <ContentBlockCard
 *   block={block}
 *   onInsert={(b) => insertContent(b.content)}
 * />
 * ```
 */
export function ContentBlockCard({ block, onInsert }: ContentBlockCardProps) {
  const Icon = categoryIcons[block.category] ?? FileText;

  return (
    <Card
      className="group cursor-pointer"
      onClick={() => onInsert(block)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onInsert(block);
        }
      }}
      aria-label={`Insert ${block.name} content block`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Category Icon */}
          <div className="rounded-lg bg-surface-2 p-2 shrink-0">
            <Icon className="h-4 w-4 text-text-3" aria-hidden="true" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Name */}
            <h3 className="font-medium text-sm text-text-1 truncate">
              {block.name}
            </h3>

            {/* Category badge and usage count */}
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs">
                {categoryLabels[block.category] ?? block.category}
              </Badge>
              <span className="text-xs text-text-3">
                Used {block.usageCount}x
              </span>
            </div>

            {/* Tags */}
            {block.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {block.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {block.tags.length > 3 && (
                  <span className="text-xs text-text-3">
                    +{block.tags.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Insert Button (hover-reveal) */}
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 min-h-[44px] min-w-[44px] opacity-0 group-hover:opacity-100 transition-opacity duration-[160ms] shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onInsert(block);
            }}
            aria-label={`Insert ${block.name}`}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        {/* Content preview */}
        <p className="text-xs text-text-3 mt-3 line-clamp-2">
          {block.content.length > 150
            ? `${block.content.substring(0, 150)}...`
            : block.content}
        </p>
      </CardContent>
    </Card>
  );
}
