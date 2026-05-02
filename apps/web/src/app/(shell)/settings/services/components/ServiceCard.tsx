"use client";

/**
 * ServiceCard Component
 * Phase 58-02: Individual service template card
 *
 * Displays service info with dropdown menu for actions.
 * System templates (workspaceId=null) show lock icon and disable edit/delete.
 */

import { useState, useTransition } from "react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@tevero/ui";
import {
  MoreHorizontal,
  Edit,
  Copy,
  Trash2,
  Lock,
  Zap,
  TrendingUp,
  Building,
  MapPin,
  Star,
  Globe,
  Users,
  Calendar,
  Package,
} from "lucide-react";
import { ServiceFormModal } from "./ServiceFormModal";
import { deleteService, duplicateService, type ServiceTemplateSelect } from "../actions";

// Icon mapping for dynamic icon rendering
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Zap,
  TrendingUp,
  Building,
  MapPin,
  Star,
  Globe,
  Users,
  Calendar,
  Package,
};

interface Props {
  service: ServiceTemplateSelect;
}

export function ServiceCard({ service }: Props) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isSystemTemplate = service.workspaceId === null;

  // Dynamic icon rendering
  const IconComponent = service.icon && ICON_MAP[service.icon]
    ? ICON_MAP[service.icon]
    : Package;

  // Format price from cents
  const formatPrice = (cents: number | null) => {
    if (cents === null || cents === 0) return "-";
    const currency = service.currency || "EUR";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  // Get pricing label based on type
  const getPricingLabel = () => {
    const basePrice = formatPrice(service.basePriceCents);
    switch (service.pricingType) {
      case "monthly":
        return `${basePrice}/mo`;
      case "per_unit":
        return `${basePrice} ${service.unitLabel || "per unit"}`;
      case "one_time":
      default:
        return basePrice;
    }
  };

  const handleDuplicate = () => {
    startTransition(async () => {
      const result = await duplicateService(service.id);
      if (!result.success) {
        alert(result.error);
      }
    });
  };

  const handleDelete = () => {
    if (!confirm(`Delete "${service.name}"? This action cannot be undone.`)) {
      return;
    }
    startTransition(async () => {
      const result = await deleteService(service.id);
      if (!result.success) {
        alert(result.error);
      }
    });
  };

  return (
    <>
      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4 hover:bg-muted/30 transition-colors">
        {/* Left: Icon + Info */}
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <IconComponent className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">{service.name}</span>
              {isSystemTemplate && (
                <Lock
                  className="h-3 w-3 text-muted-foreground"
                  aria-label="System template (read-only)"
                />
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{getPricingLabel()}</span>
              {service.setupFeeCents && service.setupFeeCents > 0 && (
                <span>+ {formatPrice(service.setupFeeCents)} setup</span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              disabled={isPending}
              className="shrink-0"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => setIsEditOpen(true)}
              disabled={isSystemTemplate}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDuplicate}>
              <Copy className="mr-2 h-4 w-4" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleDelete}
              disabled={isSystemTemplate}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Edit Modal */}
      <ServiceFormModal
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        mode="edit"
        service={service}
      />
    </>
  );
}
