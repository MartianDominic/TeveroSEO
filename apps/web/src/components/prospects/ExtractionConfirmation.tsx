"use client";

import { useState, useEffect } from "react";

import { AlertCircle, RotateCcw, Check } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import type { ExtractionResult } from "@/stores/prospect-wizard-store";

import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Button,
  Badge,
} from "@tevero/ui";

import { KeywordSelector } from "./KeywordSelector";

const INDUSTRIES = [
  "Technology",
  "E-commerce",
  "Healthcare",
  "Finance",
  "Real Estate",
  "Education",
  "Manufacturing",
  "Professional Services",
  "Hospitality",
  "Other",
];

interface ExtractionConfirmationProps {
  extraction: ExtractionResult;
  onConfirm: (confirmedData: ExtractionResult) => void;
  onReanalyze: (corrections: Partial<ExtractionResult>) => void;
  isSubmitting?: boolean;
}

export function ExtractionConfirmation({
  extraction,
  onConfirm,
  onReanalyze,
  isSubmitting = false,
}: ExtractionConfirmationProps) {
  const t = useTranslations("prospects.wizard.confirmation");

  // Local state for editing
  const [editedData, setEditedData] = useState<ExtractionResult>(extraction);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>(
    extraction.keywords || []
  );
  const [allKeywords, setAllKeywords] = useState<string[]>(
    extraction.keywords || []
  );

  // Sync when extraction changes
  useEffect(() => {
    setEditedData(extraction);
    setSelectedKeywords(extraction.keywords || []);
    setAllKeywords(extraction.keywords || []);
  }, [extraction]);

  const handleFieldChange = (
    field: keyof ExtractionResult,
    value: string | string[]
  ) => {
    setEditedData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddKeyword = (keyword: string) => {
    setAllKeywords((prev) => [...prev, keyword]);
  };

  const handleRemoveKeyword = (keyword: string) => {
    setAllKeywords((prev) => prev.filter((k) => k !== keyword));
  };

  const handleConfirm = () => {
    const confirmedData: ExtractionResult = {
      ...editedData,
      keywords: selectedKeywords,
    };
    onConfirm(confirmedData);
  };

  const handleReanalyze = () => {
    onReanalyze({
      ...editedData,
      keywords: selectedKeywords,
    });
  };

  const confidenceColor =
    extraction.confidence >= 70
      ? "text-success"
      : extraction.confidence >= 50
        ? "text-warning"
        : "text-error";

  return (
    <div className="space-y-[var(--space-5)]">
      {/* Confidence indicator */}
      <div className="flex items-center justify-between p-[var(--space-3)] rounded-[var(--radius-input)] bg-surface-2">
        <div className="flex items-center gap-[var(--space-2)]">
          <AlertCircle className={cn("h-4 w-4", confidenceColor)} />
          <span className="text-[length:var(--type-body)] text-text-2">
            {t("confidenceLabel")}
          </span>
        </div>
        <Badge variant="outline" className={confidenceColor}>
          {extraction.confidence}%
        </Badge>
      </div>

      {/* Low confidence warning */}
      {extraction.confidence < 50 && (
        <div className="p-[var(--space-3)] rounded-[var(--radius-input)] bg-warning/10 border border-warning/20">
          <p className="text-[length:var(--type-small)] text-warning">
            {t("lowConfidenceWarning")}
          </p>
        </div>
      )}

      {/* Editable fields */}
      <div className="space-y-[var(--space-4)]">
        {/* Business Name */}
        <div className="space-y-[var(--space-2)]">
          <Label htmlFor="businessName">{t("businessName")}</Label>
          <Input
            id="businessName"
            value={editedData.businessName || ""}
            onChange={(e) => handleFieldChange("businessName", e.target.value)}
            placeholder={t("businessNamePlaceholder")}
            disabled={isSubmitting}
          />
        </div>

        {/* Industry */}
        <div className="space-y-[var(--space-2)]">
          <Label htmlFor="industry">{t("industry")}</Label>
          <Select
            value={editedData.industry || ""}
            onValueChange={(v) => handleFieldChange("industry", v)}
            disabled={isSubmitting}
          >
            <SelectTrigger id="industry">
              <SelectValue placeholder={t("industryPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {INDUSTRIES.map((industry) => (
                <SelectItem key={industry} value={industry}>
                  {industry}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Services */}
        <div className="space-y-[var(--space-2)]">
          <Label htmlFor="services">{t("services")}</Label>
          <Input
            id="services"
            value={editedData.services?.join(", ") || ""}
            onChange={(e) =>
              handleFieldChange(
                "services",
                e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
              )
            }
            placeholder={t("servicesPlaceholder")}
            disabled={isSubmitting}
          />
          <p className="text-[length:var(--type-tiny)] text-text-3">
            {t("servicesHint")}
          </p>
        </div>

        {/* Target Audience */}
        <div className="space-y-[var(--space-2)]">
          <Label htmlFor="targetAudience">{t("targetAudience")}</Label>
          <Input
            id="targetAudience"
            value={editedData.targetAudience || ""}
            onChange={(e) =>
              handleFieldChange("targetAudience", e.target.value)
            }
            placeholder={t("targetAudiencePlaceholder")}
            disabled={isSubmitting}
          />
        </div>

        {/* Location */}
        <div className="space-y-[var(--space-2)]">
          <Label htmlFor="location">{t("location")}</Label>
          <Input
            id="location"
            value={editedData.location || ""}
            onChange={(e) => handleFieldChange("location", e.target.value)}
            placeholder={t("locationPlaceholder")}
            disabled={isSubmitting}
          />
        </div>

        {/* Keywords */}
        <div className="space-y-[var(--space-2)]">
          <Label>{t("keywords")}</Label>
          <KeywordSelector
            keywords={allKeywords}
            selectedKeywords={selectedKeywords}
            onSelectionChange={setSelectedKeywords}
            onAddKeyword={handleAddKeyword}
            onRemoveKeyword={handleRemoveKeyword}
            disabled={isSubmitting}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-[var(--space-5)] border-t border-[var(--hairline)]">
        <Button
          variant="ghost"
          onClick={handleReanalyze}
          disabled={isSubmitting}
          className="text-text-2"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          {t("reanalyze")}
        </Button>
        <Button onClick={handleConfirm} disabled={isSubmitting}>
          <Check className="h-4 w-4 mr-2" />
          {t("confirmAndContinue")}
        </Button>
      </div>
    </div>
  );
}
