"use client";

/**
 * Proposal Preview Component
 * Phase 55-05: Dynamic Content Translation Integration
 *
 * Displays proposal content with language toggle for EN/LT preview.
 * Fetches translation on-demand when switching to LT.
 */

import { useState, useCallback } from "react";

import { Globe, Languages } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/**
 * Hero section content.
 */
interface HeroContent {
  headline: string;
  subheadline: string;
}

/**
 * Solution item in proposals.
 */
interface SolutionItem {
  title: string;
  description: string;
}

/**
 * Investment line item.
 */
interface InvestmentLineItem {
  name: string;
  description: string;
  price: number;
}

/**
 * Investment section content.
 */
interface InvestmentContent {
  description: string;
  items: InvestmentLineItem[];
  total: number;
}

/**
 * Full proposal content structure.
 */
interface ProposalContent {
  hero: HeroContent;
  problemStatements?: string[];
  solutions?: SolutionItem[];
  investment?: InvestmentContent;
  nextSteps?: string[];
  closingStatement?: string;
}

/**
 * Props for ProposalPreview component.
 */
interface ProposalPreviewProps {
  /** Proposal ID for fetching translation */
  proposalId: string;
  /** English content (always available) */
  contentEn: ProposalContent;
  /** Lithuanian content (may be cached) */
  contentLt?: ProposalContent;
  /** Default language to display */
  defaultLanguage?: "en" | "lt";
  /** Callback when translation is fetched */
  onTranslationFetched?: (content: ProposalContent) => void;
}

type PreviewLang = "en" | "lt";

/**
 * Proposal preview with language toggle.
 */
export function ProposalPreview({
  proposalId,
  contentEn,
  contentLt,
  defaultLanguage = "en",
  onTranslationFetched,
}: ProposalPreviewProps) {
  const t = useTranslations("proposals");
  const [previewLang, setPreviewLang] = useState<PreviewLang>(defaultLanguage);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedContent, setTranslatedContent] = useState<ProposalContent | undefined>(contentLt);
  const [error, setError] = useState<string | null>(null);

  // Get content based on selected language
  const content = previewLang === "lt" ? (translatedContent ?? contentEn) : contentEn;

  /**
   * Handle language change - fetch translation if needed.
   */
  const handleLanguageChange = useCallback(async (value: string) => {
    if (!value) return;

    const newLang = value as PreviewLang;
    setPreviewLang(newLang);
    setError(null);

    // If switching to LT and no translation cached, fetch it
    if (newLang === "lt" && !translatedContent) {
      setIsTranslating(true);
      try {
        const response = await fetch(`/api/proposals/${proposalId}/translate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetLanguage: "lt" }),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch translation");
        }

        const data = await response.json();
        setTranslatedContent(data.content);
        onTranslationFetched?.(data.content);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Translation failed");
      } finally {
        setIsTranslating(false);
      }
    }
  }, [proposalId, translatedContent, onTranslationFetched]);

  return (
    <div className="space-y-6">
      {/* Language Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Languages className="h-4 w-4" />
          <span>{t("preview.languageLabel", { fallback: "Preview Language" })}</span>
        </div>
        <ToggleGroup
          type="single"
          value={previewLang}
          onValueChange={handleLanguageChange}
          className="border rounded-lg"
        >
          <ToggleGroupItem value="en" aria-label="English" className="px-4">
            <Globe className="h-4 w-4 mr-2" />
            EN
          </ToggleGroupItem>
          <ToggleGroupItem value="lt" aria-label="Lithuanian" className="px-4">
            <Globe className="h-4 w-4 mr-2" />
            LT
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Language Badge */}
      <Badge variant={previewLang === "lt" ? "secondary" : "outline"} className="w-fit">
        {previewLang === "lt" ? "Lietuviu kalba" : "English"}
      </Badge>

      {/* Error State */}
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
          {error}
        </div>
      )}

      {/* Loading State */}
      {isTranslating ? (
        <div className="space-y-4">
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <>
          {/* Hero Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{content.hero.headline}</CardTitle>
              <p className="text-muted-foreground">{content.hero.subheadline}</p>
            </CardHeader>
          </Card>

          {/* Problem Statements */}
          {content.problemStatements && content.problemStatements.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("sections.challenges", { fallback: "Challenges" })}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-2">
                  {content.problemStatements.map((statement) => (
                    <li key={`problem-${statement.slice(0, 30).replace(/\s/g, '-')}`} className="text-muted-foreground">{statement}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Solutions */}
          {content.solutions && content.solutions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("sections.solutions", { fallback: "Our Solutions" })}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {content.solutions.map((solution) => (
                  <div key={`solution-${solution.title.slice(0, 30).replace(/\s/g, '-')}`} className="border-b last:border-0 pb-4 last:pb-0">
                    <h4 className="font-medium">{solution.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{solution.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Investment */}
          {content.investment && (
            <Card>
              <CardHeader>
                <CardTitle>{t("sections.investment", { fallback: "Investment" })}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {content.investment.description && (
                  <p className="text-muted-foreground">{content.investment.description}</p>
                )}
                {content.investment.items && content.investment.items.length > 0 && (
                  <div className="space-y-2">
                    {content.investment.items.map((item) => (
                      <div key={`investment-${item.name.slice(0, 30).replace(/\s/g, '-')}`} className="flex justify-between items-start border-b pb-2">
                        <div>
                          <span className="font-medium">{item.name}</span>
                          {item.description && (
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                          )}
                        </div>
                        <span className="font-mono">{formatCurrency(item.price)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 font-semibold">
                  <span>{t("labels.total", { fallback: "Total" })}</span>
                  <span className="font-mono text-lg">{formatCurrency(content.investment.total)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Next Steps */}
          {content.nextSteps && content.nextSteps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("sections.nextSteps", { fallback: "Next Steps" })}</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="list-decimal list-inside space-y-2">
                  {content.nextSteps.map((step) => (
                    <li key={`step-${step.slice(0, 30).replace(/\s/g, '-')}`} className="text-muted-foreground">{step}</li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          {/* Closing Statement */}
          {content.closingStatement && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground italic">
                  {content.closingStatement}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Format currency value.
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export default ProposalPreview;
