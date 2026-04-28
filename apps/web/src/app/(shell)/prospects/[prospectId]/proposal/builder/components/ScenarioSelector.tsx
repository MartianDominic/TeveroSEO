"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from "@tevero/ui";
import { Target, FileSearch, Users } from "lucide-react";
import type { ProposalScenario } from "../actions";

interface ScenarioSelectorProps {
  value: ProposalScenario;
  onChange: (scenario: ProposalScenario) => void;
}

const scenarios: {
  id: ProposalScenario;
  title: string;
  description: string;
  icon: typeof Target;
  sections: string[];
}[] = [
  {
    id: "focused",
    title: "Focused SEO",
    description: "Quick wins and prioritized keywords only",
    icon: Target,
    sections: [
      "Executive Summary",
      "Quick Wins Analysis",
      "Priority Keywords",
      "Investment",
      "Agreement",
    ],
  },
  {
    id: "full_audit",
    title: "Full Audit",
    description: "Complete technical + content analysis",
    icon: FileSearch,
    sections: [
      "Executive Summary",
      "Current State Analysis",
      "Technical Issues",
      "Keyword Analysis",
      "Competitor Comparison",
      "Page Mapping",
      "ROI Projections",
      "Investment",
      "Agreement",
    ],
  },
  {
    id: "competitor_only",
    title: "Competitor Intelligence",
    description: "Focus on competitor gap analysis",
    icon: Users,
    sections: [
      "Executive Summary",
      "Competitor Landscape",
      "Gap Analysis",
      "Opportunity Keywords",
      "Investment",
      "Agreement",
    ],
  },
];

export function ScenarioSelector({ value, onChange }: ScenarioSelectorProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {scenarios.map((scenario) => {
        const Icon = scenario.icon;
        const isSelected = value === scenario.id;

        return (
          <Card
            key={scenario.id}
            className={cn(
              "cursor-pointer transition-all hover:border-primary/50",
              isSelected && "border-primary ring-2 ring-primary/20"
            )}
            onClick={() => onChange(scenario.id)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "rounded-md p-2",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <CardTitle className="text-base">{scenario.title}</CardTitle>
              </div>
              <CardDescription>{scenario.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-1">Includes:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {scenario.sections.slice(0, 4).map((section) => (
                    <li key={section} className="text-xs">
                      {section}
                    </li>
                  ))}
                  {scenario.sections.length > 4 && (
                    <li className="text-xs text-muted-foreground/70">
                      +{scenario.sections.length - 4} more sections
                    </li>
                  )}
                </ul>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
