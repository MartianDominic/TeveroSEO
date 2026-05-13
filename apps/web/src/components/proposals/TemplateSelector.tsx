"use client";

/**
 * TemplateSelector Component
 * Phase 101-06: Tiered AI Proposal Generation
 *
 * Displays available proposal templates with their packages.
 * Uses RadioGroup for single template selection.
 * Works in conjunction with ProposalModeSelector for TEMPLATE_MANUAL mode.
 */

import * as React from "react";
import { Check, FileText, Package, Star, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Template type from proposal-template-schema
 */
export interface ProposalTemplate {
  id: string;
  name: string;
  nameEn?: string | null;
  nameLt?: string | null;
  description?: string | null;
  descriptionEn?: string | null;
  descriptionLt?: string | null;
  type: "proposal" | "case_study" | "report";
  category: "seo" | "local_seo" | "ecommerce" | "enterprise" | "custom";
  isDefault: boolean;
  isPublished: boolean;
  /** Packages attached to this template (from template.packages JSONB field) */
  packages?: TemplatePackage[];
}

/**
 * Package definition within a template
 */
export interface TemplatePackage {
  id: string;
  name: string;
  description?: string;
  setupFee: number;
  monthlyFee: number;
  inclusions: string[];
  isRecommended?: boolean;
}

/**
 * Props for TemplateSelector
 */
interface TemplateSelectorProps {
  /** Available templates to display */
  templates: ProposalTemplate[];
  /** Currently selected template ID */
  selectedTemplateId: string | null;
  /** Called when template selection changes */
  onTemplateSelect: (templateId: string) => void;
  /** Currently selected package ID */
  selectedPackageId: string | null;
  /** Called when package selection changes */
  onPackageSelect: (packageId: string) => void;
  /** Locale for localized names */
  locale?: "en" | "lt";
  /** Currency for price formatting */
  currency?: string;
  /** Whether selection is disabled */
  disabled?: boolean;
  /** Loading state */
  isLoading?: boolean;
  /** Custom className */
  className?: string;
}

/**
 * Category badge component
 */
function CategoryBadge({ category }: { category: ProposalTemplate["category"] }) {
  const labels: Record<typeof category, string> = {
    seo: "SEO",
    local_seo: "Local SEO",
    ecommerce: "E-commerce",
    enterprise: "Enterprise",
    custom: "Custom",
  };

  const variants: Record<typeof category, "default" | "info" | "warning" | "muted"> = {
    seo: "default",
    local_seo: "info",
    ecommerce: "warning",
    enterprise: "default",
    custom: "muted",
  };

  return (
    <Badge variant={variants[category]} className="text-[10px]">
      {labels[category]}
    </Badge>
  );
}

/**
 * TemplateSelector Component
 *
 * Two-level selection:
 * 1. Template selection (RadioGroup of template cards)
 * 2. Package selection within selected template (RadioGroup of package cards)
 */
export function TemplateSelector({
  templates,
  selectedTemplateId,
  onTemplateSelect,
  selectedPackageId,
  onPackageSelect,
  locale = "en",
  currency = "EUR",
  disabled = false,
  isLoading = false,
  className,
}: TemplateSelectorProps) {
  /**
   * Get localized name for template
   */
  const getTemplateName = (template: ProposalTemplate) => {
    if (locale === "lt" && template.nameLt) return template.nameLt;
    if (locale === "en" && template.nameEn) return template.nameEn;
    return template.name;
  };

  /**
   * Get localized description for template
   */
  const getTemplateDescription = (template: ProposalTemplate) => {
    if (locale === "lt" && template.descriptionLt) return template.descriptionLt;
    if (locale === "en" && template.descriptionEn) return template.descriptionEn;
    return template.description || "";
  };

  /**
   * Format price in specified currency
   */
  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat(locale === "lt" ? "lt-LT" : "en-US", {
      style: "currency",
      currency,
    }).format(cents / 100);
  };

  /**
   * Get selected template object
   */
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  /**
   * Handle template selection - also clear package if template changes
   */
  const handleTemplateSelect = (templateId: string) => {
    onTemplateSelect(templateId);
    // Clear package selection when template changes
    // (parent component should handle this)
  };

  if (isLoading) {
    return (
      <Card className={cn("w-full", className)} noHover>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-text-3" />
          <span className="ml-2 text-sm text-text-3">Loading templates...</span>
        </CardContent>
      </Card>
    );
  }

  if (templates.length === 0) {
    return (
      <Card className={cn("w-full", className)} noHover>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-10 w-10 text-text-4 mb-3" />
          <p className="text-sm text-text-2">No templates available</p>
          <p className="text-xs text-text-3 mt-1">
            Create a template to get started
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Template Selection */}
      <Card noHover>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Select Template
          </CardTitle>
          <CardDescription>
            Choose a template for your proposal structure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={selectedTemplateId || ""}
            onValueChange={handleTemplateSelect}
            className="space-y-3"
            disabled={disabled}
          >
            {templates.map((template) => {
              const isSelected = selectedTemplateId === template.id;

              return (
                <label
                  key={template.id}
                  className={cn(
                    "flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all duration-200",
                    isSelected
                      ? "border-accent bg-accent-soft/30 shadow-[0_0_0_1px_rgba(15,79,61,0.2)]"
                      : "border-hairline hover:border-text-4 hover:bg-surface-2",
                    disabled && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <RadioGroupItem
                    value={template.id}
                    id={`template-${template.id}`}
                    className="mt-0.5"
                    disabled={disabled}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-text-1">
                        {getTemplateName(template)}
                      </span>
                      <CategoryBadge category={template.category} />
                      {template.isDefault && (
                        <Badge variant="secondary" className="text-[10px]">
                          <Star className="h-2.5 w-2.5 mr-0.5" />
                          Default
                        </Badge>
                      )}
                    </div>
                    {template.description && (
                      <p className="text-sm text-text-3 mt-1 line-clamp-2">
                        {getTemplateDescription(template)}
                      </p>
                    )}
                    {template.packages && template.packages.length > 0 && (
                      <p className="text-xs text-text-4 mt-2">
                        {template.packages.length} package
                        {template.packages.length !== 1 ? "s" : ""} available
                      </p>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                  )}
                </label>
              );
            })}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Package Selection (shown when template is selected) */}
      {selectedTemplate && selectedTemplate.packages && selectedTemplate.packages.length > 0 && (
        <Card noHover>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Select Package
            </CardTitle>
            <CardDescription>
              Choose a pricing package for this proposal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={selectedPackageId || ""}
              onValueChange={onPackageSelect}
              className="space-y-3"
              disabled={disabled}
            >
              {selectedTemplate.packages.map((pkg) => {
                const isSelected = selectedPackageId === pkg.id;

                return (
                  <label
                    key={pkg.id}
                    className={cn(
                      "flex items-start justify-between p-4 rounded-lg border cursor-pointer transition-all duration-200",
                      isSelected
                        ? "border-accent bg-accent-soft/30 shadow-[0_0_0_1px_rgba(15,79,61,0.2)]"
                        : "border-hairline hover:border-text-4 hover:bg-surface-2",
                      disabled && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <RadioGroupItem
                        value={pkg.id}
                        id={`package-${pkg.id}`}
                        className="mt-0.5"
                        disabled={disabled}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-text-1">{pkg.name}</span>
                          {pkg.isRecommended && (
                            <Badge variant="default" className="text-[10px]">
                              Recommended
                            </Badge>
                          )}
                        </div>
                        {pkg.description && (
                          <p className="text-sm text-text-3 mt-1">{pkg.description}</p>
                        )}
                        {pkg.inclusions && pkg.inclusions.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {pkg.inclusions.slice(0, 4).map((inclusion, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center text-xs text-text-3 bg-surface-2 rounded px-1.5 py-0.5"
                              >
                                <Check className="h-2.5 w-2.5 mr-1 text-success" />
                                {inclusion}
                              </span>
                            ))}
                            {pkg.inclusions.length > 4 && (
                              <span className="text-xs text-text-4">
                                +{pkg.inclusions.length - 4} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <div className="font-semibold text-text-1">
                        {formatPrice(pkg.monthlyFee * 100)}
                        <span className="text-xs text-text-3 font-normal">/mo</span>
                      </div>
                      {pkg.setupFee > 0 && (
                        <div className="text-xs text-text-3 mt-0.5">
                          +{formatPrice(pkg.setupFee * 100)} setup
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
            </RadioGroup>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default TemplateSelector;
