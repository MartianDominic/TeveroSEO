# Phase 44 - UI Review

**Audited:** 2026-04-30
**Baseline:** design-system-v6.md + 44-UI-SPEC.md
**Screenshots:** not captured (no dev server)

---

## Pillar Scores

| Pillar | Score | Status | Key Finding |
|--------|-------|--------|-------------|
| 1. Typography | 3/4 | PARTIAL | v6 tokens well implemented but 9 instances of sub-12px text (WCAG violation) |
| 2. Color | 4/4 | PASS | Accent #0F4F3D properly reserved; 99 text-text-N usages; no hardcoded hex |
| 3. Spacing | 4/4 | PASS | space-1 through space-9 correctly applied with clamp() |
| 4. Shadows | 4/4 | PASS | shadow-card/lift/pop/cta system used; ghost-edge shadows replace borders |
| 5. Radii | 4/4 | PASS | radius-input/button/card/modal/pill tokens applied correctly |
| 6. Accessibility | 3/4 | PARTIAL | ARIA attributes present; focus states exist; reduced motion honored; missing FocusTrap integration |

**Overall: 22/24**

---

## Top 3 Priority Fixes

1. **Sub-12px text violations** - 9 instances of text-[10px] and text-[11px] fail WCAG minimum - Change to var(--type-tiny) (12px) minimum
2. **Legacy shadcn components not updated** - button.tsx, card.tsx, dialog.tsx, input.tsx, badge.tsx use old patterns - Migrate to v6 tokens (shadow-card, radius-card, text-text-N)
3. **transition-all anti-pattern** - 13 occurrences of `transition-all` instead of specifying properties - Replace with specific property transitions (box-shadow, transform, opacity)

---

## Detailed Findings

### Pillar 1: Typography (3/4)

**PARTIAL - v6 tokens well implemented but WCAG violations exist**

**Passing:**
- Typography primitives (typography.tsx) correctly implement all v6 type roles
- Numeral primitives (numerals.tsx) use font-display with tabular-nums lining-nums
- PageTitle, SectionTitle, Eyebrow, SmallCaps, Body, Caption all use var(--type-*) tokens
- Letter-spacing values match spec (-0.024em for display, +0.1em for uppercase)
- Line heights correct (1.05 for h1, 1.55 for body)

**Failing - Sub-12px text (WCAG violation):**
```
today-feed-item.tsx:165       text-[11px]
ops-strip.tsx:158             text-[11px]
ops-strip.tsx:228             text-[11px]
severity-dots.tsx:76          text-[11px]
keyboard-shortcut-hint.tsx:90 text-[11px]
health-gauge.tsx:36           text-[11px]
step-indicator.tsx:48         text-[10px]
velocity-strip.tsx:83         text-[11px]
drop-causes-panel.tsx:180     text-[11px]
drop-causes-panel.tsx:186     text-[11px]
```

**Impact:** Screen readers and users on small displays cannot read 10-11px text. WCAG minimum is 12px.

**Fix:** Replace all text-[10px] and text-[11px] with text-[length:var(--type-tiny)] (12px).

---

### Pillar 2: Color (4/4)

**PASS - v6 color system fully implemented**

**Token file compliance:**
- tokens.css defines all v6 colors correctly:
  - Canvas ladder: #FAFAF7, #F5F4EE
  - Surface ladder: #FFFFFF, #F8F8F3, #F2F1EB
  - Text ramp: #14141A, #54545A, #93939A, #C4C3BB
  - Accent: #0F4F3D, #1A6E55, #EAF1ED, #093528
  - Semantic: success, error, warning, info with -soft variants

**Accent usage (reserved properly):**
- Primary CTA buttons: bg-accent, hover:bg-accent-2 (empty-state.tsx, error-state.tsx)
- Focus rings: ring-accent (multiple components)
- Selection states: ring-2 ring-accent (entity-card.tsx)
- Progress fills: var(--accent) (health-gauge.tsx, progress-bar.tsx)
- Active states: bg-accent-soft text-accent (count-badge.tsx, period-selector.tsx)

**Text color usage:** 99 instances of text-text-1/2/3/4 - excellent adoption.

**No hardcoded hex colors found** in component source files.

---

### Pillar 3: Spacing (4/4)

**PASS - Fluid spacing scale correctly applied**

