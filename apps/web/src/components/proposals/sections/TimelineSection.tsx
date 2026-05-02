"use client";

/**
 * TimelineSection - Project phases timeline editor.
 * Phase 57-05: Custom Sections
 *
 * Features:
 * - Phase cards (add/remove)
 * - Title, duration, description for each phase
 */

import { type FC } from "react";
import { Clock, Plus, Trash2, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label, Textarea } from "@tevero/ui";
import { Button } from "@/components/ui/button";

export interface TimelinePhase {
  title: string;
  duration: string;
  description: string;
}

export interface TimelineSectionData {
  phases: TimelinePhase[];
}

export interface TimelineSectionProps {
  /** Section data */
  data: TimelineSectionData;
  /** Callback when data changes */
  onChange: (data: TimelineSectionData) => void;
  /** Current locale */
  locale?: "en" | "lt";
  /** Whether content is editable */
  editable?: boolean;
}

const labels = {
  en: {
    title: "Project Timeline",
    phaseTitle: "Phase Title",
    phaseTitlePlaceholder: "Discovery & Audit",
    duration: "Duration",
    durationPlaceholder: "2 weeks",
    description: "Description",
    descriptionPlaceholder: "What happens in this phase...",
    addPhase: "Add Phase",
    remove: "Remove",
    phase: "Phase",
  },
  lt: {
    title: "Projekto laiko juosta",
    phaseTitle: "Etapo pavadinimas",
    phaseTitlePlaceholder: "Tyrimai ir auditas",
    duration: "Trukme",
    durationPlaceholder: "2 savaites",
    description: "Aprasymas",
    descriptionPlaceholder: "Kas vyksta siame etape...",
    addPhase: "Prideti etapa",
    remove: "Pasalinti",
    phase: "Etapas",
  },
};

/**
 * TimelineSection component.
 *
 * Renders a timeline editor with phase cards.
 */
export const TimelineSection: FC<TimelineSectionProps> = ({
  data,
  onChange,
  locale = "en",
  editable = true,
}) => {
  const t = labels[locale];

  const handlePhaseChange = (
    index: number,
    field: keyof TimelinePhase,
    value: string
  ) => {
    const newPhases = [...data.phases];
    newPhases[index] = { ...newPhases[index], [field]: value };
    onChange({ phases: newPhases });
  };

  const addPhase = () => {
    onChange({
      phases: [...data.phases, { title: "", duration: "", description: "" }],
    });
  };

  const removePhase = (index: number) => {
    const newPhases = data.phases.filter((_, i) => i !== index);
    onChange({ phases: newPhases });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Label className="flex items-center gap-2 text-sm">
        <Clock className="h-4 w-4" />
        {t.title}
      </Label>

      {/* Timeline phases */}
      <div className="relative space-y-4 pl-6">
        {/* Vertical line */}
        <div
          className={cn(
            "absolute left-2 top-2 bottom-2 w-0.5",
            "bg-gradient-to-b from-primary via-primary/50 to-transparent"
          )}
        />

        {data.phases.map((phase, index) => (
          <div key={index} className="relative">
            {/* Phase dot */}
            <div
              className={cn(
                "absolute -left-6 top-4 h-4 w-4 rounded-full",
                "bg-primary border-2 border-background shadow-sm"
              )}
            />

            {/* Phase card */}
            <div
              className={cn(
                "rounded-lg border border-border bg-background p-4",
                "space-y-3"
              )}
            >
              {/* Phase header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <GripVertical className="h-3 w-3" />
                  {t.phase} {index + 1}
                </div>
                {editable && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removePhase(index)}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    aria-label={t.remove}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>

              {/* Title and duration row */}
              <div className="grid grid-cols-[2fr_1fr] gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">{t.phaseTitle}</Label>
                  <Input
                    type="text"
                    value={phase.title}
                    onChange={(e) =>
                      handlePhaseChange(index, "title", e.target.value)
                    }
                    placeholder={t.phaseTitlePlaceholder}
                    disabled={!editable}
                    className="h-8 text-sm font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t.duration}</Label>
                  <Input
                    type="text"
                    value={phase.duration}
                    onChange={(e) =>
                      handlePhaseChange(index, "duration", e.target.value)
                    }
                    placeholder={t.durationPlaceholder}
                    disabled={!editable}
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <Label className="text-xs">{t.description}</Label>
                <Textarea
                  value={phase.description}
                  onChange={(e) =>
                    handlePhaseChange(index, "description", e.target.value)
                  }
                  placeholder={t.descriptionPlaceholder}
                  disabled={!editable}
                  rows={2}
                  className="text-sm"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add phase button */}
      {editable && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addPhase}
          className="gap-2 ml-6"
        >
          <Plus className="h-4 w-4" />
          {t.addPhase}
        </Button>
      )}
    </div>
  );
};

export default TimelineSection;
