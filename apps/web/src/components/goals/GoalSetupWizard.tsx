"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Checkbox,
} from "@tevero/ui";
import { useGoalTemplates, useCreateGoal } from "@/lib/hooks/useGoals";
import { GoalIcon } from "./GoalIcon";
import { cn } from "@/lib/utils";
import type { GoalTemplateSelect } from "@/types/goals";

interface GoalSetupWizardProps {
  clientId: string;
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

interface GoalConfig {
  templateId: string;
  targetValue: number;
  targetDenominator?: number;
}

export function GoalSetupWizard({
  clientId,
  workspaceId,
  open,
  onOpenChange,
  onComplete,
}: GoalSetupWizardProps) {
  const { data: templates } = useGoalTemplates();
  const createGoal = useCreateGoal(clientId);

  const [step, setStep] = useState<"select" | "configure">("select");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [configs, setConfigs] = useState<Record<string, GoalConfig>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedTemplates =
    templates?.filter((t) => selectedIds.includes(t.id)) ?? [];

  const toggleTemplate = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const updateConfig = (templateId: string, updates: Partial<GoalConfig>) => {
    setConfigs((prev) => ({
      ...prev,
      [templateId]: { ...prev[templateId], ...updates, templateId },
    }));
  };

  const handleSaveAll = async () => {
    setIsSubmitting(true);
    try {
      for (let i = 0; i < selectedIds.length; i++) {
        const templateId = selectedIds[i];
        const config = configs[templateId];
        const template = templates?.find((t) => t.id === templateId);

        await createGoal.mutateAsync({
          templateId,
          targetValue:
            config?.targetValue ?? Number(template?.defaultTarget) ?? 10,
          targetDenominator: config?.targetDenominator,
          isPrimary: i === 0,
          workspaceId,
        });
      }
      onComplete();
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Set Up Client Goals</DialogTitle>
          <DialogDescription>
            Select which goals to track for this client and set target values.
          </DialogDescription>
        </DialogHeader>

        {step === "select" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {templates
                ?.filter((t) => t.goalType !== "custom")
                .map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    selected={selectedIds.includes(template.id)}
                    onToggle={() => toggleTemplate(template.id)}
                  />
                ))}
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Skip for now
              </Button>
              <Button
                onClick={() => setStep("configure")}
                disabled={selectedIds.length === 0}
              >
                Configure Selected ({selectedIds.length})
              </Button>
            </div>
          </div>
        )}

        {step === "configure" && (
          <div className="space-y-6">
            {selectedTemplates.map((template, index) => (
              <QuickConfigCard
                key={template.id}
                template={template}
                config={configs[template.id]}
                onChange={(updates) => updateConfig(template.id, updates)}
                isPrimary={index === 0}
              />
            ))}

            <div className="flex justify-between pt-4">
              <Button variant="ghost" onClick={() => setStep("select")}>
                Back
              </Button>
              <Button onClick={handleSaveAll} disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save All Goals"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TemplateCard({
  template,
  selected,
  onToggle,
}: {
  template: GoalTemplateSelect;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <Card
      className={cn(
        "cursor-pointer transition-all",
        selected && "ring-2 ring-primary",
      )}
      onClick={onToggle}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Checkbox checked={selected} className="mt-1" />
          <div>
            <div className="flex items-center gap-2">
              <GoalIcon type={template.goalType} />
              <span className="font-medium">{template.name}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {template.description}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickConfigCard({
  template,
  config,
  onChange,
  isPrimary,
}: {
  template: GoalTemplateSelect;
  config?: GoalConfig;
  onChange: (updates: Partial<GoalConfig>) => void;
  isPrimary: boolean;
}) {
  const targetValue =
    config?.targetValue ?? Number(template.defaultTarget) ?? 10;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <GoalIcon type={template.goalType} />
          <span className="font-medium">{template.name}</span>
          {isPrimary && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
              Primary
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label className="text-sm">Target:</Label>
            <Input
              type="number"
              value={targetValue}
              onChange={(e) => onChange({ targetValue: Number(e.target.value) })}
              className="w-24"
              min={0}
            />
            {template.unit && (
              <span className="text-sm text-muted-foreground">
                {template.unit}
              </span>
            )}
          </div>

          {template.hasDenominator && (
            <div className="flex items-center gap-2">
              <Label className="text-sm">out of</Label>
              <Input
                type="number"
                value={config?.targetDenominator ?? ""}
                onChange={(e) =>
                  onChange({
                    targetDenominator: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
                className="w-24"
                placeholder="total"
                min={1}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
