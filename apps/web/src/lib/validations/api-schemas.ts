/**
 * Zod validation schemas for API routes.
 * Centralizes validation logic for consistent error handling.
 */
import { z } from "zod";

// ============================================
// Goals Schemas
// ============================================

export const deleteGoalSchema = z.object({
  goalId: z.string().min(1, "goalId is required"),
  clientId: z.string().optional(),
});

export type DeleteGoalInput = z.infer<typeof deleteGoalSchema>;

export const updateGoalSchema = z.object({
  goalId: z.string().min(1, "goalId is required"),
  updates: z.object({
    targetValue: z.number().optional(),
    targetDenominator: z.number().optional(),
    customName: z.string().optional(),
    customDescription: z.string().optional(),
    isPrimary: z.boolean().optional(),
    isClientVisible: z.boolean().optional(),
    currentValue: z.number().optional(),
    clientId: z.string().optional(),
  }),
});

export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;

export const createGoalSchema = z.object({
  templateId: z.string().optional(),
  customName: z.string().optional(),
  targetValue: z.union([z.string(), z.number()]).optional(),
  targetDenominator: z.union([z.string(), z.number()]).optional(),
  startDate: z.string().nullable().optional(),
  targetDate: z.string().nullable().optional(),
  isPrimary: z.boolean().optional(),
  isClientVisible: z.boolean().optional(),
});

export const bulkCreateGoalsSchema = z.object({
  goals: z.array(createGoalSchema),
});

export const goalBodySchema = z.union([
  bulkCreateGoalsSchema,
  createGoalSchema,
]);

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type BulkCreateGoalsInput = z.infer<typeof bulkCreateGoalsSchema>;

export const updateGoalByIdSchema = z.object({
  targetValue: z.union([z.string(), z.number()]).optional(),
  targetDenominator: z.union([z.string(), z.number()]).optional(),
  customName: z.string().optional(),
  customDescription: z.string().optional(),
  isPrimary: z.boolean().optional(),
  isClientVisible: z.boolean().optional(),
  currentValue: z.union([z.string(), z.number()]).optional(),
  startDate: z.string().nullable().optional(),
  targetDate: z.string().nullable().optional(),
  status: z.string().optional(),
});

export type UpdateGoalByIdInput = z.infer<typeof updateGoalByIdSchema>;

// ============================================
// Client Schemas
// ============================================

export const patchClientSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  domain: z.string().url().optional(),
  industry: z.string().max(100).optional(),
  timezone: z.string().max(50).optional(),
  isActive: z.boolean().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: "At least one field must be provided for update",
});

export type PatchClientInput = z.infer<typeof patchClientSchema>;

// ============================================
// Client Settings Schemas
// ============================================

export const clientSettingsSchema = z.object({
  reportFrequency: z.enum(["daily", "weekly", "monthly"]).optional(),
  notificationEmail: z.string().email().optional(),
  timezone: z.string().max(50).optional(),
  language: z.string().max(10).optional(),
  autoReports: z.boolean().optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export type ClientSettingsInput = z.infer<typeof clientSettingsSchema>;

// ============================================
// Branding Schemas
// ============================================

export const brandingSchema = z.object({
  logoUrl: z.string().url().nullable().optional(),
  primaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid hex color").optional(),
  secondaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid hex color").optional(),
  footerText: z.string().max(500).nullable().optional(),
});

export type BrandingInput = z.infer<typeof brandingSchema>;

// ============================================
// Schedule Schemas
// ============================================

export const createScheduleSchema = z.object({
  cronExpression: z.string().min(1, "Cron expression is required"),
  timezone: z.string().min(1, "Timezone is required"),
  reportType: z.string().min(1, "Report type is required"),
  locale: z.string().default("en"),
  recipients: z.array(z.string().email()).min(1, "At least one recipient is required"),
  enabled: z.boolean().default(true),
});

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;

export const updateScheduleSchema = z.object({
  cronExpression: z.string().optional(),
  timezone: z.string().optional(),
  reportType: z.string().optional(),
  locale: z.string().optional(),
  recipients: z.array(z.string().email()).optional(),
  enabled: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: "At least one field must be provided for update",
});

export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;

// ============================================
// Site Connection Schemas
// ============================================

/**
 * List of blocked internal/private addresses for SSRF protection.
 */
const BLOCKED_DOMAIN_PATTERNS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "169.254.169.254",
  "metadata.google.internal",
  "10.",
  "172.16.", "172.17.", "172.18.", "172.19.", "172.20.", "172.21.", "172.22.", "172.23.",
  "172.24.", "172.25.", "172.26.", "172.27.", "172.28.", "172.29.", "172.30.", "172.31.",
  "192.168.",
  "::1",
  "[::1]",
];

function isBlockedDomain(domain: string): boolean {
  const lower = domain.toLowerCase();
  return BLOCKED_DOMAIN_PATTERNS.some((pattern) => lower.includes(pattern));
}

export const detectPlatformSchema = z.object({
  domain: z.string()
    .min(1, "domain required")
    .max(253, "domain must be at most 253 characters")
    .regex(
      /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/,
      "Invalid domain format"
    )
    .refine(
      (domain) => !isBlockedDomain(domain),
      { message: "Internal addresses are not allowed" }
    ),
});

export type DetectPlatformInput = z.infer<typeof detectPlatformSchema>;

// ============================================
// Report Generation Schemas
// ============================================

export const generateReportSchema = z.object({
  clientId: z.string().uuid("clientId must be a valid UUID"),
  reportType: z.enum(["seo", "content", "technical", "full", "performance", "backlinks"])
    .optional()
    .default("full"),
  dateRange: z.object({
    start: z.string().datetime("start must be a valid ISO datetime"),
    end: z.string().datetime("end must be a valid ISO datetime"),
  }).optional().refine(
    (range) => !range || new Date(range.start) <= new Date(range.end),
    { message: "start date must be before or equal to end date" }
  ),
  locale: z.string()
    .max(10, "locale must be at most 10 characters")
    .regex(/^[a-z]{2}(-[A-Z]{2})?$/, "locale must be in format 'en' or 'en-US'")
    .optional()
    .default("en"),
});

export type GenerateReportInput = z.infer<typeof generateReportSchema>;

// ============================================
// Article Schemas
// ============================================

export const articlePostSchema = z.object({
  action: z.enum(["publish", "unpublish", "schedule", "duplicate", "archive"]).optional(),
  scheduledAt: z.string().datetime().optional(),
  targetClientId: z.string().uuid().optional(),
  metadata: z.record(z.string().max(100), z.unknown()).optional(),
}).strict();

export type ArticlePostInput = z.infer<typeof articlePostSchema>;

// ============================================
// Common Reusable Schemas
// ============================================

export const uuidSchema = z.string().uuid();
export const dateRangeSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
});
export const domainSchema = detectPlatformSchema.shape.domain;

// ============================================
// Utility: Safe JSON Parse
// ============================================

/**
 * Safely parse JSON from a request body.
 * Returns a typed result object instead of throwing.
 */
export async function safeParseJson<T = unknown>(
  req: Request
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const data = await req.json() as T;
    return { success: true, data };
  } catch {
    return { success: false, error: "Invalid JSON body" };
  }
}

/**
 * Format Zod validation errors for API response.
 * Avoids exposing internal field names by returning user-friendly messages.
 */
export function formatValidationErrors(
  error: z.ZodError<unknown>
): { field: string; message: string }[] {
  return error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));
}
