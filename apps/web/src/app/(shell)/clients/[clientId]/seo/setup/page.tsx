"use client";

/**
 * /clients/[clientId]/seo/setup — SEO Project Setup Page
 *
 * Guides users through the SEO project setup flow:
 * 1. Domain verification (enter and validate domain)
 * 2. Sitemap import (detect or manually enter sitemap URL)
 * 3. Initial audit configuration and launch
 *
 * Phase 65: CRIT-01 fix - Creates missing SEO setup page
 */

import { useState, useTransition, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Globe,
  FileSearch,
  Rocket,
  Check,
  ChevronRight,
  AlertCircle,
  Loader2,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  PageHeader,
  Skeleton,
} from "@tevero/ui";
import { apiPost, apiGet } from "@/lib/api-client";
import { useClientStore } from "@/stores/clientStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SetupStep = "domain" | "sitemap" | "audit";

interface DetectedSitemap {
  url: string;
  type: "xml" | "txt" | "rss";
  pageCount?: number;
}

interface ProjectCreateResponse {
  id: string;
  name: string;
  domain: string;
}

interface SitemapCheckResponse {
  found: boolean;
  sitemaps: DetectedSitemap[];
}

// ---------------------------------------------------------------------------
// StepIndicator Component (with ARIA labels for accessibility)
// ---------------------------------------------------------------------------

