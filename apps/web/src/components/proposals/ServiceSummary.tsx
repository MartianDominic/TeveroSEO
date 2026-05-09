"use client";

/**
 * ServiceSummary Component - Price totals calculation display.
 * Phase 58-03: Service Catalog - Proposal Integration
 *
 * Displays calculated totals for selected services:
 * - Monthly Total (recurring services)
 * - One-Time Setup (setup fees)
 * - One-Time Services (non-recurring services)
 * - First Month Total (all combined)
 */

import { useTranslations } from "next-intl";

import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface ServiceTemplate {
  id: string;
  name: string;
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
  services: ServiceTemplate[];
  selections: ProposalService[];
  currency?: string;
  locale?: string;
}

/**
 * Calculates and displays service pricing summary.
 * Shows monthly, setup, one-time, and first month totals.
 */
export function ServiceSummary({
  services,
  selections,
  currency = "EUR",
  locale = "en",
}: Props) {
  const t = useTranslations("serviceCatalog");

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).format(cents / 100);
  };

  // Calculate totals
  let monthlyTotal = 0;
  let setupTotal = 0;
  let oneTimeTotal = 0;

  for (const selection of selections) {
    if (!selection.isIncluded) continue;

    const service = services.find((s) => s.id === selection.serviceTemplateId);
    if (!service) continue;

    const price = selection.customPriceCents ?? service.basePriceCents ?? 0;
    const setup = selection.customSetupCents ?? service.setupFeeCents ?? 0;
    const qty = selection.quantity || 1;

    if (service.pricingType === "monthly") {
      monthlyTotal += price * qty;
      setupTotal += setup * qty;
    } else if (service.pricingType === "one_time") {
      oneTimeTotal += price * qty;
    } else if (service.pricingType === "per_unit") {
      // Per-unit pricing treated as one-time for first month
      oneTimeTotal += price * qty;
    }
  }

  const firstMonthTotal = monthlyTotal + setupTotal + oneTimeTotal;

  // Don't show summary if nothing selected
  if (selections.length === 0) {
    return null;
  }

  return (
    <Card className="bg-muted/30">
      <CardContent className="pt-4">
        <div className="text-sm font-medium text-muted-foreground mb-3">
          {t("selector.summary")}
        </div>
        <div className="space-y-2">
          {/* Monthly Total */}
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {t("selector.monthlyTotal")}
            </span>
            <span className="font-medium">{formatPrice(monthlyTotal)}/mo</span>
          </div>

          {/* One-Time Setup */}
          {setupTotal > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("selector.oneTimeSetup")}
              </span>
              <span className="font-medium">{formatPrice(setupTotal)}</span>
            </div>
          )}

          {/* One-Time Services */}
          {oneTimeTotal > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("categories.one_time")}
              </span>
              <span className="font-medium">{formatPrice(oneTimeTotal)}</span>
            </div>
          )}

          <Separator className="my-2" />

          {/* First Month Total */}
          <div className="flex justify-between text-lg">
            <span className="font-medium">{t("selector.firstMonth")}</span>
            <span className="font-bold text-primary">
              {formatPrice(firstMonthTotal)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ServiceSummary;
