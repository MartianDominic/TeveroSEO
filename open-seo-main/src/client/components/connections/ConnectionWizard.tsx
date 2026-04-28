/**
 * Connection Wizard Component
 * Phase 31-04: Connection Wizard UI
 *
 * Multi-step wizard for adding site connections:
 * 1. DETECT - Platform detection from domain
 * 2. CREDENTIALS - Platform-specific credential form
 * 3. VERIFYING - Connection verification
 * 4. COMPLETE - Success with status display
 */
import { useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import { Button } from "@/client/components/ui/button";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { PlatformSelector } from "./PlatformSelector";
import { WordPressCredentialForm } from "./WordPressCredentialForm";
import { ShopifyOAuthButton } from "./ShopifyOAuthButton";
import { ConnectionStatus } from "./ConnectionStatus";
import {
  createConnectionFn,
  verifyConnectionFn,
} from "@/serverFunctions/connections";
import type {
  PlatformType,
  ConnectionWithoutCredentials,
} from "@/server/features/connections";

// ============================================================================
// Types
// ============================================================================

type WizardStep = "DETECT" | "CREDENTIALS" | "VERIFYING" | "COMPLETE";

interface ConnectionWizardProps {
  clientId: string;
  onComplete: (connection: ConnectionWithoutCredentials) => void;
  onCancel: () => void;
}

// ============================================================================
// Step Titles
// ============================================================================

const STEP_TITLES: Record<WizardStep, { title: string; description: string }> = {
  DETECT: {
    title: "Connect Website",
    description: "Enter the website domain to detect the platform",
  },
  CREDENTIALS: {
    title: "Enter Credentials",
    description: "Provide API credentials to connect",
  },
  VERIFYING: {
    title: "Verifying Connection",
    description: "Testing write permissions...",
  },
  COMPLETE: {
    title: "Connection Complete",
    description: "Your website is now connected",
  },
};

// ============================================================================
// Component
// ============================================================================

/**
 * Multi-step connection wizard.
 */
export function ConnectionWizard({
  clientId,
  onComplete,
  onCancel,
}: ConnectionWizardProps) {
  // Wizard state
  const [step, setStep] = useState<WizardStep>("DETECT");
  const [platform, setPlatform] = useState<PlatformType | null>(null);
  const [siteUrl, setSiteUrl] = useState("");
  const [connection, setConnection] = useState<ConnectionWithoutCredentials | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Handle platform selection from detector.
   */
  const handlePlatformSelected = useCallback(
    (selectedPlatform: PlatformType, url: string) => {
      setPlatform(selectedPlatform);
      setSiteUrl(url);
      setStep("CREDENTIALS");
      setError(null);
    },
    []
  );

  /**
   * Handle credential submission for WordPress.
   */
  const handleWordPressCredentials = useCallback(
    async (credentials: { username: string; appPassword: string }) => {
      if (!platform) return;

      setIsSubmitting(true);
      setError(null);

      try {
        // Create connection
        const conn = await createConnectionFn({
          data: {
            clientId,
            platform,
            siteUrl,
            credentials: {
              username: credentials.username,
              appPassword: credentials.appPassword,
            },
          },
        });

        setConnection(conn);
        setStep("VERIFYING");

        // Verify connection
        const result = await verifyConnectionFn({
          data: { connectionId: conn.id },
        });

        if (!result.success) {
          setError(result.error ?? "Verification failed. Check your credentials.");
          setStep("CREDENTIALS");
          return;
        }

        // Re-fetch connection to get updated status
        setConnection({ ...conn, status: "active" });
        setStep("COMPLETE");
      } catch (err) {
        const message = (err as Error).message || "Connection failed";
        setError(message);
        setStep("CREDENTIALS");
      } finally {
        setIsSubmitting(false);
      }
    },
    [clientId, platform, siteUrl]
  );

  /**
   * Handle back button in credentials step.
   */
  const handleBack = useCallback(() => {
    setStep("DETECT");
    setError(null);
  }, []);

  /**
   * Handle completion.
   */
  const handleDone = useCallback(() => {
    if (connection) {
      onComplete(connection);
    }
  }, [connection, onComplete]);

  // Get current step info
  const stepInfo = STEP_TITLES[step];

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>{stepInfo.title}</CardTitle>
        <CardDescription>{stepInfo.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Step: DETECT */}
        {step === "DETECT" && (
          <div className="space-y-4">
            <PlatformSelector onPlatformSelected={handlePlatformSelected} />
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        )}

        {/* Step: CREDENTIALS */}
        {step === "CREDENTIALS" && platform && (
          <>
            {platform === "wordpress" && (
              <WordPressCredentialForm
                siteUrl={siteUrl}
                onSubmit={handleWordPressCredentials}
                onBack={handleBack}
                error={error}
                isSubmitting={isSubmitting}
              />
            )}

            {platform === "shopify" && (
              <ShopifyOAuthButton
                shopDomain={siteUrl}
                onBack={handleBack}
              />
            )}

            {/* Unsupported platforms */}
            {!["wordpress", "shopify"].includes(platform) && (
              <div className="space-y-4">
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    Connection for {platform} is not yet supported.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Currently supported: WordPress, Shopify (coming soon)
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  className="w-full"
                >
                  Back
                </Button>
              </div>
            )}
          </>
        )}

        {/* Step: VERIFYING */}
        {step === "VERIFYING" && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <p className="text-muted-foreground">
              Testing connection to {siteUrl}...
            </p>
          </div>
        )}

        {/* Step: COMPLETE */}
        {step === "COMPLETE" && connection && (
          <div className="space-y-6">
            <div className="flex flex-col items-center py-4">
              <CheckCircle2 className="w-12 h-12 text-green-600 mb-4" />
              <h3 className="text-lg font-medium">Connection Successful!</h3>
              <p className="text-sm text-muted-foreground text-center mt-2">
                Your website has been connected and is ready for SEO automation.
              </p>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{connection.displayName}</p>
                  <p className="text-sm text-muted-foreground">
                    {connection.platform}
                  </p>
                </div>
                <ConnectionStatus connection={connection} />
              </div>
            </div>

            <Button
              type="button"
              onClick={handleDone}
              className="w-full"
            >
              Done
            </Button>
          </div>
        )}

        {/* Error in COMPLETE step (shouldn't happen, but just in case) */}
        {step === "COMPLETE" && !connection && (
          <div className="flex flex-col items-center py-8 space-y-4">
            <XCircle className="w-12 h-12 text-red-600" />
            <p className="text-muted-foreground">Something went wrong.</p>
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
            >
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ConnectionWizard;
