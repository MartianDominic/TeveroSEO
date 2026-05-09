"use client";

/**
 * ServiceTable Component
 * Phase 58-02: Service catalog list view
 *
 * Displays services grouped by category with action buttons.
 * Categories: SEO Packages, Add-Ons, One-Time Services
 */

import { useState } from "react";

import { Plus } from "lucide-react";

import { Button } from "@tevero/ui";

import { ServiceCard } from "./ServiceCard";
import { ServiceFormModal } from "./ServiceFormModal";

import type { ServiceTemplateSelect } from "../actions";

interface Props {
  services: ServiceTemplateSelect[];
}

export function ServiceTable({ services }: Props) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Group services by category
  const seoPackages = services.filter(
    (s) => s.category === "seo_package" && s.isActive
  );
  const addons = services.filter(
    (s) => s.category === "addon" && s.isActive
  );
  const oneTime = services.filter(
    (s) => s.category === "one_time" && s.isActive
  );

  const renderGroup = (
    title: string,
    description: string,
    items: ServiceTemplateSelect[]
  ) => (
    <div className="mb-8">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No services in this category yet
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div>
      {/* Action Bar */}
      <div className="flex justify-end mb-6">
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Service
        </Button>
      </div>

      {/* Empty State */}
      {services.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Plus className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-medium text-foreground mb-1">
            No services yet
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create service templates to use in proposals
          </p>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create First Service
          </Button>
        </div>
      ) : (
        <>
          {renderGroup(
            "SEO Packages",
            "Core SEO service tiers with monthly pricing",
            seoPackages
          )}
          {renderGroup(
            "Add-On Services",
            "Optional services to enhance core packages",
            addons
          )}
          {renderGroup(
            "One-Time Services",
            "Single-delivery services and projects",
            oneTime
          )}
        </>
      )}

      {/* Create Modal */}
      <ServiceFormModal
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        mode="create"
      />
    </div>
  );
}
