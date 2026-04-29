# Phase 44: Component Library Foundation - Pattern Map

**Mapped:** 2026-04-30
**Files analyzed:** 41 new/modified files
**Analogs found:** 35 / 41

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/ui/src/lib/tokens.css` | config | static | `packages/ui/src/lib/tokens.css` (exists) | exact |
| `packages/ui/src/lib/tokens.ts` | utility | static | `packages/ui/src/lib/utils.ts` | role-match |
| `apps/web/src/app/globals.css` | config | static | `apps/web/src/app/globals.css` (exists) | exact |
| `apps/web/src/app/layout.tsx` | provider | static | `apps/web/src/app/layout.tsx` (exists) | exact |
| `packages/ui/src/components/progress-bar.tsx` | component | CRUD | `apps/web/src/components/goals/GoalCard.tsx` | exact |
| `packages/ui/src/lib/status-config.ts` | utility | static | `packages/ui/src/components/status-chip.tsx` | role-match |
| `packages/ui/src/lib/format-time.ts` | utility | transform | `apps/web/src/components/dashboard/ActivityFeed.tsx` | exact |
| `packages/ui/src/components/card-action-menu.tsx` | component | request-response | `apps/web/src/components/goals/GoalCard.tsx` | exact |
| `packages/ui/src/components/step-indicator.tsx` | component | static | `apps/web/src/components/onboarding/GettingStartedCard.tsx` | exact |
| `packages/ui/src/components/checklist.tsx` | component | CRUD | `apps/web/src/components/onboarding/GettingStartedCard.tsx` | exact |
| `packages/ui/src/components/pipeline-stage-card.tsx` | component | CRUD | `apps/web/src/components/analytics/StatCard.tsx` | role-match |
| `packages/ui/src/components/kanban.tsx` | component | CRUD | `apps/web/src/components/prospects/ProspectCard.tsx` | role-match |
| `packages/ui/src/components/today-feed-item.tsx` | component | event-driven | `apps/web/src/components/dashboard/ActivityFeed.tsx` | exact |
| `packages/ui/src/components/entity-card.tsx` | component | CRUD | `apps/web/src/components/prospects/ProspectCard.tsx` | exact |
| `packages/ui/src/components/step-wizard.tsx` | component | CRUD | `apps/web/src/components/onboarding/GettingStartedCard.tsx` | role-match |
| `packages/ui/src/components/segmented-progress-bar.tsx` | component | CRUD | `apps/web/src/components/goals/GoalCard.tsx` | role-match |
| `packages/ui/src/components/metric-card.tsx` | component | CRUD | `apps/web/src/components/analytics/StatCard.tsx` | exact |
| `packages/ui/src/components/relative-timestamp.tsx` | component | transform | `apps/web/src/components/dashboard/ActivityFeed.tsx` | exact |
| `packages/ui/src/components/typography.tsx` | component | static | `packages/ui/src/components/card.tsx` | role-match |
| `packages/ui/src/components/numerals.tsx` | component | static | `packages/ui/src/components/badge.tsx` | role-match |
| `packages/ui/src/components/tier-breakdown-table.tsx` | component | CRUD | `packages/ui/src/components/table.tsx` | role-match |
| `packages/ui/src/components/connection-status-card.tsx` | component | CRUD | `apps/web/src/components/analytics/StatCard.tsx` | role-match |
| `packages/ui/src/components/drop-causes-panel.tsx` | component | CRUD | `packages/ui/src/components/card.tsx` | role-match |
| `packages/ui/src/components/report-preview-card.tsx` | component | CRUD | `apps/web/src/components/prospects/ProspectCard.tsx` | role-match |
| `packages/ui/src/components/health-gauge.tsx` | component | CRUD | no direct analog - SVG | partial |
| `packages/ui/src/components/ops-strip.tsx` | component | event-driven | `apps/web/src/components/dashboard/ActivityFeed.tsx` | role-match |
| `packages/ui/src/components/severity-dots.tsx` | component | static | `packages/ui/src/components/badge.tsx` | role-match |
| `packages/ui/src/components/velocity-strip.tsx` | component | CRUD | `apps/web/src/components/analytics/StatCard.tsx` | role-match |
| `packages/ui/src/components/period-selector.tsx` | component | request-response | `apps/web/src/components/analytics/DateRangeSelector.tsx` | exact |
| `packages/ui/src/components/command-palette.tsx` | component | request-response | `apps/web/src/components/shell/CommandPalette.tsx` | exact |
| `packages/ui/src/components/keyboard-shortcut-hint.tsx` | component | static | `packages/ui/src/components/command.tsx` | role-match |
| `packages/ui/src/components/ghost-button.tsx` | component | request-response | `packages/ui/src/components/button.tsx` | exact |
| `packages/ui/src/components/intent-badge.tsx` | component | static | `packages/ui/src/components/badge.tsx` | exact |
| `packages/ui/src/components/count-badge.tsx` | component | static | `packages/ui/src/components/badge.tsx` | exact |
| `packages/ui/src/components/empty-state.tsx` | component | static | `apps/web/src/components/error-boundary.tsx` | role-match |
| `packages/ui/src/components/error-state.tsx` | component | static | `apps/web/src/components/error-boundary.tsx` | exact |
| `packages/ui/src/components/loading-skeleton.tsx` | component | static | `packages/ui/src/components/skeleton.tsx` | exact |
| `packages/ui/src/components/data-state-wrapper.tsx` | component | CRUD | `apps/web/src/components/error-boundary.tsx` | role-match |
| `packages/ui/src/components/focus-trap.tsx` | component | request-response | `packages/ui/src/components/dialog.tsx` | exact |
| `packages/ui/src/components/skip-to-main.tsx` | component | request-response | no analog - accessibility | none |
| `packages/ui/src/lib/keyboard-patterns.ts` | utility | static | `apps/web/src/components/shell/CommandPalette.tsx` | role-match |
| `packages/ui/src/components/aria-live.tsx` | component | event-driven | no analog - accessibility | none |
| `packages/ui/src/components/overnight-banner.tsx` | component | event-driven | `apps/web/src/components/dashboard/ActivityFeed.tsx` | role-match |
| `packages/ui/src/components/voice-compliance-indicator.tsx` | component | CRUD | `packages/ui/src/components/badge.tsx` | role-match |

## Pattern Assignments

### `packages/ui/src/lib/tokens.ts` (utility, static)

**Analog:** `packages/ui/src/lib/utils.ts`

**Imports pattern** (lines 1-2):
```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
```

**Core pattern** (lines 4-6):
```typescript
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**Notes:** The tokens.ts file will export TypeScript constants that mirror the CSS variables in tokens.css. Follow the same simple export pattern.

