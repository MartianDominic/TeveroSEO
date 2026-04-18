"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Loader2, Eye, EyeOff, CheckCircle, XCircle } from "lucide-react";

import {
  Button,
  Dialog,
  DialogContent,
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
  StatusChip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@tevero/ui";
import { cn } from "@/lib/utils";

// API
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from "@/lib/api-client";

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

interface VoiceTemplate {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  content?: string | null;
  is_system: boolean;
}

interface NewTemplateForm {
  name: string;
  description: string;
  content: string;
}

interface GlobalSettings {
  default_text_model: string | null;
  default_image_model: string | null;
}

const EMPTY_FORM: NewTemplateForm = { name: "", description: "", content: "" };

const TEXT_MODELS = [
  // Anthropic Claude
  "claude-sonnet-4-6",
  "claude-opus-4-6",
  "claude-haiku-4-5",
  "claude-opus-4-5",
  "claude-sonnet-4-5",
  // Google Gemini 3 (preview)
  "gemini-3.1-pro-preview",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite-preview",
  // Google Gemini 2.5
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  // Google Gemini 2.0 (legacy)
  "gemini-2.0-pro",
  // OpenAI GPT-5
  "gpt-5",
  "gpt-5-mini",
  "gpt-5-nano",
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-5.4-nano",
  // OpenAI GPT-4.1
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4.1-nano",
  // OpenAI GPT-4o
  "gpt-4o",
  "gpt-4o-mini",
  // OpenAI o-series
  "o3",
  "o3-mini",
  "o4-mini",
  // xAI Grok
  "grok-4",
  "grok-4-latest",
  "grok-4-fast-reasoning",
  "grok-4-fast-non-reasoning",
  "grok-4-1-fast-reasoning",
];

const IMAGE_MODELS = [
  "imagen-4.0-generate-001",
  "imagen-4.0-ultra-001",
];

// ---------------------------------------------------------------------------
// ApiIntegrationsTab
// ---------------------------------------------------------------------------

const ApiIntegrationsTab: React.FC = () => {
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

  const loadSecrets = useCallback(() => {
    setLoading(true);
    apiGet<SecretStatus[]>("/api/platform-secrets/status")
      .then((data) => setSecrets(data))
      .catch(() => setSecrets([]))
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
    } catch {
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
        setTimeout(() => handleVerify(keyName), 500);
      } catch {
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
      } catch {
        // silent — user can retry
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
                          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide bg-muted text-muted-foreground border border-border">
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
};

// ---------------------------------------------------------------------------
// VoiceTemplatesTab
// ---------------------------------------------------------------------------

const VoiceTemplatesTab: React.FC = () => {
  const [templates, setTemplates] = useState<VoiceTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<NewTemplateForm>(EMPTY_FORM);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [editingTemplate, setEditingTemplate] = useState<VoiceTemplate | null>(null);
  const [editForm, setEditForm] = useState<NewTemplateForm>(EMPTY_FORM);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadTemplates = useCallback(() => {
    setTemplatesLoading(true);
    apiGet<VoiceTemplate[]>("/api/voice-templates")
      .then((data) => setTemplates(data))
      .catch(() => setTemplates([]))
      .finally(() => setTemplatesLoading(false));
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleCreate = useCallback(async () => {
    if (!form.name.trim()) {
      setFormError("Name is required.");
      return;
    }
    setFormSaving(true);
    setFormError(null);
    try {
      await apiPost("/api/voice-templates", {
        name: form.name.trim(),
        description: form.description.trim() || null,
        content: form.content.trim() || null,
      });
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      loadTemplates();
      showToast("Voice template created.");
    } catch {
      setFormError("Failed to create template. Please try again.");
    } finally {
      setFormSaving(false);
    }
  }, [form, loadTemplates, showToast]);

  const handleOpenEdit = useCallback((template: VoiceTemplate) => {
    setEditingTemplate(template);
    setEditForm({
      name: template.name,
      description: template.description ?? "",
      content: template.content ?? "",
    });
    setEditError(null);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingTemplate) return;
    if (!editForm.name.trim()) {
      setEditError("Name is required.");
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      await apiPatch(`/api/voice-templates/${editingTemplate.id}`, {
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
        content: editForm.content.trim() || null,
      });
      setEditingTemplate(null);
      loadTemplates();
      showToast("Voice template updated.");
    } catch {
      setEditError("Failed to update template. Please try again.");
    } finally {
      setEditSaving(false);
    }
  }, [editingTemplate, editForm, loadTemplates, showToast]);

  const handleDelete = useCallback(
    async (templateId: string) => {
      setDeletingId(templateId);
      try {
        await apiDelete(`/api/voice-templates/${templateId}`);
        loadTemplates();
        showToast("Voice template deleted.");
      } catch {
        showToast("Failed to delete template.", "error");
      } finally {
        setDeletingId(null);
      }
    },
    [loadTemplates, showToast]
  );

  return (
    <div className="mt-6">
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-medium text-foreground">Voice Templates</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Reusable writing style templates. Clients can blend their brand voice with these templates.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setDialogOpen(true);
              setForm(EMPTY_FORM);
              setFormError(null);
            }}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Template
          </Button>
        </div>

        <Separator className="mb-4" />

        {templatesLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 py-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-48 flex-1" />
                <Skeleton className="h-5 w-16 rounded-md" />
              </div>
            ))}
          </div>
        ) : templates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No voice templates yet. Create one to get started.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-[100px]">Type</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium text-foreground">
                    {template.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-[240px]">
                    <span className="line-clamp-2">
                      {template.description ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {template.is_system && (
                      <StatusChip status="draft" label="system" />
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {!template.is_system && (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleOpenEdit(template)}
                          title="Edit template"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(template.id)}
                          disabled={deletingId === template.id}
                          title="Delete template"
                        >
                          {deletingId === template.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* New Template Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) setDialogOpen(false); }}>
        <DialogContent className="max-w-lg w-full rounded-lg border border-border bg-card p-6 shadow-lg">
          <h2 className="text-base font-semibold text-foreground mb-1">New Voice Template</h2>
          <p className="text-xs text-muted-foreground mb-4">Create a reusable writing style template</p>

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-foreground">Name</Label>
              <Input
                className="mt-1.5"
                placeholder="e.g. Professional, Conversational, Storyteller"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-foreground">Description</Label>
              <Input
                className="mt-1.5"
                placeholder="Brief description of this writing style"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-foreground">Content</Label>
              <Textarea
                className="mt-1.5"
                rows={5}
                placeholder="Describe the writing style in detail — tone, vocabulary, sentence structure, examples..."
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              />
            </div>

            {formError && (
              <p className="text-xs text-destructive">{formError}</p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={formSaving}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={formSaving}>
                {formSaving ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Saving...</>
                ) : (
                  "Create template"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Template Dialog */}
      <Dialog
        open={editingTemplate !== null}
        onOpenChange={(open) => { if (!open) setEditingTemplate(null); }}
      >
        <DialogContent className="max-w-lg w-full rounded-lg border border-border bg-card p-6 shadow-lg">
          <h2 className="text-base font-semibold text-foreground mb-1">Edit Voice Template</h2>
          <p className="text-xs text-muted-foreground mb-4">Update this writing style template</p>

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-foreground">Name</Label>
              <Input
                className="mt-1.5"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-foreground">Description</Label>
              <Input
                className="mt-1.5"
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-foreground">Content</Label>
              <Textarea
                className="mt-1.5"
                rows={5}
                value={editForm.content}
                onChange={(e) => setEditForm((f) => ({ ...f, content: e.target.value }))}
              />
            </div>

            {editError && (
              <p className="text-xs text-destructive">{editError}</p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditingTemplate(null)} disabled={editSaving}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={editSaving}>
                {editSaving ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Saving...</>
                ) : (
                  "Save changes"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg px-4 py-3 text-sm shadow-lg bg-card border border-border">
          <div className="flex items-center gap-2">
            <StatusChip status={toast.type === "success" ? "published" : "failed"} />
            <span className="text-foreground font-medium">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// ModelDefaultsTab
// ---------------------------------------------------------------------------

const ModelDefaultsTab: React.FC = () => {
  const [settings, setSettings] = useState<GlobalSettings>({
    default_text_model: null,
    default_image_model: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    apiGet<GlobalSettings>("/api/settings/global")
      .then((data) => setSettings(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSavedOk(false);
    try {
      await apiPut("/api/settings/global", {
        default_text_model: settings.default_text_model,
        default_image_model: settings.default_image_model,
      });
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 3000);
    } catch {
      setSaveError("Failed to save model defaults. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mt-6 space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="rounded-lg border border-border bg-card p-6 max-w-md">
        <h3 className="text-sm font-medium text-foreground mb-1">Model Defaults</h3>
        <p className="text-xs text-muted-foreground mb-5">
          Default AI models used for article generation and image creation. These are workspace-wide defaults and can be overridden per client.
        </p>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-foreground mb-1.5 block">
              Text Model
            </Label>
            <Select
              value={settings.default_text_model ?? ""}
              onValueChange={(value) =>
                setSettings((s) => ({ ...s, default_text_model: value || null }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select text model..." />
              </SelectTrigger>
              <SelectContent>
                {TEXT_MODELS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-medium text-foreground mb-1.5 block">
              Image Model
            </Label>
            <Select
              value={settings.default_image_model ?? ""}
              onValueChange={(value) =>
                setSettings((s) => ({ ...s, default_image_model: value || null }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select image model..." />
              </SelectTrigger>
              <SelectContent>
                {IMAGE_MODELS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {saveError && (
            <p className="text-xs text-destructive">{saveError}</p>
          )}

          {savedOk && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5" />
              Model defaults saved.
            </p>
          )}

          <div className="pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Saving...</>
              ) : (
                "Save defaults"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// GlobalSettingsPage
// ---------------------------------------------------------------------------

export default function GlobalSettingsPage() {
  return (
    <div className="max-w-3xl mx-auto px-8 py-10">
      <PageHeader title="Global Settings" subtitle="Platform configuration and API integrations" />

      <Tabs defaultValue="api" className="mt-6">
        <TabsList>
          <TabsTrigger value="api">API Integrations</TabsTrigger>
          <TabsTrigger value="voice">Voice Templates</TabsTrigger>
          <TabsTrigger value="models">Model Defaults</TabsTrigger>
        </TabsList>

        <TabsContent value="api">
          <ApiIntegrationsTab />
        </TabsContent>

        <TabsContent value="voice">
          <VoiceTemplatesTab />
        </TabsContent>

        <TabsContent value="models">
          <ModelDefaultsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
