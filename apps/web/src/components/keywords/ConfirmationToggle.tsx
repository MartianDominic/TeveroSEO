"use client";

/**
 * ConfirmationToggle: Human-in-the-loop toggle for keyword classification.
 *
 * Persists mode in localStorage:
 * - "confirm": Pause before expensive AI operations (default)
 * - "autonomous": Proceed automatically without confirmation
 */

import { useState, useEffect } from "react";
import { Switch } from "@tevero/ui";
import { Label } from "@/components/ui/label";
import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const STORAGE_KEY = "keyword_confirmation_mode";

export type ConfirmationMode = "confirm" | "autonomous";

interface ConfirmationToggleProps {
  onChange?: (mode: ConfirmationMode) => void;
  className?: string;
}

export function ConfirmationToggle({
  onChange,
  className,
}: ConfirmationToggleProps) {
  const [mode, setMode] = useState<ConfirmationMode>("confirm");
  const [mounted, setMounted] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "confirm" || stored === "autonomous") {
      setMode(stored);
    }
  }, []);

  const handleChange = (checked: boolean) => {
    const newMode: ConfirmationMode = checked ? "autonomous" : "confirm";
    setMode(newMode);
    localStorage.setItem(STORAGE_KEY, newMode);
    onChange?.(newMode);
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <Switch
        id="confirmation-mode"
        checked={mode === "autonomous"}
        onCheckedChange={handleChange}
        aria-describedby="confirmation-mode-description"
      />
      <Label htmlFor="confirmation-mode" className="flex items-center gap-1.5">
        {mode === "confirm" ? "Confirm before proceeding" : "Autonomous mode"}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p id="confirmation-mode-description">
                {mode === "confirm"
                  ? "Pause before expensive AI operations for your review"
                  : "Proceed automatically without confirmation pauses"}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </Label>
    </div>
  );
}

/**
 * Helper to get current confirmation mode without component.
 * Safe for SSR (returns default "confirm" on server).
 */
export function getConfirmationMode(): ConfirmationMode {
  if (typeof window === "undefined") return "confirm";
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "autonomous" ? "autonomous" : "confirm";
}
