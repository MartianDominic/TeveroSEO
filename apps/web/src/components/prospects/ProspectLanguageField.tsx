'use client';

import * as React from 'react';

import { useTranslations } from 'next-intl';

import { type SupportedLocale } from '@/lib/locale-storage';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Label,
} from '@tevero/ui';

import type { UseFormReturn, FieldValues, Path } from 'react-hook-form';

/**
 * Language option value.
 * 'inherit' means use workspace default.
 */
export type ProspectLanguageValue = 'inherit' | SupportedLocale;

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
 * Props for ProspectLanguageField.
 */
export interface ProspectLanguageFieldProps<T extends FieldValues> {
  /** React Hook Form instance */
  form: UseFormReturn<T>;
  /** Field name in form */
  name: Path<T>;
  /** Workspace default language to display */
  workspaceDefaultLanguage?: SupportedLocale;
  /** Whether field is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Prospect communication language field.
 *
 * Allows selecting a language for prospect communications,
 * or inheriting from workspace default.
 */
export function ProspectLanguageField<T extends FieldValues>({
  form,
  name,
  workspaceDefaultLanguage = 'en',
  disabled = false,
  className,
}: ProspectLanguageFieldProps<T>) {
  const t = useTranslations('prospects');
  const tCommon = useTranslations('common');

  const value = form.watch(name) as ProspectLanguageValue | undefined;

  const handleValueChange = (newValue: string) => {
    form.setValue(name, newValue as T[Path<T>], {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  // Language options with display
  const options: Array<{ value: ProspectLanguageValue; label: string; flag?: string }> = [
    {
      value: 'inherit',
      label: `${t('inheritFromWorkspace')} (${workspaceDefaultLanguage === 'lt' ? 'Lietuviu' : 'English'})`,
    },
    { value: 'en', label: 'English', flag: 'GB' },
    { value: 'lt', label: 'Lietuviu', flag: 'LT' },
  ];

  return (
    <div className={className}>
      <Label htmlFor={`field-${String(name)}`} className="text-sm font-medium">
        {t('communicationLanguage')}
      </Label>
      <Select
        value={value ?? 'inherit'}
        onValueChange={handleValueChange}
        disabled={disabled}
      >
        <SelectTrigger
          id={`field-${String(name)}`}
          className="mt-1.5 w-full"
          aria-describedby={`field-${String(name)}-description`}
        >
          <SelectValue placeholder={tCommon('select')} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <span className="flex items-center gap-2">
                {option.flag && (
                  <span aria-hidden="true">{getFlagEmoji(option.flag)}</span>
                )}
                <span>{option.label}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p
        id={`field-${String(name)}-description`}
        className="mt-1.5 text-xs text-muted-foreground"
      >
        {t('communicationLanguageDesc')}
      </p>
    </div>
  );
}

export default ProspectLanguageField;
