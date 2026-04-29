# GSD Phase 0: Component Library Foundation

> **Priority:** CRITICAL - All subsequent phases depend on this foundation
> **Duration:** ~4 days
> **Owner:** Frontend team
> **Reference docs:** `design-system-v6.md`, `design-decisions-and-rationale.md`
> **Prototype:** `.planning/design/prototypes/client-hub-v6.html`

---

## 0. Executive Summary

Phase 0 establishes the shared component library that **all future UI work depends on**. This includes:

1. **Design tokens** - CSS variables from design-system-v6.md mapped to Tailwind
2. **Extracted components** - Patterns already in the codebase that need consolidation
3. **New primitives** - Components defined in the design system but not yet implemented
4. **Storybook stories** - Visual documentation for each component
5. **Unit tests** - Baseline test coverage (80%+ target)

**Critical constraint:** These components MUST adhere to the design system anti-patterns list. Any component that violates the rules is rejected.

---

## 1. Design Tokens Layer

### 1.1 Location
```
packages/ui/src/lib/tokens.css
packages/ui/src/lib/tokens.ts       # TypeScript constants for JS usage
apps/web/tailwind.config.ts         # Extend with token mappings
```

### 1.2 CSS Tokens (from design-system-v6.md Section 2)

```css
/* Color tokens */
--canvas: #FAFAF7
--canvas-dim: #F5F4EE
--surface: #FFFFFF
--surface-2: #F8F8F3
--surface-3: #F2F1EB
--hairline: rgba(20, 20, 26, 0.06)
--hairline-2: rgba(20, 20, 26, 0.04)
--hairline-3: rgba(20, 20, 26, 0.025)
--text-1: #14141A
--text-2: #54545A
--text-3: #93939A
--text-4: #C4C3BB
--accent: #0F4F3D
--accent-2: #1A6E55
--accent-soft: #EAF1ED
--accent-ink: #093528
--accent-line: #C8DDD4
--accent-tint: #5F9181
--success: #1B6E45 --success-soft: #EAF2EE
--error: #9B2C2C --error-soft: #F4E6E6
--warning: #A87F1A --warning-soft: #F4EDDA
--info: #2D5A87 --info-soft: #EFF4F9

/* Typography tokens */
--font-sans: 'Geist', ui-sans-serif, system-ui, sans-serif
--font-mono: 'Geist Mono', ui-monospace, 'SF Mono', Menlo, monospace
--font-display: 'Newsreader', Georgia, 'Times New Roman', serif
--type-tiny: 12px
--type-small: clamp(13px, 0.92vw, 13.5px)
--type-body: clamp(14px, 1vw, 14.5px)
--type-h3: clamp(15px, 1.1vw, 16px)
--type-h2: clamp(17px, 1.3vw, 18.5px)
--type-h1: clamp(30px, 2.4vw, 40px)
--num-mega: clamp(58px, 4.8vw, 80px)
--num-hero: clamp(38px, 3.2vw, 46px)
--num-card: clamp(36px, 3vw, 44px)
--num-row: clamp(20px, 1.7vw, 26px)
--num-tiny: clamp(15px, 1.2vw, 18px)

/* Spacing tokens */
--space-1: 4px
--space-2: 8px
--space-3: clamp(10px, 0.85vw, 13px)
--space-4: clamp(12px, 1.05vw, 16px)
--space-5: clamp(16px, 1.4vw, 22px)
--space-6: clamp(20px, 1.8vw, 28px)
--space-7: clamp(28px, 2.4vw, 38px)
--space-8: clamp(36px, 3.4vw, 52px)
--space-9: clamp(48px, 4.8vw, 72px)

/* Radius tokens */
--radius-input: 6px
--radius-button: 8px
--radius-card: 12px
--radius-modal: 14px
--radius-pill: 999px

/* Shadow tokens */
--shadow-card: [layered ghost-edge shadow from spec]
--shadow-lift: [hover state shadow]
--shadow-pop: [pop shadow for small elements]
--shadow-cta: [primary CTA gradient glow]
--shadow-cta-hover: [primary CTA hover]

/* Motion tokens */
--ease-smooth: cubic-bezier(0.16, 1, 0.3, 1)
--ease-quick: cubic-bezier(0.4, 0, 0.2, 1)
--motion-fast: 160ms var(--ease-quick)
--motion-hover: 280ms var(--ease-smooth)
--motion-reveal: 240ms var(--ease-smooth)

/* Shell tokens */
--shell-sidebar: clamp(232px, 16vw, 272px)
--shell-rail: clamp(320px, 22vw, 380px)
--shell-utility-h: 56px
```

### 1.3 Tailwind Extension

Map tokens to Tailwind theme for class-based usage:
- `bg-canvas`, `bg-surface`, `bg-surface-2`, `bg-surface-3`
- `text-text-1`, `text-text-2`, `text-text-3`, `text-text-4`
- `text-accent`, `bg-accent-soft`, etc.
- `shadow-card`, `shadow-lift`, `shadow-pop`, `shadow-cta`
- `font-sans`, `font-mono`, `font-display`

### 1.4 Font Loading (Next.js)

Add to `apps/web/src/app/layout.tsx`:
```tsx
import { Geist, Geist_Mono } from 'next/font/google'
import { Newsreader } from 'next/font/google'

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' })
const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-display',
  axes: ['opsz'],
})
```

---

## 2. Extraction Tasks (From Existing Code)

### 2.1 ProgressBar
**Source:** `apps/web/src/components/goals/GoalCard.tsx` (lines 25-37)
**Target:** `packages/ui/src/components/progress-bar.tsx`

```typescript
interface ProgressBarProps {
  value: number;                    // 0-100
  variant?: 'default' | 'success' | 'warning';
  size?: 'sm' | 'md' | 'lg';       // h-1.5, h-2, h-3
  showValue?: boolean;              // Display percentage label
  className?: string;
}
```

**Design tokens used:**
- `--surface-3` for track background
- `--accent` for default fill
- `--success`, `--warning` for semantic variants
- `--radius-pill` for border-radius

**Accessibility:**
- `role="progressbar"`
- `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- `aria-label` for screen readers

---

### 2.2 Unified status-config.ts
**Sources:**
- `apps/web/src/components/prospects/PipelineDistributionChart.tsx` (lines 10-16)
- `apps/web/src/components/analytics/StatusBadge.tsx` (lines 7-16)
- `apps/web/src/components/prospects/ProspectCard.tsx` (lines 45-54)
- `packages/ui/src/components/status-chip.tsx` (lines 18-60)

**Target:** `packages/ui/src/lib/status-config.ts`

```typescript
export interface StatusConfig {
  label: string;
  color: string;                    // Tailwind class for dot/indicator
  bgColor: string;                  // Background for pills
  textColor: string;                // Text color
  icon?: React.ComponentType<{ className?: string }>;
  pulse?: boolean;                  // Animated indicator
}

