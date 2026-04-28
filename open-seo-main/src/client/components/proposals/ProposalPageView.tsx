/**
 * ProposalPageView component
 * Phase 30: Interactive Proposal Page
 *
 * Main scrollytelling proposal view combining all sections.
 * Public-facing page for recipients to view and accept proposals.
 */

import { useCallback, useEffect, useState, useRef } from "react";
import { useScrollSection } from "@/client/hooks/useScrollSection";
import { ProgressIndicator } from "./ProgressIndicator";
import { StickyCtaButton } from "./StickyCtaButton";
import { HeroSection } from "./sections/HeroSection";
import { CurrentStateSection } from "./sections/CurrentStateSection";
import { OpportunitiesSection } from "./sections/OpportunitiesSection";
import { RoiCalculatorSection } from "./sections/RoiCalculatorSection";
import { InvestmentSection } from "./sections/InvestmentSection";
import { CtaSection } from "./sections/CtaSection";
import type { ProposalSelect, ProposalContent, BrandConfig } from "@/db/proposal-schema";

const SECTIONS = [
  { id: "hero", label: "Apzvalga" },
  { id: "current", label: "Dabartine situacija" },
  { id: "opportunities", label: "Galimybes" },
  { id: "roi", label: "ROI skaiciuokle" },
  { id: "investment", label: "Investicija" },
  { id: "cta", label: "Kitas zingsnis" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

interface ProposalPageViewProps {
  /** Full proposal data */
  proposal: ProposalSelect;
  /** Company name for display */
  companyName?: string;
  /** Callback when proposal is accepted */
  onAccept: () => Promise<void>;
  /** Callback when ROI calculator is used */
  onCalculatorUsed?: () => void;
  /** Callback when view is recorded */
  onViewRecorded?: (data: {
    sectionsViewed: string[];
    durationSeconds: number;
    roiCalculatorUsed: boolean;
  }) => void;
}

/**
 * Main proposal page view with scrollytelling experience.
 */
export function ProposalPageView({
  proposal,
  companyName,
  onAccept,
  onCalculatorUsed,
  onViewRecorded,
}: ProposalPageViewProps) {
  const [isAccepting, setIsAccepting] = useState(false);
  const [showStickyCta, setShowStickyCta] = useState(false);
  const [roiCalculatorUsed, setRoiCalculatorUsed] = useState(false);
  const viewStartTime = useRef(Date.now());
  const sectionsViewed = useRef(new Set<string>());

  const content = proposal.content as ProposalContent;
  const brandConfig = proposal.brandConfig as BrandConfig | null;

  const {
    sectionRefs,
    activeSection,
    visibleSections,
    scrollToSection,
    observeSection,
  } = useScrollSection<SectionId>({
    sectionIds: SECTIONS.map((s) => s.id),
    threshold: 0.3,
  });

  // Track viewed sections
  useEffect(() => {
    Object.entries(visibleSections).forEach(([section, isVisible]) => {
      if (isVisible) {
        sectionsViewed.current.add(section);
      }
    });
  }, [visibleSections]);

  // Show sticky CTA after investment section
  useEffect(() => {
    const investmentIndex = SECTIONS.findIndex((s) => s.id === "investment");
    const currentIndex = SECTIONS.findIndex((s) => s.id === activeSection);
    setShowStickyCta(currentIndex > investmentIndex);
  }, [activeSection]);

  // Observe sections on mount
  useEffect(() => {
    // Small delay to ensure refs are set
    const timer = setTimeout(() => {
      SECTIONS.forEach((section) => {
        observeSection(section.id);
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [observeSection]);

  // Record view on unmount
  useEffect(() => {
    return () => {
      const durationSeconds = Math.round((Date.now() - viewStartTime.current) / 1000);
      onViewRecorded?.({
        sectionsViewed: Array.from(sectionsViewed.current),
        durationSeconds,
        roiCalculatorUsed,
      });
    };
  }, [onViewRecorded, roiCalculatorUsed]);

  const handleScrollDown = useCallback(() => {
    scrollToSection("current");
  }, [scrollToSection]);

  const handleAccept = useCallback(async () => {
    setIsAccepting(true);
    try {
      await onAccept();
    } finally {
      setIsAccepting(false);
    }
  }, [onAccept]);

  const handleCalculatorUsed = useCallback(() => {
    setRoiCalculatorUsed(true);
    onCalculatorUsed?.();
  }, [onCalculatorUsed]);

  // Set refs on section elements
  const setRef = (id: SectionId) => (el: HTMLElement | null) => {
    sectionRefs.current[id] = el;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Progress indicator */}
      <ProgressIndicator
        sections={SECTIONS}
        activeSection={activeSection}
        onSectionClick={(id) => scrollToSection(id as SectionId)}
      />

      {/* Hero */}
      <div ref={setRef("hero")}>
        <HeroSection
          content={content.hero}
          brandConfig={brandConfig}
          companyName={companyName}
          expiresAt={proposal.expiresAt}
          onScrollDown={handleScrollDown}
        />
      </div>

      {/* Current State */}
      <div ref={setRef("current")}>
        <CurrentStateSection
          content={content.currentState}
          brandConfig={brandConfig}
        />
      </div>

      {/* Opportunities */}
      <div ref={setRef("opportunities")}>
        <OpportunitiesSection
          opportunities={content.opportunities}
          brandConfig={brandConfig}
        />
      </div>

      {/* ROI Calculator */}
      <div ref={setRef("roi")}>
        <RoiCalculatorSection
          roi={content.roi}
          monthlyFee={content.investment.monthlyFee}
          brandConfig={brandConfig}
          onCalculatorUsed={handleCalculatorUsed}
        />
      </div>

      {/* Investment */}
      <div ref={setRef("investment")}>
        <InvestmentSection
          investment={content.investment}
          currency={proposal.currency ?? "EUR"}
          brandConfig={brandConfig}
        />
      </div>

      {/* CTA */}
      <div ref={setRef("cta")}>
        <CtaSection
          nextSteps={content.nextSteps}
          brandConfig={brandConfig}
          onAccept={handleAccept}
          isAccepting={isAccepting}
        />
      </div>

      {/* Sticky CTA button */}
      <StickyCtaButton
        isVisible={showStickyCta && activeSection !== "cta"}
        onClick={handleAccept}
        isLoading={isAccepting}
        primaryColor={brandConfig?.primaryColor ?? undefined}
      />
    </div>
  );
}
