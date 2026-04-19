/**
 * Report component exports.
 *
 * All report components are designed to render identically
 * in both interactive HTML and PDF export (via Puppeteer).
 */

// Template and section components (for rendering reports)
export { ReportTemplate } from "./ReportTemplate";
export { ReportHeader } from "./ReportHeader";
export { ReportSummaryStats } from "./ReportSummaryStats";
export { ReportGSCChart } from "./ReportGSCChart";
export { ReportGA4Chart } from "./ReportGA4Chart";
export { ReportQueriesTable } from "./ReportQueriesTable";
export { ReportFooter } from "./ReportFooter";

// UI components (for report management pages)
export { ReportList } from "./ReportList";
export { ReportStatusBadge } from "./ReportStatusBadge";
export { GenerateReportButton } from "./GenerateReportButton";
export { ReportPreview } from "./ReportPreview";
