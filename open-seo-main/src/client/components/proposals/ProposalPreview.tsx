/**
 * ProposalPreview component
 * Phase 30: Interactive Proposals - Preview Component
 *
 * Live preview of proposal as recipient sees it.
 * Supports mobile/desktop toggle and section navigation.
 */
import { useState } from "react";
import { Card } from "@/client/components/ui/card";
import { Button } from "@/client/components/ui/button";
import {
  Monitor,
  Smartphone,
  TrendingUp,
  BarChart3,
  Target,
  Calculator,
  DollarSign,
  ArrowRight,
} from "lucide-react";
import type { ProposalContent, BrandConfig } from "@/db/proposal-schema";

interface ProposalPreviewProps {
  content: ProposalContent;
  brandConfig?: BrandConfig | null;
  companyName?: string;
}

type ViewMode = "desktop" | "mobile";
type Section = "hero" | "current" | "opportunities" | "roi" | "investment" | "next";

const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: "hero", label: "Overview", icon: <TrendingUp className="h-4 w-4" /> },
  { id: "current", label: "Current State", icon: <BarChart3 className="h-4 w-4" /> },
  { id: "opportunities", label: "Opportunities", icon: <Target className="h-4 w-4" /> },
  { id: "roi", label: "ROI Calculator", icon: <Calculator className="h-4 w-4" /> },
  { id: "investment", label: "Investment", icon: <DollarSign className="h-4 w-4" /> },
  { id: "next", label: "Next Steps", icon: <ArrowRight className="h-4 w-4" /> },
];

/**
 * Renders a live preview of the proposal
 */