// Prospect statuses
export const PROSPECT_STATUS: Record<string, StatusConfig> = {
  new: { label: 'New', color: 'bg-blue-500', bgColor: 'bg-blue-500/10', textColor: 'text-blue-600' },
  analyzing: { label: 'Analyzing', color: 'bg-yellow-500', bgColor: 'bg-amber-500/10', textColor: 'text-amber-600', pulse: true },
  analyzed: { label: 'Analyzed', color: 'bg-emerald-500', bgColor: 'bg-emerald-500/10', textColor: 'text-emerald-600' },
  converted: { label: 'Converted', color: 'bg-purple-500', bgColor: 'bg-purple-500/10', textColor: 'text-purple-600' },
  archived: { label: 'Archived', color: 'bg-gray-400', bgColor: 'bg-muted', textColor: 'text-muted-foreground' },
};

// Article statuses
export const ARTICLE_STATUS: Record<string, StatusConfig> = {
  published: { label: 'Published', ... },
  generating: { label: 'Generating', pulse: true, ... },
  draft: { ... },
  // etc.
};

// Client health statuses
export const CLIENT_STATUS: Record<string, StatusConfig> = {
  good: { label: 'Healthy', icon: CheckCircle2, ... },
  drop: { label: 'Traffic Drop', icon: TrendingDown, ... },
  no_gsc: { label: 'Not Connected', icon: Link2Off, ... },
  stale: { label: 'Sync Stale', icon: AlertCircle, ... },
};

// Pipeline stages
export const PIPELINE_STAGE: Record<string, StatusConfig> = {
  idea: { label: 'Idea', ... },
  outline: { label: 'Outline', ... },
  draft: { label: 'Draft', ... },
  review: { label: 'Review', ... },
  published: { label: 'Published', ... },
};
```

---

### 2.3 formatRelativeTime Utility
**Source:** `apps/web/src/components/dashboard/ActivityFeed.tsx` (lines 41-50)
**Target:** `packages/ui/src/lib/format-time.ts`

```typescript
export function formatRelativeTime(timestamp: string | Date): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Companion: full timestamp for tooltip
export function formatFullTimestamp(timestamp: string | Date): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return date.toLocaleString();
}
```

---

### 2.4 CardActionMenu
**Source:** Pattern from `apps/web/src/components/prospects/ProspectCard.tsx` (lines 129-155)
**Target:** `packages/ui/src/components/card-action-menu.tsx`

```typescript
interface CardActionMenuItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  variant?: 'default' | 'destructive';
  disabled?: boolean;
}

interface CardActionMenuProps {
  items: CardActionMenuItem[];
  align?: 'start' | 'end';
  triggerClassName?: string;
}
```

**Design tokens used:**
- Uses `Popover` from existing UI lib
- Ghost button trigger
- `--motion-hover` for transitions

**Accessibility:**
- Menu button with `aria-haspopup="menu"`
- Menu items with `role="menuitem"`
- Keyboard navigation (arrow keys, Enter, Escape)

---

### 2.5 StepIndicator
**Source:** `apps/web/src/components/onboarding/GettingStartedCard.tsx` (lines 23-34)
**Target:** `packages/ui/src/components/step-indicator.tsx`

```typescript
interface StepIndicatorProps {
  done: boolean;
  number?: number;                  // Show step number if not done
  size?: 'sm' | 'md';               // h-4/h-5
  className?: string;
}
```

**Design tokens used:**
- `--success-soft` background when done
- `--success` / `--accent` text when done
- `--hairline` border when not done

---

## 3. New Components

### 3.1 Checklist + ChecklistItem

**Location:** `packages/ui/src/components/checklist.tsx`

```typescript
interface ChecklistProps {
  title?: string;
  description?: string;
  completedCount?: number;
  totalCount?: number;
  children: React.ReactNode;
  className?: string;
}

interface ChecklistItemProps {
  done: boolean;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  children?: React.ReactNode;
}
```

**Design tokens:**
- Card with `--shadow-card`
- Step indicators use `StepIndicator` component
- Done items get `line-through opacity-60`
- Action links use `--accent` color

**Usage example:**
```tsx
<Checklist title="Getting Started" completedCount={2} totalCount={5}>
  <ChecklistItem done title="Create account" />
  <ChecklistItem done title="Configure APIs" />
  <ChecklistItem
    done={false}
    title="Add first client"
    action={{ label: "Add Client", onClick: onAddClient }}
  />
</Checklist>
```

---

### 3.2 PipelineStageCard

**Location:** `packages/ui/src/components/pipeline-stage-card.tsx`

```typescript
interface PipelineStageCardProps {
  stage: string;                    // Key from PIPELINE_STAGE
  count: number;
  percentage: number;               // 0-100
  value?: number;                   // Optional monetary/count value
  isActive?: boolean;               // Highlight current stage
  onClick?: () => void;
  className?: string;
}
```

**Visual spec (from design-system-v6.md Section 14.5):**
- Small-caps label at top
- Newsreader serif count
- 3px relative-volume bar showing percentage
- Active stage gets `--accent` gradient + bar fill
- 2px left border in stage color

**Design tokens:**
- `--type-tiny` (12px) for label
- `--num-row` for count numeral
- `--accent` for active state
- `--hairline-2` for inactive border

---

### 3.3 KanbanColumn + KanbanCard

**Location:** `packages/ui/src/components/kanban.tsx`

```typescript
interface KanbanColumnProps {
  title: string;
  count: number;
  status: string;                   // Key from status config
  children: React.ReactNode;
  onDrop?: (itemId: string) => void;
}

