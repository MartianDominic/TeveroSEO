"use client";

import { useState, useCallback, useEffect } from "react";
import { Loader2, Mail, Calendar, Clock, Plus, Trash2 } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Switch,
  StatusChip,
} from "@tevero/ui";

import {
  type ReportSchedule,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  buildCronExpression,
  parseCronExpression,
  calculateNextRun,
  getUserTimezone,
  COMMON_TIMEZONES,
  DAYS_OF_WEEK,
  DAYS_OF_MONTH,
  HOURS,
} from "@/lib/api/schedules";

interface ScheduleFormProps {
  /** Client UUID */
  clientId: string;
  /** Initial schedules */
  initialSchedules: ReportSchedule[];
}

interface ToastState {
  open: boolean;
  message: string;
  severity: "success" | "error";
}

interface ScheduleFormData {
  id?: string;
  enabled: boolean;
  scheduleType: "weekly" | "monthly";
  dayOfWeek: number;
  dayOfMonth: number;
  hour: number;
  minute: number;
  timezone: string;
  recipients: string[];
  recipientInput: string;
}

/**
 * Report schedule configuration form.
 *
 * - Toggle for weekly and monthly schedules
 * - User-friendly day/time selectors (not raw cron input)
 * - Timezone selection with auto-detect
 * - Recipients email input with validation
 * - Next run preview
 */
