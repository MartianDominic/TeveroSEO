/**
 * VerticalBadge Component
 * Phase 92-09: UI Components for On-Page Mastery
 *
 * Displays vertical classification with YMYL indicator and confidence score.
 * Uses design-system-v6 semantic colors.
 */
import { Badge } from "@/client/components/ui/badge";
import type { Vertical } from "@/server/features/onpage-mastery/types";

const VERTICAL_COLORS: Record<Vertical, string> = {
  healthcare: "bg-red-100 text-red-800",
  legal: "bg-purple-100 text-purple-800",
  financial: "bg-green-100 text-green-800",
  ecommerce: "bg-blue-100 text-blue-800",
  saas: "bg-cyan-100 text-cyan-800",
  real_estate: "bg-amber-100 text-amber-800",
  home_services: "bg-orange-100 text-orange-800",
  hospitality: "bg-pink-100 text-pink-800",
  education: "bg-indigo-100 text-indigo-800",
  professional: "bg-slate-100 text-slate-800",
  manufacturing: "bg-zinc-100 text-zinc-800",
  nonprofit: "bg-emerald-100 text-emerald-800",
  general: "bg-gray-100 text-gray-800",
};

interface Props {
  vertical: Vertical;
  isYmyl?: boolean;
  confidence?: number;
}

export function VerticalBadge({ vertical, isYmyl, confidence }: Props) {
  const colorClass = VERTICAL_COLORS[vertical] || VERTICAL_COLORS.general;

  return (
    <div className="flex items-center gap-2">
      <Badge className={colorClass}>{vertical.replace("_", " ")}</Badge>
      {isYmyl && (
        <Badge variant="destructive" className="text-[12px]">
          YMYL
        </Badge>
      )}
      {confidence !== undefined && (
        <span className="text-[12px] text-muted-foreground">
          {Math.round(confidence * 100)}% confidence
        </span>
      )}
    </div>
  );
}
