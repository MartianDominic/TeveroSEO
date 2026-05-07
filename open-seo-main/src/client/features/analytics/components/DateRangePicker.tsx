/**
 * Date Range Picker Component
 * Phase 96-02: Master Dashboard
 *
 * Period selector with comparison mode toggle (WoW/MoM/YoY).
 * Design System v6: 3px-padded pill with active state.
 */
import { format, subDays } from 'date-fns';
import type { DateRange, ComparisonPeriod } from '@/server/features/analytics/types';

interface DateRangePickerProps {
  dateRange: DateRange;
  comparison?: ComparisonPeriod;
  onDateRangeChange: (dateRange: DateRange) => void;
  onComparisonChange: (comparison?: ComparisonPeriod) => void;
}

const PRESETS = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
  { label: '1Y', days: 365 },
];

const COMPARISONS: ComparisonPeriod[] = ['WoW', 'MoM', 'YoY'];

export function DateRangePicker({
  dateRange,
  comparison,
  onDateRangeChange,
  onComparisonChange,
}: DateRangePickerProps) {
  const handlePresetClick = (days: number) => {
    const endDate = subDays(new Date(), 1); // Yesterday (GSC latency)
    const startDate = subDays(endDate, days - 1);

    onDateRangeChange({
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
    });
  };

  return (
    <div className="flex items-center gap-3">
      {/* Period selector */}
      <div className="flex gap-1 p-[3px] bg-surface-2 rounded-lg">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => handlePresetClick(preset.days)}
            className="px-3 py-1 text-[13px] font-medium rounded-md transition-colors hover:bg-surface-3"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Comparison toggle */}
      <div className="flex gap-1 p-[3px] bg-surface-2 rounded-lg">
        <button
          onClick={() => onComparisonChange(undefined)}
          className={`px-3 py-1 text-[13px] font-medium rounded-md transition-colors ${
            !comparison ? 'bg-accent-soft text-accent-ink' : 'hover:bg-surface-3'
          }`}
        >
          No Compare
        </button>
        {COMPARISONS.map((comp) => (
          <button
            key={comp}
            onClick={() => onComparisonChange(comp)}
            className={`px-3 py-1 text-[13px] font-medium rounded-md transition-colors ${
              comparison === comp
                ? 'bg-accent-soft text-accent-ink'
                : 'hover:bg-surface-3'
            }`}
          >
            {comp}
          </button>
        ))}
      </div>
    </div>
  );
}
