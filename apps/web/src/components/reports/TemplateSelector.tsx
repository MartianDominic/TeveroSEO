"use client";

/**
 * TemplateSelector component for report builder.
 * Phase 53: Template selection and saving functionality.
 *
 * Features:
 * - Load templates from API
 * - Select template to apply sections
 * - Save current configuration as new template
 * - Auto-select default template on load
 */

import { useState, useEffect, type FC } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Textarea,
} from "@tevero/ui";
import { Save, Loader2, Star, FileText } from "lucide-react";
import {
  getReportTemplates,
  createReportTemplate,
  type ReportTemplateResponse,
} from "@/lib/api/report-templates";
import type { ReportSection } from "@tevero/types";

interface TemplateSelectorProps {
  /** Current sections configuration */
  currentSections: ReportSection[];
  /** Callback when template is loaded */
  onLoadTemplate: (sections: ReportSection[], name: string) => void;
}

/**
 * Template selector with save dialog.
 * Uses v6 design tokens for consistent styling.
 */
export const TemplateSelector: FC<TemplateSelectorProps> = ({
  currentSections,
  onLoadTemplate,
}) => {
  const [templates, setTemplates] = useState<ReportTemplateResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDescription, setNewTemplateDescription] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    const result = await getReportTemplates();
    if (result.success) {
      setTemplates(result.data);
      // Auto-select default template on first load
      const defaultTemplate = result.data.find((t) => t.isDefault);
      if (defaultTemplate && !selectedTemplateId) {
        setSelectedTemplateId(defaultTemplate.id);
        onLoadTemplate(defaultTemplate.sections, defaultTemplate.name);
      }
    }
    setLoading(false);
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (templateId === "") {
      // "Custom configuration" selected - don't change sections
      return;
    }
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      onLoadTemplate(template.sections, template.name);
    }
  };

  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim()) return;

    setSaving(true);
    const result = await createReportTemplate({
      name: newTemplateName,
      description: newTemplateDescription || undefined,
      sections: currentSections,
    });

    if (result.success) {
      setTemplates([...templates, result.data]);
      setSelectedTemplateId(result.data.id);
      setSaveDialogOpen(false);
      setNewTemplateName("");
      setNewTemplateDescription("");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[var(--text-3)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading templates...
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {/* Template selector dropdown */}
      <div className="flex-1">
        <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
          <SelectTrigger className="w-full bg-[var(--surface)] border-[var(--hairline)]">
            <SelectValue placeholder="Select a template...">
              {selectedTemplateId === "" ? (
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Custom configuration
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {templates.find((t) => t.id === selectedTemplateId)
                    ?.isDefault && (
                    <Star className="h-3 w-3 text-[var(--accent)] fill-[var(--accent)]" />
                  )}
                  {templates.find((t) => t.id === selectedTemplateId)?.name}
                </span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[var(--text-3)]" />
                Custom configuration
              </div>
            </SelectItem>
            {templates.map((template) => (
              <SelectItem key={template.id} value={template.id}>
                <div className="flex items-center gap-2">
                  {template.isDefault && (
                    <Star className="h-3 w-3 text-[var(--accent)] fill-[var(--accent)]" />
                  )}
                  <span>{template.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Save as template button */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="border-[var(--hairline)]"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Template
          </Button>
        </DialogTrigger>
        <DialogContent className="bg-[var(--surface)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-1)]">
              Save as Template
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label
                htmlFor="template-name"
                className="text-sm font-medium text-[var(--text-1)]"
              >
                Template Name
              </Label>
              <Input
                id="template-name"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="Monthly SEO Report"
                className="mt-1.5 bg-[var(--surface)] border-[var(--hairline)]"
                maxLength={100}
              />
            </div>
            <div>
              <Label
                htmlFor="template-description"
                className="text-sm font-medium text-[var(--text-1)]"
              >
                Description (optional)
              </Label>
              <Textarea
                id="template-description"
                value={newTemplateDescription}
                onChange={(e) => setNewTemplateDescription(e.target.value)}
                placeholder="Standard monthly report with all sections"
                rows={2}
                className="mt-1.5 bg-[var(--surface)] border-[var(--hairline)] resize-none"
                maxLength={500}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setSaveDialogOpen(false)}
                className="border-[var(--hairline)]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveTemplate}
                disabled={!newTemplateName.trim() || saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Template"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
