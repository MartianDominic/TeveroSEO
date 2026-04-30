'use client';

import * as React from 'react';
import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { useTransition } from 'react';
import { Globe, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { setStoredLocale, type SupportedLocale } from '@/lib/locale-storage';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  Button,
} from '@tevero/ui';

/**
 * Language configuration.
 */
interface Language {
  code: SupportedLocale;
  name: string;
  native: string;
  flag: string;
}

/**
 * Supported languages.
 */
export const LANGUAGES: Language[] = [
  { code: 'en', name: 'English', native: 'English', flag: 'GB' },
  { code: 'lt', name: 'Lithuanian', native: 'Lietuviu', flag: 'LT' },
];

/**
 * Convert country code to flag emoji.
 * Uses Unicode regional indicator symbols.
 */
function getFlagEmoji(countryCode: string): string {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

/**
 * Props for LanguageSwitcher component.
 */
export interface LanguageSwitcherProps {
  /** Display variant */
  variant?: 'default' | 'compact';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Language switcher component.
 *
 * Displays a dropdown to switch between supported languages.
 * Persists selection to cookie and localStorage, updates URL.
 */
export function LanguageSwitcher({
  variant = 'default',
  className,
}: LanguageSwitcherProps) {
  const locale = useLocale() as SupportedLocale;
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = React.useState(false);

  // Find current language
  const currentLanguage = LANGUAGES.find((lang) => lang.code === locale) || LANGUAGES[0];

  /**
   * Handle language change.
   * Updates URL, persists to storage, and refreshes.
   */
  const handleLanguageChange = React.useCallback(
    (newLocale: SupportedLocale) => {
      if (newLocale === locale) {
        setOpen(false);
        return;
      }

      // Set transitioning state on document for CSS animation
      document.documentElement.setAttribute('data-locale-transitioning', 'true');

      // Remove current locale prefix from pathname
      let newPath = pathname;

      // Handle locale prefixes:
      // - /lt/... -> remove /lt prefix
      // - /... (no prefix) -> keep as is
      if (pathname.startsWith('/lt')) {
        newPath = pathname.replace(/^\/lt/, '') || '/';
      }

      // Add new locale prefix (none for 'en', /lt for 'lt')
      if (newLocale === 'lt') {
        newPath = `/lt${newPath === '/' ? '' : newPath}`;
      }

      // Persist to storage
      setStoredLocale(newLocale);

      // Navigate with transition
      startTransition(() => {
        router.push(newPath);
        router.refresh();
      });

      setOpen(false);

      // Remove transitioning state after animation
      setTimeout(() => {
        document.documentElement.removeAttribute('data-locale-transitioning');
      }, 300);
    },
    [locale, pathname, router]
  );

  // Compact variant: just globe icon
  if (variant === 'compact') {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-8 w-8', className)}
            disabled={isPending}
            aria-label="Change language"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Globe className="h-4 w-4" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-40 p-1"
          align="end"
          sideOffset={8}
        >
          <LanguageList
            languages={LANGUAGES}
            currentLocale={locale}
            onSelect={handleLanguageChange}
          />
        </PopoverContent>
      </Popover>
    );
  }

  // Default variant: flag + native name
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            'flex items-center gap-2 px-3 py-2 text-sm',
            className
          )}
          disabled={isPending}
          aria-label={`Current language: ${currentLanguage.native}. Click to change.`}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <span className="text-base" aria-hidden="true">
                {getFlagEmoji(currentLanguage.flag)}
              </span>
              <span className="hidden sm:inline">{currentLanguage.native}</span>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-44 p-1"
        align="end"
        sideOffset={8}
      >
        <LanguageList
          languages={LANGUAGES}
          currentLocale={locale}
          onSelect={handleLanguageChange}
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * Language list for popover content.
 */
interface LanguageListProps {
  languages: Language[];
  currentLocale: SupportedLocale;
  onSelect: (locale: SupportedLocale) => void;
}

function LanguageList({ languages, currentLocale, onSelect }: LanguageListProps) {
  return (
    <div className="flex flex-col" role="listbox" aria-label="Available languages">
      {languages.map((lang) => {
        const isSelected = lang.code === currentLocale;
        return (
          <button
            key={lang.code}
            role="option"
            aria-selected={isSelected}
            onClick={() => onSelect(lang.code)}
            className={cn(
              'flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
              'cursor-pointer outline-none transition-colors',
              'hover:bg-accent focus:bg-accent',
              isSelected && 'font-medium'
            )}
          >
            <span className="text-base" aria-hidden="true">
              {getFlagEmoji(lang.flag)}
            </span>
            <span className="flex-1 text-left">{lang.native}</span>
            {isSelected && (
              <Check className="h-4 w-4 shrink-0 text-accent-foreground" aria-hidden="true" />
            )}
          </button>
        );
      })}
    </div>
  );
}

export default LanguageSwitcher;
