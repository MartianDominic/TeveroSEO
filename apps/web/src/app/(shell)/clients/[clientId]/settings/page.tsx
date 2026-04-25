"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  RotateCcw,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
} from "lucide-react";

import {
  Button,
  Input,
  Label,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Skeleton,
  Slider,
  StatusChip,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@tevero/ui";

import {
  fetchClientSettings,
  upsertClientSettings,
  type ClientSettings,
  fetchVoiceTemplates,
  type VoiceTemplate,
} from "@/lib/clientSettings";
import { testCmsConnection, type CmsPlatform } from "@/actions/cms/test-connection";

import { useClientStore } from "@/stores/clientStore";
import { ClientGoalsManager } from "@/components/goals";
import {
  useContentCalendarStore,
  type PublishingSettings,
} from "@/stores/contentCalendarStore";

// ── Model lists ──────────────────────────────────────────────────────────────

const TEXT_MODELS = [
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "gemini-2.0-flash-001", label: "Gemini 2.0 Flash" },
  { value: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite" },
  { value: "openai/gpt-4o", label: "GPT-4o" },
  { value: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
];

const IMAGE_MODELS = [
  { value: "imagen-4.0-generate-001", label: "Imagen 4" },
  { value: "imagen-4.0-ultra-generate-001", label: "Imagen 4 Ultra" },
  { value: "imagen-4.0-fast-generate-001", label: "Imagen 4 Fast" },
  {
    value: "gemini-3.1-flash-image-preview",
    label: "Nano Banana 2",
  },
  { value: "gemini-3-pro-image-preview", label: "Nano Banana Pro" },
];

// ── Local toast ──────────────────────────────────────────────────────────────

interface ToastState {
  open: boolean;
  message: string;
  severity: "success" | "error";
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ClientSettingsPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const clients = useClientStore((s) => s.clients);

  const clientName = clients.find((c) => c.id === clientId)?.name ?? null;

  // ── Core state ───────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("brand");
  const [settings, setSettings] = useState<ClientSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  // Publishing settings
  const {
    publishingSettings,
    settingsLoading,
    fetchPublishingSettings,
    updatePublishingSettings,
  } = useContentCalendarStore();
  const [pubDraft, setPubDraft] = useState<Partial<PublishingSettings>>({});
  const [pubSaving, setPubSaving] = useState(false);

  // Text field drafts — saved on blur
  const [brandVoiceDraft, setBrandVoiceDraft] = useState("");
  const [imagePromptDraft, setImagePromptDraft] = useState("");

  // CMS URL / username fields (returned from GET)
  const [wpUrl, setWpUrl] = useState("");
  const [wpUsername, setWpUsername] = useState("");
  const [shopifyUrl, setShopifyUrl] = useState("");

  // Write-only credential fields — never populated from GET response
  const [wpPassword, setWpPassword] = useState("");
  const [shopifyKey, setShopifyKey] = useState("");

  // Visibility toggles
  const [showWpPassword, setShowWpPassword] = useState(false);
  const [showShopifyKey, setShowShopifyKey] = useState(false);

  // Webhook URL
  const [webhookUrlDraft, setWebhookUrlDraft] = useState("");

  // v2.0 Voice blend state
  const [voiceTemplates, setVoiceTemplates] = useState<VoiceTemplate[]>([]);
  const [voiceTemplatesDraft, setVoiceTemplatesDraft] = useState("");
  const [blendWeightDraft, setBlendWeightDraft] = useState<number[]>([0.5]);
  const [customVoiceDraft, setCustomVoiceDraft] = useState("");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [voiceTemplatesSaving, setVoiceTemplatesSaving] = useState(false);

  // Local toast
  const [toast, setToast] = useState<ToastState>({
    open: false,
    message: "",
    severity: "success",
  });

  // CMS connection test state
  const [isTesting, setIsTesting] = useState(false);

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

  // ── Load settings on mount ───────────────────────────────────────────────
  const loadSettings = useCallback(() => {
    if (!clientId) return;
    setLoading(true);
    setLoadError(false);

    fetchClientSettings(clientId)
      .then((data) => {
        setSettings(data);
        if (data) {
          setBrandVoiceDraft(data.brand_voice ?? "");
          setImagePromptDraft(data.image_prompt_template ?? "");
          setWpUrl(data.wp_url ?? "");
          setWpUsername(data.wp_username ?? "");
          setShopifyUrl(data.shopify_store_url ?? "");
          setWebhookUrlDraft(data.webhook_url ?? "");
          // v2.0 voice blend
          setVoiceTemplatesDraft(data.voice_template_id ?? "");
          setBlendWeightDraft([data.voice_blend_weight ?? 0.5]);
          setCustomVoiceDraft(data.custom_voice_instructions ?? "");
        }
      })
      .catch(() => {
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, [clientId]);

  useEffect(() => {
    if (!clientId) return;
    loadSettings();

    fetchPublishingSettings(clientId);

    // Fetch voice templates (graceful degradation on failure)
    fetchVoiceTemplates()
      .then(setVoiceTemplates)
      .catch(() => {});
  }, [clientId, loadSettings, fetchPublishingSettings]);

  // Sync publishing settings into draft when they load
  useEffect(() => {
    if (publishingSettings) {
      setPubDraft(publishingSettings);
    }
  }, [publishingSettings]);

  // ── Brand voice ──────────────────────────────────────────────────────────

  const handleSaveBrandVoice = useCallback(async () => {
    if (!clientId) return;
    setSaving("brandVoice");
    try {
      const updated = await upsertClientSettings(clientId, {
        brand_voice: brandVoiceDraft,
      });
      setSettings(updated);
      showToast("Brand voice saved");
    } catch {
      showToast("Failed to save brand voice", "error");
    } finally {
      setSaving(null);
    }
  }, [clientId, brandVoiceDraft, showToast]);

  const handleResetBrandVoice = useCallback(async () => {
    if (!clientId) return;
    setSaving("brandVoice");
    try {
      const updated = await upsertClientSettings(clientId, {
        brand_voice: "",
      });
      setSettings(updated);
      setBrandVoiceDraft(updated.brand_voice ?? "");
      showToast("Brand voice reset to default");
    } catch {
      showToast("Failed to reset brand voice", "error");
    } finally {
      setSaving(null);
    }
  }, [clientId, showToast]);

  // ── Image prompt template ────────────────────────────────────────────────

  const handleSaveImagePrompt = useCallback(async () => {
    if (!clientId) return;
    setSaving("imagePrompt");
    try {
      const updated = await upsertClientSettings(clientId, {
        image_prompt_template: imagePromptDraft,
      });
      setSettings(updated);
      showToast("Image prompt template saved");
    } catch {
      showToast("Failed to save image prompt template", "error");
    } finally {
      setSaving(null);
    }
  }, [clientId, imagePromptDraft, showToast]);

  const handleResetImagePrompt = useCallback(async () => {
    if (!clientId) return;
    setSaving("imagePrompt");
    try {
      const updated = await upsertClientSettings(clientId, {
        image_prompt_template: "",
      });
      setSettings(updated);
      setImagePromptDraft(updated.image_prompt_template ?? "");
      showToast("Image prompt reset to default");
    } catch {
      showToast("Failed to reset image prompt", "error");
    } finally {
      setSaving(null);
    }
  }, [clientId, showToast]);

  // ── Model overrides ──────────────────────────────────────────────────────

  const handleTextModelChange = useCallback(
    async (value: string) => {
      if (!clientId) return;
      const payload = value === "" ? null : value;
      setSaving("textModel");
      try {
        const updated = await upsertClientSettings(clientId, {
          text_model_override: payload,
        });
        setSettings(updated);
        showToast("Text model override saved");
      } catch {
        showToast("Failed to save text model override", "error");
      } finally {
        setSaving(null);
      }
    },
    [clientId, showToast]
  );

  const handleImageModelChange = useCallback(
    async (value: string) => {
      if (!clientId) return;
      const payload = value === "" ? null : value;
      setSaving("imageModel");
      try {
        const updated = await upsertClientSettings(clientId, {
          image_model_override: payload,
        });
        setSettings(updated);
        showToast("Image model override saved");
      } catch {
        showToast("Failed to save image model override", "error");
      } finally {
        setSaving(null);
      }
    },
    [clientId, showToast]
  );

  const handleResetTextModel = useCallback(async () => {
    if (!clientId) return;
    setSaving("textModel");
    try {
      const updated = await upsertClientSettings(clientId, {
        text_model_override: null,
      });
      setSettings(updated);
      showToast("Text model reset to global default");
    } catch {
      showToast("Failed to reset text model", "error");
    } finally {
      setSaving(null);
    }
  }, [clientId, showToast]);

  const handleResetImageModel = useCallback(async () => {
    if (!clientId) return;
    setSaving("imageModel");
    try {
      const updated = await upsertClientSettings(clientId, {
        image_model_override: null,
      });
      setSettings(updated);
      showToast("Image model reset to global default");
    } catch {
      showToast("Failed to reset image model", "error");
    } finally {
      setSaving(null);
    }
  }, [clientId, showToast]);

  // ── Voice blend handlers ─────────────────────────────────────────────────

  const handleVoiceTemplateChange = useCallback(
    async (value: string) => {
      if (!clientId) return;
      setVoiceTemplatesDraft(value);
      setVoiceTemplatesSaving(true);
      try {
        const updated = await upsertClientSettings(clientId, {
          voice_template_id: value === "" ? null : value,
        });
        setSettings(updated);
        showToast("Voice template saved");
      } catch {
        showToast("Failed to save voice template", "error");
      } finally {
        setVoiceTemplatesSaving(false);
      }
    },
    [clientId, showToast]
  );

  const handleBlendWeightCommit = useCallback(
    async (value: number[]) => {
      if (!clientId) return;
      setSaving("voiceTemplate");
      try {
        const updated = await upsertClientSettings(clientId, {
          voice_blend_weight: value[0],
        });
        setSettings(updated);
        showToast("Blend weight saved");
      } catch {
        showToast("Failed to save blend weight", "error");
      } finally {
        setSaving(null);
      }
    },
    [clientId, showToast]
  );

  const handleSaveCustomVoice = useCallback(async () => {
    if (!clientId) return;
    setSaving("customVoice");
    try {
      const updated = await upsertClientSettings(clientId, {
        custom_voice_instructions: customVoiceDraft,
      });
      setSettings(updated);
      showToast("Custom voice instructions saved");
    } catch {
      showToast("Failed to save custom voice instructions", "error");
    } finally {
      setSaving(null);
    }
  }, [clientId, customVoiceDraft, showToast]);

  // ── WordPress credentials ────────────────────────────────────────────────

  const handleSaveWpSettings = useCallback(async () => {
    if (!clientId) return;
    setSaving("wp");
    try {
      const payload: Parameters<typeof upsertClientSettings>[1] = {
        wp_url: wpUrl || null,
        wp_username: wpUsername || null,
      };
      if (wpPassword) {
        payload.wp_app_password = wpPassword;
      }
      const updated = await upsertClientSettings(clientId, payload);
      setSettings(updated);
      setWpUrl(updated.wp_url ?? "");
      setWpUsername(updated.wp_username ?? "");
      setWpPassword("");
      showToast("WordPress settings saved");
    } catch {
      showToast("Failed to save WordPress settings", "error");
    } finally {
      setSaving(null);
    }
  }, [clientId, wpUrl, wpUsername, wpPassword, showToast]);

  // ── Shopify credentials ──────────────────────────────────────────────────

  const handleSaveShopifySettings = useCallback(async () => {
    if (!clientId) return;
    setSaving("shopify");
    try {
      const payload: Parameters<typeof upsertClientSettings>[1] = {
        shopify_store_url: shopifyUrl || null,
      };
      if (shopifyKey) {
        payload.shopify_api_key = shopifyKey;
      }
      const updated = await upsertClientSettings(clientId, payload);
      setSettings(updated);
      setShopifyUrl(updated.shopify_store_url ?? "");
      setShopifyKey("");
      showToast("Shopify settings saved");
    } catch {
      showToast("Failed to save Shopify settings", "error");
    } finally {
      setSaving(null);
    }
  }, [clientId, shopifyUrl, shopifyKey, showToast]);

  // ── Webhook URL ──────────────────────────────────────────────────────────

  const handleSaveWebhookUrl = useCallback(async () => {
    if (!clientId) return;
    setSaving("webhook");
    try {
      const updated = await upsertClientSettings(clientId, {
        webhook_url: webhookUrlDraft || null,
      });
      setSettings(updated);
      showToast("Webhook URL saved");
    } catch {
      showToast("Failed to save webhook URL", "error");
    } finally {
      setSaving(null);
    }
  }, [clientId, webhookUrlDraft, showToast]);

  // ── Publishing settings ──────────────────────────────────────────────────

  const handleSavePublishingSettings = useCallback(async () => {
    if (!clientId) return;
    setPubSaving(true);
    try {
      await updatePublishingSettings(clientId, pubDraft);
      showToast("Publishing settings saved");
    } catch {
      showToast("Failed to save publishing settings", "error");
    } finally {
      setPubSaving(false);
    }
  }, [clientId, pubDraft, updatePublishingSettings, showToast]);

  // ── Wix connection ───────────────────────────────────────────────────────

  const isWixConnected =
    typeof window !== "undefined" &&
    sessionStorage.getItem("wix_connected") === "true";

  const handleWixConnect = useCallback(() => {
    window.location.href = "/api/wix/connect";
  }, []);

  // ── Test CMS connection ──────────────────────────────────────────────────
  const handleTestConnection = useCallback(async () => {
    if (!clientId) return;

    // Determine which platform to test based on available credentials
    let platform: CmsPlatform | null = null;
    let credentials: Record<string, string> = {};

    if (wpUrl && wpUsername) {
      platform = "wordpress";
      credentials = {
        wp_url: wpUrl,
        wp_username: wpUsername,
        wp_app_password: wpPassword || "", // Use current input or empty
      };
    } else if (shopifyUrl) {
      platform = "shopify";
      credentials = {
        shopify_store_url: shopifyUrl,
        shopify_api_key: shopifyKey || "",
      };
    } else if (webhookUrlDraft) {
      platform = "webhook";
      credentials = {
        webhook_url: webhookUrlDraft,
      };
    }

    if (!platform) {
      showToast("Please configure at least one CMS platform first", "error");
      return;
    }

    setIsTesting(true);
    try {
      const result = await testCmsConnection(clientId, { platform, credentials });

      if (result.success) {
        showToast(result.message || "Connection successful!", "success");
      } else {
        showToast(result.error || "Connection failed", "error");
      }
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Connection test failed",
        "error"
      );
    } finally {
      setIsTesting(false);
    }
  }, [clientId, wpUrl, wpUsername, wpPassword, shopifyUrl, shopifyKey, webhookUrlDraft, showToast]);

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-8 py-8 space-y-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
        <div className="space-y-4">
          <div className="rounded-lg border border-border p-6 space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-24 w-full" />
          </div>
          <div className="rounded-lg border border-border p-6 space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-3xl mx-auto px-8 py-8">
        <PageHeader
          title="Client Settings"
          subtitle={clientName ?? undefined}
          backHref={clientId ? `/clients/${clientId}` : "/clients"}
        />
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center mt-6">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <div>
            <p className="text-base font-semibold text-foreground">
              Failed to load settings
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              There was a problem loading this client&apos;s settings.
            </p>
          </div>
          <Button variant="outline" onClick={loadSettings}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const textModelValue = settings?.text_model_override ?? "";
  const imageModelValue = settings?.image_model_override ?? "";
  const selectedTemplate = voiceTemplates.find(
    (t) => t.id === voiceTemplatesDraft
  );

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <PageHeader
        title="Settings"
        subtitle={clientName ?? undefined}
        backHref={clientId ? `/clients/${clientId}` : "/clients"}
      />

      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
        <TabsList className="mb-6">
          <TabsTrigger value="brand">Brand &amp; AI</TabsTrigger>
          <TabsTrigger value="cms">CMS Integration</TabsTrigger>
          <TabsTrigger value="publishing">Publishing</TabsTrigger>
          <TabsTrigger value="goals">Goals</TabsTrigger>
        </TabsList>

        {/* ══════════════════════════════════════════════════════════════
            Tab: Brand & AI
        ══════════════════════════════════════════════════════════════ */}
        <TabsContent value="brand">
          <div className="space-y-4">
            {/* ── Brand Voice ──────────────────────────────────────────── */}
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-sm font-medium text-foreground">
                  Brand Voice
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetBrandVoice}
                  disabled={saving === "brandVoice"}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Reset to default
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Injected into AI system prompts when this client is active
              </p>
              <Textarea
                rows={6}
                value={brandVoiceDraft}
                onChange={(e) => setBrandVoiceDraft(e.target.value)}
                onBlur={handleSaveBrandVoice}
                placeholder="Describe your brand's voice, tone, and style guidelines..."
                disabled={saving === "brandVoice"}
              />
            </div>

            {/* ── Voice Template (v2.0) ─────────────────────────────────── */}
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-sm font-medium text-foreground mb-1">
                Voice Template
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Apply a named style template to blend with this client&apos;s
                brand voice
              </p>
              <div className="space-y-4">
                {/* Template selector */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-foreground">
                    Template
                  </Label>
                  <Select
                    value={voiceTemplatesDraft}
                    onValueChange={handleVoiceTemplateChange}
                    disabled={voiceTemplatesSaving}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="None — use client voice only" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">
                        None — use client voice only
                      </SelectItem>
                      {voiceTemplates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                          {t.is_system && " (system)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedTemplate?.description && (
                    <p className="text-xs text-muted-foreground">
                      {selectedTemplate.description}
                    </p>
                  )}
                </div>

                {/* Advanced toggle */}
                <button
                  type="button"
                  onClick={() => setIsAdvancedOpen((v) => !v)}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isAdvancedOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  Advanced
                </button>

                {/* Advanced section — collapsed by default */}
                {isAdvancedOpen && (
                  <div className="space-y-4 pt-2">
                    {/* Blend weight slider */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium text-foreground">
                        Blend Weight
                      </Label>
                      <div className="px-1">
                        <Slider
                          value={blendWeightDraft}
                          onValueChange={setBlendWeightDraft}
                          onValueCommit={handleBlendWeightCommit}
                          min={0}
                          max={1}
                          step={0.05}
                        />
                        <div className="flex justify-between mt-1">
                          <span className="text-xs text-muted-foreground">
                            Client voice
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Template style
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Current: {blendWeightDraft[0].toFixed(2)} — 0.0 = pure
                        client voice, 1.0 = pure template style
                      </p>
                    </div>

                    <Separator />

                    {/* Custom voice instructions */}
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-foreground">
                        Custom Voice Instructions
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Plain-language description of the desired voice —
                        injected at highest priority, overrides template
                        defaults
                      </p>
                      <Textarea
                        rows={4}
                        value={customVoiceDraft}
                        onChange={(e) => setCustomVoiceDraft(e.target.value)}
                        onBlur={handleSaveCustomVoice}
                        placeholder="e.g.: Mix of Frank Kern storytelling + Hormozi directness, no anglicisms, written to read for hours..."
                        disabled={saving === "customVoice"}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Image Prompt Template ─────────────────────────────────── */}
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-start justify-between mb-1">
                <h3 className="text-sm font-medium text-foreground">
                  Image Prompt Template
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetImagePrompt}
                  disabled={saving === "imagePrompt"}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Reset to default
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Default image generation style applied to this client&apos;s
                images
              </p>
              <Textarea
                rows={4}
                value={imagePromptDraft}
                onChange={(e) => setImagePromptDraft(e.target.value)}
                onBlur={handleSaveImagePrompt}
                placeholder="Describe the default image generation style..."
                disabled={saving === "imagePrompt"}
              />
            </div>

            {/* ── Model Overrides ───────────────────────────────────────── */}
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-sm font-medium text-foreground mb-1">
                Model Overrides
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Override the global default models for this client. Select
                &quot;None&quot; to use the global default.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Text model */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-foreground">
                    Text Model
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <Select
                      value={textModelValue}
                      onValueChange={handleTextModelChange}
                      disabled={saving === "textModel"}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="None (use global default)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None (use global default)</SelectItem>
                        {TEXT_MODELS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleResetTextModel}
                      disabled={saving === "textModel"}
                      title="Reset to global default"
                      className="shrink-0"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Image model */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-foreground">
                    Image Model
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <Select
                      value={imageModelValue}
                      onValueChange={handleImageModelChange}
                      disabled={saving === "imageModel"}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="None (use global default)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None (use global default)</SelectItem>
                        {IMAGE_MODELS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleResetImageModel}
                      disabled={saving === "imageModel"}
                      title="Reset to global default"
                      className="shrink-0"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════
            Tab: CMS Integration
        ══════════════════════════════════════════════════════════════ */}
        <TabsContent value="cms">
          <div className="space-y-4">
            {/* ── WordPress ─────────────────────────────────────────────── */}
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-sm font-medium text-foreground mb-1">
                WordPress
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Publish articles directly to your WordPress site
              </p>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-foreground">
                    Site URL
                  </Label>
                  <Input
                    className="mt-1.5"
                    value={wpUrl}
                    onChange={(e) => setWpUrl(e.target.value)}
                    placeholder="https://yoursite.com"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-foreground">
                    Username
                  </Label>
                  <Input
                    className="mt-1.5"
                    value={wpUsername}
                    onChange={(e) => setWpUsername(e.target.value)}
                    placeholder="admin"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-foreground">
                    App Password
                  </Label>
                  <div className="relative mt-1.5">
                    <Input
                      type={showWpPassword ? "text" : "password"}
                      value={wpPassword}
                      onChange={(e) => setWpPassword(e.target.value)}
                      placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowWpPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showWpPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave blank to keep current password
                  </p>
                </div>
                <div className="flex justify-end pt-2">
                  <Button
                    onClick={handleSaveWpSettings}
                    disabled={saving === "wp"}
                  >
                    {saving === "wp" ? "Saving..." : "Save changes"}
                  </Button>
                </div>
              </div>
            </div>

            {/* ── Shopify ───────────────────────────────────────────────── */}
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-sm font-medium text-foreground mb-1">
                Shopify
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Publish blog articles to your Shopify store
              </p>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-foreground">
                    Store URL
                  </Label>
                  <Input
                    className="mt-1.5"
                    value={shopifyUrl}
                    onChange={(e) => setShopifyUrl(e.target.value)}
                    placeholder="https://yourstore.myshopify.com"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-foreground">
                    API Key
                  </Label>
                  <div className="relative mt-1.5">
                    <Input
                      type={showShopifyKey ? "text" : "password"}
                      value={shopifyKey}
                      onChange={(e) => setShopifyKey(e.target.value)}
                      placeholder="shpat_xxxx..."
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowShopifyKey((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showShopifyKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave blank to keep current key
                  </p>
                </div>
                <div className="flex justify-end pt-2">
                  <Button
                    onClick={handleSaveShopifySettings}
                    disabled={saving === "shopify"}
                  >
                    {saving === "shopify" ? "Saving..." : "Save changes"}
                  </Button>
                </div>
              </div>
            </div>

            {/* ── Wix (OAuth) ───────────────────────────────────────────── */}
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-sm font-medium text-foreground mb-1">Wix</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Connect your Wix site via OAuth
              </p>
              {isWixConnected ? (
                <div className="flex items-center gap-2">
                  <StatusChip status="connected" />
                  <span className="text-sm text-muted-foreground">
                    Wix account linked
                  </span>
                </div>
              ) : (
                <Button variant="outline" onClick={handleWixConnect}>
                  Connect with Wix
                </Button>
              )}
            </div>

            {/* ── Webhook URL ───────────────────────────────────────────── */}
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-sm font-medium text-foreground mb-1">
                Webhook
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Receive notifications when articles are published
              </p>
              <div>
                <Label className="text-sm font-medium text-foreground">
                  Webhook URL
                </Label>
                <Input
                  className="mt-1.5"
                  value={webhookUrlDraft}
                  onChange={(e) => setWebhookUrlDraft(e.target.value)}
                  placeholder="https://yoursite.com/webhook"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  POST request sent after each successful publish
                </p>
              </div>
              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleSaveWebhookUrl}
                  disabled={saving === "webhook"}
                >
                  {saving === "webhook" ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </div>

            {/* ── Test Connection ───────────────────────────────────────── */}
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={isTesting}
              >
                {isTesting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  "Test Connection"
                )}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════
            Tab: Publishing
        ══════════════════════════════════════════════════════════════ */}
        <TabsContent value="publishing">
          {settingsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card p-6 space-y-6">
              <h3 className="text-sm font-medium text-foreground">
                Publishing Settings
              </h3>

              {/* Volume */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium text-foreground">
                    Articles Per Week
                  </Label>
                  <Input
                    className="mt-1.5"
                    type="number"
                    min={1}
                    max={28}
                    value={pubDraft.articles_per_week ?? 3}
                    onChange={(e) =>
                      setPubDraft((d) => ({
                        ...d,
                        articles_per_week: Math.max(
                          1,
                          Math.min(28, Number(e.target.value))
                        ),
                      }))
                    }
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-foreground">
                    Min Word Count
                  </Label>
                  <Input
                    className="mt-1.5"
                    type="number"
                    min={100}
                    value={pubDraft.min_word_count ?? 800}
                    onChange={(e) =>
                      setPubDraft((d) => ({
                        ...d,
                        min_word_count: Number(e.target.value),
                      }))
                    }
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-foreground">
                    Max Word Count
                  </Label>
                  <Input
                    className="mt-1.5"
                    type="number"
                    min={100}
                    value={pubDraft.max_word_count ?? 2000}
                    onChange={(e) =>
                      setPubDraft((d) => ({
                        ...d,
                        max_word_count: Number(e.target.value),
                      }))
                    }
                  />
                </div>
              </div>

              <Separator />

              {/* Auto-publish toggle */}
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Switch
                    id="auto-publish"
                    checked={pubDraft.auto_publish ?? false}
                    onCheckedChange={(checked) =>
                      setPubDraft((d) => ({ ...d, auto_publish: checked }))
                    }
                  />
                  <label
                    htmlFor="auto-publish"
                    className="text-sm font-medium text-foreground cursor-pointer"
                  >
                    Auto-publish approved articles
                  </label>
                </div>
                <p className="text-xs text-muted-foreground pl-[52px]">
                  When enabled, approved articles publish immediately. When
                  disabled, they queue for manual publishing.
                </p>
              </div>

              {/* Review delay */}
              <div className="max-w-[220px]">
                <Label className="text-sm font-medium text-foreground">
                  Review Delay (hours)
                </Label>
                <Input
                  className="mt-1.5"
                  type="number"
                  min={0}
                  max={168}
                  value={pubDraft.review_delay_hours ?? 0}
                  onChange={(e) =>
                    setPubDraft((d) => ({
                      ...d,
                      review_delay_hours: Math.max(
                        0,
                        Math.min(168, Number(e.target.value))
                      ),
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Hours before auto-publishing after approval (0 = immediate)
                </p>
              </div>

              <Separator />

              {/* Article structure toggles */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">
                  Article Structure
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      id: "toc",
                      key: "include_toc",
                      label: "Table of Contents",
                      default: true,
                    },
                    {
                      id: "takeaways",
                      key: "include_key_takeaways",
                      label: "Key Takeaways",
                      default: true,
                    },
                    {
                      id: "faq",
                      key: "include_faq",
                      label: "FAQ Section",
                      default: true,
                    },
                    {
                      id: "infographics",
                      key: "include_infographics",
                      label: "Infographics",
                      default: false,
                    },
                  ].map(({ id, key, label, default: def }) => (
                    <div key={id} className="flex items-center gap-2">
                      <Switch
                        id={id}
                        checked={
                          ((pubDraft as Record<string, unknown>)[
                            key
                          ] as boolean) ?? def
                        }
                        onCheckedChange={(checked) =>
                          setPubDraft((d) => ({ ...d, [key]: checked }))
                        }
                      />
                      <label
                        htmlFor={id}
                        className="text-sm text-foreground cursor-pointer"
                      >
                        {label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Writing instructions */}
              <div>
                <Label className="text-sm font-medium text-foreground">
                  Writing Instructions
                </Label>
                <Textarea
                  className="mt-1.5"
                  rows={4}
                  value={pubDraft.writing_instructions ?? ""}
                  onChange={(e) =>
                    setPubDraft((d) => ({
                      ...d,
                      writing_instructions: e.target.value,
                    }))
                  }
                  placeholder="Additional instructions for article generation (tone, style, topics to avoid...)"
                />
              </div>

              {/* Internal links */}
              <div>
                <Label className="text-sm font-medium text-foreground">
                  Internal Links
                </Label>
                <Textarea
                  className="mt-1.5"
                  rows={3}
                  value={pubDraft.internal_links ?? ""}
                  onChange={(e) =>
                    setPubDraft((d) => ({
                      ...d,
                      internal_links: e.target.value,
                    }))
                  }
                  placeholder="One URL per line — linked internally in generated articles"
                />
              </div>

              {/* Location targeting */}
              <div>
                <Label className="text-sm font-medium text-foreground">
                  Location Targeting
                </Label>
                <Input
                  className="mt-1.5"
                  value={pubDraft.location_targeting ?? ""}
                  onChange={(e) =>
                    setPubDraft((d) => ({
                      ...d,
                      location_targeting: e.target.value,
                    }))
                  }
                  placeholder="e.g. New York, NY — San Francisco Bay Area"
                />
              </div>

              {/* Competitor URLs */}
              <div>
                <Label className="text-sm font-medium text-foreground">
                  Competitor URLs
                </Label>
                <Textarea
                  className="mt-1.5"
                  rows={3}
                  value={pubDraft.competitor_urls ?? ""}
                  onChange={(e) =>
                    setPubDraft((d) => ({
                      ...d,
                      competitor_urls: e.target.value,
                    }))
                  }
                  placeholder="One URL per line — used for competitive content analysis"
                />
              </div>

              {/* Business offerings */}
              <div>
                <Label className="text-sm font-medium text-foreground">
                  Business Offerings
                </Label>
                <Textarea
                  className="mt-1.5"
                  rows={3}
                  value={pubDraft.business_offerings ?? ""}
                  onChange={(e) =>
                    setPubDraft((d) => ({
                      ...d,
                      business_offerings: e.target.value,
                    }))
                  }
                  placeholder="Describe the client's products and services — injected into content prompts"
                />
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleSavePublishingSettings}
                  disabled={pubSaving}
                >
                  {pubSaving ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════
            Tab: Goals
        ══════════════════════════════════════════════════════════════ */}
        <TabsContent value="goals">
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="text-sm font-medium text-foreground mb-1">
              Goals
            </h3>
            <p className="text-xs text-muted-foreground mb-6">
              Track progress toward specific targets for this client. Goals help measure SEO success and identify areas needing attention.
            </p>
            {clientId && (
              <ClientGoalsManager
                clientId={clientId}
                workspaceId="default-workspace"
              />
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Toast notification ──────────────────────────────────────── */}
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