export function ScheduleForm({ clientId, initialSchedules }: ScheduleFormProps) {
  // Parse initial schedules into form data
  const getInitialFormData = (type: "weekly" | "monthly"): ScheduleFormData => {
    const reportType = type === "weekly" ? "weekly-summary" : "monthly-seo";
    const existing = initialSchedules.find((s) => s.reportType === reportType);

    if (existing) {
      const parsed = parseCronExpression(existing.cronExpression);
      return {
        id: existing.id,
        enabled: existing.enabled,
        scheduleType: type,
        dayOfWeek: parsed.dayOfWeek,
        dayOfMonth: parsed.dayOfMonth,
        hour: parsed.hour,
        minute: parsed.minute,
        timezone: existing.timezone,
        recipients: existing.recipients,
        recipientInput: "",
      };
    }

    // Defaults
    return {
      enabled: false,
      scheduleType: type,
      dayOfWeek: 1, // Monday
      dayOfMonth: 1, // 1st
      hour: 6, // 6 AM
      minute: 0,
      timezone: getUserTimezone(),
      recipients: [],
      recipientInput: "",
    };
  };

  const [weeklyForm, setWeeklyForm] = useState<ScheduleFormData>(() =>
    getInitialFormData("weekly")
  );
  const [monthlyForm, setMonthlyForm] = useState<ScheduleFormData>(() =>
    getInitialFormData("monthly")
  );

  // Loading states
  const [isSavingWeekly, setIsSavingWeekly] = useState(false);
  const [isSavingMonthly, setIsSavingMonthly] = useState(false);

  // Toast state
  const [toast, setToast] = useState<ToastState>({
    open: false,
    message: "",
    severity: "success",
  });

  const showToast = useCallback(
    (message: string, severity: "success" | "error" = "success") => {
      setToast({ open: true, message, severity });
      setTimeout(() => setToast((t) => ({ ...t, open: false })), 3000);
    },
    []
  );

  // Calculate next run dates
  const weeklyNextRun = calculateNextRun(
    "weekly",
    weeklyForm.dayOfWeek,
    weeklyForm.dayOfMonth,
    weeklyForm.hour,
    weeklyForm.minute,
    weeklyForm.timezone
  );

  const monthlyNextRun = calculateNextRun(
    "monthly",
    monthlyForm.dayOfWeek,
    monthlyForm.dayOfMonth,
    monthlyForm.hour,
    monthlyForm.minute,
    monthlyForm.timezone
  );

  // Format date for display
  const formatNextRun = (date: Date, timezone: string) => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: timezone,
        timeZoneName: "short",
      }).format(date);
    } catch {
      return date.toLocaleString();
    }
  };

  // Add recipient handler
  const handleAddRecipient = useCallback(
    (form: ScheduleFormData, setForm: React.Dispatch<React.SetStateAction<ScheduleFormData>>) => {
      const email = form.recipientInput.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!email) return;

      if (!emailRegex.test(email)) {
        showToast("Invalid email address", "error");
        return;
      }

      if (form.recipients.includes(email)) {
        showToast("Email already added", "error");
        return;
      }

      setForm({
        ...form,
        recipients: [...form.recipients, email],
        recipientInput: "",
      });
    },
    [showToast]
  );

  // Remove recipient handler
  const handleRemoveRecipient = useCallback(
    (
      email: string,
      form: ScheduleFormData,
      setForm: React.Dispatch<React.SetStateAction<ScheduleFormData>>
    ) => {
      setForm({
        ...form,
        recipients: form.recipients.filter((r) => r !== email),
      });
    },
    []
  );

  // Save schedule handler
  const handleSave = useCallback(
    async (
      form: ScheduleFormData,
      setForm: React.Dispatch<React.SetStateAction<ScheduleFormData>>,
      setIsSaving: React.Dispatch<React.SetStateAction<boolean>>
    ) => {
      setIsSaving(true);

      try {
        const reportType = form.scheduleType === "weekly" ? "weekly-summary" : "monthly-seo";
        const cronExpression = buildCronExpression(
          form.scheduleType,
          form.dayOfWeek,
          form.dayOfMonth,
          form.hour,
          form.minute
        );

        const data = {
          cronExpression,
          timezone: form.timezone,
          reportType,
          locale: "en",
          recipients: form.recipients,
          enabled: form.enabled,
        };

        let result: ReportSchedule;
        if (form.id) {
          result = await updateSchedule(clientId, form.id, data);
        } else {
          result = await createSchedule(clientId, data);
        }

        setForm({ ...form, id: result.id });
        showToast(`${form.scheduleType === "weekly" ? "Weekly" : "Monthly"} schedule saved`);
      } catch (err) {
        showToast((err as Error).message, "error");
      } finally {
        setIsSaving(false);
      }
    },
    [clientId, showToast]
  );

  // Delete schedule handler
  const handleDelete = useCallback(
    async (
      form: ScheduleFormData,
      setForm: React.Dispatch<React.SetStateAction<ScheduleFormData>>,
      setIsSaving: React.Dispatch<React.SetStateAction<boolean>>
    ) => {
      if (!form.id) return;

      setIsSaving(true);
      try {
        await deleteSchedule(clientId, form.id);
        setForm({
          ...form,
          id: undefined,
          enabled: false,
        });
        showToast(`${form.scheduleType === "weekly" ? "Weekly" : "Monthly"} schedule deleted`);
      } catch (err) {
        showToast((err as Error).message, "error");
      } finally {
        setIsSaving(false);
      }
    },
    [clientId, showToast]
  );

  // Render schedule card
  const renderScheduleCard = (
    form: ScheduleFormData,
    setForm: React.Dispatch<React.SetStateAction<ScheduleFormData>>,
    isSaving: boolean,
    setIsSaving: React.Dispatch<React.SetStateAction<boolean>>,
    nextRun: Date,
    title: string,
    description: string
  ) => (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
          <Switch
            checked={form.enabled}
            onCheckedChange={(checked) => setForm({ ...form, enabled: checked })}
            disabled={isSaving}
          />
        </div>
      </CardHeader>

      <CardContent className={`space-y-4 ${!form.enabled ? "opacity-50 pointer-events-none" : ""}`}>
        {/* Day selector */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium">
              {form.scheduleType === "weekly" ? "Day of Week" : "Day of Month"}
            </Label>
            <Select
              value={String(form.scheduleType === "weekly" ? form.dayOfWeek : form.dayOfMonth)}
              onValueChange={(v) =>
                setForm({
                  ...form,
                  [form.scheduleType === "weekly" ? "dayOfWeek" : "dayOfMonth"]: parseInt(v, 10),
                })
              }
              disabled={isSaving}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(form.scheduleType === "weekly" ? DAYS_OF_WEEK : DAYS_OF_MONTH).map((d) => (
                  <SelectItem key={d.value} value={String(d.value)}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Time selector */}
          <div>
            <Label className="text-sm font-medium">Time</Label>
            <Select
              value={String(form.hour)}
              onValueChange={(v) => setForm({ ...form, hour: parseInt(v, 10) })}
              disabled={isSaving}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOURS.map((h) => (
                  <SelectItem key={h.value} value={String(h.value)}>
                    {h.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Timezone selector */}
        <div>
          <Label className="text-sm font-medium">Timezone</Label>
          <Select
            value={form.timezone}
            onValueChange={(v) => setForm({ ...form, timezone: v })}
            disabled={isSaving}
          >
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMMON_TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Recipients */}
        <div>
          <Label className="text-sm font-medium">Recipients</Label>
          <div className="flex gap-2 mt-1.5">
            <Input
              type="email"
              value={form.recipientInput}
              onChange={(e) => setForm({ ...form, recipientInput: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddRecipient(form, setForm);
                }
              }}
              placeholder="email@example.com"
              disabled={isSaving}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => handleAddRecipient(form, setForm)}
              disabled={isSaving || !form.recipientInput}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Recipient list */}
          {form.recipients.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {form.recipients.map((email) => (
                <div
                  key={email}
                  className="flex items-center gap-1 px-2 py-1 bg-muted rounded-md text-sm"
                >
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  <span>{email}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveRecipient(email, form, setForm)}
                    className="text-muted-foreground hover:text-destructive ml-1"
                    disabled={isSaving}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Next run preview */}
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Next delivery:</span>
          <span className="font-medium">{formatNextRun(nextRun, form.timezone)}</span>
        </div>

        {/* Action buttons */}
        <div className="flex justify-between pt-2">
          {form.id && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(form, setForm, setIsSaving)}
              disabled={isSaving}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Delete
            </Button>
          )}
          <div className="flex-1" />
          <Button
            onClick={() => handleSave(form, setForm, setIsSaving)}
            disabled={isSaving || form.recipients.length === 0}
            size="sm"
          >
            {isSaving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Weekly Schedule */}
      {renderScheduleCard(
        weeklyForm,
        setWeeklyForm,
        isSavingWeekly,
        setIsSavingWeekly,
        weeklyNextRun,
        "Weekly Report",
        "Send a summary report every week"
      )}

      {/* Monthly Schedule */}
      {renderScheduleCard(
        monthlyForm,
        setMonthlyForm,
        isSavingMonthly,
        setIsSavingMonthly,
        monthlyNextRun,
        "Monthly Report",
        "Send a detailed SEO report every month"
      )}

      {/* Toast notification */}
      {toast.open && (
        <div className="fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg bg-card border border-border transition-opacity">
          <div className="flex items-center gap-2">
            <StatusChip
              status={toast.severity === "success" ? "published" : "failed"}
            />
            <span className="text-foreground">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
