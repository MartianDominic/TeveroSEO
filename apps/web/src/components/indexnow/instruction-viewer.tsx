"use client";

/**
 * IndexNow Manual Instruction Viewer
 *
 * Displays platform-specific step-by-step instructions for manual IndexNow key deployment.
 * Features:
 * - Step-by-step navigation
 * - Code snippets with one-click copy
 * - Screenshot placeholders (ready for assets)
 * - Verification flow
 * - Common error troubleshooting
 */

import * as React from "react";
import { useCallback, useMemo, useState } from "react";

import {
  AlertCircle,
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  HelpCircle,
  Lightbulb,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useTranslations } from "next-intl";


import type {
  Platform,
  InstructionStep,
  CommonError,
  InstructionVariables,
} from "@/lib/indexnow/instruction-templates";
import {
  generateInstructions,
  getSupportedPlatforms,
  generateKeyFileName,
  generateKeyFileContent,
  generateVerificationUrl,
} from "@/lib/indexnow/instruction-templates";

import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  Badge,
  cn,
  Alert,
  AlertDescription,
  AlertTitle,
} from "@tevero/ui";

// ============================================================================
// Types
// ============================================================================

interface InstructionViewerProps {
  /** The IndexNow API key to deploy */
  apiKey: string;
  /** Client's domain */
  domain: string;
  /** Pre-selected platform (if detected) */
  initialPlatform?: Platform;
  /** Client name for personalization */
  clientName?: string;
  /** Callback when verification succeeds */
  onVerified?: () => void;
  /** Callback when user skips */
  onSkip?: () => void;
  /** Callback when user goes back to platform selection */
  onBack?: () => void;
  /** Custom verification function */
  verifyKey?: (url: string) => Promise<boolean>;
  /** Additional CSS classes */
  className?: string;
}

type ViewState = "platform-select" | "instructions" | "verification" | "success" | "error";

// ============================================================================
// Copy Button Component
// ============================================================================

interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
}

function CopyButton({ text, label, className }: CopyButtonProps) {
  const t = useTranslations("indexnow.copy");
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={handleCopy}
      className={cn("gap-1.5", className)}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5" />
          {t("copied")}
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          {label || t("button")}
        </>
      )}
    </Button>
  );
}

// ============================================================================
// Platform Selection
// ============================================================================

interface PlatformSelectProps {
  onSelect: (platform: Platform) => void;
}

