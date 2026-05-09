"use client";

/**
 * PublicProposalView - Read-only proposal display for public links.
 * Phase 57-08: Clone + Undo/Redo + Magic Link
 * Phase 65: Added Accept Proposal CTA
 *
 * Features:
 * - Branded experience using proposal brandConfig
 * - Read-only rendering (no editing)
 * - Client-side view duration tracking
 * - Section visibility tracking
 * - Accept Proposal button with agreement flow
 */

import { useEffect, useRef, useCallback, useState } from "react";

import Image from "next/image";
import { useRouter } from "next/navigation";

import { TrendingUp, CheckCircle, ArrowRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProposalContent {
  hero: {
    headline: string;
    subheadline: string;
    trafficValue: number;
  };
  currentState: {
    traffic: number;
    keywords: number;
    value: number;
    chartData: Array<{ month: string; traffic: number }>;
  };
  opportunities: Array<{
    keyword: string;
    volume: number;
    difficulty: "easy" | "medium" | "hard";
    potential: number;
  }>;
  roi: {
    projectedTrafficGain: number;
    trafficValue: number;
    defaultConversionRate: number;
    defaultAov: number;
  };
  investment: {
    setupFee: number;
    monthlyFee: number;
    inclusions: string[];
  };
  nextSteps: string[];
}

interface BrandConfig {
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
}

interface ProposalData {
  id: string;
  content: ProposalContent;
  brandConfig?: BrandConfig | null;
  setupFeeCents: number | null;
  monthlyFeeCents: number | null;
  currency: string;
  status: string;
  expiresAt: string | null;
  createdAt: string;
}

export interface PublicProposalViewProps {
  proposal: ProposalData;
  token: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-US").format(num);
}

function getDifficultyColor(difficulty: "easy" | "medium" | "hard"): string {
  switch (difficulty) {
    case "easy":
      return "bg-success/10 text-success";
    case "medium":
      return "bg-warning/10 text-warning";
    case "hard":
      return "bg-error/10 text-error";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PublicProposalView({ proposal, token }: PublicProposalViewProps) {
  const { content, brandConfig, currency } = proposal;
  const router = useRouter();
  const startTimeRef = useRef<number>(Date.now());
  const sectionsViewedRef = useRef<Set<string>>(new Set());
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  // Handle proposal acceptance
  const handleAcceptProposal = useCallback(async () => {
    setIsAccepting(true);
    setAcceptError(null);

    try {
      const response = await fetch(`/api/proposals/${proposal.id}/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to accept proposal");
      }

      const result = await response.json();

      // Redirect to agreement signing page if agreementToken is returned
      // Use window.location for external-style navigation to public routes
      if (result.agreementToken) {
        window.location.href = `/c/${result.agreementToken}`;
      } else if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
      } else {
        // Fallback: show success state
        router.refresh();
      }
    } catch (error) {
      setAcceptError(error instanceof Error ? error.message : "Failed to accept proposal");
    } finally {
      setIsAccepting(false);
    }
  }, [proposal.id, token, router]);

  // Track duration on unmount
  useEffect(() => {
    const startTime = startTimeRef.current;

    return () => {
      const duration = Math.floor((Date.now() - startTime) / 1000);
      const sections = Array.from(sectionsViewedRef.current);

      // Send beacon on page leave
      if (navigator.sendBeacon) {
        const data = JSON.stringify({
          token,
          durationSeconds: duration,
          sectionsViewed: sections,
        });
        navigator.sendBeacon("/api/proposals/track-duration", data);
      }
    };
  }, [token]);

  // Track section visibility with intersection observer
  const observerCallback = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const sectionId = entry.target.getAttribute("data-section");
          if (sectionId) {
            sectionsViewedRef.current.add(sectionId);
          }
        }
      });
    },
    []
  );

  useEffect(() => {
    const observer = new IntersectionObserver(observerCallback, {
      threshold: 0.5,
    });

    const sections = document.querySelectorAll("[data-section]");
    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, [observerCallback]);

  // Apply brand colors as CSS variables
  const brandStyles = brandConfig
    ? {
        "--brand-primary": brandConfig.primaryColor,
        "--brand-secondary": brandConfig.secondaryColor,
        fontFamily: brandConfig.fontFamily || "inherit",
      }
    : {};

  return (
    <div
      className="min-h-screen bg-surface-1"
      style={brandStyles as React.CSSProperties}
    >
      {/* Hero Section */}
      <section
        data-section="hero"
        className="relative bg-gradient-to-br from-accent to-accent-dark py-20 px-4"
        style={{
          background: brandConfig
            ? `linear-gradient(135deg, ${brandConfig.primaryColor}, ${brandConfig.secondaryColor})`
            : undefined,
        }}
      >
        <div className="max-w-4xl mx-auto text-center text-white">
          {/* Logo */}
          {brandConfig?.logoUrl && (
            <div className="mb-8">
              <Image
                src={brandConfig.logoUrl}
                alt="Company logo"
                width={180}
                height={60}
                className="mx-auto"
              />
            </div>
          )}

          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {content.hero.headline}
          </h1>
          <p className="text-xl md:text-2xl opacity-90 mb-8">
            {content.hero.subheadline}
          </p>

          {/* Traffic Value Highlight */}
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-6 py-3">
            <TrendingUp className="h-5 w-5" />
            <span className="text-lg font-semibold">
              Potential Value: {formatCurrency(content.hero.trafficValue * 100, currency)}
            </span>
          </div>
        </div>
      </section>

      {/* Current State Section */}
      <section data-section="current-state" className="py-16 px-4 bg-surface-2">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-text-1 mb-8 text-center">
            Your Current Performance
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-surface-1 rounded-lg p-6 text-center shadow-[var(--shadow-card)]">
              <p className="text-text-3 text-sm mb-1">Monthly Traffic</p>
              <p className="text-3xl font-bold text-text-1">
                {formatNumber(content.currentState.traffic)}
              </p>
            </div>
            <div className="bg-surface-1 rounded-lg p-6 text-center shadow-[var(--shadow-card)]">
              <p className="text-text-3 text-sm mb-1">Ranking Keywords</p>
              <p className="text-3xl font-bold text-text-1">
                {formatNumber(content.currentState.keywords)}
              </p>
            </div>
            <div className="bg-surface-1 rounded-lg p-6 text-center shadow-[var(--shadow-card)]">
              <p className="text-text-3 text-sm mb-1">Traffic Value</p>
              <p className="text-3xl font-bold text-text-1">
                {formatCurrency(content.currentState.value * 100, currency)}/mo
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Opportunities Section */}
      <section data-section="opportunities" className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-text-1 mb-8 text-center">
            Growth Opportunities
          </h2>

          <div className="space-y-4">
            {content.opportunities.map((opp, index) => (
              <div
                key={index}
                className="bg-surface-2 rounded-lg p-4 flex items-center justify-between"
              >
                <div className="flex-1">
                  <p className="font-medium text-text-1">{opp.keyword}</p>
                  <p className="text-sm text-text-3">
                    {formatNumber(opp.volume)} monthly searches
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium",
                      getDifficultyColor(opp.difficulty)
                    )}
                  >
                    {opp.difficulty}
                  </span>
                  <span className="text-success font-semibold">
                    +{formatCurrency(opp.potential * 100, currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROI Section */}
      <section data-section="roi" className="py-16 px-4 bg-surface-2">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-text-1 mb-8 text-center">
            Projected Return on Investment
          </h2>

          <div className="bg-surface-1 rounded-lg p-8 shadow-[var(--shadow-card)]">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <p className="text-text-3 text-sm mb-2">Projected Traffic Gain</p>
                <p className="text-3xl font-bold text-success">
                  +{formatNumber(content.roi.projectedTrafficGain)} visitors/mo
                </p>
              </div>
              <div>
                <p className="text-text-3 text-sm mb-2">Additional Traffic Value</p>
                <p className="text-3xl font-bold text-success">
                  +{formatCurrency(content.roi.trafficValue * 100, currency)}/mo
                </p>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-border">
              <p className="text-text-3 text-sm text-center">
                Based on {(content.roi.defaultConversionRate * 100).toFixed(1)}%
                conversion rate and{" "}
                {formatCurrency(content.roi.defaultAov * 100, currency)} average order
                value
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Investment Section */}
      <section data-section="investment" className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-text-1 mb-8 text-center">
            Your Investment
          </h2>

          <div className="bg-surface-2 rounded-lg p-8">
            <div className="grid md:grid-cols-2 gap-8 mb-8">
              <div className="text-center">
                <p className="text-text-3 text-sm mb-2">Setup Fee</p>
                <p className="text-4xl font-bold text-text-1">
                  {formatCurrency(
                    proposal.setupFeeCents ?? content.investment.setupFee * 100,
                    currency
                  )}
                </p>
                <p className="text-text-3 text-sm">one-time</p>
              </div>
              <div className="text-center">
                <p className="text-text-3 text-sm mb-2">Monthly Fee</p>
                <p className="text-4xl font-bold text-text-1">
                  {formatCurrency(
                    proposal.monthlyFeeCents ?? content.investment.monthlyFee * 100,
                    currency
                  )}
                </p>
                <p className="text-text-3 text-sm">per month</p>
              </div>
            </div>

            <div className="border-t border-border pt-8">
              <p className="font-semibold text-text-1 mb-4">What&apos;s Included:</p>
              <ul className="space-y-3">
                {content.investment.inclusions.map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-success shrink-0 mt-0.5" />
                    <span className="text-text-2">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Accept Proposal CTA */}
            {proposal.status !== "accepted" && proposal.status !== "declined" && (
              <div className="mt-8 pt-8 border-t border-border text-center">
                <Button
                  size="lg"
                  onClick={handleAcceptProposal}
                  disabled={isAccepting}
                  className="px-8 py-6 text-lg font-semibold"
                  style={{
                    backgroundColor: brandConfig?.primaryColor ?? undefined,
                  }}
                >
                  {isAccepting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Accept Proposal & Proceed to Agreement
                      <ArrowRight className="h-5 w-5 ml-2" />
                    </>
                  )}
                </Button>
                {acceptError && (
                  <p className="mt-4 text-error text-sm">{acceptError}</p>
                )}
                <p className="mt-4 text-text-3 text-sm">
                  By accepting, you agree to proceed with the proposed services.
                </p>
              </div>
            )}

            {proposal.status === "accepted" && (
              <div className="mt-8 pt-8 border-t border-border text-center">
                <div className="inline-flex items-center gap-2 bg-success/10 text-success rounded-full px-6 py-3">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-semibold">Proposal Accepted</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Next Steps Section */}
      <section
        data-section="next-steps"
        className="py-16 px-4 bg-accent/5"
        style={{
          backgroundColor: brandConfig
            ? `${brandConfig.primaryColor}10`
            : undefined,
        }}
      >
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-text-1 mb-8">Next Steps</h2>

          <div className="space-y-4">
            {content.nextSteps.map((step, index) => (
              <div
                key={index}
                className="flex items-center gap-4 bg-surface-1 rounded-lg p-4 text-left"
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                  style={{
                    backgroundColor:
                      brandConfig?.primaryColor ?? "var(--accent)",
                  }}
                >
                  {index + 1}
                </div>
                <span className="text-text-1">{step}</span>
                <ArrowRight className="h-5 w-5 text-text-3 ml-auto shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 bg-surface-2 text-center">
        <p className="text-text-3 text-sm">
          This proposal was created for you. If you have questions, please
          contact us.
        </p>
        {proposal.expiresAt && (
          <p className="text-text-4 text-xs mt-2">
            Valid until {new Date(proposal.expiresAt).toLocaleDateString()}
          </p>
        )}
      </footer>
    </div>
  );
}

export default PublicProposalView;
