"use client";

/**
 * ServiceFormModal Component
 * Phase 58-02: Create/Edit service template modal
 *
 * Full-featured form with:
 * - Name (EN/LT for i18n)
 * - Category and pricing type selection
 * - Base price and setup fee
 * - Dynamic inclusions list
 * - Terms template
 * - Icon selection
 */

import { useState, useTransition, useEffect } from "react";

import { Loader2, Plus, X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@tevero/ui";

import {
  createService,
  updateService,
  SERVICE_CATEGORIES,
  PRICING_TYPES,
  type ServiceTemplateSelect,
  type ServiceCategory,
  type PricingType,
} from "../actions";

const ICON_OPTIONS = [
  "Zap",
  "TrendingUp",
  "Building",
  "MapPin",
  "Star",
  "Globe",
  "Users",
  "Calendar",
  "Package",
];

const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  seo_package: "SEO Package",
  addon: "Add-On Service",
  one_time: "One-Time Service",
};

const PRICING_TYPE_LABELS: Record<PricingType, string> = {
  monthly: "Monthly",
  one_time: "One-Time",
  per_unit: "Per Unit",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  service?: ServiceTemplateSelect;
}

export function ServiceFormModal({ open, onOpenChange, mode, service }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [nameLt, setNameLt] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [descriptionLt, setDescriptionLt] = useState("");
  const [category, setCategory] = useState<ServiceCategory>("addon");
  const [pricingType, setPricingType] = useState<PricingType>("monthly");
  const [basePrice, setBasePrice] = useState("");
  const [setupFee, setSetupFee] = useState("");
  const [unitLabel, setUnitLabel] = useState("");
  const [inclusions, setInclusions] = useState<string[]>([]);
  const [newInclusion, setNewInclusion] = useState("");
  const [termsTemplate, setTermsTemplate] = useState("");
  const [icon, setIcon] = useState("Package");

  // Reset form when modal opens/closes or service changes
  useEffect(() => {
    if (open && service && mode === "edit") {
      // Populate form with existing service data
      setName(service.name);
      setNameEn(service.nameEn || "");
      setNameLt(service.nameLt || "");
      setDescription(service.description || "");
      setDescriptionEn(service.descriptionEn || "");
      setDescriptionLt(service.descriptionLt || "");
      setCategory(service.category);
      setPricingType(service.pricingType);
      setBasePrice(
        service.basePriceCents ? String(service.basePriceCents / 100) : ""
      );
      setSetupFee(
        service.setupFeeCents ? String(service.setupFeeCents / 100) : ""
      );
      setUnitLabel(service.unitLabel || "");
      setInclusions(service.inclusions || []);
      setTermsTemplate(service.termsTemplate || "");
      setIcon(service.icon || "Package");
      setError(null);
    } else if (open && mode === "create") {
      // Reset form for create mode
      setName("");
      setNameEn("");
      setNameLt("");
      setDescription("");
      setDescriptionEn("");
      setDescriptionLt("");
      setCategory("addon");
      setPricingType("monthly");
      setBasePrice("");
      setSetupFee("");
      setUnitLabel("");
      setInclusions([]);
      setNewInclusion("");
      setTermsTemplate("");
      setIcon("Package");
      setError(null);
    }
  }, [open, service, mode]);

  const addInclusion = () => {
    const trimmed = newInclusion.trim();
    if (trimmed && !inclusions.includes(trimmed)) {
      setInclusions([...inclusions, trimmed]);
      setNewInclusion("");
    }
  };

  const removeInclusion = (index: number) => {
    setInclusions(inclusions.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addInclusion();
    }
  };

  const handleSubmit = () => {
    setError(null);

    // Basic validation
    const finalName = name.trim() || nameEn.trim();
    if (!finalName) {
      setError("Service name is required");
      return;
    }

    const basePriceNum = parseFloat(basePrice || "0");
    if (isNaN(basePriceNum) || basePriceNum < 0) {
      setError("Please enter a valid base price");
      return;
    }

    const setupFeeNum = parseFloat(setupFee || "0");
    if (isNaN(setupFeeNum) || setupFeeNum < 0) {
      setError("Please enter a valid setup fee");
      return;
    }

    const data = {
      name: finalName,
      nameEn: nameEn.trim() || undefined,
      nameLt: nameLt.trim() || undefined,
      description: description.trim() || undefined,
      descriptionEn: descriptionEn.trim() || undefined,
      descriptionLt: descriptionLt.trim() || undefined,
      category,
      pricingType,
      basePriceCents: Math.round(basePriceNum * 100),
      setupFeeCents: setupFeeNum > 0 ? Math.round(setupFeeNum * 100) : undefined,
      unitLabel: pricingType === "per_unit" ? unitLabel.trim() || undefined : undefined,
      inclusions: inclusions.length > 0 ? inclusions : undefined,
      termsTemplate: termsTemplate.trim() || undefined,
      icon,
    };

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createService(data)
          : await updateService(service!.id, data);

      if (result.success) {
        onOpenChange(false);
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Create Service" : "Edit Service"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Name Fields (EN/LT for i18n) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nameEn">Name (EN)</Label>
              <Input
                id="nameEn"
                value={nameEn}
                onChange={(e) => {
                  setNameEn(e.target.value);
                  // Auto-set name if empty
                  if (!name) setName(e.target.value);
                }}
                placeholder="Service name in English"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nameLt">Name (LT)</Label>
              <Input
                id="nameLt"
                value={nameLt}
                onChange={(e) => setNameLt(e.target.value)}
                placeholder="Service name in Lithuanian"
              />
            </div>
          </div>

          {/* Category + Pricing Type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as ServiceCategory)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Pricing Type</Label>
              <Select
                value={pricingType}
                onValueChange={(v) => setPricingType(v as PricingType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRICING_TYPES.map((pt) => (
                    <SelectItem key={pt} value={pt}>
                      {PRICING_TYPE_LABELS[pt]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="basePrice">
                Base Price (EUR){" "}
                {pricingType === "monthly" && (
                  <span className="text-muted-foreground">/month</span>
                )}
              </Label>
              <Input
                id="basePrice"
                type="number"
                min="0"
                step="0.01"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            {pricingType !== "per_unit" ? (
              <div className="space-y-2">
                <Label htmlFor="setupFee">Setup Fee (EUR)</Label>
                <Input
                  id="setupFee"
                  type="number"
                  min="0"
                  step="0.01"
                  value={setupFee}
                  onChange={(e) => setSetupFee(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="unitLabel">Unit Label</Label>
                <Input
                  id="unitLabel"
                  value={unitLabel}
                  onChange={(e) => setUnitLabel(e.target.value)}
                  placeholder="e.g., per article, per hour"
                />
              </div>
            )}
          </div>

          {/* Description (EN) */}
          <div className="space-y-2">
            <Label>Description (EN)</Label>
            <Textarea
              value={descriptionEn}
              onChange={(e) => {
                setDescriptionEn(e.target.value);
                if (!description) setDescription(e.target.value);
              }}
              rows={2}
              placeholder="Brief description of the service"
            />
          </div>

          {/* Description (LT) */}
          <div className="space-y-2">
            <Label>Description (LT)</Label>
            <Textarea
              value={descriptionLt}
              onChange={(e) => setDescriptionLt(e.target.value)}
              rows={2}
              placeholder="Paslaugos aprasymas lietuviu kalba"
            />
          </div>

          {/* Inclusions */}
          <div className="space-y-2">
            <Label>What&apos;s Included</Label>
            <div className="space-y-2">
              {inclusions.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded-md bg-muted px-3 py-2"
                >
                  <span className="flex-1 text-sm">{item}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => removeInclusion(idx)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  value={newInclusion}
                  onChange={(e) => setNewInclusion(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Add inclusion..."
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={addInclusion}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Terms Template */}
          <div className="space-y-2">
            <Label>Agreement Terms (optional)</Label>
            <Textarea
              value={termsTemplate}
              onChange={(e) => setTermsTemplate(e.target.value)}
              rows={3}
              placeholder="Legal terms that will be appended to agreements when this service is selected..."
            />
          </div>

          {/* Icon */}
          <div className="space-y-2">
            <Label>Icon</Label>
            <Select value={icon} onValueChange={setIcon}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ICON_OPTIONS.map((iconName) => (
                  <SelectItem key={iconName} value={iconName}>
                    {iconName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || (!name && !nameEn)}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "create" ? "Create Service" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