interface KanbanCardProps {
  id: string;
  title: string;
  subtitle?: string;
  meta?: React.ReactNode;
  status?: string;
  draggable?: boolean;
  onClick?: () => void;
}
```

**Design tokens:**
- Column header with status dot
- Cards use `--shadow-card`, lift on hover
- Drop zones highlight with `--accent-soft`
- Drag handle appears on hover

**Accessibility:**
- `role="listbox"` for column
- `role="option"` for cards
- Keyboard drag-drop support

---

### 3.4 TodayFeedItem

**Location:** `packages/ui/src/components/today-feed-item.tsx`

**Reference:** design-system-v6.md Section 10.2

```typescript
interface TodayFeedItemProps {
  timestamp: string | Date;
  title: string;
  description?: string;
  tag?: {
    label: string;
    variant: 'ranking' | 'audit' | 'alert' | 'report' | 'connection';
  };
  onClick?: () => void;
}
```

**Visual spec:**
- Two-column: mono timestamp (44px width) + body
- Tag at bottom with semantic dot + small caps
- Day dividers ("Yesterday") separate groups

**Design tokens:**
- `--font-mono` for timestamp at `--type-tiny`
- `--type-small` for body
- Tag uses `font-variant-caps: all-small-caps`
- Colors from status config variants

---

### 3.5 EntityCard

**Location:** `packages/ui/src/components/entity-card.tsx`

Generic card for displaying an entity with consistent structure.

```typescript
interface EntityCardProps {
  avatar?: {
    type: 'initials' | 'image' | 'icon';
    value: string | React.ReactNode;
    color?: string;                 // Gradient or solid
  };
  title: string;
  subtitle?: string;
  description?: string;
  status?: {
    key: string;
    config: StatusConfig;
  };
  meta?: React.ReactNode;
  actions?: CardActionMenuItem[];
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}
```

**Design tokens:**
- `--shadow-card` at rest, `--shadow-lift` on hover
- `--radius-card` (12px)
- Selection ring with `--accent`
- Lift animation with `--motion-hover`

---

### 3.6 StepWizard

**Location:** `packages/ui/src/components/step-wizard.tsx`

Multi-step form component with progress indication.

```typescript
interface StepWizardProps {
  steps: WizardStep[];
  currentStep: number;
  onStepChange: (step: number) => void;
  onComplete: () => void;
  onCancel?: () => void;
  children: React.ReactNode;
}

interface WizardStep {
  id: string;
  title: string;
  description?: string;
  isOptional?: boolean;
  isComplete?: boolean;
  validateFn?: () => boolean | Promise<boolean>;
}

// Compound components
StepWizard.Header          // Progress indicator
StepWizard.Content         // Step content container
StepWizard.Footer          // Navigation buttons
StepWizard.Step            // Individual step wrapper
```

**Design tokens:**
- Progress dots/line showing completion
- Active step uses `--accent`
- Completed steps use `--success`
- Footer buttons follow button system

---

### 3.7 SegmentedProgressBar

**Location:** `packages/ui/src/components/segmented-progress-bar.tsx`

Progress bar with labeled segments (for pipelines, funnels).

```typescript
interface ProgressSegment {
  id: string;
  label: string;
  value: number;                    // Count or percentage
  color?: string;                   // Tailwind color class
  percentage?: number;              // Auto-calculated if not provided
}

interface SegmentedProgressBarProps {
  segments: ProgressSegment[];
  showLabels?: boolean;
  showValues?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}
```

**Visual spec (from prototype Pipeline stages):**
- Segments fill proportionally
- Labels above or below segments
- Values shown as Newsreader numerals

**Design tokens:**
- `--surface-3` for track
- Segment colors from status config
- `--radius-pill` for pill shape

---

### 3.8 MetricCard

**Location:** `packages/ui/src/components/metric-card.tsx`

KPI display component following design-system-v6.md Section 7.2.

```typescript
interface MetricCardProps {
  label: string;
  value: number | string;
  unit?: string;
  delta?: {
    value: number;
    direction: 'up' | 'down' | 'flat';
    period?: string;               // "vs last week"
  };
  trend?: number[];                // Sparkline data
  icon?: React.ComponentType<{ className?: string }>;
  actions?: CardActionMenuItem[];
  loading?: boolean;
  className?: string;
}
```

**Design tokens:**
- `--num-card` for main value (Newsreader serif)
- `--type-small` for label
- `--type-tiny` for delta
- Sparkline hidden at rest, `--motion-reveal` on hover
- Action menu hidden at rest

---

### 3.9 RelativeTimestamp

**Location:** `packages/ui/src/components/relative-timestamp.tsx`

Timestamp display with hover tooltip showing full date.

```typescript
interface RelativeTimestampProps {
  timestamp: string | Date;
  prefix?: string;                  // "Updated", "Created", etc.
  className?: string;
  mono?: boolean;                   // Use mono font
}
```

**Renders as:**
```html
<span title="April 29, 2026, 2:34 PM">
  <span class="text-muted-foreground">Updated</span>
  <span class="font-mono">2h ago</span>
</span>
```

**Design tokens:**
- `--font-mono` for time value
- `--text-3` for prefix
- `--type-tiny` or `--type-small` depending on context

---

## 4. Typography Components

### 4.1 Type Primitives

**Location:** `packages/ui/src/components/typography.tsx`

```typescript
// Page title (one per page)
export const PageTitle: React.FC<{ children: React.ReactNode }>;
// Newsreader, --type-h1, letter-spacing -0.024em

// Section title
export const SectionTitle: React.FC<{ children: React.ReactNode }>;
// Geist, --type-h2

// Card title
export const CardTitle: React.FC<{ children: React.ReactNode }>;
// Geist, --type-h3, font-weight 500

// Eyebrow label
export const Eyebrow: React.FC<{ children: React.ReactNode }>;
// 12px, uppercase, 0.1em tracking, --text-3

// Small caps
export const SmallCaps: React.FC<{ children: React.ReactNode }>;
// 12px, font-variant-caps: all-small-caps, 0.04em tracking

// Mono text
export const Mono: React.FC<{ children: React.ReactNode }>;
// Geist Mono, tabular-nums lining-nums
```

### 4.2 Numeral Primitives

**Location:** `packages/ui/src/components/numerals.tsx`

```typescript
// Editorial moment numeral
export const NumMega: React.FC<NumProps>;
// --num-mega (58-80px), Newsreader, tabular-nums

// Hero KPI numeral
export const NumHero: React.FC<NumProps>;
// --num-hero (38-46px)

// Card KPI numeral
export const NumCard: React.FC<NumProps>;
// --num-card (36-44px)

// Row/table numeral
export const NumRow: React.FC<NumProps>;
// --num-row (20-26px)

interface NumProps {
  value: number | string;
  unit?: string;
  className?: string;
}
```

---

## 5. Storybook Stories

Each component requires a Storybook story file:

```
packages/ui/src/stories/
  progress-bar.stories.tsx
  checklist.stories.tsx
  pipeline-stage-card.stories.tsx
  kanban.stories.tsx
  today-feed-item.stories.tsx
  entity-card.stories.tsx
  step-wizard.stories.tsx
  segmented-progress-bar.stories.tsx
  metric-card.stories.tsx
  relative-timestamp.stories.tsx
  typography.stories.tsx
  numerals.stories.tsx
  card-action-menu.stories.tsx
  step-indicator.stories.tsx
