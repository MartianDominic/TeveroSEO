"use client";

/**
 * ScenarioSelector - Proposal scenario selection with EntityCard pattern
 * Phase 47-01: Updated with v6 design system compliance
 *
 * Uses v6 color tokens, a11y keyboard navigation, and recommended badge.
 */

import { FileSearch, FileText, Users, Check } from "lucide-react";

import { Card, CardContent } from "@tevero/ui";

import type { ProposalScenario } from "../actions";

interface ScenarioSelectorProps {
  value: ProposalScenario;
  onChange: (scenario: ProposalScenario) => void;
}

interface ScenarioOption {
  id: ProposalScenario;
  title: string;
  description: string;
  icon: React.ReactNode;
  sections: string[];
  recommended?: boolean;
}

const SCENARIOS: ScenarioOption[] = [
  {
    id: "focused",
    title: "Fokusuotas",
    description: "Raktazodziu ir konkurentu analize su ROI projekcija",
    icon: <FileSearch className="h-6 w-6" />,
    sections: [
      "Santrauka",
      "Raktazodziu analize",
      "Konkurentu palyginimas",
      "Puslapiu zemelapiavimas",
      "ROI projekcijos",
      "Investicija",
    ],
    recommended: true,
  },
  {
    id: "full_audit",
    title: "Pilnas auditas",
    description: "Isami dabartines situacijos analize + visa fokusuoto turinys",
    icon: <FileText className="h-6 w-6" />,
    sections: [
      "Santrauka",
      "Dabartine situacija",
      "Raktazodziu analize",
      "Konkurentu palyginimas",
      "Puslapiu zemelapiavimas",
      "ROI projekcijos",
      "Investicija",
    ],
  },
  {
    id: "competitor_only",
    title: "Konkurentu spy",
    description: "Greitas konkurentu palyginimas be issamios analizes",
    icon: <Users className="h-6 w-6" />,
    sections: ["Santrauka", "Konkurentu palyginimas", "Investicija"],
  },
];

export function ScenarioSelector({ value, onChange }: ScenarioSelectorProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {SCENARIOS.map((scenario) => {
        const isSelected = value === scenario.id;

        return (
          <Card
            key={scenario.id}
            className={`cursor-pointer transition-all duration-200 hover:shadow-[var(--shadow-elevated)] ${
              isSelected
                ? "ring-2 ring-[#0f4f3d] bg-[#eaf1ed]"
                : "hover:bg-[#f8f8f3]"
            }`}
            onClick={() => onChange(scenario.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onChange(scenario.id);
              }
            }}
          >
            <CardContent className="p-6">
              {/* Header with icon and selection indicator */}
              <div className="flex items-start justify-between mb-4">
                <div
                  className={`p-2 rounded-lg ${
                    isSelected
                      ? "bg-[#0f4f3d] text-white"
                      : "bg-[#f2f1eb] text-[#54545a]"
                  }`}
                >
                  {scenario.icon}
                </div>
                <div className="flex items-center gap-2">
                  {scenario.recommended && (
                    <span className="text-xs-safe font-medium text-[#0f4f3d] bg-[#eaf1ed] px-2 py-0.5 rounded">
                      Rekomenduojama
                    </span>
                  )}
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-[#0f4f3d] flex items-center justify-center">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                </div>
              </div>

              {/* Title and description - v6 text colors */}
              <h3
                className="text-lg font-semibold mb-1"
                style={{ color: "#14141a" }}
              >
                {scenario.title}
              </h3>
              <p className="text-sm mb-4" style={{ color: "#54545a" }}>
                {scenario.description}
              </p>

              {/* Sections list with v6 styling */}
              <div className="pt-4 border-t" style={{ borderColor: "#f2f1eb" }}>
                <p
                  className="text-xs-safe font-medium uppercase tracking-wider mb-2"
                  style={{ color: "#93939a" }}
                >
                  Iskeltos sekcijos
                </p>
                <ul className="space-y-1">
                  {scenario.sections.slice(0, 4).map((section, i) => (
                    <li
                      key={i}
                      className="text-xs-safe flex items-center gap-1.5"
                      style={{ color: "#54545a" }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: "#0f4f3d" }}
                      />
                      {section}
                    </li>
                  ))}
                  {scenario.sections.length > 4 && (
                    <li className="text-xs-safe" style={{ color: "#93939a" }}>
                      +{scenario.sections.length - 4} daugiau...
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

ScenarioSelector.displayName = "ScenarioSelector";
