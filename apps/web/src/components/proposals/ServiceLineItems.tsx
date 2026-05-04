"use client";

/**
 * ServiceLineItems component for displaying selected services in proposal view.
 * Phase 58-04: Service Catalog Integration with Proposals
 *
 * Displays services grouped by category (seo_package, addon, one_time) with:
 * - Custom price display when overridden
 * - Service inclusions with checkmarks
 * - Monthly, setup, and one-time totals calculation
 */

import { Separator } from "@tevero/ui";
import { Check, Package } from "lucide-react";
import * as Icons from "lucide-react";

interface ServiceWithSelection {
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
  // Selection data merged
  customPriceCents?: number | null;
  customSetupCents?: number | null;
  quantity: number;
}

interface Props {
  services: ServiceWithSelection[];
  currency?: string;
  locale?: string;
  showInclusions?: boolean;
}

export function ServiceLineItems({
  services,
  currency = "EUR",
  locale = "en",
  showInclusions = true,
}: Props) {
  const formatPrice = (cents: number | null) => {
    if (cents === null || cents === undefined) return "-";
    return new Intl.NumberFormat(locale === "lt" ? "lt-LT" : "en-US", {
      style: "currency",
      currency,
    }).format(cents / 100);
  };

  const getName = (service: ServiceWithSelection) => {
    if (locale === "lt" && service.nameLt) return service.nameLt;
    if (locale === "en" && service.nameEn) return service.nameEn;
    return service.name;
  };

  const packages = services.filter((s) => s.category === "seo_package");
  const addons = services.filter((s) => s.category === "addon");
  const oneTime = services.filter((s) => s.category === "one_time");

  const renderServiceItem = (service: ServiceWithSelection) => {
    const price = service.customPriceCents ?? service.basePriceCents;
    const setup = service.customSetupCents ?? service.setupFeeCents;

    // Get icon component dynamically
    const iconName = service.icon as keyof typeof Icons;
    const IconComponent =
      iconName && Icons[iconName] && typeof Icons[iconName] === "function"
        ? (Icons[iconName] as React.ComponentType<{ className?: string }>)
        : Package;

    return (
      <div key={service.id} className="py-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center mt-0.5">
              <IconComponent className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="font-medium">{getName(service)}</div>
              {showInclusions &&
                service.inclusions &&
                service.inclusions.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {service.inclusions.map((item) => (
                      <li
                        key={`${service.id}-inclusion-${item}`}
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        <Check className="h-3 w-3 text-green-500" />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
            </div>
          </div>
          <div className="text-right">
            <div className="font-semibold">
              {formatPrice(price)}
              {service.pricingType === "monthly" && (
                <span className="text-sm font-normal text-muted-foreground">
                  /mo
                </span>
              )}
            </div>
            {setup && setup > 0 && (
              <div className="text-sm text-muted-foreground">
                + {formatPrice(setup)} setup
              </div>
            )}
            {service.quantity > 1 && (
              <div className="text-xs text-muted-foreground">
                x{service.quantity}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderGroup = (title: string, items: ServiceWithSelection[]) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-6">
        <h4 className="text-sm font-medium text-muted-foreground mb-2">
          {title}
        </h4>
        <div className="divide-y">{items.map(renderServiceItem)}</div>
      </div>
    );
  };

  // Calculate totals
  let monthlyTotal = 0;
  let setupTotal = 0;
  let oneTimeTotal = 0;

  for (const service of services) {
    const price =
      (service.customPriceCents ?? service.basePriceCents ?? 0) *
      service.quantity;
    const setup =
      (service.customSetupCents ?? service.setupFeeCents ?? 0) *
      service.quantity;

    if (service.pricingType === "monthly") {
      monthlyTotal += price;
      setupTotal += setup;
    } else {
      oneTimeTotal += price;
    }
  }

  const categoryLabels = {
    en: {
      packages: "Core SEO Package",
      addons: "Add-On Services",
      oneTime: "One-Time Services",
      monthlyRecurring: "Monthly Recurring",
      oneTimeSetup: "One-Time Setup",
      oneTimeServices: "One-Time Services",
      firstMonthTotal: "First Month Total",
    },
    lt: {
      packages: "Pagrindinis SEO paketas",
      addons: "Papildomos paslaugos",
      oneTime: "Vienkartines paslaugos",
      monthlyRecurring: "Menesinis mokejimas",
      oneTimeSetup: "Vienkartinis diegimas",
      oneTimeServices: "Vienkartines paslaugos",
      firstMonthTotal: "Pirmo menesio suma",
    },
  };

  const labels = locale === "lt" ? categoryLabels.lt : categoryLabels.en;

  return (
    <div>
      {renderGroup(labels.packages, packages)}
      {renderGroup(labels.addons, addons)}
      {renderGroup(labels.oneTime, oneTime)}

      <Separator className="my-4" />

      <div className="space-y-2 pt-2">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{labels.monthlyRecurring}</span>
          <span className="font-medium">{formatPrice(monthlyTotal)}/mo</span>
        </div>
        {setupTotal > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">{labels.oneTimeSetup}</span>
            <span className="font-medium">{formatPrice(setupTotal)}</span>
          </div>
        )}
        {oneTimeTotal > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">{labels.oneTimeServices}</span>
            <span className="font-medium">{formatPrice(oneTimeTotal)}</span>
          </div>
        )}
        <Separator className="my-2" />
        <div className="flex justify-between text-lg">
          <span className="font-semibold">{labels.firstMonthTotal}</span>
          <span className="font-bold text-primary">
            {formatPrice(monthlyTotal + setupTotal + oneTimeTotal)}
          </span>
        </div>
      </div>
    </div>
  );
}
