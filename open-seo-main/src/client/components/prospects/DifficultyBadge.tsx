/**
 * DifficultyBadge component
 * Phase 28: Keyword Gap Analysis UI
 *
 * Displays keyword difficulty as a color-coded badge:
 * - 0-30: green (Easy)
 * - 31-60: yellow (Medium)
 * - 61-100: red (Hard)
 */
import { Badge } from "@/client/components/ui/badge";
import { cn } from "@/client/lib/utils";

export type DifficultyLevel = "Easy" | "Medium" | "Hard";

interface DifficultyConfig {
  label: DifficultyLevel;
  className: string;
}

/**
 * Determines the difficulty level based on numeric value
 * @param difficulty - Numeric difficulty score (0-100)
 * @returns DifficultyLevel - Easy, Medium, or Hard
 */
export function getDifficultyLevel(difficulty: number): DifficultyLevel {
  // Handle null/undefined/NaN values
  const value = Number(difficulty) || 0;

  if (value <= 30) {
    return "Easy";
  }
  if (value <= 60) {
    return "Medium";
  }
  return "Hard";
}

/**
 * Returns styling configuration for a difficulty level
 * @param level - DifficultyLevel to get config for
 * @returns DifficultyConfig with label and className
 */
export function getDifficultyConfig(level: DifficultyLevel): DifficultyConfig {
  switch (level) {
    case "Easy":
      return {
        label: "Easy",
        className: "bg-green-500/20 text-green-400 border-green-500/30",
      };
    case "Medium":
      return {
        label: "Medium",
        className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      };
    case "Hard":
      return {
        label: "Hard",
        className: "bg-red-500/20 text-red-400 border-red-500/30",
      };
  }
}

interface DifficultyBadgeProps {
  difficulty: number;
  className?: string;
}

/**
 * Renders a color-coded badge indicating keyword difficulty
 */
export function DifficultyBadge({
  difficulty,
  className,
}: DifficultyBadgeProps) {
  const level = getDifficultyLevel(difficulty);
  const config = getDifficultyConfig(level);

  return (
    <Badge
      variant="outline"
      className={cn(config.className, className)}
      aria-label={`Difficulty: ${difficulty} (${config.label})`}
    >
      {config.label}
    </Badge>
  );
}
