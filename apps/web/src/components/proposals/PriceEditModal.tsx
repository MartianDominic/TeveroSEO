"use client";

/**
 * PriceEditModal Component - Per-proposal price customization.
 * Phase 58-03: Service Catalog - Proposal Integration
 *
 * Allows editing service price and setup fee for a specific proposal.
 * Shows original template prices for reference.
 * Supports reset to template defaults.
 */

import { useState, useEffect } from "react";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@tevero/ui";


interface ServiceTemplate {
  id: string;
  name: string;
  nameEn?: string | null;
  nameLt?: string | null;
  pricingType: "monthly" | "one_time" | "per_unit";
  basePriceCents: number | null;
  setupFeeCents?: number | null;
}

interface ProposalService {
  serviceTemplateId: string;
  customPriceCents?: number | null;
  customSetupCents?: number | null;
  quantity: number;
  isIncluded: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: ServiceTemplate;
  selection: ProposalService;
  onSave: (
    serviceId: string,
    customPriceCents: number | null,
    customSetupCents: number | null
  ) => void;
  currency?: string;
}

/**
 * Modal for editing per-proposal service prices.
 * Allows customization while showing original template values.
 */
export function PriceEditModal({
  open,
  onOpenChange,
  service,
  selection,
  onSave,
  currency = "EUR",
}: Props) {
  const t = useTranslations("serviceCatalog");
  const tFields = useTranslations("serviceCatalog.fields");

  // Original template prices in currency units (not cents)
  const originalPrice = service.basePriceCents
    ? service.basePriceCents / 100
    : 0;
  const originalSetup = service.setupFeeCents
    ? service.setupFeeCents / 100
    : 0;

  // Local state for form inputs (string for controlled input)
  const [customPrice, setCustomPrice] = useState<string>(
    selection.customPriceCents != null
      ? String(selection.customPriceCents / 100)
      : String(originalPrice)
  );
  const [customSetup, setCustomSetup] = useState<string>(
    selection.customSetupCents != null
      ? String(selection.customSetupCents / 100)
      : String(originalSetup)
  );

  // Reset form when modal opens or selection changes
  useEffect(() => {
    if (open) {
      setCustomPrice(
        selection.customPriceCents != null
          ? String(selection.customPriceCents / 100)
          : String(originalPrice)
      );
      setCustomSetup(
        selection.customSetupCents != null
          ? String(selection.customSetupCents / 100)
          : String(originalSetup)
      );
    }
  }, [open, selection, originalPrice, originalSetup]);

  /**
   * Save price changes.
   * Returns null for unchanged values to indicate no customization.
   */
  const handleSave = () => {
    const priceCents = Math.round(parseFloat(customPrice || "0") * 100);
    const setupCents = Math.round(parseFloat(customSetup || "0") * 100);

    // Validate price bounds (threat mitigation T-58-07)
    const validatedPrice = Math.max(0, Math.min(priceCents, 100000000));
    const validatedSetup = Math.max(0, Math.min(setupCents, 100000000));

    // Pass null if same as template (no customization)
    const finalPrice =
      validatedPrice === (service.basePriceCents ?? 0) ? null : validatedPrice;
    const finalSetup =
      validatedSetup === (service.setupFeeCents ?? 0) ? null : validatedSetup;

    onSave(service.id, finalPrice, finalSetup);
  };

  /**
   * Reset to template prices.
   */
  const handleReset = () => {
    setCustomPrice(String(originalPrice));
    setCustomSetup(String(originalSetup));
  };

  // Check if values differ from original
  const hasChanges =
    parseFloat(customPrice || "0") !== originalPrice ||
    parseFloat(customSetup || "0") !== originalSetup;

  const serviceName = service.name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Price: {serviceName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Base price input */}
          <div className="space-y-2">
            <Label htmlFor="customPrice">
              {tFields("basePrice")} ({currency})
              {service.pricingType === "monthly" && (
                <span className="text-muted-foreground"> /mo</span>
              )}
            </Label>
            <div className="relative">
              <Input
                id="customPrice"
                type="number"
                min="0"
                max="1000000"
                step="0.01"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                className="pr-16"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                was {originalPrice}
              </div>
            </div>
          </div>

          {/* Setup fee input (only for services with setup fees) */}
          {service.pricingType !== "per_unit" &&
            (service.setupFeeCents ?? 0) > 0 && (
              <div className="space-y-2">
                <Label htmlFor="customSetup">
                  {tFields("setupFee")} ({currency})
                </Label>
                <div className="relative">
                  <Input
                    id="customSetup"
                    type="number"
                    min="0"
                    max="1000000"
                    step="0.01"
                    value={customSetup}
                    onChange={(e) => setCustomSetup(e.target.value)}
                    className="pr-16"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    was {originalSetup}
                  </div>
                </div>
              </div>
            )}

          {/* Reset button - only show when values differ */}
          {hasChanges && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-xs"
            >
              Reset to template prices
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Price</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PriceEditModal;
