"use client";

/**
 * ServiceSelector Component - Main service selection for proposals.
 * Phase 58-03: Service Catalog - Proposal Integration
 *
 * Combines PackageSelector (radio) and AddonCheckbox (checkboxes) components
 * with ServiceSummary for total calculation and PriceEditModal for customization.
 *
 * Features:
 * - Package selection (mutually exclusive)
 * - Add-on services (multi-select)
 * - One-time services (multi-select)
 * - Per-proposal price customization
 * - Real-time total calculation
 */

import { useState } from "react";
import { PackageSelector } from "./PackageSelector";
import { AddonCheckbox } from "./AddonCheckbox";
import { ServiceSummary } from "./ServiceSummary";
import { PriceEditModal } from "./PriceEditModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "next-intl";

interface ServiceTemplate {
  id: string;
  name: string;
  nameEn?: string | null;
  nameLt?: string | null;
  category: "seo_package" | "addon" | "one_time";
  pricingType: "monthly" | "one_time" | "per_unit";
  basePriceCents: number | null;
  setupFeeCents?: number | null;
  inclusions?: string[] | null;
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
  services: ServiceTemplate[];
  selections: ProposalService[];
  onSelectionsChange: (selections: ProposalService[]) => void;
  currency?: string;
  locale?: string;
}

/**
 * Main service selector component for the proposal builder.
 * Manages package + add-on selections with price customization.
 */
export function ServiceSelector({
  services,
  selections,
  onSelectionsChange,
  currency = "EUR",
  locale = "en",
}: Props) {
  const t = useTranslations("serviceCatalog");
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);

  // Split services by category
  const packages = services.filter((s) => s.category === "seo_package");
  const addons = services.filter((s) => s.category === "addon");
  const oneTime = services.filter((s) => s.category === "one_time");

  // Find currently selected package
  const selectedPackageId =
    selections.find(
      (s) => packages.some((p) => p.id === s.serviceTemplateId) && s.isIncluded
    )?.serviceTemplateId || null;

  // Helper to get selection for a service
  const getSelection = (serviceId: string) =>
    selections.find((s) => s.serviceTemplateId === serviceId);

  /**
   * Handle package selection (radio behavior - mutually exclusive).
   * Removes other package selections, adds new one.
   */
  const handlePackageSelect = (packageId: string) => {
    // Remove existing package selections
    const withoutPackages = selections.filter(
      (s) => !packages.some((p) => p.id === s.serviceTemplateId)
    );

    onSelectionsChange([
      ...withoutPackages,
      { serviceTemplateId: packageId, quantity: 1, isIncluded: true },
    ]);
  };

  /**
   * Handle add-on toggle (checkbox behavior).
   */
  const handleAddonToggle = (serviceId: string, included: boolean) => {
    const existing = selections.find((s) => s.serviceTemplateId === serviceId);

    if (existing) {
      // Update existing selection
      onSelectionsChange(
        selections.map((s) =>
          s.serviceTemplateId === serviceId ? { ...s, isIncluded: included } : s
        )
      );
    } else {
      // Add new selection
      onSelectionsChange([
        ...selections,
        { serviceTemplateId: serviceId, quantity: 1, isIncluded: included },
      ]);
    }
  };

  /**
   * Handle price update from modal.
   * Pass null to reset to template prices.
   */
  const handlePriceUpdate = (
    serviceId: string,
    customPriceCents: number | null,
    customSetupCents: number | null
  ) => {
    const existing = selections.find((s) => s.serviceTemplateId === serviceId);

    if (existing) {
      onSelectionsChange(
        selections.map((s) =>
          s.serviceTemplateId === serviceId
            ? { ...s, customPriceCents, customSetupCents }
            : s
        )
      );
    }

    setEditingServiceId(null);
  };

  // Get service and selection for editing modal
  const editingService = editingServiceId
    ? services.find((s) => s.id === editingServiceId)
    : null;
  const editingSelection = editingServiceId
    ? getSelection(editingServiceId)
    : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Investment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Package selection (radio buttons) */}
          {packages.length > 0 && (
            <PackageSelector
              packages={packages}
              selectedId={selectedPackageId}
              onSelect={handlePackageSelect}
              currency={currency}
              locale={locale}
            />
          )}

          {/* Add-on services (checkboxes) */}
          {addons.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">
                {t("selector.addOns")}
              </h3>
              <div className="space-y-2">
                {addons.map((addon) => (
                  <AddonCheckbox
                    key={addon.id}
                    service={addon}
                    selection={getSelection(addon.id)}
                    onToggle={handleAddonToggle}
                    onEdit={setEditingServiceId}
                    currency={currency}
                    locale={locale}
                  />
                ))}
              </div>
            </div>
          )}

          {/* One-time services (checkboxes) */}
          {oneTime.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">
                {t("categories.one_time")}
              </h3>
              <div className="space-y-2">
                {oneTime.map((service) => (
                  <AddonCheckbox
                    key={service.id}
                    service={service}
                    selection={getSelection(service.id)}
                    onToggle={handleAddonToggle}
                    onEdit={setEditingServiceId}
                    currency={currency}
                    locale={locale}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Summary showing totals */}
          <ServiceSummary
            services={services}
            selections={selections.filter((s) => s.isIncluded)}
            currency={currency}
            locale={locale}
          />
        </CardContent>
      </Card>

      {/* Price edit modal */}
      {editingService && editingSelection && (
        <PriceEditModal
          open={!!editingServiceId}
          onOpenChange={(open) => !open && setEditingServiceId(null)}
          service={editingService}
          selection={editingSelection}
          onSave={handlePriceUpdate}
          currency={currency}
        />
      )}
    </div>
  );
}

export default ServiceSelector;
