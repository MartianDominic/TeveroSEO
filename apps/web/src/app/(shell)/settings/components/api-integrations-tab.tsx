"use client";

/**
 * ApiIntegrationsTab - API Keys and Secrets Management
 *
 * HIGH-02 FIX: Extracted from 1043-line settings/page.tsx for maintainability.
 * This component manages platform API secrets (DataForSEO, OpenAI, etc.).
 */

import React, { useState, useEffect, useCallback, useRef } from "react";

import {
  CheckCircle,
  Eye,
  EyeOff,
  Loader2,
  Trash2,
  XCircle,
} from "lucide-react";

import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api-client";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";

import {
  Button,
  Input,
  Separator,
  Skeleton,
  StatusChip,
} from "@tevero/ui";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SecretStatus {
  key_name: string;
  label: string;
  group: string;
  required: boolean;
  configured: boolean;
  masked: string | null;
  source: "db" | "env" | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ApiIntegrationsTab() {
  const [secrets, setSecrets] = useState<SecretStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const [dataforseoMethod, setDataforseoMethod] = useState<"credentials" | "basecode">("credentials");

  useEffect(() => {
    if (secrets.length === 0) return;
    const basecode = secrets.find((s) => s.key_name === "dataforseo_base_code");
    const login = secrets.find((s) => s.key_name === "dataforseo_login");
    if (basecode?.configured && !login?.configured) {
      setDataforseoMethod("basecode");
    }
  }, [secrets]);

  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showValue, setShowValue] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [verifying, setVerifying] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<Record<string, { ok: boolean; error: string | null }>>({});
  const verifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup verify timer on unmount
  useEffect(() => {
    return () => {
      if (verifyTimerRef.current) {
        clearTimeout(verifyTimerRef.current);
      }
    };
  }, []);

  const loadSecrets = useCallback(() => {
    setLoading(true);
    apiGet<SecretStatus[]>("/api/platform-secrets/status")
      .then((data) => setSecrets(data))
      .catch((error) => {
        logger.error("[ApiIntegrationsTab] Failed to load secrets", error instanceof Error ? error : { error: String(error) });
        setSecrets([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadSecrets();
  }, [loadSecrets]);

  const handleStartEdit = (keyName: string) => {
    setEditing(keyName);
    setEditValue("");
    setShowValue(false);
    setSaveError(null);
  };

  const handleCancelEdit = () => {
    setEditing(null);
    setEditValue("");
    setSaveError(null);
  };

  const handleVerify = useCallback(async (keyName: string) => {
    setVerifying(keyName);
    try {
      const data = await apiPost<{ ok: boolean; error: string | null }>(
        `/api/platform-secrets/${keyName}/verify`,
        {}
      );
      setVerifyResult((prev) => ({ ...prev, [keyName]: data }));
    } catch (error) {
      logger.error("[ApiIntegrationsTab] Verification failed for", { keyName, error: String(error) });
      setVerifyResult((prev) => ({
        ...prev,
        [keyName]: { ok: false, error: "Verification request failed" },
      }));
    } finally {
      setVerifying(null);
    }
  }, []);

  const handleSave = useCallback(
    async (keyName: string) => {
      if (!editValue.trim()) {
        setSaveError("Value cannot be empty.");
        return;
      }
      setSaving(true);
      setSaveError(null);
      try {
        await apiPut(`/api/platform-secrets/${keyName}`, { value: editValue.trim() });
        setEditing(null);
        setEditValue("");
        loadSecrets();
        // Clear any existing timer before setting new one
        if (verifyTimerRef.current) {
          clearTimeout(verifyTimerRef.current);
        }
        verifyTimerRef.current = setTimeout(() => handleVerify(keyName), 500);
      } catch (error) {
        logger.error("[ApiIntegrationsTab] Failed to save secret", error instanceof Error ? error : { error: String(error) });
        setSaveError("Failed to save. Please try again.");
      } finally {
        setSaving(false);
      }
    },
    [editValue, loadSecrets, handleVerify]
  );

  const handleDelete = useCallback(
    async (keyName: string, label: string) => {
      if (!window.confirm(`Remove "${label}" from the database? This cannot be undone.`)) return;
      try {
        await apiDelete(`/api/platform-secrets/${keyName}`);
        setVerifyResult((prev) => {
          const next = { ...prev };
          delete next[keyName];
          return next;
        });
        loadSecrets();
      } catch (err) {
        logger.error("Failed to delete secret", err instanceof Error ? err : { error: String(err) });
      }
    },
    [loadSecrets]
  );

  const groups = secrets.reduce<Record<string, SecretStatus[]>>((acc, s) => {
    if (!acc[s.group]) acc[s.group] = [];
    acc[s.group].push(s);
    return acc;
  }, {});

  const getChipStatus = (s: SecretStatus): "connected" | "error" | "warning" | "draft" => {
    if (s.configured) {
      const vr = verifyResult[s.key_name];
      if (vr && !vr.ok) return "error";
      return "connected";
    }
    return s.required ? "warning" : "draft";
  };

  const getChipLabel = (s: SecretStatus): string => {
    if (s.configured) {
      const vr = verifyResult[s.key_name];
      if (vr && vr.ok) return "Verified";
      if (vr && !vr.ok) return "Invalid";
      return "Configured";
    }
    return s.required ? "Required" : "Optional";
  };

  if (loading) {
    return (
      <div className="space-y-3 mt-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-4">
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
        ))}
      </div>
    );
  }

  if (secrets.length === 0) {
    return (
      <div className="mt-6 rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">No API keys configured.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-8">
      {Object.entries(groups).map(([groupName, items]) => {
        const visibleItems = groupName === "SEO Intelligence"
          ? items.filter((s) => {
              if (dataforseoMethod === "credentials") return s.key_name !== "dataforseo_base_code";
              return s.key_name === "dataforseo_base_code";
            })
          : items;

        return (
          <div key={groupName}>
            <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">
              {groupName}
            </h3>
            {groupName === "SEO Intelligence" && (
              <>
                <div className="mb-3 flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-1 w-fit">
                  <button
                    onClick={() => setDataforseoMethod("credentials")}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                      dataforseoMethod === "credentials"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Email + Password
                  </button>
                  <button
                    onClick={() => setDataforseoMethod("basecode")}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                      dataforseoMethod === "basecode"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Base Code
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  {dataforseoMethod === "credentials"
                    ? "Enter the email and password from your DataForSEO account."
                    : "Enter the base64 auth string DataForSEO sent to your email (single credential)."}
                </p>
              </>
            )}
            <div className="space-y-3">
              {visibleItems.map((s) => {
                const isEditing = editing === s.key_name;
                const isVerifying = verifying === s.key_name;
                const vr = verifyResult[s.key_name];

                return (
                  <div key={s.key_name} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{s.label}</span>
                        {s.source === "env" && (
                          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs-safe font-medium uppercase tracking-wide bg-muted text-muted-foreground border border-border">
                            ENV
                          </span>
                        )}
                      </div>
                      <StatusChip status={getChipStatus(s)} label={getChipLabel(s)} />
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="flex-1 text-xs text-muted-foreground font-mono">
                        {s.configured && s.masked ? s.masked : "Not configured"}
                      </span>

                      {!isEditing && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleStartEdit(s.key_name)}
                        >
                          Update
                        </Button>
                      )}

                      {!isEditing && s.configured && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleVerify(s.key_name)}
                          disabled={isVerifying}
                        >
                          {isVerifying ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Verify"
                          )}
                        </Button>
                      )}

                      {!isEditing && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-destructive hover:text-destructive"
                          onClick={() => handleDelete(s.key_name, s.label)}
                          disabled={s.source === "env" || !s.configured}
                          title={
                            s.source === "env"
                              ? "Managed via environment variable"
                              : !s.configured
                              ? "Not configured"
                              : undefined
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    {isEditing && (
                      <div className="mt-3 space-y-2">
                        <Separator />
                        <div className="flex items-center gap-2 mt-3">
                          <div className="relative flex-1">
                            <Input
                              type={showValue ? "text" : "password"}
                              placeholder="Enter new value..."
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="pr-9 text-sm font-mono"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => setShowValue((v) => !v)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              {showValue ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                          <Button
                            size="sm"
                            className="h-9"
                            onClick={() => handleSave(s.key_name)}
                            disabled={saving}
                          >
                            {saving ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              "Save"
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9"
                            onClick={handleCancelEdit}
                            disabled={saving}
                          >
                            Cancel
                          </Button>
                        </div>
                        {saveError && (
                          <p className="text-xs text-destructive">{saveError}</p>
                        )}
                      </div>
                    )}

                    {!isEditing && vr && (
                      <div
                        className={cn(
                          "mt-2 flex items-center gap-1.5 text-xs",
                          vr.ok ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                        )}
                      >
                        {vr.ok ? (
                          <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 shrink-0" />
                        )}
                        <span>
                          {vr.ok
                            ? "Verified successfully"
                            : vr.error
                            ? vr.error.slice(0, 80)
                            : "Verification failed"}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
