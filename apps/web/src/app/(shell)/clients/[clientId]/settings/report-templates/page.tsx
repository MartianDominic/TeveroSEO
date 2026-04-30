import { Suspense } from "react";
import { redirect } from "next/navigation";
type AnyRoute = Parameters<typeof redirect>[0];
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
} from "@tevero/ui";
import { Plus, Star, Trash2, Edit, ArrowLeft } from "lucide-react";
import {
  getReportTemplates,
  type ReportTemplateResponse,
} from "@/lib/api/report-templates";
import { REPORT_SECTIONS, getSectionMeta } from "@/lib/reports/sections";

interface TemplateSettingsPageProps {
  params: Promise<{ clientId: string }>;
}

/**
 * Skeleton loader for templates list.
 */
function TemplatesLoading() {
  return (
    <div className="space-y-4">
      {[1, 2].map((i) => (
        <div
          key={i}
          className="h-32 w-full rounded-lg bg-[var(--surface-2)] animate-pulse"
        />
      ))}
    </div>
  );
}

/**
 * Template card component.
 */
function TemplateCard({ template }: { template: ReportTemplateResponse }) {
  return (
    <Card className="hover:shadow-md transition-shadow border-[var(--hairline)]">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg text-[var(--text-1)]">
              {template.name}
            </CardTitle>
            {template.isDefault && (
              <Badge
                variant="secondary"
                className="bg-[var(--accent-soft)] text-[var(--accent)]"
              >
                <Star className="h-3 w-3 mr-1 fill-current" />
                Default
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-[var(--text-3)] hover:text-[var(--text-1)]"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-[var(--text-3)] hover:text-[var(--error)]"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {template.description && (
          <p className="text-sm text-[var(--text-3)]">{template.description}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {template.sections.map((section) => {
            const meta = getSectionMeta(section.type);
            return (
              <Badge
                key={section.type}
                variant="outline"
                className="border-[var(--hairline)] text-[var(--text-2)]"
              >
                {meta?.label || section.type}
              </Badge>
            );
          })}
        </div>
        <p className="text-xs text-[var(--text-3)] mt-3">
          Created {new Date(template.createdAt).toLocaleDateString()}
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Templates list content (server component).
 */
async function TemplatesContent() {
  const result = await getReportTemplates();

  if (!result.success) {
    return (
      <div className="p-4 bg-[var(--error-soft)] text-[var(--error)] rounded-lg">
        {result.error || "Failed to load templates"}
      </div>
    );
  }

  const templates = result.data;

  if (templates.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--text-3)] mb-4">No templates saved yet</p>
        <p className="text-sm text-[var(--text-3)] mb-6">
          Create a report and save it as a template for quick reuse.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {templates.map((template) => (
        <TemplateCard key={template.id} template={template} />
      ))}
    </div>
  );
}

/**
 * Report templates settings page.
 * Phase 53: Manage saved report configurations.
 */
export default async function TemplateSettingsPage({
  params,
}: TemplateSettingsPageProps) {
  const { clientId } = await params;

  // Validate UUID format
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(clientId)) {
    redirect("/clients" as AnyRoute);
  }

  return (
    <div className="container max-w-4xl py-8">
      {/* Page Header */}
      <div className="mb-8">
        <Link
          href={`/clients/${clientId}/settings`}
          className="inline-flex items-center gap-2 text-sm text-[var(--text-3)] hover:text-[var(--text-1)] mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Link>
        <h1 className="text-2xl font-semibold text-[var(--text-1)]">
          Report Templates
        </h1>
        <p className="text-[var(--text-3)] mt-1">
          Manage saved report configurations for quick reuse
        </p>
      </div>

      {/* Templates Card */}
      <Card className="border-[var(--hairline)]">
        <CardHeader className="border-b border-[var(--hairline-2)]">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[var(--text-1)]">
              Saved Templates
            </CardTitle>
            <Link href={`/clients/${clientId}/reports/new`}>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <Suspense fallback={<TemplatesLoading />}>
            <TemplatesContent />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