function StepIndicator({
  currentStep,
  steps,
}: {
  currentStep: SetupStep;
  steps: { key: SetupStep; label: string }[];
}) {
  const currentIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <nav aria-label="Setup progress" className="mb-8">
      <ol className="flex items-center justify-center gap-2" role="list">
        {steps.map((step, i) => {
          const isComplete = currentIndex > i;
          const isCurrent = currentStep === step.key;

          return (
            <li key={step.key} className="flex items-center" role="listitem">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  isCurrent
                    ? "bg-primary text-primary-foreground"
                    : isComplete
                      ? "bg-green-500 text-white"
                      : "bg-muted text-muted-foreground"
                }`}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={`Step ${i + 1}: ${step.label}${isComplete ? " (completed)" : isCurrent ? " (current)" : ""}`}
              >
                {isComplete ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  i + 1
                )}
              </div>
              <span className="sr-only">{step.label}</span>
              {i < steps.length - 1 && (
                <ChevronRight
                  className="h-4 w-4 mx-2 text-muted-foreground"
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
      <div className="text-center mt-2">
        <span className="text-sm text-muted-foreground">
          Step {currentIndex + 1} of {steps.length}:{" "}
          <span className="font-medium text-foreground">
            {steps[currentIndex]?.label}
          </span>
        </span>
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function SeoSetupPage() {
  const params = useParams<{ clientId: string }>();
  const clientId = params.clientId;
  const router = useRouter();
  const { activeClient } = useClientStore();

  // Step state
  const [step, setStep] = useState<SetupStep>("domain");
  const [isPending, startTransition] = useTransition();

  // Domain step state
  const [domain, setDomain] = useState(
    activeClient?.website_url?.replace(/^https?:\/\//, "").replace(/\/$/, "") ?? ""
  );
  const [domainError, setDomainError] = useState<string | null>(null);
  const [domainValid, setDomainValid] = useState(false);

  // Sitemap step state
  const [sitemaps, setSitemaps] = useState<DetectedSitemap[]>([]);
  const [selectedSitemap, setSelectedSitemap] = useState<string | null>(null);
  const [manualSitemap, setManualSitemap] = useState("");
  const [sitemapLoading, setSitemapLoading] = useState(false);
  const [sitemapError, setSitemapError] = useState<string | null>(null);

  // Audit step state
  const [projectId, setProjectId] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditStarted, setAuditStarted] = useState(false);

  const steps: { key: SetupStep; label: string }[] = [
    { key: "domain", label: "Verify Domain" },
    { key: "sitemap", label: "Import Sitemap" },
    { key: "audit", label: "Start Audit" },
  ];

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const validateDomain = useCallback(async () => {
    setDomainError(null);

    if (!domain.trim()) {
      setDomainError("Domain is required");
      return;
    }

    // Basic domain format validation
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;
    const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

    if (!domainRegex.test(cleanDomain)) {
      setDomainError("Please enter a valid domain (e.g., example.com)");
      return;
    }

    setDomainValid(true);
    setStep("sitemap");

    // Auto-detect sitemaps
    detectSitemaps(cleanDomain);
  }, [domain]);

  const detectSitemaps = async (domainToCheck: string) => {
    setSitemapLoading(true);
    setSitemapError(null);

    try {
      const normalizedDomain = domainToCheck.startsWith("http")
        ? domainToCheck
        : `https://${domainToCheck}`;

      // Try to detect sitemaps via API or common paths
      const result = await apiGet<SitemapCheckResponse>(
        `/api/seo/detect-sitemap?url=${encodeURIComponent(normalizedDomain)}`
      ).catch(() => null);

      if (result?.found && result.sitemaps.length > 0) {
        setSitemaps(result.sitemaps);
        setSelectedSitemap(result.sitemaps[0]?.url ?? null);
      } else {
        // Fallback: suggest common sitemap paths
        setSitemaps([
          { url: `${normalizedDomain}/sitemap.xml`, type: "xml" },
          { url: `${normalizedDomain}/sitemap_index.xml`, type: "xml" },
        ]);
      }
    } catch {
      setSitemapError("Could not auto-detect sitemaps. You can enter one manually.");
    } finally {
      setSitemapLoading(false);
    }
  };

  const handleSitemapContinue = useCallback(() => {
    const sitemapUrl = manualSitemap.trim() || selectedSitemap;

    if (!sitemapUrl) {
      setSitemapError("Please select or enter a sitemap URL");
      return;
    }

    setSitemapError(null);
    setStep("audit");
  }, [manualSitemap, selectedSitemap]);

  const handleSkipSitemap = useCallback(() => {
    setSelectedSitemap(null);
    setManualSitemap("");
    setStep("audit");
  }, []);

  const handleCreateProjectAndAudit = useCallback(async () => {
    setAuditError(null);

    startTransition(async () => {
      try {
        // Create SEO project
        const normalizedDomain = domain.startsWith("http")
          ? domain
          : `https://${domain}`;

        const project = await apiPost<ProjectCreateResponse>(
          "/api/seo/projects",
          {
            client_id: clientId,
            name: `${domain} SEO`,
            domain: normalizedDomain,
            sitemap_url: manualSitemap.trim() || selectedSitemap || undefined,
          }
        );

        setProjectId(project.id);

        // Start the initial audit
        await apiPost(`/api/seo/projects/${project.id}/audits`, {
          scope: "full",
        });

        setAuditStarted(true);

        // Redirect to the audit page after a short delay
        setTimeout(() => {
          router.push(
            `/clients/${clientId}/seo/${project.id}/audit` as Parameters<typeof router.push>[0]
          );
        }, 2000);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to create project";
        setAuditError(message);
      }
    });
  }, [clientId, domain, manualSitemap, selectedSitemap, router]);

  const handleBack = useCallback(() => {
    if (step === "sitemap") {
      setStep("domain");
    } else if (step === "audit") {
      setStep("sitemap");
    }
  }, [step]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <PageHeader
        title="SEO Project Setup"
        subtitle={activeClient?.name ?? "New Project"}
        backHref={`/clients/${clientId}/seo` as Parameters<typeof PageHeader>[0]["backHref"]}
      />

      <StepIndicator currentStep={step} steps={steps} />

      {/* Domain Verification Step */}
      {step === "domain" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              Verify Your Domain
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the domain you want to audit. We will crawl this site and
              analyze its SEO performance.
            </p>

            <div className="space-y-2">
              <Label htmlFor="domain">Website Domain</Label>
              <Input
                id="domain"
                placeholder="example.com"
                value={domain}
                onChange={(e) => {
                  setDomain(e.target.value);
                  setDomainError(null);
                }}
                disabled={isPending}
                aria-describedby={domainError ? "domain-error" : undefined}
                aria-invalid={!!domainError}
              />
              {domainError && (
                <p
                  id="domain-error"
                  className="text-xs text-destructive flex items-center gap-1"
                  role="alert"
                >
                  <AlertCircle className="h-3 w-3" />
                  {domainError}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button asChild variant="ghost">
                <Link href={`/clients/${clientId}/seo` as Parameters<typeof Link>[0]["href"]}>Cancel</Link>
              </Button>
              <Button onClick={validateDomain} disabled={isPending || !domain.trim()}>
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Continue
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sitemap Import Step */}
      {step === "sitemap" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSearch className="h-5 w-5 text-primary" />
              Import Sitemap
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A sitemap helps us crawl your site more efficiently. We have
              detected the following sitemaps:
            </p>

            {sitemapLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : sitemaps.length > 0 ? (
              <div className="space-y-2">
                {sitemaps.map((sitemap) => (
                  <button
                    key={sitemap.url}
                    type="button"
                    className={`w-full p-3 rounded-lg border text-left transition-colors ${
                      selectedSitemap === sitemap.url
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => {
                      setSelectedSitemap(sitemap.url);
                      setManualSitemap("");
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">
                        {sitemap.url}
                      </span>
                      {selectedSitemap === sitemap.url && (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </div>
                    {sitemap.pageCount && (
                      <span className="text-xs text-muted-foreground">
                        {sitemap.pageCount} pages
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="manual-sitemap">Or enter sitemap URL manually</Label>
              <Input
                id="manual-sitemap"
                placeholder="https://example.com/sitemap.xml"
                value={manualSitemap}
                onChange={(e) => {
                  setManualSitemap(e.target.value);
                  if (e.target.value) {
                    setSelectedSitemap(null);
                  }
                }}
              />
            </div>

            {sitemapError && (
              <div
                className="flex items-center gap-2 p-3 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm"
                role="alert"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                {sitemapError}
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() => detectSitemaps(domain)}
                  aria-label="Retry sitemap detection"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div className="flex justify-between gap-3 pt-4">
              <Button variant="ghost" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleSkipSitemap}>
                  Skip
                </Button>
                <Button
                  onClick={handleSitemapContinue}
                  disabled={!selectedSitemap && !manualSitemap.trim()}
                >
                  Continue
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Start Audit Step */}
      {step === "audit" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-primary" />
              Start Your First Audit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {auditStarted ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
                  <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Audit Started Successfully!
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  We are now crawling your site. This may take a few minutes
                  depending on the size of your site.
                </p>
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Redirecting to audit dashboard...
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-lg bg-muted p-4 space-y-2">
                  <h4 className="text-sm font-medium text-foreground">
                    Audit Configuration
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Domain:</span>
                    <span className="font-medium">{domain}</span>
                    <span className="text-muted-foreground">Sitemap:</span>
                    <span className="font-medium truncate">
                      {manualSitemap.trim() || selectedSitemap || "Auto-discover"}
                    </span>
                    <span className="text-muted-foreground">Scope:</span>
                    <span className="font-medium">Full site audit</span>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  We will analyze over 100 SEO factors including technical SEO,
                  content quality, mobile-friendliness, and Core Web Vitals.
                </p>

                {auditError && (
                  <div
                    className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm"
                    role="alert"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {auditError}
                  </div>
                )}

                <div className="flex justify-between gap-3 pt-4">
                  <Button variant="ghost" onClick={handleBack}>
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                  <Button
                    onClick={handleCreateProjectAndAudit}
                    disabled={isPending}
                    size="lg"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Creating Project...
                      </>
                    ) : (
                      <>
                        <Rocket className="h-4 w-4 mr-2" />
                        Start Audit
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