```

**Story requirements:**
- Default story with realistic props
- All variants documented
- Interactive controls for props
- Accessibility annotations
- Design token usage in docs

---

## 6. Test Coverage

### 6.1 Unit Tests

```
packages/ui/src/__tests__/
  progress-bar.test.tsx
  checklist.test.tsx
  pipeline-stage-card.test.tsx
  kanban.test.tsx
  today-feed-item.test.tsx
  entity-card.test.tsx
  step-wizard.test.tsx
  segmented-progress-bar.test.tsx
  metric-card.test.tsx
  relative-timestamp.test.tsx
  card-action-menu.test.tsx
  step-indicator.test.tsx
  format-time.test.ts
  status-config.test.ts
```

**Test requirements:**
- Render without errors
- Props affect output correctly
- Variants render differently
- Accessibility attributes present
- Event handlers fire
- Edge cases (empty, max values, etc.)

### 6.2 Coverage Target

80%+ line coverage across:
- Component files
- Utility functions
- Type exports validated

---

## 7. Task Breakdown

### Phase 0A: Tokens Foundation (Day 1)

| Task | File | Est. |
|------|------|------|
| Create CSS tokens file | `packages/ui/src/lib/tokens.css` | 1h |
| Create TS tokens export | `packages/ui/src/lib/tokens.ts` | 30m |
| Extend Tailwind config | `apps/web/tailwind.config.ts` | 1h |
| Add font loading | `apps/web/src/app/layout.tsx` | 30m |
| Verify tokens in dev | manual check | 30m |

### Phase 0B: Extraction Tasks (Day 1-2)

| Task | Source | Target | Est. |
|------|--------|--------|------|
| Extract ProgressBar | GoalCard.tsx | packages/ui | 1h |
| Consolidate status-config | 4 files | packages/ui/lib | 2h |
| Extract formatRelativeTime | ActivityFeed.tsx | packages/ui/lib | 30m |
| Extract CardActionMenu | ProspectCard.tsx | packages/ui | 1h |
| Extract StepIndicator | GettingStartedCard.tsx | packages/ui | 30m |
| Update imports in apps/web | multiple | - | 2h |

### Phase 0C: New Primitives (Day 2-3)

| Task | Complexity | Est. |
|------|------------|------|
| Checklist + ChecklistItem | Medium | 2h |
| PipelineStageCard | Medium | 2h |
| KanbanColumn + KanbanCard | High | 4h |
| TodayFeedItem | Low | 1h |
| EntityCard | Medium | 2h |
| StepWizard | High | 4h |
| SegmentedProgressBar | Medium | 2h |
| MetricCard | Medium | 2h |
| RelativeTimestamp | Low | 30m |
| Typography primitives | Low | 1h |
| Numeral primitives | Low | 1h |

### Phase 0D: Stories & Tests (Day 3-4)

| Task | Count | Est. |
|------|-------|------|
| Storybook stories | 14 | 4h |
| Unit tests | 14 | 4h |
| Integration tests | 3 | 2h |
| Coverage verification | - | 1h |

---

## 8. Validation Checklist

Before marking Phase 0 complete:

### Design System Compliance

- [ ] All components use design tokens, no hardcoded values
- [ ] No `border: 1px solid` on cards (use shadow system)
- [ ] All text >= 12px (WCAG floor)
- [ ] Body text is 14px
- [ ] Hover states use `--motion-hover` (280ms)
- [ ] Transitions specify properties, never `transition: all`
- [ ] No `transform: scale()` on hover (use translateY)
- [ ] Cards lift 1px + shadow-lift on hover
- [ ] Small caps use `font-variant-caps`, not `text-transform`
- [ ] One chromatic accent only (emerald)
- [ ] `prefers-reduced-motion` honored

### Accessibility

- [ ] All interactive elements keyboard-accessible
- [ ] ARIA attributes on custom controls
- [ ] Focus rings visible
- [ ] Color contrast meets WCAG AA

### Code Quality

- [ ] TypeScript strict mode passes
- [ ] ESLint clean
- [ ] Prettier formatted
- [ ] 80%+ test coverage
- [ ] No console.log statements

### Documentation

- [ ] Storybook stories for each component
- [ ] Props documented with JSDoc
- [ ] Usage examples in stories
- [ ] Token usage documented

---

## 9. Dependencies

**npm packages to add:**

```json
{
  "@radix-ui/react-tooltip": "^1.x",    // For RelativeTimestamp
  "class-variance-authority": "^0.7",   // For variant management
  "tailwind-merge": "^2.x"              // Already likely present
}
```

**Internal dependencies:**

- `packages/ui` must be built before `apps/web`
- Storybook requires build step for component imports

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Token mismatch between CSS and Tailwind | High | Generate from single source |
| Breaking existing components | High | Run full test suite before/after |
| Font loading performance | Medium | Use `next/font` with display swap |
| Storybook setup complexity | Low | Use existing setup from package |
| Design drift during implementation | Medium | Reference prototype constantly |

---

## 11. Success Criteria

Phase 0 is complete when:

1. All 14 components implemented in `packages/ui`
2. All components exported from package index
3. Design tokens CSS file added and Tailwind extended
4. Fonts loading correctly via `next/font`
5. 14 Storybook stories viewable
6. 80%+ test coverage verified
7. `apps/web` successfully imports and uses components
8. No design system violations in code review

---

## Sprint 5: Missing v6/v7 Components (12h)

> **Source:** [design-system-v6.md](./design-system-v6.md), [v7-master-design-architecture.md](./v7-master-design-architecture.md)
> **Rationale:** Journey audits revealed 14 components specified in v6/v7 but not in Phase 0. Without these, developers improvise and break consistency.

### 5.1 Data Display Components

#### TierBreakdownTable
**Purpose:** Display audit findings grouped by severity tier (1-4) with visual severity indicators
**Location:** `packages/ui/src/components/tier-breakdown-table.tsx`
**Reference:** design-system-v6.md Section 14.6

```typescript
interface TierBreakdownTableProps {
  findings: Finding[];
  onTierClick?: (tier: number) => void;
  onFindingClick?: (finding: Finding) => void;
  showSeverityDots?: boolean;         // Visual tier indicator
  className?: string;
}