**Token definitions verified:**
```css
--space-1: 4px (fixed)
--space-2: 8px (fixed)
--space-3: clamp(10px, 0.85vw, 13px)
--space-4: clamp(12px, 1.05vw, 16px)
--space-5: clamp(16px, 1.4vw, 22px)
--space-6: clamp(20px, 1.8vw, 28px)
--space-7: clamp(28px, 2.4vw, 38px)
--space-8: clamp(36px, 3.4vw, 52px)
--space-9: clamp(48px, 4.8vw, 72px)
```

**Usage patterns (correct):**
- Card padding: p-[var(--space-5)] (metric-card.tsx, entity-card.tsx)
- Section spacing: py-[var(--space-8)] px-[var(--space-6)] (empty-state.tsx)
- Gap spacing: gap-[var(--space-4)] (entity-card.tsx)
- Step wizard: py-[var(--space-6)], pt-[var(--space-5)] (step-wizard.tsx)

---

### Pillar 4: Shadows (4/4)

**PASS - Ghost-edge shadow system correctly implemented**

**Token definitions verified:**
```css
--shadow-card: 0 1px 2px rgba(20,20,26,0.04), 0 2px 4px rgba(20,20,26,0.02), 0 0 0 1px var(--hairline-3)
--shadow-lift: 0 2px 8px rgba(20,20,26,0.08), 0 4px 16px rgba(20,20,26,0.04), 0 0 0 1px var(--hairline-2)
--shadow-pop: 0 4px 12px rgba(20,20,26,0.12), 0 8px 24px rgba(20,20,26,0.08)
--shadow-cta: 0 1px 2px rgba(15,79,61,0.24), 0 2px 4px rgba(15,79,61,0.12)
```

**Usage patterns (correct):**
- Cards at rest: shadow-card (metric-card.tsx, entity-card.tsx, kanban.tsx)
- Card hover: hover:shadow-lift hover:-translate-y-px (metric-card.tsx:133, entity-card.tsx:63)
- Popover menus: shadow-pop (card-action-menu.tsx:71)
- Skip link on focus: focus:shadow-pop (skip-to-main.tsx:58)

**Note:** Some legacy shadcn components (card.tsx) still use shadow-sm instead of shadow-card. See Priority Fix #2.

---

### Pillar 5: Radii (4/4)

**PASS - Radius tokens correctly applied**

**Token definitions verified:**
```css
--radius-input: 6px
--radius-button: 8px
--radius-card: 12px
--radius-modal: 14px
--radius-pill: 999px
```

**Usage patterns (correct):**
- Cards: rounded-[var(--radius-card)] (metric-card.tsx, entity-card.tsx, step-wizard.tsx)
- Buttons: rounded-[var(--radius-button)] (card-action-menu.tsx, period-selector.tsx)
- Pills/badges: rounded-[var(--radius-pill)] (count-badge.tsx, segmented-progress-bar.tsx)
- Inputs: rounded-[var(--radius-input)] (loading-skeleton.tsx, error-state.tsx)
- Skip link: focus:rounded-button (skip-to-main.tsx)

---

### Pillar 6: Accessibility (3/4)

**PARTIAL - Good foundation but gaps remain**

**Passing:**

*ARIA Attributes (25+ occurrences):*
- role="progressbar" with aria-valuenow/min/max (progress-bar.tsx, segmented-progress-bar.tsx)
- role="img" with aria-label (health-gauge.tsx)
- role="alert" for errors (error-state.tsx)
- role="status" with aria-live (aria-live.tsx)
- role="listbox" with aria-label (kanban.tsx)
- role="menu" with aria-haspopup (card-action-menu.tsx)
- role="menuitem" for menu items (card-action-menu.tsx)

*Focus States (26+ occurrences):*
- focus-visible:outline-none focus-visible:ring-2 pattern used throughout
- focus:ring-accent for v6 accent color rings
- Focus ring offset present for visibility

*Reduced Motion:*
- tokens.css: @media (prefers-reduced-motion: reduce) disables animations
- loading-skeleton.tsx: motion-reduce:animate-none motion-reduce:opacity-70

*Accessibility Components:*
- AriaLive component for screen reader announcements
- SkipToMain component for keyboard navigation
- FocusTrap component for modal focus management

**Partial/Missing:**

1. **FocusTrap not integrated** - FocusTrap component exists but Dialog/Sheet don't use it (rely on Radix primitives)
2. **Button component lacks v6 focus ring** - Uses focus-visible:ring-ring instead of ring-accent
3. **Some interactive elements missing role** - EntityCard with onClick should always have role="button"
4. **Input components not updated** - input.tsx, textarea.tsx use legacy patterns without v6 tokens