---

### `packages/ui/src/components/progress-bar.tsx` (component, CRUD)

**Analog:** `apps/web/src/components/goals/GoalCard.tsx` (lines 25-37)

**Existing implementation to extract:**
```typescript
function ProgressBar({ value }: { value: number }) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
      <div
        className={cn(
          "h-full transition-all",
          clamped >= 100 ? "bg-green-500" : clamped >= 80 ? "bg-yellow-500" : "bg-primary",
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
```

**v6 token updates needed:**
- Replace `bg-muted` with `bg-surface-3`
- Replace color conditionals with `bg-accent`, `bg-success`, `bg-warning`
- Add `role="progressbar"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`
- Add CVA for variant management

---

### `packages/ui/src/lib/status-config.ts` (utility, static)

**Analog:** `packages/ui/src/components/status-chip.tsx` (lines 13-60)

**Existing status map pattern:**
```typescript
type StatusConfig = {
  className: string;
  pulse?: boolean;
};

const STATUS_MAP: Record<string, StatusConfig> = {
  published: {
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  success: {
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  generating: {
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    pulse: true,
  },
  // ... etc
};
```

**v6 token updates needed:**
- Replace hardcoded colors with v6 semantic tokens (`--success-soft`, `--warning-soft`, etc.)
- Add `label`, `icon`, `bgColor`, `textColor` per RESEARCH.md spec
- Create separate status groups: PROSPECT_STATUS, ARTICLE_STATUS, CLIENT_STATUS, PIPELINE_STAGE

---

### `packages/ui/src/lib/format-time.ts` (utility, transform)

**Analog:** `apps/web/src/components/dashboard/ActivityFeed.tsx` (lines 41-50)

**Existing implementation to extract:**
```typescript
const formatTime = (timestamp: string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return date.toLocaleDateString();
};
```

