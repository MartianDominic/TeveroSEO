'use client';

import * as React from 'react';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { SupportedLocale } from '@/lib/locale-storage';
import { cn } from '@/lib/utils';

import { Label, Button } from '@tevero/ui';


/**
 * Convert country code to flag emoji.
 */
function getFlagEmoji(countryCode: string): string {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

/**
 * Props for PreviewLanguageToggle.
 */
export interface PreviewLanguageToggleProps {
  /** Currently selected language */
  value: SupportedLocale;
  /** Callback when language changes */
  onChange: (locale: SupportedLocale) => void;
  /** Whether loading preview content */
  isLoading?: boolean;
  /** Whether toggle is disabled */
  disabled?: boolean;
  /** Whether to show label */
  showLabel?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Language toggle for previewing content in different languages.
 *
 * Used in proposal editor and agreement previews to toggle
 * between English and Lithuanian content views.
 */
export function PreviewLanguageToggle({
  value,
  onChange,
  isLoading = false,
  disabled = false,
  showLabel = true,
  className,
}: PreviewLanguageToggleProps) {
  const t = useTranslations('common');

  const languages: Array<{ code: SupportedLocale; label: string; flag: string }> = [
    { code: 'en', label: 'EN', flag: 'GB' },
    { code: 'lt', label: 'LT', flag: 'LT' },
  ];

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showLabel && (
        <Label className="text-sm text-muted-foreground">
          {t('view')}:
        </Label>
      )}

      <div
        className="flex items-center rounded-md border border-border bg-muted/50 p-0.5"
        role="group"
        aria-label="Preview language"
      >
        {languages.map((lang) => {
          const isSelected = value === lang.code;
          return (
            <Button
              key={lang.code}
              type="button"
              variant={isSelected ? 'default' : 'ghost'}
              size="sm"
              disabled={disabled || isLoading}
              onClick={() => onChange(lang.code)}
              className={cn(
                'h-7 px-2.5 text-xs-safe font-medium',
                isSelected
                  ? 'bg-background shadow-[var(--shadow-card)]'
                  : 'bg-transparent hover:bg-background/50'
              )}
              aria-pressed={isSelected}
            >
              {isLoading && isSelected ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <span className="flex items-center gap-1.5">
                  <span aria-hidden="true">{getFlagEmoji(lang.flag)}</span>
                  <span>{lang.label}</span>
                </span>
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export default PreviewLanguageToggle;
