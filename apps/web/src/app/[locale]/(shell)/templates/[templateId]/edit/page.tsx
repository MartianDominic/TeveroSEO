/**
 * Template Editor Page
 * Phase 59-05: Template Editor with Drag-Drop Variables
 *
 * Server component that loads template data and renders the editor.
 */

import { notFound } from "next/navigation";

import { getTranslations } from "next-intl/server";

import { TemplateEditor } from "@/components/template-editor/TemplateEditor";

import { PageHeader } from "@tevero/ui";

import { getTemplate } from "./actions";

interface Props {
  params: Promise<{ templateId: string; locale: string }>;
}

export default async function TemplateEditPage({ params }: Props) {
  const { templateId, locale } = await params;
  const t = await getTranslations("templates");

  // Validate templateId format
  if (!templateId || templateId.length === 0) {
    notFound();
  }

  // Fetch template data
  const template = await getTemplate(templateId);

  if (!template) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="container py-4">
          <PageHeader
            title={t("editor.title", { fallback: "Edit Template" })}
            subtitle={t("editor.subtitle", {
              name: template.name,
              fallback: `Editing: ${template.name}`,
            })}
          />
        </div>
      </div>

      <div className="container py-0">
        <TemplateEditor initialData={template} />
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: Props) {
  const { templateId } = await params;
  const template = await getTemplate(templateId);

  return {
    title: template ? `Edit: ${template.name}` : "Edit Template",
  };
}