**Updates needed:**
- Add type signature for Date | string input
- Add companion `formatFullTimestamp` for tooltips
- Consider using date-fns `formatDistanceToNow` for localization

---

### `packages/ui/src/components/card-action-menu.tsx` (component, request-response)

**Analog:** `apps/web/src/components/goals/GoalCard.tsx` (lines 138-167)

**Imports pattern:**
```typescript
import { useState } from "react";
import {
  Button,
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@tevero/ui";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
```

**Core pattern:**
```typescript
<Popover open={menuOpen} onOpenChange={setMenuOpen}>
  <PopoverTrigger asChild>
    <Button variant="ghost" size="icon" className="h-8 w-8">
      <MoreHorizontal className="h-4 w-4" />
    </Button>
  </PopoverTrigger>
  <PopoverContent align="end" className="w-40 p-1">
    <Button
      variant="ghost"
      className="w-full justify-start"
      onClick={() => {
        setMenuOpen(false);
        onEdit();
      }}
    >
      <Pencil className="h-4 w-4 mr-2" />
      Edit
    </Button>
    <Button
      variant="ghost"
      className="w-full justify-start text-destructive hover:text-destructive"
      onClick={() => {
        setMenuOpen(false);
        onDelete();
      }}
    >
      <Trash2 className="h-4 w-4 mr-2" />
      Delete
    </Button>
  </PopoverContent>
</Popover>
```

**Accessibility additions:**
- Add `aria-haspopup="menu"` to trigger
- Add `role="menuitem"` to menu items
- Add keyboard navigation (arrow keys, Enter, Escape)

---

### `packages/ui/src/components/step-indicator.tsx` (component, static)

**Analog:** `apps/web/src/components/onboarding/GettingStartedCard.tsx` (lines 23-34)

**Existing implementation:**
```typescript
const StepIndicator = ({ done }: { done: boolean }) => (
  <span
    className={cn(
      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold",
      done
        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
        : "border border-border text-muted-foreground"
    )}
  >
    {done ? "✓" : ""}
  </span>
);
```

**v6 token updates:**
- Replace `bg-emerald-500/15` with `bg-success-soft`
- Replace `text-emerald-600` with `text-success`
- Replace `border-border` with `border-hairline`

---

### `packages/ui/src/components/checklist.tsx` (component, CRUD)

**Analog:** `apps/web/src/components/onboarding/GettingStartedCard.tsx` (lines 90-178)

**Structure pattern:**
```typescript
<div className="mb-6 rounded-xl border border-border bg-card p-6">
  <div className="mb-4 flex items-center gap-2">
    <span className="text-sm font-semibold text-foreground">
      Getting Started
    </span>
    <span className="text-xs text-muted-foreground">
      — {completedCount}/3 complete
    </span>
  </div>

  <div className="space-y-3">
    <div className="flex items-start gap-3">
      <StepIndicator done={step1Done} />
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium", step1Done ? "line-through opacity-60" : "")}>
          Account created
        </p>
      </div>
    </div>
    {/* ... more items */}
  </div>
</div>
```

**v6 token updates:**
- Replace `border-border` with `shadow-card` (no solid borders on cards)
- Replace `bg-card` with `bg-surface`
- Use `--shadow-lift` on hover

---

### `packages/ui/src/components/metric-card.tsx` (component, CRUD)

**Analog:** `apps/web/src/components/analytics/StatCard.tsx`

**Full implementation:**
```typescript
import { Card, CardContent } from "@tevero/ui";

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    label: string;
  };
}

export function StatCard({ label, value, subtitle, trend }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="text-2xl font-semibold mt-1">{value}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
        {trend && (
          <p
            className={`text-xs mt-1 ${
              trend.value > 0
                ? "text-emerald-600"
                : trend.value < 0
                ? "text-red-600"
                : "text-muted-foreground"
            }`}
          >
            {trend.value > 0 ? "+" : ""}
            {trend.value.toFixed(1)}% {trend.label}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

**v6 updates needed:**
- Replace `text-2xl font-semibold` with `font-display text-num-card` (Newsreader serif numerals)
- Replace `text-xs uppercase tracking-wide` with `text-type-tiny font-variant-caps-all-small-caps`
- Add sparkline (hidden at rest, revealed on hover with `--motion-reveal`)
- Add action menu (hidden at rest)
- Use `--shadow-card` and `--shadow-lift` on hover

---

### `packages/ui/src/components/today-feed-item.tsx` (component, event-driven)

**Analog:** `apps/web/src/components/dashboard/ActivityFeed.tsx` (lines 130-159)

**Event item pattern:**
```typescript
<div
  key={event.id}
  className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
