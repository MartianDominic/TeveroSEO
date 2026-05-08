/**
 * Report Schedule Modal Component
 * Phase 96-05: Client Portal
 *
 * Modal for creating/editing report schedules.
 * Supports both client-level and workspace-wide (portfolio) reports.
 *
 * Design System v6: ghost-edge shadows, Geist font for forms.
 */
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/client/components/ui/dialog';
import { Button } from '@/client/components/ui/button';
import { Input } from '@/client/components/ui/input';
import { Label } from '@/client/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/client/components/ui/select';

interface ReportSchedule {
  id?: string;
  workspaceId: string;
  clientId: string | null; // null = portfolio report
  frequency: 'weekly' | 'monthly';
  recipients: string[];
  nextRunAt: string;
  isActive: boolean;
}

interface Client {
  id: string;
  name: string;
}

interface ReportScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  clients: Client[];
  schedule?: ReportSchedule;
  onSave: (schedule: ReportSchedule) => void;
}

export function ReportScheduleModal({
  isOpen,
  onClose,
  workspaceId,
  clients,
  schedule,
  onSave,
}: ReportScheduleModalProps) {
  const [clientId, setClientId] = useState<string | null>(schedule?.clientId ?? null);
  const [frequency, setFrequency] = useState<'weekly' | 'monthly'>(schedule?.frequency ?? 'weekly');
  const [recipients, setRecipients] = useState<string[]>(schedule?.recipients ?? []);
  const [recipientInput, setRecipientInput] = useState('');
  const [isActive, setIsActive] = useState(schedule?.isActive ?? true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when schedule changes
  useEffect(() => {
    if (schedule) {
      setClientId(schedule.clientId);
      setFrequency(schedule.frequency);
      setRecipients(schedule.recipients);
      setIsActive(schedule.isActive);
    } else {
      setClientId(null);
      setFrequency('weekly');
      setRecipients([]);
      setIsActive(true);
    }
    setRecipientInput('');
    setError(null);
  }, [schedule, isOpen]);

  const handleAddRecipient = () => {
    const email = recipientInput.trim().toLowerCase();
    if (!email) return;

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (recipients.includes(email)) {
      setError('This email is already added');
      return;
    }

    setRecipients([...recipients, email]);
    setRecipientInput('');
    setError(null);
  };

  const handleRemoveRecipient = (email: string) => {
    setRecipients(recipients.filter((r) => r !== email));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddRecipient();
    }
  };

  const calculateNextRun = (): string => {
    const now = new Date();
    if (frequency === 'weekly') {
      // Next Monday at 9am
      const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
      const nextMonday = new Date(now);
      nextMonday.setDate(now.getDate() + daysUntilMonday);
      nextMonday.setHours(9, 0, 0, 0);
      return nextMonday.toISOString();
    } else {
      // First of next month at 9am
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 9, 0, 0, 0);
      return nextMonth.toISOString();
    }
  };

  const handleSave = async () => {
    if (recipients.length === 0) {
      setError('Please add at least one recipient');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const scheduleData: ReportSchedule = {
        id: schedule?.id,
        workspaceId,
        clientId,
        frequency,
        recipients,
        nextRunAt: calculateNextRun(),
        isActive,
      };

      onSave(scheduleData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save schedule');
    } finally {
      setIsSaving(false);
    }
  };

  const nextRunDate = new Date(calculateNextRun());
  const formattedNextRun = nextRunDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-[16px] font-medium text-text-1">
            {schedule?.id ? 'Edit Report Schedule' : 'Create Report Schedule'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Client selector */}
          <div className="space-y-2">
            <Label className="text-[13px] font-medium text-text-1">Report Type</Label>
            <Select value={clientId || 'portfolio'} onValueChange={(v) => setClientId(v === 'portfolio' ? null : v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="portfolio">Portfolio Report (All Clients)</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-text-3">
              {clientId
                ? 'Report will include metrics for selected client only'
                : 'Report will include aggregated metrics across all clients'}
            </p>
          </div>

          {/* Frequency selector */}
          <div className="space-y-2">
            <Label className="text-[13px] font-medium text-text-1">Frequency</Label>
            <Select value={frequency} onValueChange={(v) => setFrequency(v as 'weekly' | 'monthly')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly (every Monday)</SelectItem>
                <SelectItem value="monthly">Monthly (first of month)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Recipients */}
          <div className="space-y-2">
            <Label className="text-[13px] font-medium text-text-1">Recipients</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="email@example.com"
                value={recipientInput}
                onChange={(e) => setRecipientInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1"
              />
              <Button variant="outline" size="sm" onClick={handleAddRecipient}>
                Add
              </Button>
            </div>
            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {recipients.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-surface-raised rounded text-[12px] text-text-2"
                  >
                    {email}
                    <button
                      onClick={() => handleRemoveRecipient(email)}
                      className="ml-1 text-text-3 hover:text-error"
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Next delivery preview */}
          <div className="bg-surface-raised rounded-md p-3 space-y-1">
            <p className="text-[12px] text-text-3">Next scheduled delivery:</p>
            <p className="text-[13px] font-medium text-text-1">{formattedNextRun}</p>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-[13px] font-medium text-text-1">Active</Label>
              <p className="text-sm text-text-3">Schedule will run automatically</p>
            </div>
            <button
              onClick={() => setIsActive(!isActive)}
              className={`w-10 h-6 rounded-full transition-colors ${
                isActive ? 'bg-accent' : 'bg-surface-raised'
              }`}
            >
              <div
                className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  isActive ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Error message */}
          {error && (
            <p className="text-[12px] text-error">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : schedule?.id ? 'Update Schedule' : 'Create Schedule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
