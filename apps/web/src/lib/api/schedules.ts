/**
 * Report schedules API functions.
 *
 * Phase 16 Plan 04: Schedule settings UI.
 */

/**
 * Report schedule data from API.
 */
export interface ReportSchedule {
  id: string;
  clientId: string;
  cronExpression: string;
  timezone: string;
  reportType: string;
  locale: string;
  recipients: string[];
  enabled: boolean;
  lastRun: string | null;
  nextRun: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Schedule input for create/update.
 */
export interface ScheduleInput {
  cronExpression: string;
  timezone: string;
  reportType: string;
  locale?: string;
  recipients: string[];
  enabled?: boolean;
}

/**
 * Schedule list response.
 */
interface ScheduleListResponse {
  schedules: ReportSchedule[];
}

/**
 * Fetch all schedules for a client.
 */
export async function getSchedules(clientId: string): Promise<ReportSchedule[]> {
  const res = await fetch(`/api/clients/${clientId}/schedules`);
  if (!res.ok) {
    return [];
  }
  const data: ScheduleListResponse = await res.json();
  return data.schedules ?? [];
}

/**
 * Create a new schedule.
 */
export async function createSchedule(
  clientId: string,
  data: ScheduleInput,
): Promise<ReportSchedule> {
  const res = await fetch(`/api/clients/${clientId}/schedules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Create failed" }));
    throw new Error(err.error ?? "Failed to create schedule");
  }
  return res.json();
}

/**
 * Update an existing schedule.
 */
export async function updateSchedule(
  clientId: string,
  scheduleId: string,
  data: Partial<ScheduleInput>,
): Promise<ReportSchedule> {
  const res = await fetch(`/api/clients/${clientId}/schedules/${scheduleId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Update failed" }));
    throw new Error(err.error ?? "Failed to update schedule");
  }
  return res.json();
}

/**
 * Delete a schedule.
 */
export async function deleteSchedule(
  clientId: string,
  scheduleId: string,
): Promise<void> {
  const res = await fetch(`/api/clients/${clientId}/schedules/${scheduleId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Delete failed" }));
    throw new Error(err.error ?? "Failed to delete schedule");
  }
}

/**
 * Calculate next run date from cron expression.
 * Uses user-friendly templates, not raw cron parsing.
 */
export function calculateNextRun(
  scheduleType: "weekly" | "monthly",
  dayOfWeek: number,
  dayOfMonth: number,
  hour: number,
  minute: number,
  timezone: string,
): Date {
  const now = new Date();
  const next = new Date(now);

  if (scheduleType === "weekly") {
    // Find next occurrence of the specified day of week
    const currentDay = now.getDay();
    let daysUntil = dayOfWeek - currentDay;
    if (daysUntil < 0) daysUntil += 7;
    if (daysUntil === 0) {
      // If today, check if time has passed
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      if (currentHour > hour || (currentHour === hour && currentMinute >= minute)) {
        daysUntil = 7;
      }
    }
    next.setDate(now.getDate() + daysUntil);
  } else {
    // Monthly: find next occurrence of the day of month
    next.setDate(dayOfMonth);
    if (next <= now) {
      next.setMonth(next.getMonth() + 1);
    }
  }

  next.setHours(hour, minute, 0, 0);
  return next;
}

/**
 * Build cron expression from user-friendly inputs.
 */
export function buildCronExpression(
  scheduleType: "weekly" | "monthly",
  dayOfWeek: number,
  dayOfMonth: number,
  hour: number,
  minute: number,
): string {
  if (scheduleType === "weekly") {
    // Weekly: run at specified hour:minute on specified day of week
    // Cron format: minute hour * * dayOfWeek
    return `${minute} ${hour} * * ${dayOfWeek}`;
  } else {
    // Monthly: run at specified hour:minute on specified day of month
    // Cron format: minute hour dayOfMonth * *
    return `${minute} ${hour} ${dayOfMonth} * *`;
  }
}

/**
 * Parse cron expression to user-friendly components.
 */
export function parseCronExpression(cronExpression: string): {
  scheduleType: "weekly" | "monthly";
  dayOfWeek: number;
  dayOfMonth: number;
  hour: number;
  minute: number;
} {
  const parts = cronExpression.split(" ");
  if (parts.length !== 5) {
    // Default to weekly Monday 6am
    return { scheduleType: "weekly", dayOfWeek: 1, dayOfMonth: 1, hour: 6, minute: 0 };
  }

  const [minute, hour, dayOfMonth, , dayOfWeek] = parts;

  // Determine schedule type based on day fields
  const isWeekly = dayOfMonth === "*" && dayOfWeek !== "*";

  return {
    scheduleType: isWeekly ? "weekly" : "monthly",
    dayOfWeek: dayOfWeek !== "*" ? parseInt(dayOfWeek, 10) : 1,
    dayOfMonth: dayOfMonth !== "*" ? parseInt(dayOfMonth, 10) : 1,
    hour: parseInt(hour, 10),
    minute: parseInt(minute, 10),
  };
}

/**
 * Get user's timezone.
 */
export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

/**
 * Common timezones for selector.
 */
export const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Vancouver",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Vilnius",
  "Europe/Moscow",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Dubai",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
];

/**
 * Days of week for selector.
 */
export const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

/**
 * Days of month for selector.
 */
export const DAYS_OF_MONTH = Array.from({ length: 28 }, (_, i) => ({
  value: i + 1,
  label: `${i + 1}${getOrdinalSuffix(i + 1)}`,
}));

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

/**
 * Hours for selector (0-23).
 */
export const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${i.toString().padStart(2, "0")}:00`,
}));