export function ProposalPreview({
  content,
  brandConfig,
  companyName,
}: ProposalPreviewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("desktop");
  const [activeSection, setActiveSection] = useState<Section>("hero");

  const primaryColor = brandConfig?.primaryColor ?? "#2563eb";
  const secondaryColor = brandConfig?.secondaryColor ?? "#1e40af";

  const scrollToSection = (section: Section) => {
    setActiveSection(section);
    const element = document.getElementById(`preview-${section}`);
    element?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Preview controls */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Preview Mode:
          </span>
          <div className="flex gap-1">
            <Button
              variant={viewMode === "desktop" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("desktop")}
            >
              <Monitor className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "mobile" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("mobile")}
            >
              <Smartphone className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Section navigation */}
        <div className="hidden md:flex items-center gap-1">
          {SECTIONS.map((section) => (
            <Button
              key={section.id}
              variant={activeSection === section.id ? "secondary" : "ghost"}
              size="sm"
              onClick={() => scrollToSection(section.id)}
              className="gap-1"
            >
              {section.icon}
              <span className="hidden lg:inline">{section.label}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Preview container */}
      <div className="flex-1 overflow-auto bg-gray-100 p-4">
        <div
          className={`mx-auto transition-all duration-300 ${
            viewMode === "mobile" ? "max-w-[375px]" : "max-w-4xl"
          }`}
        >
          <Card className="overflow-hidden shadow-lg">
            {/* Hero Section */}
            <section
              id="preview-hero"
              className="p-8 text-white"
              style={{
                background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
              }}
            >
              {brandConfig?.logoUrl && (
                <img
                  src={brandConfig.logoUrl}
                  alt="Company logo"
                  className="h-12 mb-6"
                />
              )}
              <h1 className="text-3xl font-bold mb-2">{content.hero.headline}</h1>
              <p className="text-lg opacity-90 mb-6">{content.hero.subheadline}</p>
              <div className="flex items-center gap-2 text-sm">
                <span className="opacity-75">Projected Traffic Value:</span>
                <span className="text-2xl font-bold">
                  ${content.hero.trafficValue.toLocaleString()}
                </span>
              </div>
            </section>

            {/* Current State Section */}
            <section id="preview-current" className="p-8 border-b">
              <h2 className="text-xl font-semibold mb-4">Current SEO Performance</h2>
              <div className="grid grid-cols-3 gap-4">
                <MetricCard
                  label="Monthly Traffic"
                  value={content.currentState.traffic.toLocaleString()}
                  color={primaryColor}
                />
                <MetricCard
                  label="Ranking Keywords"
                  value={content.currentState.keywords.toLocaleString()}
                  color={primaryColor}
                />
                <MetricCard
                  label="Traffic Value"
                  value={`$${content.currentState.value.toLocaleString()}`}
                  color={primaryColor}
                />
              </div>
              {content.currentState.chartData.length > 0 && (
                <div className="mt-6 h-32 flex items-end justify-between gap-2">
                  {content.currentState.chartData.map((point, i) => (
                    <div key={i} className="flex flex-col items-center flex-1">
                      <div
                        className="w-full rounded-t"
                        style={{
                          height: `${Math.max(20, (point.traffic / Math.max(...content.currentState.chartData.map(d => d.traffic))) * 100)}%`,
                          backgroundColor: primaryColor,
                          opacity: 0.7 + (i * 0.05),
                        }}
                      />
                      <span className="text-xs text-muted-foreground mt-1">
                        {point.month}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Opportunities Section */}
            <section id="preview-opportunities" className="p-8 border-b">
              <h2 className="text-xl font-semibold mb-4">
                Keyword Opportunities ({content.opportunities.length})
              </h2>
              {content.opportunities.length === 0 ? (
                <p className="text-muted-foreground">
                  No opportunities data available yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {content.opportunities.slice(0, 5).map((opp, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div>
                        <span className="font-medium">{opp.keyword}</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          {opp.volume.toLocaleString()} searches/mo
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <DifficultyBadge difficulty={opp.difficulty} />
                        <span className="text-sm font-medium" style={{ color: primaryColor }}>
                          ${opp.potential.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                  {content.opportunities.length > 5 && (
                    <p className="text-sm text-muted-foreground text-center">
                      +{content.opportunities.length - 5} more opportunities
                    </p>
                  )}
                </div>
              )}
            </section>

            {/* ROI Section */}
            <section id="preview-roi" className="p-8 border-b bg-muted/30">
              <h2 className="text-xl font-semibold mb-4">ROI Calculator</h2>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-sm text-muted-foreground">
                    Projected Traffic Gain
                  </label>
                  <p className="text-2xl font-bold">
                    +{content.roi.projectedTrafficGain.toLocaleString()}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">
                    Traffic Value
                  </label>
                  <p className="text-2xl font-bold" style={{ color: primaryColor }}>
                    ${content.roi.trafficValue.toLocaleString()}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">
                    Conversion Rate
                  </label>
                  <p className="text-lg font-medium">
                    {(content.roi.defaultConversionRate * 100).toFixed(1)}%
                  </p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">
                    Avg Order Value
                  </label>
                  <p className="text-lg font-medium">
                    ${content.roi.defaultAov.toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="mt-6 p-4 rounded-lg border-2" style={{ borderColor: primaryColor }}>
                <p className="text-sm text-muted-foreground mb-1">
                  Estimated Monthly Revenue
                </p>
                <p className="text-3xl font-bold" style={{ color: primaryColor }}>
                  $
                  {Math.round(
                    content.roi.projectedTrafficGain *
                      content.roi.defaultConversionRate *
                      content.roi.defaultAov
                  ).toLocaleString()}
                </p>
              </div>
            </section>

            {/* Investment Section */}
            <section id="preview-investment" className="p-8 border-b">
              <h2 className="text-xl font-semibold mb-4">Investment</h2>
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="p-4 rounded-lg border">
                  <p className="text-sm text-muted-foreground">Setup Fee</p>
                  <p className="text-2xl font-bold">
                    ${content.investment.setupFee.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">One-time</p>
                </div>
                <div className="p-4 rounded-lg border">
                  <p className="text-sm text-muted-foreground">Monthly Fee</p>
                  <p className="text-2xl font-bold">
                    ${content.investment.monthlyFee.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">Per month</p>
                </div>
              </div>
              <div>
                <p className="font-medium mb-2">What's Included:</p>
                <ul className="space-y-2">
                  {content.investment.inclusions.map((item, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs"
                        style={{ backgroundColor: primaryColor }}
                      >
                        ✓
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* Next Steps Section */}
            <section id="preview-next" className="p-8">
              <h2 className="text-xl font-semibold mb-4">Next Steps</h2>
              <ol className="space-y-4">
                {content.nextSteps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {i + 1}
                    </span>
                    <span className="pt-1">{step}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-8">
                <Button
                  className="w-full py-6 text-lg"
                  style={{ backgroundColor: primaryColor }}
                >
                  Accept Proposal
                </Button>
              </div>
            </section>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="p-4 rounded-lg border">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: "easy" | "medium" | "hard" }) {
  const colors = {
    easy: "bg-green-100 text-green-800",
    medium: "bg-yellow-100 text-yellow-800",
    hard: "bg-red-100 text-red-800",
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${colors[difficulty]}`}>
      {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
    </span>
  );
}
