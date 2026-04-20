"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  Button,
  Badge,
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@tevero/ui";
import { MoreHorizontal, Pencil, Trash2, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { GoalIcon } from "./GoalIcon";
import { cn } from "@/lib/utils";
import type { ClientGoalSelect, GoalTemplateSelect } from "@/types/goals";

interface GoalCardProps {
  goal: ClientGoalSelect;
  template: GoalTemplateSelect;
  onEdit: () => void;
  onDelete: () => void;
}

function ProgressBar({ value }: { value: number }) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
      <div
        className={cn(
          "h-full transition-all",
          clamped >= 100 ? "bg-green-500" : clamped >= 80 ? "bg-yellow-500" : "bg-primary",
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function TrendIndicator({
  direction,
  value,
}: {
  direction: string | null;
  value: string | null;
}) {
  if (!direction || direction === "flat") {
    return (
      <span className="flex items-center gap-1 text-muted-foreground">
        <Minus className="h-3 w-3" />
        <span className="text-xs">flat</span>
      </span>
    );
  }

  const numValue = Number(value ?? 0);
  const isUp = direction === "up";

  return (
    <span
      className={cn(
        "flex items-center gap-1",
        isUp ? "text-green-600" : "text-red-600",
      )}
    >
      {isUp ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      <span className="text-xs">
        {isUp ? "+" : ""}
        {numValue.toFixed(1)}
      </span>
    </span>
  );
}

export function GoalCard({ goal, template, onEdit, onDelete }: GoalCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const currentValue = Number(goal.currentValue ?? 0);
  const targetValue = Number(goal.targetValue);
  const attainmentPct = Number(goal.attainmentPct ?? 0);
  const displayName = goal.customName ?? template.name;

  return (
    <Card className={cn(goal.isPrimary && "ring-2 ring-primary")}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-2">
              <GoalIcon
                type={template.goalType}
                className="h-5 w-5 text-muted-foreground"
              />
              {goal.isPrimary && (
                <Badge variant="secondary" className="text-xs">
                  Primary
                </Badge>
              )}
              <h4 className="font-medium">{displayName}</h4>
            </div>

            <div className="space-y-1">
              <ProgressBar value={attainmentPct} />
              <div className="flex items-center justify-between text-sm">
                <span>
                  {currentValue.toLocaleString()} / {targetValue.toLocaleString()}
                  {template.unit && ` ${template.unit}`}
                </span>
                <span
                  className={cn(
                    "font-medium",
                    attainmentPct >= 100
                      ? "text-green-600"
                      : attainmentPct >= 80
                        ? "text-yellow-600"
                        : "text-muted-foreground",
                  )}
                >
                  {attainmentPct.toFixed(0)}%
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">30d trend:</span>
              <TrendIndicator
                direction={goal.trendDirection}
                value={goal.trendValue}
              />
            </div>
          </div>

          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-40 p-1">
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => {
                  setMenuOpen(false);
                  onEdit();
                }}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start text-destructive hover:text-destructive"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </PopoverContent>
          </Popover>
        </div>
      </CardContent>
    </Card>
  );
}