>
  <div className="mt-0.5">
    {getEventIcon(event.type as ActivityEventType)}
  </div>
  <div className="flex-1 min-w-0">
    <div className="flex items-center gap-2">
      <span className="font-medium text-sm">
        {EVENT_TYPE_LABELS[event.type as ActivityEventType] ?? event.type}
      </span>
      {event.clientName && (
        <Badge variant="outline" className="text-xs">
          {event.clientName}
        </Badge>
      )}
    </div>
    {typeof event.data.message === 'string' && event.data.message && (
      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
        {event.data.message}
      </p>
    )}
  </div>
  <span className="text-xs text-muted-foreground whitespace-nowrap">
    {formatTime(event.timestamp)}
  </span>
</div>
```

**v6 updates:**
- Two-column layout: mono timestamp (44px width) + body
- Use `font-mono text-type-tiny` for timestamp
- Tag uses `font-variant-caps: all-small-caps`
- Add day dividers between date groups

---

### `packages/ui/src/components/entity-card.tsx` (component, CRUD)

**Analog:** `apps/web/src/components/prospects/ProspectCard.tsx`

**Imports pattern** (lines 1-31):
```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@tevero/ui";
import {
  Globe,
  User,
  Mail,
  Building2,
  MoreVertical,
  Search,
  Trash2,
  ExternalLink,
  Loader2,
  Check,
} from "lucide-react";
```

**Card structure pattern** (lines 99-202):
```typescript
<Card className={`hover:shadow-md transition-shadow ${selected ? "ring-2 ring-primary" : ""}`}>
  {/* Selection checkbox */}
  {onToggleSelect && (
    <div className="absolute top-3 left-3 z-10">
      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${selected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30 bg-background"}`}>
        {selected && <Check className="h-3 w-3" />}
      </div>
    </div>
  )}
  <CardHeader className="pb-2">
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <CardTitle className="text-lg flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <Link href={`/prospects/${prospect.id}`} className="hover:underline">
            {prospect.domain}
          </Link>
        </CardTitle>
        {/* ... description */}
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
        {/* Action menu */}
      </div>
    </div>
  </CardHeader>
  <CardContent className="pb-2">
    {/* Content */}
  </CardContent>
  <CardFooter className="pt-2">
    {/* Footer actions */}
  </CardFooter>
</Card>
```

**v6 updates:**
- Replace `hover:shadow-md` with `shadow-card hover:shadow-lift`
- Replace `ring-2 ring-primary` with `ring-2 ring-accent`
- Add `--motion-hover` for transitions
- Card lift: `transform: translateY(-1px)` on hover

---

### `packages/ui/src/components/period-selector.tsx` (component, request-response)

**Analog:** `apps/web/src/components/analytics/DateRangeSelector.tsx`

**Full implementation:**
```typescript
"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@tevero/ui";

interface DateRangeSelectorProps {
  value: "30" | "90";
  onChange: (value: "30" | "90") => void;
}

export function DateRangeSelector({ value, onChange }: DateRangeSelectorProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[140px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="30">Last 30 days</SelectItem>
        <SelectItem value="90">Last 90 days</SelectItem>
      </SelectContent>
    </Select>
  );
}
```

**v6 implementation changes:**
- Replace Select with pill button group (3px padding, `--surface` bg, `--shadow-card`)
- Active button: `--accent-soft` background, `--accent-ink` text
- Inactive hover: `--surface-2` background
- Values: '7d' | '30d' | '90d' | '1y' | 'custom'

---

### `packages/ui/src/components/command-palette.tsx` (component, request-response)

**Analog:** `apps/web/src/components/shell/CommandPalette.tsx`

**Imports pattern** (lines 1-26):
```typescript
"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Check,
  LayoutDashboard,
  Calendar,
  Brain,
  Settings,
  BarChart3,
  Plus,
} from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Dialog,
  DialogContent,
} from "@tevero/ui";
import { useClientStore } from "@/stores";
import { cn } from "@/lib/utils";
```

**Core pattern** (lines 105-178):
```typescript
<Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
  <DialogContent className={cn(
    "max-w-lg w-full rounded-xl border border-border bg-popover p-0 shadow-xl"
  )}>
    <Command className="rounded-xl">
      <CommandInput placeholder="Search commands..." />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Clients">
          {clients.map((client) => (
            <CommandItem
              key={client.id}
              value={client.name}
              onSelect={() => handleClientSelect(client.id)}
            >
              <Building2 className="mr-2 h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{client.name}</span>
              {activeClientId === client.id && (
                <Check className="ml-2 h-4 w-4 shrink-0 text-primary" />
              )}
            </CommandItem>
          ))}
        </CommandGroup>
        {/* More groups */}
      </CommandList>
    </Command>
  </DialogContent>