interface Finding {
  id: string;
  tier: 1 | 2 | 3 | 4;
  title: string;
  count: number;
  url?: string;
}
```

**v6 Tokens:**
- `--shadow-card` for table container
- `--font-mono` for counts (tabular-nums lining-nums)
- `--hairline-2` for row separators
- `--surface-2` for hover state
- Tier colors: `--error` (tier 1), `--warning` (tier 2), `--info` (tier 3), `--text-3` (tier 4)

**Visual spec:**
- Grid layout with tier column, issue column, count column, action column
- SeverityDots component inline (see 5.1.7)
- Hover reveals `->` arrow with `--motion-reveal`

---

#### ConnectionStatusCard
**Purpose:** Display integration connection status (GSC, GA4, CMS, etc.) with health indicator
**Location:** `packages/ui/src/components/connection-status-card.tsx`
**Reference:** v7-master-design-architecture.md "Connection Health Dashboard"

```typescript
interface ConnectionStatusCardProps {
  service: 'gsc' | 'ga4' | 'gbp' | 'wordpress' | 'shopify' | 'custom';
  status: 'connected' | 'disconnected' | 'error' | 'expiring' | 'syncing';
  lastSync?: Date | string;
  expiresAt?: Date | string;
  account?: string;                   // e.g., "user@gmail.com"
  property?: string;                  // e.g., "acmecorp.com"
  onConnect?: () => void;
  onDisconnect?: () => void;
  onRefresh?: () => void;
  className?: string;
}
```

**v6 Tokens:**
- `--shadow-card` at rest, `--shadow-lift` on hover
- `--radius-card` (12px)
- Status dot: `--success` (connected), `--error` (error/disconnected), `--warning` (expiring), pulse for syncing
- `--font-mono` for timestamps
- `--type-tiny` (12px) for "Last sync" label
- `--type-small` (13px) for account/property

**Visual spec:**
- Service icon (24x24) + service name + status pill
- Last sync timestamp with RelativeTimestamp component
- Warning banner for expiring tokens (< 7 days)
- Ghost button for actions

---

#### DropCausesPanel
**Purpose:** Display potential causes for ranking drops with correlation data
**Location:** `packages/ui/src/components/drop-causes-panel.tsx`
**Reference:** v7-master-design-architecture.md "Pattern C: Drop -> Investigation -> Action"

```typescript
interface DropCausesPanelProps {
  keyword: string;
  currentPosition: number;
  previousPosition: number;
  dropDate: Date | string;
  causes: DropCause[];
  onCauseClick?: (cause: DropCause) => void;
  onAuditClick?: () => void;
  className?: string;
}

interface DropCause {
  id: string;
  type: 'technical' | 'content' | 'backlink' | 'serp_change' | 'competitor';
  title: string;
  confidence: number;                 // 0-100
  evidence?: string;
  actionLabel?: string;
  actionUrl?: string;
}
```

**v6 Tokens:**
- `--surface-2` for panel background
- `--error-soft` background for the drop indicator header
- `--font-display` for position numerals
- `--hairline-2` for separating causes
- Confidence bar uses `--accent` for high confidence, `--warning` for medium, `--text-4` for low

**Visual spec:**
- Header: keyword + position change (e.g., "Position #12 from #4")
- List of causes with confidence bar, evidence snippet, action link
- Footer CTA: "Run full audit on this page"

---

#### ReportPreviewCard
**Purpose:** Preview card for generated/scheduled reports
**Location:** `packages/ui/src/components/report-preview-card.tsx`
**Reference:** v7-master-design-architecture.md "Journey -> Component Mapping Table"

```typescript
interface ReportPreviewCardProps {
  id: string;
  title: string;
  type: 'seo' | 'performance' | 'content' | 'custom';
  status: 'draft' | 'generating' | 'ready' | 'sent' | 'scheduled';
  createdAt: Date | string;
  scheduledFor?: Date | string;
  recipient?: string;
  sections?: string[];
  onView?: () => void;
  onDownload?: () => void;
  onSend?: () => void;
  onEdit?: () => void;
  className?: string;
}
```

**v6 Tokens:**
- `--shadow-card`, `--shadow-lift` on hover
- `--type-h3` for title
- `--type-tiny` for type badge and meta
- Status pill uses StatusConfig from status-config.ts
- `--accent` for primary action button

**Visual spec:**
- Type icon + title + status pill header
- Section list (collapsed, show count)
- Footer: created date + actions (View, Download, Send)
- Generating state shows progress indicator

---

### 5.2 Visualization Components

#### HealthGauge
**Purpose:** SVG arc gauge showing site health score (0-100)
**Location:** `packages/ui/src/components/health-gauge.tsx`
**Reference:** design-system-v6.md Section 10.3

```typescript
interface HealthGaugeProps {
  score: number;                      // 0-100
  grade?: string;                     // "A", "B+", etc. - auto-calculated if not provided
  size?: 'sm' | 'md' | 'lg';          // 64px, 96px, 128px
  showGrade?: boolean;
  className?: string;
}
```

**v6 Tokens:**
- `--surface-3` (#F2F1EB) for track stroke
- `--accent` (#0F4F3D) for score arc
- `--font-display` for center numeral
- Grade uses italic Newsreader beside numeral

**SVG Implementation:**
```html
<svg viewBox="0 0 96 96">
  <circle cx="48" cy="48" r="38" fill="none" stroke="var(--surface-3)" stroke-width="7"/>
  <circle cx="48" cy="48" r="38" fill="none" stroke="var(--accent)" stroke-width="7" 
    stroke-linecap="round" stroke-dasharray="{score * 239 / 100} 239" pathLength="239"
    transform="rotate(-90 48 48)"/>
</svg>
```

**Accessibility:**
- `role="img"` with `aria-label="Health score: {score}%"`

---

#### OpsStrip
**Purpose:** System status bar showing integration health and pending operations
**Location:** `packages/ui/src/components/ops-strip.tsx`
**Reference:** design-system-v6.md Section 14.6, v7 "Show What You're Doing"

```typescript
interface OpsStripProps {
  items: OpsStripItem[];
  expandable?: boolean;
  className?: string;
}

