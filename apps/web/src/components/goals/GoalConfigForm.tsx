"use client";

import { useState } from "react";

import type { GoalTemplateSelect, ClientGoalSelect } from "@/types/goals";

import {
  Button,
  Input,
  Label,
  Checkbox,
  Card,
  CardContent,
} from "@tevero/ui";

import { GoalIcon } from "./GoalIcon";

interface GoalConfigFormProps {
  template: GoalTemplateSelect;
  initialValues?: Partial<ClientGoalSelect>;
  onSubmit: (values: GoalFormValues) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export interface GoalFormValues {
  targetValue: number;
  // TODO: Phase 40+ - Re-enable when backend supports these fields
  // targetDenominator?: number;
  // isPrimary: boolean;
  // isClientVisible: boolean;
}

function formatGoalPreview(
  template: GoalTemplateSelect,
  target: number,
): string {
  // Use metric field to determine goal type display
  switch (template.metric) {
    case "organic_clicks":
      return `${target.toLocaleString()} organic clicks`;
    case "avg_position":
      return `Average position ${target}`;
    case "impressions":
      return `${target.toLocaleString()} impressions`;
    case "ctr":
      return `CTR above ${target}%`;
    case "keywords_top_10":
      return `${target} keywords in top 10`;
    case "keywords_top_3":
      return `${target} keywords in top 3`;
    default:
      return `${target} ${template.metric}`;
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
    Number(initialValues?.targetValue) || 10,
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      targetValue,
      // TODO: Phase 40+ - Re-enable when backend supports these fields
      // targetDenominator: undefined,
      // isPrimary: false,
      // isClientVisible: true,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card className="bg-muted">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <GoalIcon type={template.metric} />
            <span>Goal Preview</span>
          </div>
          <p className="text-lg font-medium">
            {formatGoalPreview(template, targetValue)}
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
            step={template.metric === "ctr" ? 0.1 : 1}
            className="w-32"
          />
          <span className="text-muted-foreground">{template.metric}</span>
        </div>
      </div>

      {/* TODO: Phase 40+ - Re-enable denominator and visibility options when backend supports them */}
      {template.description && (
        <p className="text-sm text-muted-foreground">{template.description}</p>
      )}

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
