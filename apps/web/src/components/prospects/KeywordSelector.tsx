"use client";

import { useState } from "react";
import { Checkbox, Input, Button, Badge } from "@tevero/ui";
import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface KeywordSelectorProps {
  keywords: string[];
  selectedKeywords: string[];
  onSelectionChange: (selected: string[]) => void;
  onAddKeyword: (keyword: string) => void;
  onRemoveKeyword: (keyword: string) => void;
  disabled?: boolean;
  className?: string;
}

export function KeywordSelector({
  keywords,
  selectedKeywords,
  onSelectionChange,
  onAddKeyword,
  onRemoveKeyword,
  disabled = false,
  className,
}: KeywordSelectorProps) {
  const t = useTranslations("prospects.wizard.keywords");
  const [newKeyword, setNewKeyword] = useState("");

  const handleToggle = (keyword: string) => {
    if (disabled) return;

    if (selectedKeywords.includes(keyword)) {
      onSelectionChange(selectedKeywords.filter((k) => k !== keyword));
    } else {
      onSelectionChange([...selectedKeywords, keyword]);
    }
  };

  const handleAdd = () => {
    const trimmed = newKeyword.trim().toLowerCase();
    if (trimmed && !keywords.includes(trimmed)) {
      onAddKeyword(trimmed);
      onSelectionChange([...selectedKeywords, trimmed]);
      setNewKeyword("");
    }
  };

  const handleRemove = (keyword: string) => {
    onRemoveKeyword(keyword);
    onSelectionChange(selectedKeywords.filter((k) => k !== keyword));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className={cn("space-y-[var(--space-3)]", className)}>
      {/* Existing keywords with checkboxes */}
      <div className="flex flex-wrap gap-[var(--space-2)]">
        {keywords.map((keyword) => {
          const isSelected = selectedKeywords.includes(keyword);
          return (
            <Badge
              key={keyword}
              variant={isSelected ? "default" : "outline"}
              className={cn(
                "cursor-pointer transition-all",
                "flex items-center gap-[var(--space-1)] pr-1",
                isSelected && "bg-accent text-white",
                !isSelected && "text-text-3 hover:text-text-1",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => handleToggle(keyword)}
                disabled={disabled}
                className="h-3 w-3"
              />
              <span className="text-[length:var(--type-small)]">{keyword}</span>
              <button
                type="button"
                onClick={() => handleRemove(keyword)}
                disabled={disabled}
                className="ml-1 p-0.5 rounded hover:bg-white/20 disabled:opacity-50"
                aria-label={t("remove", { keyword })}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          );
        })}
      </div>

      {/* Add new keyword */}
      <div className="flex gap-[var(--space-2)]">
        <Input
          value={newKeyword}
          onChange={(e) => setNewKeyword(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("addPlaceholder")}
          disabled={disabled}
          className="flex-1 h-8 text-[length:var(--type-small)]"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          disabled={disabled || !newKeyword.trim()}
        >
          <Plus className="h-4 w-4 mr-1" />
          {t("add")}
        </Button>
      </div>

      {/* Selection count */}
      <p className="text-[length:var(--type-tiny)] text-text-3">
        {t("selected", { count: selectedKeywords.length, total: keywords.length })}
      </p>
    </div>
  );
}