interface OpsStripItem {
  id: string;
  type: 'system' | 'gsc' | 'dataforseo' | 'queue' | 'custom';
  label: string;
  value?: string | number;
  status: 'ok' | 'warning' | 'error' | 'syncing';
  lastSync?: Date | string;
  onClick?: () => void;
}
```

**v6 Tokens:**
- `--canvas-dim` background
- `--hairline` top border
- `--type-tiny` (12px) for all text
- `--font-mono` for timestamps/values
- Status dots: `--success` (ok), `--warning`, `--error`, pulse animation for syncing

**Visual spec:**
- Horizontal strip at page bottom
- Items separated by `--text-4` dots
- Click expands to show detailed status/logs
- Pattern: `[dot] Label [value]` or `[dot] Label [time]m ago`

---

#### SeverityDots
**Purpose:** Visual severity indicator using 1-5 filled dots
**Location:** `packages/ui/src/components/severity-dots.tsx`
**Reference:** design-system-v6.md Section 14.6

```typescript
interface SeverityDotsProps {
  count: number;                      // 1-5 (beyond 5, show numeric)
  maxDots?: number;                   // Default 5
  tier?: 1 | 2 | 3 | 4;               // For tier-based coloring
  size?: 'sm' | 'md';                 // 4px, 6px dot size
  className?: string;
}
```

**v6 Tokens:**
- Tier 1 (Critical): `--error`
- Tier 2 (Warning): `--warning`
- Tier 3 (Info): `--info`
- Tier 4 (Low): `--text-4`
- Inactive dot: `--hairline`

**Visual spec:**
- 5 dots max per cell, spaced 4px apart
- Beyond 5: show numeral instead (e.g., "12")
- Filled dots = count, empty dots = remaining

---

#### VelocityStrip
**Purpose:** Two-cell display showing 7-day and 30-day velocity metrics
**Location:** `packages/ui/src/components/velocity-strip.tsx`
**Reference:** design-system-v6.md Section 14.3

```typescript
interface VelocityStripProps {
  velocity7d: number;
  velocity30d: number;
  unit?: string;                      // "keywords", "clicks", etc.
  showTrend?: boolean;
  className?: string;
}
```

**v6 Tokens:**
- 2px left border: `--accent` for first cell, `--text-4` for second
- `--type-tiny` uppercase label (e.g., "7-DAY")
- `.num` class for values (tabular-nums)
- Italic `em` for unit anchors

**Visual spec:**
- Two-column grid with hairline divider
- Each cell: tiny label + value with inline numeral styling
- Positive values get `--success` tint, negative get `--error` tint

---

### 5.3 Navigation & Input Components

#### PeriodSelector
**Purpose:** Pill button group for time period selection (7D/30D/90D/1Y)
**Location:** `packages/ui/src/components/period-selector.tsx`
**Reference:** design-system-v6.md Section 14.2

```typescript
interface PeriodSelectorProps {
  value: '7d' | '30d' | '90d' | '1y' | 'custom';
  onChange: (period: string) => void;
  customRange?: { start: Date; end: Date };
  onCustomClick?: () => void;
  disabled?: boolean;
  className?: string;
}
```

**v6 Tokens:**
- Container: 3px padding, `--surface` background, `--shadow-card`
- Buttons: `--type-body` (14px), font-weight 500
- Active: `--accent-soft` background, `--accent-ink` text
- Inactive hover: `--surface-2` background
- `--radius-button` (8px) for container, `--radius-input` (6px) for buttons

**Visual spec:**
- Horizontal pill with 4 options
- Active button has subtle background shift
- Optional "Custom" opens date picker

---

#### CommandPalette
**Purpose:** Cmd+K global search and navigation
**Location:** `packages/ui/src/components/command-palette.tsx`
**Reference:** v7-master-design-architecture.md "Cmd+K command palette"

```typescript
interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: CommandItem) => void;
  recentItems?: CommandItem[];
  className?: string;
}

interface CommandItem {
  id: string;
  type: 'page' | 'client' | 'action' | 'keyword' | 'article';
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  shortcut?: string[];                // ["G", "O"] for "Go to Overview"
  onSelect: () => void;
}
```

**v6 Tokens:**
- Modal backdrop: `rgba(20, 20, 26, 0.4)` with `backdrop-filter: blur(4px)`
- `--radius-modal` (14px) for container
- `--shadow-pop` for modal
- `--type-body` for item titles
- `--type-small` for subtitles
- `--surface-2` for hover state
- `--accent-soft` for selected item

**Accessibility:**
- `role="combobox"` with `aria-expanded`
- `role="listbox"` for results
- Arrow key navigation
- Escape to close

---

#### KeyboardShortcutHint
**Purpose:** Inline kbd chip showing keyboard shortcuts
**Location:** `packages/ui/src/components/keyboard-shortcut-hint.tsx`
**Reference:** design-system-v6.md Section 5.5

```typescript
interface KeyboardShortcutHintProps {
  keys: string[];                     // ["Cmd", "K"] or ["G", "O"]
  variant?: 'default' | 'inverted';   // For use on dark backgrounds
  size?: 'sm' | 'md';
  className?: string;
}
```

**v6 Tokens:**
- `--font-mono` at `--type-tiny` (12px)
- `--surface-2` background
- `--hairline` as box-shadow border (0 0 0 1px)
- `--radius-input` (6px) but often 4px for small chips
- Inverted: `rgba(255,255,255,0.14)` background for use on accent buttons

**Visual spec:**
- Keys shown as `<kbd>Cmd</kbd> <kbd>K</kbd>` with 4px gap
- Often hidden at rest, revealed on hover (see hover-to-reveal pattern)

---

### 5.4 Badge & Pill Components

#### GhostButton
**Purpose:** Transparent button with subtle border for secondary actions
**Location:** `packages/ui/src/components/ghost-button.tsx`
**Reference:** design-system-v6.md Section 5.3

```typescript
interface GhostButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md' | 'lg';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  loading?: boolean;
}
```

**v6 Tokens:**
- `background: transparent`
- `border: 1px solid var(--hairline)`
- `--radius-input` (6px)
- `padding: 5px 10px`
- `--type-tiny` (12px), `--text-2`
- Hover: `--surface-2` background, `--text-4` border, `--text-1` color

---

#### IntentBadge
**Purpose:** Keyword search intent indicator (Commercial, Informational, etc.)
**Location:** `packages/ui/src/components/intent-badge.tsx`
**Reference:** design-system-v6.md Section 6.3

```typescript
interface IntentBadgeProps {
  intent: 'commercial' | 'informational' | 'transactional' | 'navigational';
  size?: 'sm' | 'md';
  className?: string;
}
```

**v6 Tokens:**
- Pill-shaped (`--radius-pill`)
- Commercial: `--accent-soft` / `--accent`
- Informational: `--info-soft` / `--info`
- Transactional: `--warning-soft` / `--warning`
- Navigational: `--surface-2` / `--text-2`
- `--type-tiny` (12px), `font-variant-caps: all-small-caps`

---

#### CountBadge
**Purpose:** Numeric count badge for tabs and navigation items
**Location:** `packages/ui/src/components/count-badge.tsx`
**Reference:** design-system-v6.md Section 6.4

```typescript
interface CountBadgeProps {
  count: number;
  max?: number;                       // Show "99+" if exceeded
  variant?: 'default' | 'active';     // Active for selected tabs
  size?: 'sm' | 'md';
  className?: string;
}
```

**v6 Tokens:**
- `--type-tiny` (12px)
- Default: `--surface-2` background, `--text-3` color
- Active: `--accent-soft` background, `--accent` color
- `--radius-pill`
- `font-variant-numeric: tabular-nums lining-nums`
- Padding: `1px 7px`

---

## Sprint 6: UX State Components (8h)

> **Rationale:** Every data view needs empty, error, and loading states. Without these, users see confusing blank screens or broken layouts. These are NOT optional - they're required for production quality.

### 6.1 EmptyState

**Purpose:** Shown when a data view has no items to display
**Location:** `packages/ui/src/components/empty-state.tsx`
**Reference:** v7-master-design-architecture.md "Layer 3: Empty State Variants"

```typescript
interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  variant?: 'default' | 'search' | 'first-time' | 'filtered';
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'ghost';
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}
```

**v6 Tokens:**
- Icon: 48px size, `--text-3` color (subtle)
- Title: `--font-display` (Newsreader), `--type-h3`, `--text-1`
- Description: `--type-body`, `--text-2`, max-width 320px
- Layout: Centered, `--space-6` gap between elements
- Action button follows button system

**Variants:**
- `default`: Generic empty state
- `search`: "No results for [query]" with clear filter action
- `first-time`: Onboarding prompt with illustrated icon
- `filtered`: "No items match your filters" with reset action

**Usage contexts (from v7):**
| Context | Title | Description | Action |
|---------|-------|-------------|--------|
| Client List | "No clients yet" | "Add your first client to start..." | "Create your first client" |
| Goal Hero | "No goal set" | "Set a goal to track..." | "Set a goal" |
| Keywords Table | "No keywords tracked" | "Run intelligence to discover..." | "Run intelligence" |
| Articles List | "No articles yet" | "Create content to publish..." | "Create your first article" |
| Today Feed | "Nothing yet today" | "Activity will appear here as..." | (no action) |
| Audit Findings | "No issues found" | "Your site passed all checks..." | "Run new audit" |

---

### 6.2 ErrorState

**Purpose:** Shown when data fetch or operation fails
**Location:** `packages/ui/src/components/error-state.tsx`
**Reference:** v7-master-design-architecture.md "Layer 4: Error State Variants"

```typescript
interface ErrorStateProps {
  variant: 'inline' | 'card' | 'fullPage';
  title?: string;
  message: string;
  errorCode?: string;                 // For debugging reference
  retryLabel?: string;
  onRetry?: () => void;
  reportLabel?: string;
  onReport?: () => void;
  className?: string;
}
```

**v6 Tokens:**
- Inline variant:
  - `--error-soft` (#F4E6E6) background
  - `--error` (#9B2C2C) text color
  - `1px solid rgba(155, 44, 44, 0.2)` border
  - `--radius-input` (6px)
- Card variant:
  - Replaces card content
  - `--surface` background with error icon
  - Alert triangle icon in `--error`
- Full page variant:
  - Centered in viewport
  - Larger icon (64px)
  - Additional "Go back" or "Go home" links

**Behavior:**
- Inline: Shows in-place without disrupting layout
- Card: Replaces card content, maintains card dimensions
- Full page: Route-level error boundary

**Error message rules:**
- Never expose internal error details to users
- Provide actionable message when possible
- Include error code for support reference

---

### 6.3 LoadingSkeleton

**Purpose:** Placeholder animation while data loads
**Location:** `packages/ui/src/components/loading-skeleton.tsx`
**Reference:** v7-master-design-architecture.md "Layer 5: Progress State Variants"

```typescript
interface LoadingSkeletonProps {
  variant: 'text' | 'card' | 'table' | 'chart' | 'avatar' | 'button';
  lines?: number;                     // For text variant
  rows?: number;                      // For table variant
  width?: string | number;
  height?: string | number;
  className?: string;
}
```

**v6 Tokens:**
- Background: `--surface-3` (#F2F1EB)
- Animation: opacity transition 0.5 -> 1 using `--ease-smooth`
- `--radius-card` for card variant
- `--radius-input` for text lines

**CRITICAL RULE:** Never use Tailwind's `animate-pulse` - it violates the design system's motion principles. Use CSS opacity transition instead:

```css
@keyframes skeleton-shimmer {
  0% { opacity: 0.5; }
  50% { opacity: 1; }
  100% { opacity: 0.5; }
}

