"use client";

/**
 * ComparisonSection - Before/after comparison table editor.
 * Phase 57-05: Custom Sections
 *
 * Features:
 * - Before/after rows (add/remove)
 * - Aspect/feature column
 */

import { type FC } from "react";
import { Scale, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export interface ComparisonItem {
  aspect: string;
  before: string;
  after: string;
}

export interface ComparisonSectionData {
  items: ComparisonItem[];
}

export interface ComparisonSectionProps {
  /** Section data */
  data: ComparisonSectionData;
  /** Callback when data changes */
  onChange: (data: ComparisonSectionData) => void;
  /** Current locale */
  locale?: "en" | "lt";
  /** Whether content is editable */
  editable?: boolean;
}

const labels = {
  en: {
    title: "Comparison Table",
    aspect: "Aspect",
    aspectPlaceholder: "Organic Traffic",
    before: "Before",
    beforePlaceholder: "10,000 visits",
    after: "After",
    afterPlaceholder: "30,000 visits",
    addRow: "Add Row",
    remove: "Remove",
  },
  lt: {
    title: "Palyginimo lentele",
    aspect: "Aspektas",
    aspectPlaceholder: "Organinis srautas",
    before: "Pries",
    beforePlaceholder: "10,000 apsilankymu",
    after: "Po",
    afterPlaceholder: "30,000 apsilankymu",
    addRow: "Prideti eilute",
    remove: "Pasalinti",
  },
};

/**
 * ComparisonSection component.
 *
 * Renders a before/after comparison table editor.
 */
export const ComparisonSection: FC<ComparisonSectionProps> = ({
  data,
  onChange,
  locale = "en",
  editable = true,
}) => {
  const t = labels[locale];

  const handleItemChange = (
    index: number,
    field: keyof ComparisonItem,
    value: string
  ) => {
    const newItems = [...data.items];
    newItems[index] = { ...newItems[index], [field]: value };
    onChange({ items: newItems });
  };

  const addItem = () => {
    onChange({
      items: [...data.items, { aspect: "", before: "", after: "" }],
    });
  };

  const removeItem = (index: number) => {
    const newItems = data.items.filter((_, i) => i !== index);
    onChange({ items: newItems });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Label className="flex items-center gap-2 text-sm">
        <Scale className="h-4 w-4" />
        {t.title}
      </Label>

      {/* Table header */}
      <div
        className={cn(
          "grid grid-cols-[1fr_1fr_1fr_auto] gap-2",
          "px-3 py-2 rounded-t-lg bg-muted text-sm font-medium"
        )}
      >
        <div>{t.aspect}</div>
        <div>{t.before}</div>
        <div>{t.after}</div>
        <div className="w-8" />
      </div>

      {/* Table rows */}
      <div className="space-y-2">
        {data.items.map((item, index) => (
          <div
            key={index}
            className={cn(
              "grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center",
              "px-3 py-2 rounded-lg border border-border bg-background"
            )}
          >
            <Input
              type="text"
              value={item.aspect}
              onChange={(e) => handleItemChange(index, "aspect", e.target.value)}
              placeholder={t.aspectPlaceholder}
              disabled={!editable}
              className="h-8 text-sm"
            />
            <Input
              type="text"
              value={item.before}
              onChange={(e) => handleItemChange(index, "before", e.target.value)}
              placeholder={t.beforePlaceholder}
              disabled={!editable}
              className="h-8 text-sm bg-red-50 dark:bg-red-950/20"
            />
            <Input
              type="text"
              value={item.after}
              onChange={(e) => handleItemChange(index, "after", e.target.value)}
              placeholder={t.afterPlaceholder}
              disabled={!editable}
              className="h-8 text-sm bg-green-50 dark:bg-green-950/20"
            />
            {editable && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeItem(index)}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                aria-label={t.remove}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Add row button */}
      {editable && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addItem}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          {t.addRow}
        </Button>
      )}
    </div>
  );
};

export default ComparisonSection;
