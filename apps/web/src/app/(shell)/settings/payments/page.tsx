"use client";

/**
 * Payment Settings Page
 * Phase 54-04: Payment Settings UI + Client Choice
 *
 * Workspace-level payment provider configuration.
 * v6 Design: ghost-edge shadows, emerald accent, proper tokens.
 */
import { useState, useEffect } from "react";

import { useOrganization } from "@clerk/nextjs";
import { Loader2, Save, AlertCircle, CheckCircle2 } from "lucide-react";

import { ProviderCard, PaymentProviderType } from "@/components/payments/ProviderCard";
import { RevolutConnectModal, RevolutCredentials } from "@/components/payments/RevolutConnectModal";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Switch,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Alert,
  AlertDescription,
} from "@tevero/ui";

interface PaymentSettings {
  defaultProvider: PaymentProviderType;
  allowClientChoice: boolean;
  paymentTermsDays: number;
  stripe: {
    enabled: boolean;
    connected: boolean;
    publishableKey: string | null;
  };
  revolut: {
    enabled: boolean;
    connected: boolean;
    merchantId: string | null;
  };
}

const DEFAULT_SETTINGS: PaymentSettings = {
  defaultProvider: "stripe",
  allowClientChoice: false,
  paymentTermsDays: 14,
  stripe: { enabled: false, connected: false, publishableKey: null },
  revolut: { enabled: false, connected: false, merchantId: null },
};

export default function PaymentSettingsPage() {
  const { organization, isLoaded } = useOrganization();
  const [settings, setSettings] = useState<PaymentSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [revolutModalOpen, setRevolutModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<PaymentProviderType | null>(null);

  // Fetch settings on mount
  useEffect(() => {
    if (!isLoaded || !organization) return;

    async function fetchSettings() {
      try {
        const response = await fetch("/api/settings/payments");
        const data = await response.json();

        if (data.success) {
          setSettings(data.data);
        } else {
          setError(data.error || "Failed to load settings");
        }
      } catch (err) {
        setError("Failed to load payment settings");
      } finally {
        setIsLoading(false);
      }
    }

    fetchSettings();
  }, [isLoaded, organization]);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/settings/payments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultProvider: settings.defaultProvider,
          allowClientChoice: settings.allowClientChoice,
          paymentTermsDays: settings.paymentTermsDays,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSettings(data.data);
        setSuccess("Settings saved successfully");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || "Failed to save settings");
      }
    } catch (err) {
      setError("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleStripeConnect = async () => {
    // For now, show a placeholder - actual Stripe Connect OAuth would redirect
    setActionLoading("stripe");
    try {
      // Placeholder: In production, redirect to Stripe Connect OAuth
      alert("Stripe Connect OAuth flow would start here. For manual setup, use API directly.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevolutConnect = async (credentials: RevolutCredentials) => {
    // The modal already calls the API, just refresh settings
    const response = await fetch("/api/settings/payments");
    const data = await response.json();
    if (data.success) {
      setSettings(data.data);
      setSuccess("Revolut connected successfully");
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  const handleDisconnect = async (provider: PaymentProviderType) => {
    if (!confirm(`Are you sure you want to disconnect ${provider}?`)) {
      return;
    }

    setActionLoading(provider);
    setError(null);

    try {
      const response = await fetch(`/api/settings/payments/disconnect/${provider}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        setSettings(data.data);
        setSuccess(`${provider} disconnected`);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || "Failed to disconnect");
      }
    } catch (err) {
      setError("Failed to disconnect provider");
    } finally {
      setActionLoading(null);
    }
  };

  // Get list of connected providers for default selection
  const connectedProviders: PaymentProviderType[] = [];
  if (settings.stripe.connected) connectedProviders.push("stripe");
  if (settings.revolut.connected) connectedProviders.push("revolut");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payment Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure payment providers and checkout options for your workspace.
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <AlertDescription className="text-emerald-700 dark:text-emerald-400">
            {success}
          </AlertDescription>
        </Alert>
      )}

      {/* Payment Providers Section */}
      <Card className="shadow-[0_1px_3px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.03)]">
        <CardHeader>
          <CardTitle>Payment Providers</CardTitle>
          <CardDescription>
            Connect payment providers to accept payments from clients.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ProviderCard
              provider="stripe"
              connected={settings.stripe.connected}
              enabled={settings.stripe.enabled}
              onConnect={handleStripeConnect}
              onDisconnect={() => handleDisconnect("stripe")}
              isLoading={actionLoading === "stripe"}
            />
            <ProviderCard
              provider="revolut"
              connected={settings.revolut.connected}
              enabled={settings.revolut.enabled}
              onConnect={() => setRevolutModalOpen(true)}
              onDisconnect={() => handleDisconnect("revolut")}
              isLoading={actionLoading === "revolut"}
            />
          </div>
        </CardContent>
      </Card>

      {/* Payment Options Section */}
      <Card className="shadow-[0_1px_3px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.03)]">
        <CardHeader>
          <CardTitle>Payment Options</CardTitle>
          <CardDescription>
            Configure default behavior for invoice payments.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Default Provider */}
          <div className="space-y-2">
            <Label htmlFor="defaultProvider">Default Payment Provider</Label>
            <Select
              value={settings.defaultProvider}
              onValueChange={(value: PaymentProviderType) =>
                setSettings((prev) => ({ ...prev, defaultProvider: value }))
              }
              disabled={connectedProviders.length === 0}
            >
              <SelectTrigger id="defaultProvider" className="w-full max-w-xs">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {connectedProviders.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No providers connected
                  </SelectItem>
                ) : (
                  connectedProviders.map((provider) => (
                    <SelectItem key={provider} value={provider}>
                      {provider.charAt(0).toUpperCase() + provider.slice(1)}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Provider used when clients do not choose a payment method.
            </p>
          </div>

          {/* Allow Client Choice */}
          <div className="flex items-center justify-between py-3 border-t">
            <div className="space-y-0.5">
              <Label htmlFor="allowClientChoice">Allow clients to choose payment method</Label>
              <p className="text-sm text-muted-foreground">
                When enabled, clients can select their preferred payment provider at checkout.
              </p>
            </div>
            <Switch
              id="allowClientChoice"
              checked={settings.allowClientChoice}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, allowClientChoice: checked }))
              }
              disabled={connectedProviders.length < 2}
            />
          </div>

          {/* Payment Terms */}
          <div className="space-y-2 pt-3 border-t">
            <Label htmlFor="paymentTerms">Payment Terms (days)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="paymentTerms"
                type="number"
                min={0}
                max={90}
                value={settings.paymentTermsDays}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    paymentTermsDays: parseInt(e.target.value, 10) || 0,
                  }))
                }
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">days</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Number of days until invoice is due after being sent.
            </p>
          </div>

          {/* Save Button */}
          <div className="pt-4 border-t">
            <Button onClick={handleSaveSettings} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Revolut Connect Modal */}
      <RevolutConnectModal
        open={revolutModalOpen}
        onOpenChange={setRevolutModalOpen}
        onConnect={handleRevolutConnect}
      />
    </div>
  );
}
