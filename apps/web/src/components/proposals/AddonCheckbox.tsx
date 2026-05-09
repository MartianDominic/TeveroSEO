"use client";

/**
 * AddonCheckbox Component - Individual add-on service checkbox.
 * Phase 58-03: Service Catalog - Proposal Integration
 *
 * Displays an add-on/one-time service as a checkbox with price and edit button.
 * Shows custom price if overridden, with visual indicator.
 */

import { Edit2 } from "lucide-react";
import * as Icons from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

interface ServiceTemplate {
  id: string;
  name: string;
  nameEn?: string | null;
  nameLt?: string | null;
  pricingType: "monthly" | "one_time" | "per_unit";
  basePriceCents: number | null;
  setupFeeCents?: number | null;
  icon?: string | null;
}

interface ProposalService {
  serviceTemplateId: string;
  customPriceCents?: number | null;
  customSetupCents?: number | null;
  quantity: number;
  isIncluded: boolean;
}

interface Props {
  service: ServiceTemplate;
  selection?: ProposalService;
  onToggle: (serviceId: string, included: boolean) => void;
  onEdit: (serviceId: string) => void;
  currency?: string;
  locale?: string;
}

/**
 * Single add-on service checkbox with price display.
 * Shows edit button when selected for price customization.
 */
export function AddonCheckbox({
  service,
  selection,
  onToggle,
  onEdit,
  currency = "EUR",
  locale = "en",
}: Props) {
  const isSelected = selection?.isIncluded ?? false;
  const displayPrice = selection?.customPriceCents ?? service.basePriceCents;

  const formatPrice = (cents: number | null) => {
    if (cents === null) return "-";
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).format(cents / 100);
  };

  const getName = () => {
    if (locale === "lt" && service.nameLt) return service.nameLt;
    if (locale === "en" && service.nameEn) return service.nameEn;
    return service.name;
  };

  // Get icon component from Lucide
  const IconComponent =
    service.icon && Icons[service.icon as keyof typeof Icons]
      ? (Icons[service.icon as keyof typeof Icons] as React.ComponentType<{
          className?: string;
        }>)
      : Icons.Package;

  // Format price label based on pricing type
  const priceLabel =
    service.pricingType === "monthly"
      ? `${formatPrice(displayPrice)}/mo`
      : service.pricingType === "one_time"
        ? formatPrice(displayPrice)
        : `${formatPrice(displayPrice)} per unit`;

  const hasCustomPrice = selection?.customPriceCents != null;

  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg border transition-colors
      ${isSelected ? "border-primary/50 bg-primary/5" : "border-border"}`}
    >
      <div className="flex items-center gap-3">
        <Checkbox
          id={`addon-${service.id}`}
          checked={isSelected}
          onCheckedChange={(checked) =>
            onToggle(service.id, checked as boolean)
          }
        />
        <div className="w-6 h-6 rounded bg-muted flex items-center justify-center">
          <IconComponent className="h-3 w-3" />
        </div>
        <label
          htmlFor={`addon-${service.id}`}
          className="cursor-pointer text-sm"
        >
          {getName()}
        </label>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`text-sm ${hasCustomPrice ? "text-primary font-medium" : ""}`}
        >
          {priceLabel}
        </span>
        {isSelected && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onEdit(service.id)}
            aria-label={`Edit price for ${getName()}`}
          >
            <Edit2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default AddonCheckbox;
