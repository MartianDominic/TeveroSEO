"use client";

/**
 * Language toggle component for EN/LT switching.
 * Phase 59: Agreement & Signing Excellence
 *
 * Switches between /en/c/:token and /lt/c/:token routes per D-19.
 */
import { Button } from "@/components/ui/button";

interface LanguageToggleProps {
  currentLocale: string;
  token: string;
}

export function LanguageToggle({ currentLocale, token }: LanguageToggleProps) {
  const switchLocale = (newLocale: string) => {
    if (newLocale === currentLocale) return;
    // Use window.location for locale switching to avoid Next.js type issues
    window.location.href = `/${newLocale}/c/${token}`;
  };

  return (
    <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
      <Button
        variant={currentLocale === "en" ? "default" : "ghost"}
        size="sm"
        onClick={() => switchLocale("en")}
        className="px-3 py-1 text-sm font-medium"
      >
        EN
      </Button>
      <Button
        variant={currentLocale === "lt" ? "default" : "ghost"}
        size="sm"
        onClick={() => switchLocale("lt")}
        className="px-3 py-1 text-sm font-medium"
      >
        LT
      </Button>
    </div>
  );
}
