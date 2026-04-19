"use client";

import { REPORT_COLORS, REPORT_CONTAINER } from "@/lib/reports/styles";
import type {
  ReportData,
  ReportLabels,
  ReportTemplate as ReportTemplateType,
  ReportSectionType,
} from "@/lib/reports/types";
import { ReportHeader } from "./ReportHeader";
import { ReportSummaryStats } from "./ReportSummaryStats";
import { ReportGSCChart } from "./ReportGSCChart";
import { ReportGA4Chart } from "./ReportGA4Chart";
import { ReportQueriesTable } from "./ReportQueriesTable";
import { ReportFooter } from "./ReportFooter";

interface ReportTemplateProps {
  /** Full report data payload */
  data: ReportData;
  /** Localized labels for all text */
  labels: ReportLabels;
  /** Optional template configuration (for custom section order) */
  template?: ReportTemplateType;
  /** Optional trend data for comparison */
  trends?: {
    clicks?: number;
    impressions?: number;
    sessions?: number;
    conversions?: number;
  };
}

/**
 * Default section order when no template is provided.
 */
const DEFAULT_SECTIONS: ReportSectionType[] = [
  "header",
  "summary_stats",
  "gsc_chart",
  "ga4_chart",
  "queries_table",
  "footer",
];

/**
 * Main report template component.
 *
 * Composes all report sections in the correct order.
 * If a template prop is provided, renders only sections in template.sections.
 * Otherwise, renders all 6 default sections.
 *
 * Uses "use client" because it includes client-side chart components.
 */
export function ReportTemplate({
  data,
  labels,
  template,
  trends,
}: ReportTemplateProps) {
  // Determine which sections to render and in what order
  const sections = template
    ? template.sections
        .sort((a, b) => a.order - b.order)
        .map((s) => s.type)
    : DEFAULT_SECTIONS;

  const locale = data.metadata.locale;

  /**
   * Render a single section by type.
   */
  const renderSection = (sectionType: ReportSectionType) => {
    switch (sectionType) {
      case "header":
        return (
          <ReportHeader
            key="header"
            clientName={data.metadata.clientName}
            dateRange={data.metadata.dateRange}
            locale={locale}
            labels={{
              title: labels.title,
              subtitle: labels.subtitle,
              dateRange: labels.dateRange,
            }}
          />
        );

      case "summary_stats":
        return (
          <ReportSummaryStats
            key="summary_stats"
            gscSummary={data.gscSummary}
            ga4Summary={data.ga4Summary}
            locale={locale}
            labels={{
              clicks: labels.clicks,
              impressions: labels.impressions,
              ctr: labels.ctr,
              position: labels.position,
              sessions: labels.sessions,
              users: labels.users,
              conversions: labels.conversions,
              bounceRate: labels.bounceRate,
              wow: labels.wow,
            }}
            trends={trends}
          />
        );

      case "gsc_chart":
        return (
          <section key="gsc_chart" className="report-section mb-8">
            <h3
              className="text-lg font-semibold mb-4"
              style={{ color: REPORT_COLORS.text }}
            >
              Search Performance
            </h3>
            <ReportGSCChart data={data.gscDaily} locale={locale} />
          </section>
        );

      case "ga4_chart":
        return (
          <section key="ga4_chart" className="report-section mb-8">
            <h3
              className="text-lg font-semibold mb-4"
              style={{ color: REPORT_COLORS.text }}
            >
              Traffic Overview
            </h3>
            <ReportGA4Chart data={data.ga4Daily} locale={locale} />
          </section>
        );

      case "queries_table":
        return (
          <ReportQueriesTable
            key="queries_table"
            queries={data.topQueries}
            locale={locale}
            labels={{
              topQueries: labels.topQueries,
              query: labels.query,
              clicks: labels.clicks,
              impressions: labels.impressions,
              ctr: labels.ctr,
              position: labels.position,
              wow: labels.wow,
            }}
          />
        );

      case "footer":
        return (
          <ReportFooter
            key="footer"
            generatedAt={data.metadata.generatedAt}
            locale={locale}
            labels={{
              generatedBy: labels.generatedBy,
              generatedAt: labels.generatedAt,
            }}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div
      className="report-container mx-auto"
      style={{
        maxWidth: REPORT_CONTAINER.maxWidth,
        padding: REPORT_CONTAINER.padding,
        backgroundColor: REPORT_COLORS.background,
        color: REPORT_COLORS.text,
      }}
    >
      {sections.map(renderSection)}
    </div>
  );
}