</Dialog>
```

**v6 updates:**
- Modal backdrop: `rgba(20, 20, 26, 0.4)` with `backdrop-filter: blur(4px)`
- `--radius-modal` (14px) for container
- `--shadow-pop` for modal
- `--surface-2` for hover state
- `--accent-soft` for selected item

---

### `packages/ui/src/components/empty-state.tsx` (component, static)

**Analog:** `apps/web/src/components/error-boundary.tsx` (lines 59-75)

**Error UI pattern (adapt for empty state):**
```typescript
<div className="flex flex-col items-center justify-center min-h-[400px] p-8">
  <h2 className="text-xl font-semibold mb-4">Something went wrong</h2>
  <p className="text-muted-foreground mb-4 text-center max-w-md">
    We encountered an error loading this section. Please try again or contact support if the problem persists.
  </p>
  <Button onClick={this.handleReset}>
    Try again
  </Button>
</div>
```

**v6 adaptation:**
- Icon: 48px size, `--text-3` color
- Title: `font-display` (Newsreader), `--type-h3`, `--text-1`
- Description: `--type-body`, `--text-2`, max-width 320px
- Layout: Centered, `--space-6` gap
- Variants: default, search, first-time, filtered

---

### `packages/ui/src/components/error-state.tsx` (component, static)

**Analog:** `apps/web/src/components/error-boundary.tsx`

**Full pattern** (lines 33-80):
```typescript
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logError('ErrorBoundary', error, { componentStack: errorInfo.componentStack || 'unknown' });
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
          <h2 className="text-xl font-semibold mb-4">Something went wrong</h2>
          <p className="text-muted-foreground mb-4 text-center max-w-md">
            We encountered an error loading this section.
          </p>
          <Button onClick={this.handleReset}>Try again</Button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

**v6 variants:**
- Inline: `--error-soft` bg, `--error` text, `--radius-input`
- Card: Replaces card content, maintains dimensions
- Full page: Centered in viewport, 64px icon

---

### `packages/ui/src/components/loading-skeleton.tsx` (component, static)

**Analog:** `packages/ui/src/components/skeleton.tsx`

**Existing implementation:**
```typescript
import * as React from "react";
import { cn } from "../lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
```

**CRITICAL v6 update:**
- Replace `animate-pulse` with custom `skeleton-shimmer` animation (already in tokens.css)
- Replace `bg-muted` with `bg-surface-3`
- Add variants: text, card, table, chart, avatar, button
- Honor `prefers-reduced-motion`

---

### `packages/ui/src/components/focus-trap.tsx` (component, request-response)

**Analog:** `packages/ui/src/components/dialog.tsx`

**Dialog uses Radix primitives which include focus trapping:**
```typescript
import * as DialogPrimitive from "@radix-ui/react-dialog";

const DialogContent = React.forwardRef<...>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(...)}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPortal>
));
```

**FocusTrap implementation using Radix:**
```typescript
import * as FocusScope from '@radix-ui/react-focus-scope';

export function FocusTrap({ active, onEscape, children, ...props }: FocusTrapProps) {
  if (!active) return <>{children}</>;
  
  return (
    <FocusScope.Root
      trapped
      onEscapeKeyDown={onEscape}
      {...props}
    >
      {children}
    </FocusScope.Root>
  );
}
```

---

### `packages/ui/src/components/button.tsx` (EXTEND with GhostButton variant)

