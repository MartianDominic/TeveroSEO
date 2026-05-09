"use client";

/**
 * VoiceTemplatesTab - Voice Template Management
 *
 * HIGH-02 FIX: Extracted from 1043-line settings/page.tsx for maintainability.
 * This component manages reusable voice/writing style templates.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";

import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";
import { logger } from "@/lib/logger";

import {
  Button,
  Dialog,
  DialogContent,
  Input,
  Label,
  Separator,
  Skeleton,
  StatusChip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from "@tevero/ui";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

const EMPTY_FORM: NewTemplateForm = { name: "", description: "", content: "" };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VoiceTemplatesTab() {
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
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    // Clear any existing timer to prevent memory leaks
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // Cleanup toast timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const loadTemplates = useCallback(() => {
    setTemplatesLoading(true);
    apiGet<VoiceTemplate[]>("/api/voice-templates")
      .then((data) => setTemplates(data))
      .catch((error) => {
        logger.error("[VoiceTemplatesTab] Failed to load templates", error instanceof Error ? error : { error: String(error) });
        setTemplates([]);
      })
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
    } catch (error) {
      logger.error("[VoiceTemplatesTab] Failed to create template", error instanceof Error ? error : { error: String(error) });
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
    } catch (error) {
      logger.error("[VoiceTemplatesTab] Failed to update template", error instanceof Error ? error : { error: String(error) });
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
      } catch (error) {
        logger.error("[VoiceTemplatesTab] Failed to delete template", error instanceof Error ? error : { error: String(error) });
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
                      {template.description ?? ""}
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
                placeholder="Describe the writing style in detail - tone, vocabulary, sentence structure, examples..."
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
}
