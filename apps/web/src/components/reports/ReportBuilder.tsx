"use client";

/**
 * ReportBuilder container component.
 *
 * Main UI for configuring and generating custom reports.
 * Combines section selection, date range picker, and data preview.
 */

import { useState, type FC } from "react";

import { useRouter, redirect } from "next/navigation";

type AnyRoute = Parameters<typeof redirect>[0];
import { Calendar, FileText, Loader2, AlertCircle } from "lucide-react";

import { generateReport } from "@/lib/reports/actions";
import { useReportBuilder } from "@/lib/reports/builder";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  cn,
} from "@tevero/ui";

import { ReportDataPreview } from "./ReportDataPreview";
import { SectionSelector } from "./SectionSelector";
import { TemplateSelector } from "./TemplateSelector";

interface ReportBuilderProps {
  /** Client UUID */
  clientId: string;
  /** Client display name */
  clientName: string;
}

/**
 * Report builder container component.
 *
 * Features:
 * - Report name and date range configuration
 * - Drag-and-drop section ordering
 * - Live data preview
 * - Generation with loading state
 * - Error handling with user-friendly messages
 */
export const ReportBuilder: FC<ReportBuilderProps> = ({
  clientId,
  clientName,
}) => {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    config,
    setName,
    setSections,
    toggleSection,
    setDateRange,
    isValid,
    enabledSections,
  } = useReportBuilder({
    name: `${clientName} Report`,
  });

  /**
   * Handle report generation.
   * Redirects to report detail page on success.
   */
  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);

    try {
      const result = await generateReport(clientId, {
        reportType: "monthly-seo",
        dateRange: config.dateRange,
        locale: config.locale,
      });

      if (result.success && result.data) {
        router.push(`/clients/${clientId}/reports/${result.data.reportId}` as AnyRoute);
      } else {
        setError("error" in result ? result.error : "Failed to generate report");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left column: Configuration */}
      <div className="space-y-6">
        {/* Report Settings Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-[var(--accent)]" />
              Report Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Template Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Template</Label>
              <TemplateSelector
                currentSections={config.sections}
                onLoadTemplate={(sections, name) => {
                  setSections(sections);
                  setName(name);
                }}
              />
            </div>

            {/* Report Name */}
            <div className="space-y-2">
              <Label htmlFor="report-name" className="text-sm font-medium">
                Report Name
              </Label>
              <Input
                id="report-name"
                value={config.name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Monthly SEO Report"
                className="bg-[var(--surface)] border-[var(--hairline)]"
              />
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[var(--text-3)]" />
                Date Range
              </Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label
                    htmlFor="date-start"
                    className="text-xs-safe text-[var(--text-3)]"
                  >
                    Start Date
                  </Label>
                  <Input
                    id="date-start"
                    type="date"
                    value={config.dateRange.start}
                    onChange={(e) =>
                      setDateRange({ ...config.dateRange, start: e.target.value })
                    }
                    className="bg-[var(--surface)] border-[var(--hairline)]"
                  />
                </div>
                <div className="space-y-1">
                  <Label
                    htmlFor="date-end"
                    className="text-xs-safe text-[var(--text-3)]"
                  >
                    End Date
                  </Label>
                  <Input
                    id="date-end"
                    type="date"
                    value={config.dateRange.end}
                    onChange={(e) =>
                      setDateRange({ ...config.dateRange, end: e.target.value })
                    }
                    className="bg-[var(--surface)] border-[var(--hairline)]"
                  />
                </div>
              </div>
              <p className="text-xs-safe text-[var(--text-3)]">
                Maximum range: 365 days
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Section Selection Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Report Sections</CardTitle>
            <p className="text-sm text-[var(--text-3)]">
              Drag to reorder, toggle to include/exclude
            </p>
          </CardHeader>
          <CardContent>
            <SectionSelector
              sections={config.sections}
              onSectionsChange={setSections}
              onToggle={toggleSection}
              enabledSections={enabledSections}
            />
          </CardContent>
        </Card>
      </div>

      {/* Right column: Preview and Actions */}
      <div className="space-y-6">
        {/* Data Preview Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Data Preview</CardTitle>
            <p className="text-sm text-[var(--text-3)]">
              Live preview of report data
            </p>
          </CardHeader>
          <CardContent>
            <ReportDataPreview
              clientId={clientId}
              dateRange={config.dateRange}
              sections={config.sections}
            />
          </CardContent>
        </Card>

        {/* Error Message */}
        {error && (
          <div
            className={cn(
              "flex items-center gap-3 p-4 rounded-lg",
              "bg-[var(--error-soft)] text-[var(--error)]"
            )}
            role="alert"
          >
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Validation Message */}
        {!isValid && !error && (
          <div
            className={cn(
              "p-4 rounded-lg text-sm",
              "bg-[var(--warning-soft)] text-[var(--warning)]"
            )}
          >
            Please provide a report name and select at least one data section.
          </div>
        )}

        {/* Generate Button */}
        <Button
          onClick={handleGenerate}
          disabled={!isValid || generating}
          className="w-full"
          size="lg"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating Report...
            </>
          ) : (
            <>
              <FileText className="h-4 w-4 mr-2" />
              Generate Report
            </>
          )}
        </Button>

        {/* Help Text */}
        <p className="text-xs-safe text-[var(--text-3)] text-center">
          Report generation typically takes 10-30 seconds depending on data volume.
        </p>
      </div>
    </div>
  );
};
