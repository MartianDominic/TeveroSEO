"use client";

/**
 * Proposal view component for public proposal page.
 * Phase 46-47: Proposal System
 * Phase 58-04: Service Catalog Integration
 *
 * Renders the proposal content with hero, current state, opportunities,
 * investment details, and next steps. Includes beacon image for view tracking.
 * Supports structured services from Phase 58 service catalog.
 */

import { ServicesSection } from "./ServicesSection";

import type { PublicProposal } from "../actions";

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

interface ProposalViewProps {
  proposal: PublicProposal;
  token: string;
  services?: ServiceWithSelection[];
  locale?: string;
}

export function ProposalView({
  proposal,
  token,
  services = [],
  locale = "lt",
}: ProposalViewProps) {
  const { content, brandConfig, setupFeeCents, monthlyFeeCents, currency } =
    proposal;

  const formatCurrency = (cents: number | null) => {
    if (cents === null) return "-";
    return new Intl.NumberFormat("lt-LT", {
      style: "currency",
      currency: currency || "EUR",
    }).format(cents / 100);
  };

  const primaryColor = brandConfig?.primaryColor || "#0f4f3d";

  return (
    <div className="space-y-8">
      {/* View tracking beacon per D-07 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/proposals/beacon?t=${token}`}
        alt=""
        width={1}
        height={1}
        className="absolute opacity-0 pointer-events-none"
        aria-hidden="true"
      />

      {/* Hero Section */}
      <section
        className="text-center py-12 px-4 rounded-xl"
        style={{ backgroundColor: `${primaryColor}10` }}
      >
        {brandConfig?.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={brandConfig.logoUrl}
            alt="Logo"
            className="h-12 mx-auto mb-6 object-contain"
          />
        )}
        <h1
          className="text-4xl font-bold mb-4"
          style={{ fontFamily: "Newsreader, serif", color: "#14141a" }}
        >
          {content.hero.headline}
        </h1>
        <p className="text-xl text-gray-600 mb-6">{content.hero.subheadline}</p>
        <div className="mt-6">
          <span
            className="text-5xl font-bold"
            style={{ fontFamily: "Newsreader, serif", color: primaryColor }}
          >
            {formatCurrency(content.hero.trafficValue * 100)}
          </span>
          <span className="text-gray-500 ml-2">vertes galimybe/men.</span>
        </div>
      </section>

      {/* Current State Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2
            className="text-xl font-semibold"
            style={{ fontFamily: "Newsreader, serif" }}
          >
            Dabartine situacija
          </h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <div
                className="text-3xl font-bold"
                style={{ fontFamily: "Newsreader, serif" }}
              >
                {content.currentState.traffic.toLocaleString("lt-LT")}
              </div>
              <div className="text-sm text-gray-500">Lankytoju/men.</div>
            </div>
            <div>
              <div
                className="text-3xl font-bold"
                style={{ fontFamily: "Newsreader, serif" }}
              >
                {content.currentState.keywords.toLocaleString("lt-LT")}
              </div>
              <div className="text-sm text-gray-500">Raktazodziu</div>
            </div>
            <div>
              <div
                className="text-3xl font-bold"
                style={{ fontFamily: "Newsreader, serif" }}
              >
                {formatCurrency(content.currentState.value * 100)}
              </div>
              <div className="text-sm text-gray-500">Verte/men.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Opportunities Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2
            className="text-xl font-semibold"
            style={{ fontFamily: "Newsreader, serif" }}
          >
            Galimybes
          </h2>
        </div>
        <div className="p-6">
          <div className="space-y-3">
            {content.opportunities.slice(0, 5).map((opp, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-3 border-b last:border-0 border-gray-50"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-900">{opp.keyword}</span>
                  <span
                    className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                      opp.difficulty === "easy"
                        ? "bg-green-100 text-green-700"
                        : opp.difficulty === "medium"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                    }`}
                  >
                    {opp.difficulty === "easy"
                      ? "Lengva"
                      : opp.difficulty === "medium"
                        ? "Vidutine"
                        : "Sunki"}
                  </span>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">
                    {opp.volume.toLocaleString("lt-LT")}
                  </div>
                  <div className="text-xs text-gray-500">paieskos/men.</div>
                </div>
              </div>
            ))}
          </div>
          {content.opportunities.length > 5 && (
            <p className="text-sm text-gray-500 mt-4 text-center">
              ...ir dar {content.opportunities.length - 5} galimybes
            </p>
          )}
        </div>
      </div>

      {/* Services/Investment section - Phase 58-04 */}
      {services.length > 0 ? (
        <ServicesSection
          services={services}
          currency={currency || "EUR"}
          locale={locale}
        />
      ) : (
        /* Legacy Investment Card (fallback when no structured services) */
        <div
          className="bg-white rounded-xl shadow-sm overflow-hidden"
          style={{ borderColor: primaryColor, borderWidth: 2 }}
        >
          <div
            className="px-6 py-4"
            style={{ backgroundColor: `${primaryColor}10` }}
          >
            <h2
              className="text-xl font-semibold"
              style={{ fontFamily: "Newsreader, serif" }}
            >
              Investicija
            </h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div
                  className="text-3xl font-bold"
                  style={{ fontFamily: "Newsreader, serif", color: primaryColor }}
                >
                  {formatCurrency(setupFeeCents)}
                </div>
                <div className="text-sm text-gray-500">Pradinis mokestis</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div
                  className="text-3xl font-bold"
                  style={{ fontFamily: "Newsreader, serif", color: primaryColor }}
                >
                  {formatCurrency(monthlyFeeCents)}
                </div>
                <div className="text-sm text-gray-500">Menesinis mokestis</div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-gray-900">Kas ieina:</h4>
              <ul className="space-y-2">
                {content.investment.inclusions.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-gray-700">
                    <span style={{ color: primaryColor }} className="mt-0.5">
                      &#10003;
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ROI Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2
            className="text-xl font-semibold"
            style={{ fontFamily: "Newsreader, serif" }}
          >
            Tikimasis rezultatas
          </h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 gap-6 text-center">
            <div>
              <div
                className="text-3xl font-bold"
                style={{ fontFamily: "Newsreader, serif", color: primaryColor }}
              >
                +{content.roi.projectedTrafficGain.toLocaleString("lt-LT")}
              </div>
              <div className="text-sm text-gray-500">
                Papildomi lankytojai/men.
              </div>
            </div>
            <div>
              <div
                className="text-3xl font-bold"
                style={{ fontFamily: "Newsreader, serif", color: primaryColor }}
              >
                {formatCurrency(content.roi.trafficValue * 100)}
              </div>
              <div className="text-sm text-gray-500">Papildoma verte/men.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Next Steps Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2
            className="text-xl font-semibold"
            style={{ fontFamily: "Newsreader, serif" }}
          >
            Tolimesni zingsniai
          </h2>
        </div>
        <div className="p-6">
          <ol className="space-y-3">
            {content.nextSteps.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-medium"
                  style={{ backgroundColor: primaryColor }}
                >
                  {i + 1}
                </span>
                <span className="text-gray-700 pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
