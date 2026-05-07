/**
 * Tag Filter Component
 * Phase 96-02: Master Dashboard
 *
 * Multi-select dropdown for filtering by tags.
 * Design System v6: Badge component for selected tags.
 */
import { useState } from 'react';
import { Badge } from '@/client/components/ui/badge';

interface TagFilterProps {
  tags: Array<{ name: string; count: number }>;
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function TagFilter({ tags, selected, onChange }: TagFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleTag = (tagName: string) => {
    if (selected.includes(tagName)) {
      onChange(selected.filter((t) => t !== tagName));
    } else {
      onChange([...selected, tagName]);
    }
  };

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-2 bg-surface shadow-card rounded-lg text-[14px] font-medium hover:shadow-pop transition-shadow"
      >
        Tags {selected.length > 0 && `(${selected.length})`}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 mt-2 w-64 bg-surface shadow-lift rounded-lg border border-hairline z-20 max-h-96 overflow-y-auto">
            <div className="p-3 space-y-2">
              {tags.map((tag) => (
                <label
                  key={tag.name}
                  className="flex items-center gap-3 p-2 hover:bg-surface-2 rounded-md cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(tag.name)}
                    onChange={() => toggleTag(tag.name)}
                    className="w-4 h-4"
                  />
                  <span className="flex-1 text-[14px]">{tag.name}</span>
                  <span className="text-[12px] text-text-3 tabular-nums">
                    {tag.count}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Selected tags display */}
      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {selected.map((tag) => (
            <Badge
              key={tag}
              variant="default"
              className="cursor-pointer"
              onClick={() => toggleTag(tag)}
            >
              {tag} ×
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
