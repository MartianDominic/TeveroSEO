"use client";

import { Card } from "@tevero/ui";
import { Check, Shield, Wand2, Settings } from "lucide-react";
import { cn } from "@tevero/ui/lib/utils";

interface VoiceModeCardProps {
  mode: "preservation" | "application" | "best_practices";
  selected: boolean;
  onSelect: () => void;
}

const MODE_CONFIG = {
  preservation: {
    icon: Shield,
    title: "Preserve Existing Voice",
    description:
      "Protect brand text from SEO changes. Ideal for clients with established copy they don't want altered.",
    features: [
      "Protect specific pages and sections",
      "Define text patterns to preserve",
      "SEO changes only where allowed",
    ],
  },
  application: {
    icon: Wand2,
    title: "Apply Learned Voice",
    description:
      "Generate content in your client's voice. The system learns from existing content and applies those patterns.",
    features: [
      "AI analyzes existing content",
      "Extracts tone, style, vocabulary",
      "New content matches voice",
    ],
  },
  best_practices: {
    icon: Settings,
    title: "Use Industry Standards",
    description:
      "Apply SEO-optimized defaults for professional content. Best for new clients without established voice guidelines.",
    features: [
      "Select industry template",
      "Professional tone by default",
      "Full SEO optimization",
    ],
  },
} as const;

export function VoiceModeCard({ mode, selected, onSelect }: VoiceModeCardProps) {
  const config = MODE_CONFIG[mode];
  const Icon = config.icon;

  return (
    <Card
      className={cn(
        "p-5 cursor-pointer transition-all",
        "hover:border-primary/50 hover:shadow-sm",
        selected && "border-primary border-2 ring-2 ring-primary/20 bg-primary/5"
      )}
      onClick={onSelect}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "p-2 rounded-lg",
            selected ? "bg-primary text-primary-foreground" : "bg-muted"
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">{config.title}</h3>
            {selected && (
              <Check className="h-4 w-4 text-primary shrink-0" />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {config.description}
          </p>
          <ul className="mt-3 space-y-1">
            {config.features.map((feature, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}