---

## Motion Anti-Patterns

**transition-all usage (anti-pattern per v6 spec):**

13 occurrences found. Spec says "Never use transition: all. Specify properties."

```
metric-card.tsx:132      transition-all duration-[280ms]
metric-card.tsx:211      transition-all duration-[240ms]
entity-card.tsx:61       transition-all duration-[280ms]
kanban.tsx:206           transition-all duration-[280ms]
segmented-progress-bar:108 transition-all duration-[280ms]
step-wizard.tsx:75       transition-all duration-[280ms]
pipeline-stage-card:139  transition-all duration-[280ms]
health-gauge.tsx:144     transition-all duration-500
progress-bar.tsx:24      transition-all duration-300
skip-to-main.tsx:62      transition-all duration-[160ms]
tabs.tsx:32              transition-all (shadcn default)
drop-causes-panel:197    transition-all
pipeline-stage-card:90   transition-all duration-[160ms]
```

**Fix:** Replace with specific properties:
- Card hover: `transition-[box-shadow,transform] duration-[280ms]`
- Opacity reveal: `transition-opacity duration-[240ms]`

**Duration compliance:**
- Most components use correct durations: 160ms (fast), 240ms (reveal), 280ms (hover)
- Exception: health-gauge.tsx uses 500ms (exceeds 320ms max per spec)

---

## Legacy shadcn Components Not Updated

The following components still use shadcn default patterns instead of v6 tokens:

| Component | Issues |
|-----------|--------|
| button.tsx | Uses ring-ring instead of ring-accent; no v6 shadow |
| card.tsx | Uses border instead of shadow-card; uses p-6 instead of space tokens |
| dialog.tsx | No v6 radius (--radius-modal); uses foreground instead of text-1 |
| input.tsx | Uses border-input; no v6 radius or shadow |
| badge.tsx | Uses px-2.5 py-0.5 instead of space tokens; no v6 colors |
| tabs.tsx | Uses transition-all; shadow-sm instead of shadow system |
| select.tsx | Uses border-input; focus:bg-accent from wrong palette |
| sheet.tsx | Uses ring-ring; no v6 tokens |

These components work but don't match the v6 design system polish. Recommend migration in Phase 45.

---

## Registry Safety

**Registry audit:** No third-party registries declared in 44-UI-SPEC.md.

All 56 components use shadcn official primitives (Radix UI) or are custom-built. No flags.

---

## Files Audited

**Token Files:**
- packages/ui/src/lib/tokens.css (168 lines)
- apps/web/src/app/globals.css (134 lines)

**Component Files (56 total):**
- packages/ui/src/components/typography.tsx
- packages/ui/src/components/numerals.tsx
- packages/ui/src/components/button.tsx
- packages/ui/src/components/card.tsx
- packages/ui/src/components/metric-card.tsx
- packages/ui/src/components/entity-card.tsx
- packages/ui/src/components/health-gauge.tsx
- packages/ui/src/components/empty-state.tsx
- packages/ui/src/components/error-state.tsx
- packages/ui/src/components/progress-bar.tsx
- packages/ui/src/components/focus-trap.tsx
- packages/ui/src/components/skip-to-main.tsx
- packages/ui/src/components/aria-live.tsx
- packages/ui/src/components/dialog.tsx
- packages/ui/src/components/input.tsx
- packages/ui/src/components/badge.tsx
- (and 40 additional components scanned via grep patterns)

---

## Recommendations

### High Priority (address before production)

1. **Fix sub-12px text** - Replace all text-[10px] and text-[11px] with var(--type-tiny)
2. **Replace transition-all** - Use specific property transitions per v6 spec
3. **Fix health-gauge duration** - Reduce 500ms to 280ms (within 320ms max)

### Medium Priority (address in Phase 45)

4. **Migrate legacy shadcn components** - Update button, card, dialog, input, badge, tabs, select, sheet to v6 tokens
5. **Integrate FocusTrap** - Use FocusTrap component in Dialog and Sheet
6. **Add missing ARIA** - Ensure all clickable elements have role="button"

### Low Priority (polish)

7. **Standardize focus rings** - Use ring-accent consistently instead of ring-ring
8. **Add keyboard patterns** - Document LISTBOX, MENU, TABS, DIALOG patterns