.skeleton {
  background: var(--surface-3);
  animation: skeleton-shimmer 1.5s var(--ease-smooth) infinite;
}

@media (prefers-reduced-motion: reduce) {
  .skeleton {
    animation: none;
    opacity: 0.7;
  }
}
```

**Variants:**
- `text`: Single or multiple lines with varying widths
- `card`: Full card placeholder with header/body regions
- `table`: Row placeholders matching table structure
- `chart`: Rectangle with chart-like proportions
- `avatar`: Circle placeholder (40px default)
- `button`: Rounded rectangle matching button dimensions

---

### 6.4 DataStateWrapper

**Purpose:** Convenience wrapper that handles loading, error, and empty states
**Location:** `packages/ui/src/components/data-state-wrapper.tsx`

```typescript
interface DataStateWrapperProps<T> {
  data: T | undefined | null;
  isLoading: boolean;
  isError: boolean;
  error?: Error | string;
  isEmpty?: (data: T) => boolean;     // Custom emptiness check
  loadingComponent?: React.ReactNode;
  errorComponent?: React.ReactNode;
  emptyComponent?: React.ReactNode;
  children: (data: T) => React.ReactNode;
}
```

**Usage example:**
```tsx
<DataStateWrapper
  data={keywords}
  isLoading={isLoading}
  isError={isError}
  error={error}
  isEmpty={(data) => data.length === 0}
  loadingComponent={<LoadingSkeleton variant="table" rows={5} />}
  emptyComponent={
    <EmptyState
      icon={Search}
      title="No keywords tracked"
      action={{ label: "Run intelligence", onClick: runIntelligence }}
    />
  }
>
  {(data) => <KeywordsTable keywords={data} />}
</DataStateWrapper>
```

---

## Sprint 7: Accessibility Foundation (6h)

> **Compliance:** WCAG 2.1 AA minimum
> **Rationale:** Accessibility is not optional. Users with disabilities must be able to use all features. These foundations enable accessible component development.

### 7.1 Motion Preferences CSS

**Purpose:** Respect user's OS-level motion preferences
**Location:** `packages/ui/src/lib/tokens.css` (add to existing file)

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**Implementation notes:**
- Add to globals.css or tokens.css
- Affects ALL animations and transitions
- Skeleton loading falls back to static opacity
- Hover lifts become instant
- Page transitions become instant

**Testing:**
- macOS: System Preferences > Accessibility > Display > Reduce motion
- Windows: Settings > Ease of Access > Display > Show animations
- Chrome DevTools: Rendering > Emulate CSS media feature prefers-reduced-motion

---

### 7.2 FocusTrap Component

**Purpose:** Keep keyboard focus inside modals, dialogs, and drawers
**Location:** `packages/ui/src/components/focus-trap.tsx`

```typescript
interface FocusTrapProps {
  active: boolean;
  onEscape?: () => void;
  initialFocus?: React.RefObject<HTMLElement>;
  returnFocus?: boolean;              // Return focus to trigger on close
  children: React.ReactNode;
}
```

**Behavior:**
- When active, Tab cycles within trapped area only
- Shift+Tab cycles in reverse
- Escape calls onEscape (typically closes modal)
- Focus moves to first focusable element (or initialFocus ref) when activated
- Focus returns to trigger element when deactivated (if returnFocus=true)

**Implementation:**
```tsx
// Uses @radix-ui/react-focus-scope under the hood
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

