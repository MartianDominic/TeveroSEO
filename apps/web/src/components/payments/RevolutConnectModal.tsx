"use client";

/**
 * RevolutConnectModal Component
 * Phase 54-04: Payment Settings UI
 *
 * Modal for entering Revolut Merchant API credentials.
 * Includes test connection button before saving.
 */
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle, Eye, EyeOff } from "lucide-react";

interface RevolutConnectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: (credentials: RevolutCredentials) => Promise<void>;
}

export interface RevolutCredentials {
  secretKey: string;
  publicKey: string;
  merchantId: string;
  webhookSecret: string;
}

export function RevolutConnectModal({
  open,
  onOpenChange,
  onConnect,
}: RevolutConnectModalProps) {
  const [credentials, setCredentials] = useState<RevolutCredentials>({
    secretKey: "",
    publicKey: "",
    merchantId: "",
    webhookSecret: "",
  });
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testError, setTestError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (field: keyof RevolutCredentials, value: string) => {
    setCredentials((prev) => ({ ...prev, [field]: value }));
    // Reset test status when credentials change
    if (testStatus !== "idle") {
      setTestStatus("idle");
      setTestError(null);
    }
  };

  const handleTestConnection = async () => {
    setTestStatus("testing");
    setTestError(null);

    try {
      // Test by calling our API endpoint with the credentials
      const response = await fetch("/api/settings/payments/connect/revolut", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Connection failed");
      }

      setTestStatus("success");
    } catch (error) {
      setTestStatus("error");
      setTestError(error instanceof Error ? error.message : "Connection test failed");
    }
  };

  const handleSubmit = async () => {
    if (testStatus !== "success") {
      // Run test first
      await handleTestConnection();
      return;
    }

    setIsSubmitting(true);
    try {
      await onConnect(credentials);
      onOpenChange(false);
      // Reset form
      setCredentials({ secretKey: "", publicKey: "", merchantId: "", webhookSecret: "" });
      setTestStatus("idle");
    } catch (error) {
      setTestError(error instanceof Error ? error.message : "Failed to save credentials");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid =
    credentials.secretKey.length > 0 &&
    credentials.publicKey.length > 0 &&
    credentials.merchantId.length > 0 &&
    credentials.webhookSecret.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-[#0075EB] flex items-center justify-center text-white font-bold">
              R
            </div>
            Connect Revolut
          </DialogTitle>
          <DialogDescription>
            Enter your Revolut Merchant API credentials. You can find these in your Revolut
            Business dashboard under Developer &rarr; API Settings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Secret Key */}
          <div className="space-y-2">
            <Label htmlFor="secretKey">Secret Key</Label>
            <div className="relative">
              <Input
                id="secretKey"
                type={showSecretKey ? "text" : "password"}
                placeholder="sk_live_..."
                value={credentials.secretKey}
                onChange={(e) => handleInputChange("secretKey", e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowSecretKey(!showSecretKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Public Key */}
          <div className="space-y-2">
            <Label htmlFor="publicKey">Public Key</Label>
            <Input
              id="publicKey"
              type="text"
              placeholder="pk_live_..."
              value={credentials.publicKey}
              onChange={(e) => handleInputChange("publicKey", e.target.value)}
            />
          </div>

          {/* Merchant ID */}
          <div className="space-y-2">
            <Label htmlFor="merchantId">Merchant ID</Label>
            <Input
              id="merchantId"
              type="text"
              placeholder="mer_..."
              value={credentials.merchantId}
              onChange={(e) => handleInputChange("merchantId", e.target.value)}
            />
          </div>

          {/* Webhook Secret */}
          <div className="space-y-2">
            <Label htmlFor="webhookSecret">Webhook Secret</Label>
            <div className="relative">
              <Input
                id="webhookSecret"
                type={showWebhookSecret ? "text" : "password"}
                placeholder="wsk_..."
                value={credentials.webhookSecret}
                onChange={(e) => handleInputChange("webhookSecret", e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showWebhookSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Test status */}
          {testStatus === "success" && (
            <Alert className="bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <AlertDescription className="text-emerald-700 dark:text-emerald-400">
                Connection successful! Click Save to store your credentials.
              </AlertDescription>
            </Alert>
          )}

          {testStatus === "error" && testError && (
            <Alert variant="destructive">
              <XCircle className="w-4 h-4" />
              <AlertDescription>{testError}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={!isFormValid || testStatus === "testing"}
          >
            {testStatus === "testing" ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              "Test Connection"
            )}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid || isSubmitting}
            className="bg-[#0075EB] hover:bg-[#0066CC]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : testStatus === "success" ? (
              "Save"
            ) : (
              "Test & Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
