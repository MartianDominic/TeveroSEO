"use client";

import { useState } from "react";
import {
  Button,
  Input,
  Label,
  Checkbox,
  Card,
  CardContent,
} from "@tevero/ui";
import { GoalIcon } from "./GoalIcon";
import type { GoalTemplateSelect, ClientGoalSelect } from "@/types/goals";

interface GoalConfigFormProps {
  template: GoalTemplateSelect;
  initialValues?: Partial<ClientGoalSelect>;
  onSubmit: (values: GoalFormValues) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export interface GoalFormValues {
  targetValue: number;
  targetDenominator?: number;
  isPrimary: boolean;
  isClientVisible: boolean;
}

function formatGoalPreview(
  template: GoalTemplateSelect,
  target: number,
  denominator?: number,
): string {
  switch (template.goalType) {
    case "keywords_top_10":
      return denominator
        ? `${target} of ${denominator} keywords in top 10`
        : `${target} keywords in top 10`;
    case "keywords_top_3":
      return denominator
        ? `${target} of ${denominator} keywords in top 3`
        : `${target} keywords in top 3`;
    case "keywords_position_1":
      return `${target} keywords at #1`;
    case "weekly_clicks":
      return `${target.toLocaleString()} clicks per week`;
    case "monthly_clicks":
      return `${target.toLocaleString()} clicks per month`;
    case "ctr_target":
      return `CTR above ${target}%`;
    case "traffic_growth":
      return `${target}% MoM traffic growth`;
    case "impressions_target":
      return `${target.toLocaleString()} impressions per month`;
    default:
      return `${target} ${template.unit ?? ""}`;
  }
}

export function GoalConfigForm({
  template,
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting,
}: GoalConfigFormProps) {
  const [targetValue, setTargetValue] = useState(
    Number(initialValues?.targetValue) || Number(template.defaultTarget) || 10,
  );
  const [denominator, setDenominator] = useState<number | undefined>(
    initialValues?.targetDenominator ?? undefined,
  );
  const [isPrimary, setIsPrimary] = useState(initialValues?.isPrimary ?? false);
  const [isClientVisible, setIsClientVisible] = useState(
    initialValues?.isClientVisible ?? true,
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      targetValue,
      targetDenominator: denominator,
      isPrimary,
      isClientVisible,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card className="bg-muted">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <GoalIcon type={template.goalType} />
            <span>Goal Preview</span>
          </div>
          <p className="text-lg font-medium">
            {formatGoalPreview(template, targetValue, denominator)}
          </p>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Label htmlFor="targetValue">Target Value</Label>
        <div className="flex items-center gap-2">
          <Input
            id="targetValue"
            type="number"
            value={targetValue}
            onChange={(e) => setTargetValue(Number(e.target.value))}
            min={0}
            step={template.goalType === "ctr_target" ? 0.1 : 1}
            className="w-32"
          />
          {template.unit && (
            <span className="text-muted-foreground">{template.unit}</span>
          )}
        </div>
      </div>

      {template.hasDenominator && (
        <div className="space-y-2">
          <Label htmlFor="denominator">Out of (total tracked)</Label>
          <Input
            id="denominator"
            type="number"
            value={denominator ?? ""}
            onChange={(e) =>
              setDenominator(e.target.value ? Number(e.target.value) : undefined)
            }
            placeholder="e.g., 100 keywords"
            min={1}
            className="w-48"
          />
          <p className="text-xs text-muted-foreground">
            Optional: helps show progress like &ldquo;7 of 100 keywords&rdquo;
          </p>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="isPrimary"
            checked={isPrimary}
            onCheckedChange={(checked) => setIsPrimary(checked === true)}
          />
          <Label htmlFor="isPrimary" className="font-normal">
            Set as primary goal (highlighted on dashboard)
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="isClientVisible"
            checked={isClientVisible}
            onCheckedChange={(checked) => setIsClientVisible(checked === true)}
          />
          <Label htmlFor="isClientVisible" className="font-normal">
            Show in client reports
          </Label>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Goal"}
        </Button>
      </div>
    </form>
  );
}
