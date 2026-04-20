import {
  Target,
  TrendingUp,
  MousePointer,
  Eye,
  Award,
  BarChart3,
  Percent,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const iconMap: Record<string, typeof Target> = {
  keywords_top_10: Target,
  keywords_top_3: Award,
  keywords_position_1: Award,
  weekly_clicks: MousePointer,
  monthly_clicks: MousePointer,
  ctr_target: Percent,
  traffic_growth: TrendingUp,
  impressions_target: Eye,
  custom: Settings,
};

interface GoalIconProps {
  type: string;
  className?: string;
}

export function GoalIcon({ type, className }: GoalIconProps) {
  const Icon = iconMap[type] ?? BarChart3;
  return <Icon className={cn("h-4 w-4", className)} />;
}
