/**
 * Dashboard Views Schema - Saved dashboard configurations
 * Phase 62-01: Database schema for Agency Command Center
 *
 * Per DESIGN.md D-09: Saved views with filters and layout.
 */
import {
  pgTable,
  text,
  timestamp,
  boolean,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization, user } from "../user-schema";

/**
 * Dashboard filters structure
 */
export interface DashboardFilters {
  dateRange?: {
    start: string;
    end: string;
  };
  teamMembers?: string[];
  entityTypes?: string[];
  priorities?: string[];
  [key: string]: unknown;
}

/**
 * Dashboard layout structure
 */
export interface DashboardLayout {
  cardOrder?: string[];
  collapsedWidgets?: string[];
  [key: string]: unknown;
}

/**
 * Command Center dashboard views table - saved view configurations.
 * Uses cc_dashboard_views to avoid conflict with Phase 21 dashboard_views.
 * NULL user_id means shared workspace view.
 */
export const ccDashboardViews = pgTable(
  "cc_dashboard_views",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // NULL user_id = shared workspace view
    userId: text("user_id").references(() => user.id),

    // View definition
    name: text("name").notNull(),
    isDefault: boolean("is_default").default(false).notNull(),

    // Filters
    filters: jsonb("filters").$type<DashboardFilters>().default({}).notNull(),

    // Layout
    layout: jsonb("layout").$type<DashboardLayout>().default({}).notNull(),

    // Metadata
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_cc_dashboard_views_workspace").on(table.workspaceId),
    index("ix_cc_dashboard_views_user").on(table.userId),
  ]
);

// Relations
export const ccDashboardViewsRelations = relations(ccDashboardViews, ({ one }) => ({
  workspace: one(organization, {
    fields: [ccDashboardViews.workspaceId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [ccDashboardViews.userId],
    references: [user.id],
  }),
}));

// Inferred types
export type CCDashboardViewSelect = typeof ccDashboardViews.$inferSelect;
export type CCDashboardViewInsert = typeof ccDashboardViews.$inferInsert;
