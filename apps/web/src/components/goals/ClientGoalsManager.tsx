"use client";

import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Skeleton,
} from "@tevero/ui";
import { Plus } from "lucide-react";
import {
  useClientGoals,
  useCreateGoal,
  useUpdateGoal,
  useDeleteGoal,
  useGoalTemplates,
} from "@/lib/hooks/useGoals";
import { GoalCard } from "./GoalCard";
import { GoalTemplateSelector } from "./GoalTemplateSelector";
import { GoalConfigForm, type GoalFormValues } from "./GoalConfigForm";

interface ClientGoalsManagerProps {
  clientId: string;
  workspaceId: string;
}

export function ClientGoalsManager({
  clientId,
  workspaceId,
}: ClientGoalsManagerProps) {
  const { data: goals, isLoading } = useClientGoals(clientId);
  const { data: templates } = useGoalTemplates();
  const createGoal = useCreateGoal(clientId);
  const updateGoal = useUpdateGoal(clientId);
  const deleteGoalMutation = useDeleteGoal(clientId);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);

  const existingTemplateIds = goals?.map((g) => g.goal.templateId) ?? [];
  const selectedTemplate = templates?.find((t) => t.id === selectedTemplateId);
  const editingGoal = goals?.find((g) => g.goal.id === editingGoalId);

  const handleCreate = async (values: GoalFormValues) => {
    if (!selectedTemplateId) return;

    await createGoal.mutateAsync({
      templateId: selectedTemplateId,
      workspaceId,
      ...values,
    });

    setIsAddOpen(false);
    setSelectedTemplateId(null);
  };

  const handleUpdate = async (values: GoalFormValues) => {
    if (!editingGoalId) return;

    await updateGoal.mutateAsync({
      goalId: editingGoalId,
      updates: values,
    });

    setEditingGoalId(null);
  };

  const handleDelete = async (goalId: string) => {
    if (confirm("Are you sure you want to delete this goal?")) {
      await deleteGoalMutation.mutateAsync(goalId);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {goals?.map(({ goal, template }) => (
        <GoalCard
          key={goal.id}
          goal={goal}
          template={template}
          onEdit={() => setEditingGoalId(goal.id)}
          onDelete={() => handleDelete(goal.id)}
        />
      ))}

      {goals?.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No goals configured yet.</p>
          <p className="text-sm">Add goals to track progress for this client.</p>
        </div>
      )}

      <Button
        onClick={() => setIsAddOpen(true)}
        variant="outline"
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Goal
      </Button>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Goal</DialogTitle>
          </DialogHeader>

          {!selectedTemplateId ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select a goal type to track for this client:
              </p>
              <GoalTemplateSelector
                value={null}
                onChange={setSelectedTemplateId}
                excludeTemplates={existingTemplateIds}
              />
            </div>
          ) : selectedTemplate ? (
            <GoalConfigForm
              template={selectedTemplate}
              onSubmit={handleCreate}
              onCancel={() => {
                setSelectedTemplateId(null);
                setIsAddOpen(false);
              }}
              isSubmitting={createGoal.isPending}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingGoalId} onOpenChange={() => setEditingGoalId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Goal</DialogTitle>
          </DialogHeader>

          {editingGoal && (
            <GoalConfigForm
              template={editingGoal.template}
              initialValues={editingGoal.goal}
              onSubmit={handleUpdate}
              onCancel={() => setEditingGoalId(null)}
              isSubmitting={updateGoal.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