function PlatformSelect({ onSelect }: PlatformSelectProps) {
  const t = useTranslations("indexnow");
  const platforms = getSupportedPlatforms();

  const difficultyColors = {
    easy: "bg-green-100 text-green-800",
    medium: "bg-yellow-100 text-yellow-800",
    hard: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-[var(--text-1)] mb-2">
          {t("selectPlatform")}
        </h2>
        <p className="text-[var(--text-3)]">{t("autoDeployFailed")}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {platforms.map((p) => (
          <Card
            key={p.platform}
            className="cursor-pointer hover:border-[var(--accent)] transition-colors"
            onClick={() => onSelect(p.platform)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-medium text-[var(--text-1)]">
                  {t(`platforms.${p.platform}`)}
                </h3>
                <Badge
                  variant="secondary"
                  className={cn("text-xs", difficultyColors[p.difficulty])}
                >
                  {t(`difficulty.${p.difficulty}`)}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-[var(--text-3)]">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {t("estimatedTime", { minutes: p.estimatedMinutes })}
                </span>
                {p.paidPlanRequired && (
                  <span className="text-amber-600">{t("paidRequired")}</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Step Display
// ============================================================================

interface StepDisplayProps {
  step: InstructionStep;
  variables: InstructionVariables;
}

function StepDisplay({ step, variables }: StepDisplayProps) {
  const t = useTranslations("indexnow");
  const tHelp = useTranslations("indexnow.help");

  // Interpolate step code
  const interpolatedCode = step.code
    ? step.code
        .replace(/{apiKey}/g, variables.apiKey)
        .replace(/{domain}/g, variables.domain)
    : null;

  return (
    <div className="space-y-4">
      {/* Step Header */}
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-[var(--accent)] text-white flex items-center justify-center font-semibold text-sm flex-shrink-0">
          {step.number}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-[var(--text-1)] text-lg">
            {t(step.titleKey)}
          </h3>
        </div>
      </div>

      {/* Description */}
      <p className="text-[var(--text-2)] ml-11">{t(step.descriptionKey)}</p>

      {/* Warning */}
      {step.warningKey && (
        <Alert variant="destructive" className="ml-11">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{t(step.warningKey)}</AlertDescription>
        </Alert>
      )}

      {/* Tip */}
      {step.tipKey && (
        <div className="ml-11 flex items-start gap-2 p-3 rounded-md bg-blue-50 text-blue-800 text-sm">
          <Lightbulb className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{t(step.tipKey)}</span>
        </div>
      )}

      {/* Screenshot Placeholder */}
      {step.screenshot && (
        <div className="ml-11 rounded-[var(--radius)] overflow-hidden border border-[var(--hairline)] bg-[var(--surface-2)]">
          <div className="aspect-video flex items-center justify-center text-[var(--text-3)]">
            {/* In production, replace with actual screenshot */}
            <span className="text-sm">Screenshot: {step.screenshot}</span>
          </div>
        </div>
      )}

      {/* Code Snippet */}
      {interpolatedCode && (
        <div className="ml-11 relative">
          <pre className="bg-[var(--surface-2)] p-4 rounded-[var(--radius)] text-sm overflow-x-auto font-mono text-[var(--text-1)] border border-[var(--hairline)]">
            <code>{interpolatedCode}</code>
          </pre>
          {step.hasCopyButton && (
            <CopyButton
              text={interpolatedCode}
              className="absolute top-2 right-2"
            />
          )}
        </div>
      )}

      {/* Help Links */}
      {(step.helpLink || step.videoUrl) && (
        <div className="ml-11 flex items-center gap-4 text-sm">
          <span className="text-[var(--text-3)]">{tHelp("stuck")}</span>
          {step.videoUrl && (
            <a
              href={step.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] hover:underline inline-flex items-center gap-1"
            >
              {tHelp("watchVideo")}
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {step.helpLink && (
            <a
              href={step.helpLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] hover:underline inline-flex items-center gap-1"
            >
              {tHelp("contactSupport")}
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Verification Screen
// ============================================================================

interface VerificationScreenProps {
  variables: InstructionVariables;
  onVerify: () => Promise<void>;
  verifying: boolean;
  verified: boolean;
  error: string | null;
}

function VerificationScreen({
  variables,
  onVerify,
  verifying,
  verified,
  error,
}: VerificationScreenProps) {
  const t = useTranslations("indexnow.verify");
  const tCopy = useTranslations("indexnow.copy");

  const checkUrl = generateVerificationUrl(variables.domain, variables.apiKey);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-[var(--text-1)] mb-2">
          {t("title")}
        </h2>
        <p className="text-[var(--text-3)]">{t("instruction")}</p>
      </div>

      {/* Verification URL */}
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-[var(--text-3)] mb-2">{t("visitUrl")}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-[var(--surface-2)] p-3 rounded-md text-sm font-mono break-all">
              {checkUrl}
            </code>
            <CopyButton text={checkUrl} label={tCopy("copyUrl")} />
          </div>
          <p className="text-xs text-[var(--text-3)] mt-2">
            {t("expectedContent")}
          </p>
        </CardContent>
      </Card>

      {/* Status */}
      {verified && (
        <Alert className="border-green-200 bg-green-50">
          <Check className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">{t("success")}</AlertTitle>
          <AlertDescription className="text-green-700">
            {t("successMessage")}
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t("failed")}</AlertTitle>
          <AlertDescription>{t("failedMessage")}</AlertDescription>
        </Alert>
      )}

      {/* Action Button */}
      <div className="flex justify-center">
        {verified ? null : (
          <Button onClick={onVerify} disabled={verifying} size="lg">
            {verifying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t("checking")}
              </>
            ) : error ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                {t("retry")}
              </>
            ) : (
              t("title")
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Common Errors Display
// ============================================================================

interface CommonErrorsProps {
  errors: CommonError[];
}

function CommonErrors({ errors }: CommonErrorsProps) {
  const t = useTranslations("indexnow");
  const [expanded, setExpanded] = useState<string | null>(null);

  if (errors.length === 0) return null;

  return (
    <div className="space-y-3">
      <h4 className="font-medium text-[var(--text-1)] flex items-center gap-2">
        <HelpCircle className="h-4 w-4" />
        Common Issues & Solutions
      </h4>
      <div className="space-y-2">
        {errors.map((error, idx) => (
          <Card key={idx} className="overflow-hidden">
            <button
              className="w-full p-3 text-left flex items-start justify-between hover:bg-[var(--surface-2)]"
              onClick={() => setExpanded(expanded === error.titleKey ? null : error.titleKey)}
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <span className="font-medium text-sm">{t(error.titleKey)}</span>
              </div>
              <ChevronRight
                className={cn(
                  "h-4 w-4 text-[var(--text-3)] transition-transform",
                  expanded === error.titleKey && "rotate-90"
                )}
              />
            </button>
            {expanded === error.titleKey && (
              <div className="px-3 pb-3 pt-0 ml-6 space-y-2 text-sm">
                <p className="text-[var(--text-3)]">{t(error.descriptionKey)}</p>
                <div className="p-2 bg-green-50 rounded text-green-800">
                  <strong>Solution:</strong> {t(error.solutionKey)}
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// File Content Preview
// ============================================================================

interface FilePreviewProps {
  apiKey: string;
  domain: string;
}

function FilePreview({ apiKey, domain }: FilePreviewProps) {
  const t = useTranslations("indexnow.copy");
  const fileName = generateKeyFileName(apiKey);
  const fileContent = generateKeyFileContent(apiKey);
  const verificationUrl = generateVerificationUrl(domain, apiKey);

  return (
    <Card className="bg-[var(--surface-2)]">
      <CardHeader className="pb-2">
        <h4 className="font-medium text-sm">Your IndexNow Key File</h4>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Filename */}
        <div>
          <label className="text-xs text-[var(--text-3)]">Filename</label>
          <div className="flex items-center gap-2 mt-1">
            <code className="flex-1 bg-white p-2 rounded text-sm font-mono border">
              {fileName}
            </code>
            <CopyButton text={fileName} label={t("copyFilename")} />
          </div>
        </div>

        {/* Content */}
        <div>
          <label className="text-xs text-[var(--text-3)]">File Content</label>
          <div className="flex items-center gap-2 mt-1">
            <code className="flex-1 bg-white p-2 rounded text-sm font-mono border break-all">
              {fileContent}
            </code>
            <CopyButton text={fileContent} label={t("copyContent")} />
          </div>
        </div>

        {/* Verification URL */}
        <div>
          <label className="text-xs text-[var(--text-3)]">Final URL</label>
          <div className="flex items-center gap-2 mt-1">
            <code className="flex-1 bg-white p-2 rounded text-xs font-mono border break-all text-[var(--text-3)]">
              {verificationUrl}
            </code>
            <CopyButton text={verificationUrl} label={t("copyUrl")} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function InstructionViewer({
  apiKey,
  domain,
  initialPlatform,
  clientName,
  onVerified,
  onSkip,
  onBack,
  verifyKey,
  className,
}: InstructionViewerProps) {
  const t = useTranslations("indexnow");
  const tNav = useTranslations("indexnow.navigation");

  // State
  const [viewState, setViewState] = useState<ViewState>(
    initialPlatform ? "instructions" : "platform-select"
  );
  const [platform, setPlatform] = useState<Platform | null>(initialPlatform || null);
  const [currentStep, setCurrentStep] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Variables for interpolation
  const variables: InstructionVariables = useMemo(
    () => ({
      apiKey,
      domain: domain.replace(/^https?:\/\//, "").replace(/\/$/, ""),
      fullDomain: domain.startsWith("http") ? domain : `https://${domain}`,
      clientName,
    }),
    [apiKey, domain, clientName]
  );

  // Get instructions for selected platform
  const instructions = useMemo(() => {
    if (!platform) return null;
    return generateInstructions(platform, variables);
  }, [platform, variables]);

  // Handlers
  const handlePlatformSelect = useCallback((p: Platform) => {
    setPlatform(p);
    setCurrentStep(0);
    setViewState("instructions");
  }, []);

  const handleNextStep = useCallback(() => {
    if (!instructions) return;
    if (currentStep < instructions.steps.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      setViewState("verification");
    }
  }, [currentStep, instructions]);

  const handlePrevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    } else if (onBack) {
      onBack();
    } else {
      setViewState("platform-select");
      setPlatform(null);
    }
  }, [currentStep, onBack]);

  const handleVerify = useCallback(async () => {
    setVerifying(true);
    setVerifyError(null);

    try {
      const url = generateVerificationUrl(variables.domain, variables.apiKey);

      if (verifyKey) {
        const result = await verifyKey(url);
        if (result) {
          setVerified(true);
          setViewState("success");
          onVerified?.();
        } else {
          setVerifyError("Verification failed");
        }
      } else {
        // Default verification: try to fetch the URL
        const response = await fetch(`/api/indexnow/verify?url=${encodeURIComponent(url)}`);
        const data = await response.json();

        if (data.verified) {
          setVerified(true);
          setViewState("success");
          onVerified?.();
        } else {
          setVerifyError(data.error || "Verification failed");
        }
      }
    } catch (err) {
      setVerifyError((err as Error).message);
    } finally {
      setVerifying(false);
    }
  }, [variables, verifyKey, onVerified]);

  // Render based on view state
  return (
    <div className={cn("max-w-2xl mx-auto", className)}>
      {/* Platform Selection */}
      {viewState === "platform-select" && (
        <PlatformSelect onSelect={handlePlatformSelect} />
      )}

      {/* Instructions */}
      {viewState === "instructions" && instructions && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-[var(--text-1)]">
                  {t(`platforms.${platform}`)}
                </h2>
                <p className="text-sm text-[var(--text-3)]">
                  Step {currentStep + 1} of {instructions.steps.length}
                </p>
              </div>
              <Badge variant="secondary" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {instructions.estimatedMinutes} min
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* File Preview (always visible) */}
            <FilePreview apiKey={apiKey} domain={variables.domain} />

            {/* Current Step */}
            <StepDisplay
              step={instructions.interpolatedSteps[currentStep]}
              variables={variables}
            />
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button variant="ghost" onClick={handlePrevStep}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              {tNav("back")}
            </Button>
            <div className="flex gap-2">
              {onSkip && (
                <Button variant="ghost" onClick={onSkip}>
                  {tNav("skip")}
                </Button>
              )}
              <Button onClick={handleNextStep}>
                {currentStep === instructions.steps.length - 1 ? (
                  tNav("verify")
                ) : (
                  <>
                    {tNav("next")}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {/* Verification */}
      {viewState === "verification" && instructions && (
        <Card>
          <CardContent className="pt-6">
            <VerificationScreen
              variables={variables}
              onVerify={handleVerify}
              verifying={verifying}
              verified={verified}
              error={verifyError}
            />

            {/* Common Errors (shown on failure) */}
            {verifyError && (
              <div className="mt-6">
                <CommonErrors
                  errors={instructions.commonErrors}
                />
              </div>
            )}
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button variant="ghost" onClick={() => setViewState("instructions")}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              {tNav("back")}
            </Button>
            {verified && (
              <Button onClick={onVerified}>
                {tNav("done")}
              </Button>
            )}
          </CardFooter>
        </Card>
      )}

      {/* Success */}
      {viewState === "success" && (
        <Card className="text-center">
          <CardContent className="pt-8 pb-8">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-[var(--text-1)]">
                  {t("verify.success")}
                </h2>
                <p className="text-[var(--text-3)] mt-1">
                  {t("verify.successMessage")}
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-center">
            <Button onClick={onVerified}>{tNav("done")}</Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}

export default InstructionViewer;
