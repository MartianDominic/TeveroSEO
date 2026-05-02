"use client";

/**
 * ServicesSection component for proposal view.
 * Phase 58-04: Service Catalog Integration with Proposals
 *
 * Wraps ServiceLineItems in a Card for the proposal view.
 * Renders service line items grouped by category with totals.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@tevero/ui";
import { ServiceLineItems } from "@/components/proposals/ServiceLineItems";

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
  customPriceCents?: number | null;
  customSetupCents?: number | null;
  quantity: number;
}

interface Props {
  services: ServiceWithSelection[];
  currency?: string;
  locale?: string;
}

export function ServicesSection({
  services,
  currency = "EUR",
  locale = "en",
}: Props) {
  if (!services || services.length === 0) {
    return null;
  }

  const sectionTitle = locale === "lt" ? "Investicija" : "Investment";

  return (
    <section className="py-8">
      <Card>
        <CardHeader>
          <CardTitle>{sectionTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <ServiceLineItems
            services={services}
            currency={currency}
            locale={locale}
            showInclusions={true}
          />
        </CardContent>
      </Card>
    </section>
  );
}