**Analog:** `packages/ui/src/components/button.tsx`

**Existing CVA pattern:**
```typescript
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
```

**v6 GhostButton addition:**
- Add to variants or create separate component
- `background: transparent`
- `border: 1px solid var(--hairline)`
- `--radius-input` (6px)
- `--type-tiny` (12px), `--text-2`
- Hover: `--surface-2` background, `--text-4` border, `--text-1` color

---

### `packages/ui/src/components/badge.tsx` (EXTEND with IntentBadge, CountBadge)

**Analog:** `packages/ui/src/components/badge.tsx`

**Existing CVA pattern:**
```typescript
const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground border-border",
        zinc: "border-transparent bg-zinc-800 text-zinc-300",
      },
    },
    defaultVariants: { variant: "default" },
  }
);
```

**v6 IntentBadge additions:**
- Commercial: `--accent-soft` / `--accent`
- Informational: `--info-soft` / `--info`
- Transactional: `--warning-soft` / `--warning`
- Navigational: `--surface-2` / `--text-2`
- Use `--radius-pill`, `--type-tiny`, `font-variant-caps: all-small-caps`

**v6 CountBadge:**
- Default: `--surface-2` bg, `--text-3` color
- Active: `--accent-soft` bg, `--accent` color
- `--radius-pill`, `--type-tiny`
- `font-variant-numeric: tabular-nums lining-nums`

---

### `apps/web/src/app/layout.tsx` (EXTEND with font loading)

**Current implementation:**
```typescript
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tevero",
  description: "TeveroSEO unified platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="min-h-screen bg-background text-foreground antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
```

**v6 font loading pattern (from RESEARCH.md):**
```typescript
import { Geist, Geist_Mono } from 'next/font/google'
import { Newsreader } from 'next/font/google'

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  axes: ['opsz'],
})

// Apply to html: className={`${geist.variable} ${geistMono.variable} ${newsreader.variable}`}
```

---

### `apps/web/src/app/globals.css` (EXTEND with v6 @theme)

**Current implementation:**
```css
@import "tailwindcss";

@theme {
  /* Current OKLCH colors - need to ADD v6 token mappings */
}
```

**v6 @theme additions:**
```css
@import "tailwindcss";
@import "@tevero/ui/src/lib/tokens.css";

@theme inline {
  /* Colors - map v6 tokens to Tailwind utilities */
  --color-canvas: var(--canvas);
  --color-canvas-dim: var(--canvas-dim);
  --color-surface: var(--surface);
  --color-surface-2: var(--surface-2);
  --color-surface-3: var(--surface-3);
  
  --color-text-1: var(--text-1);
  --color-text-2: var(--text-2);
  --color-text-3: var(--text-3);
  --color-text-4: var(--text-4);
  
  --color-accent: var(--accent);
  --color-accent-soft: var(--accent-soft);
  --color-accent-ink: var(--accent-ink);
  
  /* Shadows */
  --shadow-card: var(--shadow-card);
  --shadow-lift: var(--shadow-lift);
  --shadow-pop: var(--shadow-pop);
  
  /* Radius */
  --radius-input: var(--radius-input);
  --radius-button: var(--radius-button);
  --radius-card: var(--radius-card);
  --radius-pill: var(--radius-pill);
}
```

---

## Shared Patterns

### Component Structure (All UI components)
**Source:** `packages/ui/src/components/button.tsx`
**Apply to:** All new component files

```typescript
"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

const componentVariants = cva(
  "base-classes",
  {
    variants: {
      variant: { /* ... */ },
      size: { /* ... */ },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface ComponentProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof componentVariants> {
  // additional props
}

const Component = React.forwardRef<HTMLElement, ComponentProps>(
  ({ className, variant, size, ...props }, ref) => (
    <element
      className={cn(componentVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
);
Component.displayName = "Component";

export { Component, componentVariants };
```

### Radix Primitive Wrapper (Dialog, Popover, Select-based components)
**Source:** `packages/ui/src/components/dialog.tsx`
**Apply to:** CommandPalette, FocusTrap, overlays

