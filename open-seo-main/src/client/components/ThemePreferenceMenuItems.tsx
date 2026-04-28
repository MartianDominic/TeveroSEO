import { Monitor, Moon, Sun } from "lucide-react";
import { type ThemePreference, useThemePreference } from "@/client/lib/theme";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/client/components/ui/tooltip";

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  icon: typeof Sun;
}[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

export function ThemePreferenceMenuItems() {
  const { themePreference, setThemePreference } = useThemePreference();

  return (
    <>
      <p className="px-2 pt-2 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Theme
      </p>

      <div className="px-2 pb-2">
        <TooltipProvider>
          <div
            role="radiogroup"
            aria-label="Theme preference"
            className="flex gap-0.5 rounded-lg bg-muted p-0.5"
          >
            {THEME_OPTIONS.map((option) => {
              const isActive = option.value === themePreference;
              const Icon = option.icon;

              return (
                <Tooltip key={option.value}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      aria-label={option.label}
                      className={`flex flex-1 cursor-pointer items-center justify-center rounded-md px-2.5 py-1.5 transition-colors ${
                        isActive
                          ? "bg-background text-foreground shadow-sm"
                          : "text-foreground/50 hover:text-foreground/80"
                      }`}
                      onClick={() => setThemePreference(option.value)}
                    >
                      <Icon className="size-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{option.label}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
      </div>
    </>
  );
}
