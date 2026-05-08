/**
 * Drizzle ORM schema for report metadata.
 *
 * Reports are generated PDFs stored in the filesystem.
 * This table stores metadata, paths, and generation status.
 */
import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  uniqueIndex,
  boolean,
} from "drizzle-orm/pg-core";
import { clients } from "./client-schema";
import { reportSchedules } from "./schedule-schema";
import { softDeleteColumns } from "./soft-delete-columns";

/**
 * Report status enum values.
 * - pending: Job queued, waiting for worker
 * - generating: Worker processing, PDF being created
 * - complete: PDF generated successfully
 * - failed: Generation failed after retries
 */
export type ReportStatus = "pending" | "generating" | "complete" | "failed";

/**
 * Report type enum values.
 * - monthly-seo: Monthly SEO performance report
 * - weekly-summary: Weekly summary report
 */
export type ReportType = "monthly-seo" | "weekly-summary";

/**
 * Report metadata table.
 * Stores metadata for generated reports.
 * PDFs are stored on filesystem at pdfPath.
 */
export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    reportType: text("report_type").notNull(), // "monthly-seo", "weekly-summary"
    dateRangeStart: text("date_range_start").notNull(), // YYYY-MM-DD
    dateRangeEnd: text("date_range_end").notNull(), // YYYY-MM-DD
    locale: text("locale").notNull().default("en"),
    contentHash: text("content_hash").notNull(), // SHA256 prefix for cache
    pdfPath: text("pdf_path"), // /data/reports/{clientId}/{date}_{type}.pdf
    status: text("status").notNull().default("pending"), // pending, generating, complete, failed
    errorMessage: text("error_message"),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Schedule link for automated reports (null for manual reports)
    scheduleId: uuid("schedule_id").references(() => reportSchedules.id, {
      onDelete: "set null",
    }),
    // Email delivery tracking (null until email sent)
    emailSentAt: timestamp("email_sent_at", { withTimezone: true }),

    // Soft delete columns (migration 0067)
    // Legacy columns (deprecated - use softDeletedAt instead)
    isDeleted: boolean("is_deleted").notNull().default(false),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    // New standardized soft delete column (DBS-005/006/007)
    ...softDeleteColumns,
  },
  (table) => [
    index("ix_reports_client_id").on(table.clientId),
    uniqueIndex("uq_reports_client_content_hash").on(
      table.clientId,
      table.contentHash,
    ),
    index("ix_reports_status").on(table.status),
    index("ix_reports_schedule_id").on(table.scheduleId),
    index("ix_reports_deleted").on(table.isDeleted),
    index("ix_reports_soft_deleted").on(table.softDeletedAt),
  ],
);

// Type exports for use in queries
export type ReportSelect = typeof reports.$inferSelect;
export type ReportInsert = typeof reports.$inferInsert;