**Dependencies:**
- Add `@radix-ui/react-focus-scope` to packages/ui

---

### 7.3 SkipToMain Link

**Purpose:** Allow keyboard users to skip repetitive navigation
**Location:** `packages/ui/src/components/skip-to-main.tsx`

```typescript
interface SkipToMainProps {
  targetId?: string;                  // Default "main-content"
  label?: string;                     // Default "Skip to main content"
}
```

**v6 Tokens:**
- `sr-only` by default (visually hidden)
- On focus: `--accent` background, white text, fixed top-left position
- `--radius-button` (8px)
- `--shadow-pop` for visibility
- `z-index: 9999` to appear above all content

**Implementation:**
```tsx
export function SkipToMain({ targetId = 'main-content', label = 'Skip to main content' }: SkipToMainProps) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:bg-accent focus:text-white focus:px-4 focus:py-2 focus:rounded-button focus:shadow-pop"
    >
      {label}
    </a>
  );
}
```

**Integration:**
- Add as first element in `apps/web/src/app/layout.tsx`
- Add `id="main-content"` to main content container
- Add `tabIndex={-1}` to main content for focus management

---

### 7.4 Keyboard Navigation Patterns

**Purpose:** Consistent keyboard interaction across all interactive components
**Location:** `packages/ui/src/lib/keyboard-patterns.ts`

```typescript
export const KeyboardPatterns = {
  LISTBOX: {
    ArrowDown: 'next',
    ArrowUp: 'previous',
    Enter: 'select',
    Space: 'select',
    Escape: 'close',
    Home: 'first',
    End: 'last',
  },
  MENU: {
    ArrowDown: 'next',
    ArrowUp: 'previous',
    ArrowRight: 'expand',
    ArrowLeft: 'collapse',
    Enter: 'select',
    Escape: 'close',
  },
  TABS: {
    ArrowLeft: 'previous',
    ArrowRight: 'next',
    Home: 'first',
    End: 'last',
  },
  DIALOG: {
    Escape: 'close',
    Tab: 'cycle',
  },
};

export function useKeyboardNavigation(
  pattern: keyof typeof KeyboardPatterns,
  handlers: Record<string, () => void>
): React.KeyboardEventHandler;
```

**Focus Visible:**
Add `data-focus-visible-added` attribute for keyboard-only focus rings:

```css
/* Show focus ring only for keyboard navigation */
:focus:not(:focus-visible) {
  outline: none;
}

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* Alternative using data attribute */
[data-focus-visible-added]:focus {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

**Implementation per component type:**

| Component | Focus Pattern | Keyboard Navigation |
|-----------|--------------|---------------------|
| CommandPalette | First item on open | LISTBOX pattern |
| CardActionMenu | Trigger button | MENU pattern |
| Tabs (kw-tab) | Active tab | TABS pattern |
| StepWizard | Current step input | Tab to navigate |
| Kanban | Selected card | Arrow keys in column |
| PeriodSelector | Active button | Arrow keys |

---

### 7.5 ARIA Live Regions

**Purpose:** Announce dynamic content changes to screen readers
**Location:** `packages/ui/src/components/aria-live.tsx`

```typescript
interface AriaLiveProps {
  children: React.ReactNode;
  mode?: 'polite' | 'assertive';      // Default 'polite'
  atomic?: boolean;                   // Announce entire region
  relevant?: 'additions' | 'removals' | 'text' | 'all';
}
```

**Usage contexts:**
- Form validation errors (assertive)
- Toast notifications (polite)
- Loading state changes (polite)
- Real-time data updates like Today feed (polite)

```tsx
// Example: Loading state announcement
<AriaLive mode="polite">
  {isLoading ? 'Loading keywords...' : `Loaded ${keywords.length} keywords`}
</AriaLive>
```

---

## Sprint 8: Additional v7 Overlays (4h)

> **Source:** v7-master-design-architecture.md "Layer 2: Overlay Components"
> **Note:** These are critical for journey completion but not covered in Sprints 1-4

### 8.1 OvernightBanner

**Purpose:** Morning summary showing what happened while user was away
**Location:** `packages/ui/src/components/overnight-banner.tsx`
**Reference:** v7 "Overnight Summary Banner"

```typescript
interface OvernightBannerProps {
  summary: {
    keywordChanges: number;
    newArticles: number;
    auditFindings: number;
    alertsTriggered: number;
  };
  since: Date | string;
  onDismiss: () => void;
  onViewDetails: () => void;
  className?: string;
}
```

**v6 Tokens:**
- `--accent-soft` background strip
- `--accent-ink` text
- `--type-body` for summary
- Dismiss uses GhostButton
- "View details" uses link styling

---

### 8.2 VoiceComplianceIndicator

**Purpose:** Show voice/brand compliance status on articles
**Location:** `packages/ui/src/components/voice-compliance-indicator.tsx`

```typescript
interface VoiceComplianceIndicatorProps {
  score: number;                      // 0-100
  violations?: string[];
  onViewDetails?: () => void;
  compact?: boolean;
  className?: string;
}
```

**v6 Tokens:**
- Compact: Small pill with score
- Expanded: Score + violation list
- `--success` for 80+, `--warning` for 60-79, `--error` for <60

---

## Updated Estimates

### Sprint Summary

| Sprint | Focus | Hours |
|--------|-------|-------|
| Sprint 0A | Tokens Foundation | 3.5h |
| Sprint 0B | Extraction Tasks | 7h |
| Sprint 0C | New Primitives | 21.5h |
| Sprint 0D | Stories & Tests | 11h |
| **Sprint 5** | **Missing v6/v7 Components** | **12h** |
| **Sprint 6** | **UX State Components** | **8h** |
| **Sprint 7** | **Accessibility Foundation** | **6h** |
| **Sprint 8** | **Additional v7 Overlays** | **4h** |
| **Total** | | **73h (~9 days)** |

### Component Count

| Category | Count |
|----------|-------|
| Extracted components | 5 |
| New primitives (Sprint 0C) | 11 |
| v6/v7 components (Sprint 5) | 14 |
| UX state components (Sprint 6) | 4 |
| Accessibility (Sprint 7) | 5 |
| Additional overlays (Sprint 8) | 2 |
| **Total components** | **41** |

---

*Created: 2026-04-29*
*Updated: 2026-04-30*
*Phase: 0 (Foundation)*
*Blocks: All subsequent UI phases*
