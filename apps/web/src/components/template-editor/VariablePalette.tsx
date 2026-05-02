"use client";

/**
 * Variable Palette Component
 * Phase 59-05: Template Editor with Drag-Drop Variables
 *
 * Displays draggable template variables organized by category.
 * Uses collapsible sections for each category.
 */

import { useState, useMemo } from "react";
import { Button, Input } from "@tevero/ui";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { VariableInserter } from "./VariableInserter";

/**
 * Variable categories matching 59-03 AgreementVariableService.
 */
const VARIABLE_CATEGORIES = {
  client: [
    "client.name",
    "client.company",
    "client.email",
    "client.phone",
    "client.address",
  ],
  provider: [
    "provider.name",
    "provider.company",
    "provider.email",
    "provider.phone",
    "provider.address",
  ],
  services: ["services.list", "services.total", "services.breakdown"],
  agreement: ["agreement.date", "agreement.validUntil", "agreement.number"],
  signer: ["signer.name", "signer.email", "signer.role"],
  payment: [
    "payment.amount",
    "payment.currency",
    "payment.dueDate",
    "payment.method",
  ],
} as const;

type VariableCategory = keyof typeof VARIABLE_CATEGORIES;

const CATEGORY_LABELS: Record<VariableCategory, string> = {
  client: "Client",
  provider: "Provider",
  services: "Services",
  agreement: "Agreement",
  signer: "Signer",
  payment: "Payment",
};

const CATEGORY_ICONS: Record<VariableCategory, string> = {
  client: "User",
  provider: "Building2",
  services: "List",
  agreement: "FileText",
  signer: "PenTool",
  payment: "CreditCard",
};

interface VariablePaletteProps {
  onInsert?: (clauseId: string, variable: string, position: number) => void;
}

export function VariablePalette({ onInsert }: VariablePaletteProps) {
  // Start with client and provider categories expanded
  const [expandedCategories, setExpandedCategories] = useState<Set<VariableCategory>>(
    new Set(["client", "provider"])
  );
  const [searchQuery, setSearchQuery] = useState("");

  /**
   * Toggle category expansion state.
   */
  const toggleCategory = (category: VariableCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  /**
   * Filter variables by search query.
   */
  const filteredCategories = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) {
      return VARIABLE_CATEGORIES;
    }

    const result: Partial<Record<VariableCategory, readonly string[]>> = {};
    for (const [category, variables] of Object.entries(VARIABLE_CATEGORIES)) {
      const filtered = variables.filter(
        (v) =>
          v.toLowerCase().includes(query) ||
          CATEGORY_LABELS[category as VariableCategory]
            .toLowerCase()
            .includes(query)
      );
      if (filtered.length > 0) {
        result[category as VariableCategory] = filtered;
      }
    }
    return result as typeof VARIABLE_CATEGORIES;
  }, [searchQuery]);

  const categories = Object.entries(filteredCategories) as [
    VariableCategory,
    readonly string[]
  ][];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-sm mb-1">Variables</h3>
        <p className="text-xs text-muted-foreground">
          Drag to clause or click copy
        </p>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search variables..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8 h-9 text-sm"
        />
      </div>

      {/* Category list */}
      <div className="space-y-2">
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No variables match your search
          </p>
        ) : (
          categories.map(([category, variables]) => {
            const isExpanded = expandedCategories.has(category);
            const variableCount = variables.length;

            return (
              <div
                key={category}
                className="border border-border rounded-md overflow-hidden"
              >
                {/* Category header */}
                <Button
                  variant="ghost"
                  onClick={() => toggleCategory(category)}
                  className="w-full justify-between px-3 py-2 h-auto font-normal hover:bg-muted/50"
                >
                  <span className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    <span className="text-sm font-medium">
                      {CATEGORY_LABELS[category]}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {variableCount}
                  </span>
                </Button>

                {/* Variables list */}
                {isExpanded && (
                  <div className="px-2 pb-2 space-y-1">
                    {variables.map((variable) => (
                      <VariableInserter key={variable} variable={variable} />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Help text */}
      <div className="text-xs text-muted-foreground border-t border-border pt-3">
        <p className="font-medium mb-1">How to use:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Drag a variable to a clause editor</li>
          <li>Or click the copy button to copy</li>
          <li>{"Variables use {{name}} format"}</li>
        </ul>
      </div>
    </div>
  );
}

export default VariablePalette;
