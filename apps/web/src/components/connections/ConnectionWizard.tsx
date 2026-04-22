"use client";

import { useState } from "react";
import { Loader2, Globe, Check, AlertCircle, ChevronRight } from "lucide-react";
import {
  Button,
  Input,
  Label,
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  StatusChip,
} from "@tevero/ui";
import {
  detectPlatform,
  createSiteConnection,
  verifySiteConnection,
} from "@/lib/siteConnections";
import type {
  SiteConnection,
  DetectionResult,
  CreateConnectionInput,
} from "@/lib/siteConnections";
import { PlatformCredentialsForm } from "./PlatformCredentialsForm";

type WizardStep = "detect" | "credentials" | "verify";

interface ConnectionWizardProps {
  clientId: string;
  onSuccess: (connection: SiteConnection) => void;
  onCancel: () => void;
}

export function ConnectionWizard({
  clientId,
  onSuccess,
  onCancel,
}: ConnectionWizardProps) {
  const [step, setStep] = useState<WizardStep>("detect");
  const [domain, setDomain] = useState("");
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<SiteConnection | null>(null);

  // Step 1: Detect platform
  async function handleDetect() {
    setLoading(true);
    setError(null);
    try {
      const result = await detectPlatform(domain);
      setDetection(result);
      setStep("credentials");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // Step 2: Submit credentials and create connection
  async function handleSubmitCredentials(creds: Record<string, string>) {
    if (!detection) return;
    setLoading(true);
    setError(null);

    try {
      const input: CreateConnectionInput = {
        clientId,
        platform: detection.platform,
        siteUrl: domain.startsWith("http") ? domain : `https://${domain}`,
        credentials: creds,
      };

      const conn = await createSiteConnection(input);
      setConnection(conn);
      setStep("verify");

      // Auto-verify after creation
      const verifyResult = await verifySiteConnection(conn.id);
      if (verifyResult.success) {
        onSuccess(conn);
      } else {
        setError(verifyResult.error || "Verification failed");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // Render step indicator
  function renderStepIndicator() {
    const steps = [
      { key: "detect", label: "Detect" },
      { key: "credentials", label: "Connect" },
      { key: "verify", label: "Verify" },
    ];

    const currentIndex = steps.findIndex((s) => s.key === step);

    return (
      <div className="flex items-center justify-center gap-2 mb-6">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === s.key
                  ? "bg-primary text-primary-foreground"
                  : currentIndex > i
                    ? "bg-green-500 text-white"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {currentIndex > i ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            {i < steps.length - 1 && (
              <ChevronRight className="h-4 w-4 mx-2 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <h3 className="text-lg font-semibold">Add Site Connection</h3>
        {renderStepIndicator()}
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {/* Step 1: Detect */}
        {step === "detect" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="domain">Website Domain</Label>
              <div className="flex gap-2">
                <Input
                  id="domain"
                  placeholder="example.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  disabled={loading}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                We&apos;ll auto-detect if it&apos;s WordPress, Shopify, Wix,
                etc.
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Credentials */}
        {step === "credentials" && detection && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 rounded-md bg-muted">
              <Globe className="h-4 w-4" />
              <span className="text-sm font-medium">{domain}</span>
              <StatusChip
                status={
                  detection.confidence === "high" ? "published" : "draft"
                }
              />
              <span className="text-sm capitalize">{detection.platform}</span>
            </div>

            <PlatformCredentialsForm
              platform={detection.platform}
              onSubmit={handleSubmitCredentials}
              loading={loading}
            />
          </div>
        )}

        {/* Step 3: Verify */}
        {step === "verify" && (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            {loading ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Verifying connection...
                </p>
              </>
            ) : error ? (
              <>
                <AlertCircle className="h-8 w-8 text-destructive" />
                <p className="text-sm text-center">{error}</p>
                <Button variant="outline" onClick={() => setStep("credentials")}>
                  Try Again
                </Button>
              </>
            ) : (
              <>
                <Check className="h-8 w-8 text-green-500" />
                <p className="text-sm text-center">Connection verified!</p>
              </>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button variant="ghost" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>

        {step === "detect" && (
          <Button onClick={handleDetect} disabled={!domain.trim() || loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Detect Platform
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
