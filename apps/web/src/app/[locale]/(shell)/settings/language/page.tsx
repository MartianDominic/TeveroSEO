"use client";

/**
 * Language Settings Page
 * Phase 55-04: Multi-Tenant Language Settings
 *
 * Workspace-level language and formality configuration.
 * Uses next-intl for translations.
 */
import { useState, useEffect } from "react";
import { useOrganization } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Label,
  Checkbox,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Alert,
  AlertDescription,
} from "@tevero/ui";
import { Loader2, Save, AlertCircle, CheckCircle2, Globe, Languages } from "lucide-react";

type SupportedLocale = "en" | "lt";
type Formality = "formal" | "informal";

interface LanguageSettings {
  defaultLanguage: SupportedLocale;
  supportedLanguages: SupportedLocale[];
  formality: Formality;
  country: string | null;
}

const DEFAULT_SETTINGS: LanguageSettings = {
  defaultLanguage: "en",
  supportedLanguages: ["en"],
  formality: "formal",
  country: null,
};

const LANGUAGES: { code: SupportedLocale; name: string; native: string; flag: string }[] = [
  { code: "en", name: "English", native: "English", flag: "GB" },
  { code: "lt", name: "Lithuanian", native: "Lietuviu", flag: "LT" },
];

const FORMALITY_OPTIONS: { value: Formality; label: string; description: string }[] = [
  { value: "formal", label: "Formal (jus)", description: "Professional, respectful tone" },
  { value: "informal", label: "Informal (tu)", description: "Casual, friendly tone" },
];

export default function LanguageSettingsPage() {
  const { organization, isLoaded } = useOrganization();
  const t = useTranslations("settings");
  const [settings, setSettings] = useState<LanguageSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch settings on mount
  useEffect(() => {
    if (!isLoaded || !organization) return;

    async function fetchSettings() {
      try {
        const response = await fetch("/api/settings/language");
        const data = await response.json();

        if (data.success) {
          setSettings(data.data);
        } else {
          setError(data.error || "Failed to load settings");
        }
      } catch (err) {
        setError("Failed to load language settings");
      } finally {
        setIsLoading(false);
      }
    }

    fetchSettings();
  }, [isLoaded, organization]);

  const handleSupportedLanguageChange = (code: SupportedLocale, checked: boolean) => {
    setSettings((prev) => {
      const newSupported = checked
        ? [...prev.supportedLanguages, code]
        : prev.supportedLanguages.filter((l) => l !== code);

      // Ensure at least one language is supported
      if (newSupported.length === 0) return prev;

      // If removing the default language, switch default to first available
      const newDefault = newSupported.includes(prev.defaultLanguage)
        ? prev.defaultLanguage
        : newSupported[0];

      return {
        ...prev,
        supportedLanguages: newSupported,
        defaultLanguage: newDefault,
      };
    });
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/settings/language", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const data = await response.json();

      if (data.success) {
        setSettings(data.data);
        setSuccess("Language settings saved successfully");
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
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Globe className="w-6 h-6" />
          {t("language.title", { fallback: "Language Settings" })}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t("language.description", {
            fallback: "Configure language preferences for your workspace and client communications.",
          })}
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

      {/* Supported Languages */}
      <Card className="shadow-[0_1px_3px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.03)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Languages className="w-5 h-5" />
            {t("language.supportedLanguages", { fallback: "Supported Languages" })}
          </CardTitle>
          <CardDescription>
            {t("language.supportedLanguagesDesc", {
              fallback: "Select which languages your workspace supports for client communications.",
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {LANGUAGES.map((lang) => (
              <div key={lang.code} className="flex items-center space-x-3">
                <Checkbox
                  id={`lang-${lang.code}`}
                  checked={settings.supportedLanguages.includes(lang.code)}
                  onCheckedChange={(checked) =>
                    handleSupportedLanguageChange(lang.code, checked as boolean)
                  }
                  disabled={
                    settings.supportedLanguages.length === 1 &&
                    settings.supportedLanguages.includes(lang.code)
                  }
                />
                <Label
                  htmlFor={`lang-${lang.code}`}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <span className="text-lg">{lang.flag === "GB" ? "\u{1F1EC}\u{1F1E7}" : "\u{1F1F1}\u{1F1F9}"}</span>
                  <span className="font-medium">{lang.native}</span>
                  <span className="text-muted-foreground">({lang.name})</span>
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Default Language & Formality */}
      <Card className="shadow-[0_1px_3px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.03)]">
        <CardHeader>
          <CardTitle>{t("language.defaults", { fallback: "Default Settings" })}</CardTitle>
          <CardDescription>
            {t("language.defaultsDesc", {
              fallback: "Configure default language and formality for communications.",
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Default Language */}
          <div className="space-y-2">
            <Label htmlFor="defaultLanguage">
              {t("language.defaultLanguage", { fallback: "Default Language" })}
            </Label>
            <Select
              value={settings.defaultLanguage}
              onValueChange={(value: SupportedLocale) =>
                setSettings((prev) => ({ ...prev, defaultLanguage: value }))
              }
            >
              <SelectTrigger id="defaultLanguage" className="w-full max-w-xs">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                {settings.supportedLanguages.map((code) => {
                  const lang = LANGUAGES.find((l) => l.code === code);
                  return (
                    <SelectItem key={code} value={code}>
                      {lang?.native} ({lang?.name})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {t("language.defaultLanguageDesc", {
                fallback: "Language used when no specific preference is set.",
              })}
            </p>
          </div>

          {/* Formality */}
          <div className="space-y-2 pt-4 border-t">
            <Label htmlFor="formality">
              {t("language.formality", { fallback: "Formality Level" })}
            </Label>
            <Select
              value={settings.formality}
              onValueChange={(value: Formality) =>
                setSettings((prev) => ({ ...prev, formality: value }))
              }
            >
              <SelectTrigger id="formality" className="w-full max-w-xs">
                <SelectValue placeholder="Select formality" />
              </SelectTrigger>
              <SelectContent>
                {FORMALITY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {t("language.formalityDesc", {
                fallback:
                  "Determines the tone of Lithuanian communications. Formal uses 'jus' (you-formal), informal uses 'tu' (you-informal).",
              })}
            </p>
          </div>

          {/* Save Button */}
          <div className="pt-4 border-t">
            <Button onClick={handleSaveSettings} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("common.saving", { fallback: "Saving..." })}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {t("common.saveChanges", { fallback: "Save Changes" })}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                {t("language.resolutionInfo", { fallback: "Language Resolution" })}
              </p>
              <p className="text-sm text-blue-600 dark:text-blue-400">
                {t("language.resolutionDesc", {
                  fallback:
                    "Communications use this hierarchy: prospect preference > workspace default > browser language > English. Individual prospects can override the workspace default.",
                })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
