"use client";

/**
 * ScoreWeightEditor Component
 * Phase 43-04: Prioritization Engine + UI
 *
 * Power user control for customizing scoring weights.
 */

import { useState } from "react";

import { Settings } from "lucide-react";

import { Button, Card, CardContent, CardHeader, CardTitle, Slider } from "@tevero/ui";

import type { ScoreWeights } from "../actions";

interface ScoreWeightEditorProps {
  weights: ScoreWeights;
  onChange: (weights: ScoreWeights) => void;
  onApply: () => void;
  isApplying?: boolean;
}

const WEIGHT_LABELS: Record<keyof ScoreWeights, { label: string; description: string }> = {
  volume: {
    label: "Search Volume",
    description: "Weight for monthly search volume",
  },
  competition: {
    label: "Competition",
    description: "Weight for competitive difficulty (lower is better)",
  },
  relevance: {
    label: "Relevance",
    description: "Weight for topic/product relevance",
  },
  focus: {
    label: "Business Focus",
    description: "Weight for business priority alignment",
  },
  position: {
    label: "Current Position",
    description: "Weight for ranking opportunity",
  },
};

export function ScoreWeightEditor({
  weights,
  onChange,
  onApply,
  isApplying = false,
}: ScoreWeightEditorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleChange = (key: keyof ScoreWeights, value: number[]) => {
    onChange({ ...weights, [key]: value[0] / 100 });
  };

  const total = Object.values(weights).reduce((sum, v) => sum + v, 0);
  const isValid = Math.abs(total - 1) < 0.01;

  if (!isOpen) {
    return (
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        <Settings className="h-4 w-4 mr-2" />
        Customize Weights
      </Button>
    );
  }

  return (
    <Card className="w-80 shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          Score Weights
          <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
            Close
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {(Object.keys(weights) as (keyof ScoreWeights)[]).map((key) => (
          <div key={key}>
            <div className="flex justify-between text-sm mb-1">
              <span title={WEIGHT_LABELS[key].description}>
                {WEIGHT_LABELS[key].label}
              </span>
              <span className="font-mono text-text-3">
                {(weights[key] * 100).toFixed(0)}%
              </span>
            </div>
            <Slider
              value={[weights[key] * 100]}
              onValueChange={(v) => handleChange(key, v)}
              max={100}
              step={5}
            />
          </div>
        ))}

        <div
          className={`text-[12px] p-2 rounded-[var(--radius-input)] ${
            isValid
              ? "bg-success-soft text-success"
              : "bg-error-soft text-error"
          }`}
        >
          Total: {(total * 100).toFixed(0)}%{" "}
          {isValid ? "(valid)" : "(must equal 100%)"}
        </div>

        <Button
          onClick={onApply}
          disabled={!isValid || isApplying}
          className="w-full"
        >
          {isApplying ? "Applying..." : "Apply Weights & Re-prioritize"}
        </Button>
      </CardContent>
    </Card>
  );
}