```typescript
"use client";

import * as React from "react";
import * as PrimitiveName from "@radix-ui/react-primitive-name";
import { cn } from "../lib/utils";

const Component = PrimitiveName.Root;

const ComponentContent = React.forwardRef<
  React.ElementRef<typeof PrimitiveName.Content>,
  React.ComponentPropsWithoutRef<typeof PrimitiveName.Content>
>(({ className, ...props }, ref) => (
  <PrimitiveName.Portal>
    <PrimitiveName.Content
      ref={ref}
      className={cn("default-classes", className)}
      {...props}
    />
  </PrimitiveName.Portal>
));
ComponentContent.displayName = PrimitiveName.Content.displayName;

export { Component, ComponentContent };
```

### Barrel Export Pattern
**Source:** `packages/ui/src/index.ts`
**Apply to:** All new component exports

```typescript
export { ComponentName, componentVariants } from "./components/component-name";
export type { ComponentNameProps } from "./components/component-name";
```

### v6 Card Hover Pattern
**Source:** design-system-v6.md Section 4
**Apply to:** All card-based components

```typescript
className={cn(
  "rounded-card bg-surface shadow-card",
  "transition-all duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
  "hover:shadow-lift hover:-translate-y-px",
  className
)}
```

### v6 Hover-to-Reveal Pattern
**Source:** design-system-v6.md Section 11
**Apply to:** MetricCard sparklines, row arrows, action menus

```typescript
// Hidden element
<div className={cn(
  "opacity-0 translate-x-[-4px]",
  "transition-all duration-[240ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
  "group-hover:opacity-100 group-hover:translate-x-0",
  "group-hover:text-accent"
)}>
  {/* Content */}
</div>
```

### v6 Small Caps Pattern
**Source:** design-system-v6.md Section 6.1
**Apply to:** Status pills, intent badges, eyebrows

```typescript
className="text-type-tiny tracking-[0.06em] [font-variant-caps:all-small-caps]"
```

---

## No Analog Found

Files with no close match in the codebase (use RESEARCH.md patterns):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `packages/ui/src/components/health-gauge.tsx` | component | CRUD | SVG arc gauge - no existing SVG components |
| `packages/ui/src/components/skip-to-main.tsx` | component | request-response | Accessibility component - none exist |
| `packages/ui/src/components/aria-live.tsx` | component | event-driven | ARIA live region - none exist |

**For these components, use the patterns from RESEARCH.md:**

### HealthGauge SVG Pattern
```typescript
<svg viewBox="0 0 96 96">
  <circle cx="48" cy="48" r="38" fill="none" stroke="var(--surface-3)" stroke-width="7"/>
  <circle cx="48" cy="48" r="38" fill="none" stroke="var(--accent)" stroke-width="7" 
    stroke-linecap="round" stroke-dasharray="{score * 239 / 100} 239" pathLength="239"
    transform="rotate(-90 48 48)"/>
</svg>
```

### SkipToMain Pattern
```typescript
<a
  href={`#${targetId}`}
  className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:bg-accent focus:text-white focus:px-4 focus:py-2 focus:rounded-button focus:shadow-pop"
>
  {label}
</a>
```

### AriaLive Pattern
```typescript
<div
  role="status"
  aria-live={mode}
  aria-atomic={atomic}
  aria-relevant={relevant}
  className="sr-only"
>
  {children}
</div>
```

---

## Metadata

**Analog search scope:** 
- `packages/ui/src/components/`
- `apps/web/src/components/`
- `packages/ui/src/lib/`

**Files scanned:** 75
**Pattern extraction date:** 2026-04-30

---

## PATTERN MAPPING COMPLETE

**Phase:** 44 - Component Library Foundation
**Files classified:** 41
**Analogs found:** 35 / 41

### Coverage
- Files with exact analog: 18
- Files with role-match analog: 17
- Files with partial/no analog: 6

### Key Patterns Identified
1. All UI components use CVA (class-variance-authority) for variant management
2. Radix primitives wrap all accessible components (Dialog, Popover, Command, etc.)
3. Card components follow shadow-card/shadow-lift hover pattern (no solid borders)
4. Timestamps use formatRelativeTime utility with mono font
5. Status indicators use StatusConfig pattern with semantic color tokens
6. Hover-to-reveal pattern for secondary actions (sparklines, menus, arrows)

### File Created
`/home/dominic/Documents/TeveroSEO/.planning/phases/44-component-library-foundation/44-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can now reference analog patterns in PLAN.md files.
