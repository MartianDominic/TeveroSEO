"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@tevero/ui";
import { Skeleton } from "@tevero/ui";
import { useGoalTemplates } from "@/lib/hooks/useGoals";
import { GoalIcon } from "./GoalIcon";

interface GoalTemplateSelectorProps {
  value: string | null;
  onChange: (templateId: string) => void;
  excludeTemplates?: string[];
  disabled?: boolean;
}

export function GoalTemplateSelector({
  value,
  onChange,
  excludeTemplates = [],
  disabled,
}: GoalTemplateSelectorProps) {
  const { data: templates, isLoading } = useGoalTemplates();

  if (isLoading) {
    return <Skeleton className="h-10 w-full" />;
  }

  const available = templates?.filter(
    (t) => !excludeTemplates.includes(t.id) || t.goalType === "custom",
  );

  return (
    <Select
      value={value ?? undefined}
      onValueChange={onChange}
      disabled={disabled}
    >
      <SelectTrigger>
        <SelectValue placeholder="Select a goal type..." />
      </SelectTrigger>
      <SelectContent>
        {available?.map((template) => (
          <SelectItem key={template.id} value={template.id}>
            <div className="flex items-center gap-2">
              <GoalIcon type={template.goalType} />
              <span>{template.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
