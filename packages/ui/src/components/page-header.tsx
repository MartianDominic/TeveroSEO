"use client";

import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "../lib/utils";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  backHref?: string;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  backHref,
  className,
}) => {
  const router = useRouter();

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 pb-8 border-b border-border",
        className
      )}
    >
      {/* Left */}
      <div className="min-w-0">
        {backHref && (
          <button
            onClick={() => router.push(backHref as Parameters<typeof router.push>[0])}
            className="-ml-1 mb-1 flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <h1 className="text-xl font-semibold text-foreground truncate">{title}</h1>
        {subtitle && (
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>

      {/* Right */}
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
};
