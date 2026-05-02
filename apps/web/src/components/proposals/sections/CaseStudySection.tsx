"use client";

/**
 * CaseStudySection - Mini case study section editor.
 * Phase 57-05: Custom Sections
 *
 * Features:
 * - Title input
 * - Metric cards (add/remove)
 * - Description textarea
 */

import { type FC } from "react";
import { FileText, TrendingUp, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label, Textarea } from "@tevero/ui";
import { Button } from "@/components/ui/button";

export interface CaseStudyMetric {
  label: string;
  value: string;
  change?: string;
}

export interface CaseStudySectionData {
  title: string;
  metrics: CaseStudyMetric[];
  description: string;
}

export interface CaseStudySectionProps {
  /** Section data */
  data: CaseStudySectionData;
  /** Callback when data changes */
  onChange: (data: CaseStudySectionData) => void;
  /** Current locale */
  locale?: "en" | "lt";
  /** Whether content is editable */
  editable?: boolean;
}

const labels = {
  en: {
    title: "Case Study Title",
    titlePlaceholder: "How we increased traffic by 200%",
    metrics: "Key Metrics",
    metricLabel: "Metric",
    metricLabelPlaceholder: "Organic Traffic",
    metricValue: "Value",
    metricValuePlaceholder: "+200%",
    metricChange: "Change",
    metricChangePlaceholder: "from 10k to 30k",
    addMetric: "Add Metric",
    description: "Description",
    descriptionPlaceholder: "Describe the case study results...",
    remove: "Remove",
  },
  lt: {
    title: "Atvejo studijos pavadinimas",
    titlePlaceholder: "Kaip padidinome srautus 200%",
    metrics: "Pagrindiniai rodikliai",
    metricLabel: "Rodiklis",
    metricLabelPlaceholder: "Organinis srautas",
    metricValue: "Reiksme",
    metricValuePlaceholder: "+200%",
    metricChange: "Pokytis",
    metricChangePlaceholder: "nuo 10k iki 30k",
    addMetric: "Prideti rodikli",
    description: "Aprasymas",
    descriptionPlaceholder: "Aprasykite atvejo studijos rezultatus...",
    remove: "Pasalinti",
  },
};

/**
 * CaseStudySection component.
 *
 * Renders a case study editor with title, metrics, and description.
 */
export const CaseStudySection: FC<CaseStudySectionProps> = ({
  data,
  onChange,
  locale = "en",
  editable = true,
}) => {
  const t = labels[locale];

  const handleTitleChange = (title: string) => {
    onChange({ ...data, title });
  };

  const handleDescriptionChange = (description: string) => {
    onChange({ ...data, description });
  };

  const handleMetricChange = (
    index: number,
    field: keyof CaseStudyMetric,
    value: string
  ) => {
    const newMetrics = [...data.metrics];
    newMetrics[index] = { ...newMetrics[index], [field]: value };
    onChange({ ...data, metrics: newMetrics });
  };

  const addMetric = () => {
    onChange({
      ...data,
      metrics: [...data.metrics, { label: "", value: "", change: "" }],
    });
  };

  const removeMetric = (index: number) => {
    const newMetrics = data.metrics.filter((_, i) => i !== index);
    onChange({ ...data, metrics: newMetrics });
  };

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="case-title" className="flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4" />
          {t.title}
        </Label>
        <Input
          id="case-title"
          type="text"
          value={data.title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder={t.titlePlaceholder}
          disabled={!editable}
        />
      </div>

      {/* Metrics */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2 text-sm">
          <TrendingUp className="h-4 w-4" />
          {t.metrics}
        </Label>

        {/* Metric cards */}
        <div className="space-y-2">
          {data.metrics.map((metric, index) => (
            <div
              key={index}
              className={cn(
                "grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end",
                "p-3 rounded-lg border border-border bg-muted/20"
              )}
            >
              <div className="space-y-1">
                <Label className="text-xs">{t.metricLabel}</Label>
                <Input
                  type="text"
                  value={metric.label}
                  onChange={(e) =>
                    handleMetricChange(index, "label", e.target.value)
                  }
                  placeholder={t.metricLabelPlaceholder}
                  disabled={!editable}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t.metricValue}</Label>
                <Input
                  type="text"
                  value={metric.value}
                  onChange={(e) =>
                    handleMetricChange(index, "value", e.target.value)
                  }
                  placeholder={t.metricValuePlaceholder}
                  disabled={!editable}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t.metricChange}</Label>
                <Input
                  type="text"
                  value={metric.change || ""}
                  onChange={(e) =>
                    handleMetricChange(index, "change", e.target.value)
                  }
                  placeholder={t.metricChangePlaceholder}
                  disabled={!editable}
                  className="h-8 text-sm"
                />
              </div>
              {editable && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMetric(index)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  aria-label={t.remove}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {editable && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addMetric}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            {t.addMetric}
          </Button>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="case-description" className="text-sm">
          {t.description}
        </Label>
        <Textarea
          id="case-description"
          value={data.description}
          onChange={(e) => handleDescriptionChange(e.target.value)}
          placeholder={t.descriptionPlaceholder}
          disabled={!editable}
          rows={4}
        />
      </div>
    </div>
  );
};

export default CaseStudySection;
