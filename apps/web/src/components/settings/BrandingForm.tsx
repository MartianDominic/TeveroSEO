"use client";

import { useState, useCallback, useEffect } from "react";
import { RotateCcw, Loader2 } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Textarea,
  Separator,
  StatusChip,
} from "@tevero/ui";

import { LogoUpload } from "./LogoUpload";
import { ColorPicker } from "./ColorPicker";
import { BrandingPreview } from "./BrandingPreview";
import {
  type ClientBranding,
  DEFAULT_BRANDING,
  updateBranding,
  uploadLogo,
  deleteLogo,
  resetBranding,
} from "@/lib/api/branding";
import { useClientStore } from "@/stores/clientStore";

interface BrandingFormProps {
  /** Client UUID */
  clientId: string;
  /** Initial branding data (or defaults) */
  initialData: ClientBranding;
}

interface ToastState {
  open: boolean;
  message: string;
  severity: "success" | "error";
}

/**
 * Branding settings form with logo upload, color pickers, and live preview.
 */
export function BrandingForm({ clientId, initialData }: BrandingFormProps) {
  // Get client name from store
  const clients = useClientStore((s) => s.clients);
  const clientName = clients.find((c) => c.id === clientId)?.name ?? "";

  // Form state
  const [logoUrl, setLogoUrl] = useState(initialData.logoUrl);
  const [primaryColor, setPrimaryColor] = useState(initialData.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState(initialData.secondaryColor);
  const [footerText, setFooterText] = useState(initialData.footerText ?? "");

  // Track if form has unsaved changes
  const [hasChanges, setHasChanges] = useState(false);

  // Loading states
  const [isLogoLoading, setIsLogoLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Local toast
  const [toast, setToast] = useState<ToastState>({
    open: false,
    message: "",
    severity: "success",
  });

  const showToast = useCallback(
    (message: string, severity: "success" | "error" = "success") => {
      setToast({ open: true, message, severity });
      setTimeout(
        () => setToast((t) => ({ ...t, open: false })),
        3000
      );
    },
    []
  );

  // Track changes
  useEffect(() => {
    const changed =
      primaryColor !== initialData.primaryColor ||
      secondaryColor !== initialData.secondaryColor ||
      footerText !== (initialData.footerText ?? "");
    setHasChanges(changed);
  }, [primaryColor, secondaryColor, footerText, initialData]);

  // Logo upload handler
  const handleLogoUpload = useCallback(
    async (file: File) => {
      setIsLogoLoading(true);
      try {
        const result = await uploadLogo(clientId, file);
        setLogoUrl(result.logoUrl);
        showToast("Logo uploaded successfully");
      } catch (err) {
        showToast((err as Error).message, "error");
        throw err;
      } finally {
        setIsLogoLoading(false);
      }
    },
    [clientId, showToast],
  );

  // Logo delete handler
  const handleLogoDelete = useCallback(async () => {
    setIsLogoLoading(true);
    try {
      await deleteLogo(clientId);
      setLogoUrl(null);
      showToast("Logo removed");
    } catch (err) {
      showToast((err as Error).message, "error");
      throw err;
    } finally {
      setIsLogoLoading(false);
    }
  }, [clientId, showToast]);

  // Save branding changes
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const updated = await updateBranding(clientId, {
        primaryColor,
        secondaryColor,
        footerText: footerText || null,
      });
      // Update initial data reference for change tracking
      Object.assign(initialData, updated);
      setHasChanges(false);
      showToast("Branding saved");
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setIsSaving(false);
    }
  }, [clientId, primaryColor, secondaryColor, footerText, initialData, showToast]);

  // Reset to Tevero defaults
  const handleReset = useCallback(async () => {
    setIsResetting(true);
    try {
      await resetBranding(clientId);
      // Reset form to defaults
      setLogoUrl(null);
      setPrimaryColor(DEFAULT_BRANDING.primaryColor);
      setSecondaryColor(DEFAULT_BRANDING.secondaryColor);
      setFooterText("");
      setHasChanges(false);
      showToast("Branding reset to Tevero defaults");
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setIsResetting(false);
    }
  }, [clientId, showToast]);

  const isLoading = isSaving || isResetting;

  return (
    <div className="space-y-6">
      {/* Live Preview */}
      <BrandingPreview
        logoUrl={logoUrl}
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
        clientName={clientName}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Logo Upload Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Logo</CardTitle>
          </CardHeader>
          <CardContent>
            <LogoUpload
              currentLogoUrl={logoUrl}
              onUpload={handleLogoUpload}
              onDelete={handleLogoDelete}
              isLoading={isLogoLoading}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground mt-3">
              Your logo will appear in report headers. For best results, use a
              transparent PNG or SVG with dimensions around 200x60 pixels.
            </p>
          </CardContent>
        </Card>

        {/* Colors Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Colors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <ColorPicker
              label="Primary Color"
              value={primaryColor}
              onChange={setPrimaryColor}
              disabled={isLoading}
            />
            <ColorPicker
              label="Secondary Color"
              value={secondaryColor}
              onChange={setSecondaryColor}
              disabled={isLoading}
            />
          </CardContent>
        </Card>
      </div>

      {/* Footer Text Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Footer Text</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={footerText}
            onChange={(e) => setFooterText(e.target.value)}
            placeholder="Custom footer text for your reports (e.g., company tagline, contact info)"
            rows={3}
            disabled={isLoading}
            className="mb-2"
          />
          <p className="text-xs text-muted-foreground">
            This text will appear in the report footer. Leave empty to use the
            default &ldquo;Generated by Tevero&rdquo; attribution. Basic HTML tags
            (p, br, a, span) are supported.
          </p>
        </CardContent>
      </Card>

      <Separator />

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={handleReset}
          disabled={isLoading}
          className="text-destructive hover:text-destructive"
        >
          {isResetting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4 mr-2" />
          )}
          Reset to defaults
        </Button>

        <Button onClick={handleSave} disabled={isLoading || !hasChanges}>
          {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save changes
        </Button>
      </div>

      {/* Toast notification */}
      {toast.open && (
        <div className="fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg bg-card border border-border transition-opacity">
          <div className="flex items-center gap-2">
            <StatusChip
              status={toast.severity === "success" ? "published" : "failed"}
            />
            <span className="text-foreground">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
