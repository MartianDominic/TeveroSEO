# Phase 94: Design System v6 Migration

**Goal**: Transform agency UI from "functional SaaS" to "$100M-software polish" by implementing design-system-v6 across all components.

**Depends on**: None (can run parallel with other phases)

**Milestone**: v9.2 Premium Agency Experience

**Estimated effort**: 20-25 hours

**Reference docs**:
- `.planning/design/design-system-v6.md` — Design system specification
- `.planning/design/prototypes/client-hub-v6.html` — Reference implementation
- `.planning/design/UI-REDESIGN-AUDIT.md` — Comprehensive audit findings

---

## Success Criteria

1. All cards use `--shadow-card` ghost-edge shadows (no `border: 1px solid`)
2. Typography uses Newsreader (display numerals) + Geist (UI) + Geist Mono (data)
3. All KPI numbers use progress block pattern with serif mega numerals
4. Hover-to-reveal pattern implemented for secondary actions
5. Status pills use small-caps with semantic colors
6. Article pipeline shows expandable "under the hood" details
7. Quality score card shows expandable check details
8. Warm-shifted grays (#14141A, #54545A, #93939A, #C4C3BB) replace Tailwind slate

---

## Task Breakdown

### T1: Tokens Layer (P0) — 2-3 hours
**File**: `packages/ui/src/lib/tokens.css`

- [ ] Add missing `--shadow-card` with inset highlight
- [ ] Add `--shadow-cta` and `--shadow-cta-hover`
- [ ] Add type role classes (`.t-page-title`, `.t-eyebrow`, `.t-mono`, `.t-smallcaps`)
- [ ] Add numeric display classes (`.num-mega`, `.num-card`, `.num-hero`)
- [ ] Verify warm-shifted gray ramp (`--text-1` through `--text-4`)
- [ ] Add motion tokens (`--motion-hover`, `--motion-reveal`, `--ease-smooth`)

**Verification**: `grep -E "shadow-card|num-mega|text-4" packages/ui/src/lib/tokens.css` returns all tokens

---

### T2: Font Loading (P2) — 1 hour
**File**: `apps/web/src/app/layout.tsx`

- [ ] Add Newsreader font (Google Fonts)
- [ ] Add Geist font (already likely present)
- [ ] Add Geist Mono font
- [ ] Set CSS variables `--font-display`, `--font-sans`, `--font-mono`
- [ ] Verify fonts load on page

**Verification**: DevTools shows Newsreader rendering for `.num-mega` elements

---

### T3: Card Primitive (P1) — 3-4 hours
**File**: `packages/ui/src/components/card.tsx`

- [ ] Remove `border` class, use `shadow-[--shadow-card]`
- [ ] Add hover lift effect (`shadow-[--shadow-lift]`, `translateY(-1px)`)
- [ ] Add transition with `--motion-hover` timing
- [ ] Update `border-radius` to `--radius-card` (12px)
- [ ] Test across all card usages

**Verification**: Visual inspection shows no hard borders on any cards

---

### T4: Button & Badge Primitives (P1) — 2 hours
**Files**: 
- `packages/ui/src/components/button.tsx`
- `packages/ui/src/components/badge.tsx`

- [ ] Button: Add v6 shadow variants, semantic colors
- [ ] Badge/StatusPill: Add small-caps, 0.06em tracking
- [ ] Badge: Semantic color mapping (success, warning, error, info, accent)
- [ ] Remove uppercase, use `font-variant-caps: all-small-caps`

**Verification**: Status pills render with small-caps, no hard borders

---

### T5: Progress Block Component (P3) — 2 hours
**File**: `packages/ui/src/components/progress-block.tsx` (new)

- [ ] Create ProgressBlock component with mega numeral + target
- [ ] Support slash divider pattern (`100 / 100`)
- [ ] Add progress bar variant
- [ ] Add unit label (small-caps below number)
- [ ] Responsive sizing via container queries

**Verification**: Component renders with Newsreader serif numerals

---

### T6: Article Pipeline Card (P3) — 4 hours
**Files**: 
- `apps/web/src/components/pipeline/ArticlePipelineCard.tsx` (new or existing)
- `apps/web/src/components/pipeline/PipelineStep.tsx` (new)

- [ ] Progress block header (steps completed / total)
- [ ] Step rows with semantic icon backgrounds
- [ ] Active step with accent-soft background + ring
- [ ] Hover-to-reveal duration
- [ ] Expandable details with tree structure (`├─`, `└─`)
- [ ] Status pill for current state

**Verification**: Pipeline shows expandable details per step

---

### T7: Quality Score Card (P3) — 3 hours
**Files**:
- `apps/web/src/components/quality/QualityScoreCard.tsx` (new or existing)
- `apps/web/src/components/quality/QualityCheckRow.tsx` (new)

- [ ] Mega numeral score display
- [ ] Grade badge (A+, A, B, etc.)
- [ ] Expandable check rows
- [ ] Tree structure details (word breakdown, keyword distribution, etc.)
- [ ] Semantic success/warning icons per check

**Verification**: Each quality check expands to show detailed breakdown

---

### T8: Keyword Table (P4) — 3 hours
**File**: `apps/web/src/components/keywords/KeywordTable.tsx` or similar

- [ ] Tab navigation with sliding underline
- [ ] Volume cell with Newsreader serif + relative bar
- [ ] Difficulty badge with semantic colors
- [ ] Intent badge with v6 styling
- [ ] Hover-to-reveal queue button
- [ ] Priority indicator bar (left edge)

**Verification**: Table renders with v6 typography and hover patterns

---

### T9: Content Calendar (P4) — 4 hours
**Files**:
- `apps/web/src/components/calendar/ContentCalendar.tsx` (new)
- `apps/web/src/components/calendar/CalendarViews.tsx` (new)

- [ ] Month view (Notion-style grid)
- [ ] Week view (Linear roadmap-style)
- [ ] List view (Superhuman-style)
- [ ] Article status dot system (published, scheduled, draft, overdue)
- [ ] Pipeline progress inline visualization

**Verification**: All three calendar views render with correct status indicators

---

### T10: Portal Components Update (P5) — 2 hours
**Files**:
- `apps/web/src/components/portal/GoalProgressCard.tsx`
- `apps/web/src/components/portal/ClusterCard.tsx`
- Other portal components

- [ ] Apply progress block pattern to GoalProgressCard
- [ ] Update tier colors to v6 semantic colors
- [ ] Add hover-to-reveal for secondary metrics
- [ ] Verify warm gray text colors

**Verification**: Portal dashboard matches v6 aesthetic

---

## Execution Order

```
T1 (tokens) ─┬─► T3 (card) ─┬─► T6 (pipeline)
             │              │
             ├─► T4 (btn)   ├─► T7 (quality)
             │              │
             └─► T2 (fonts) ├─► T8 (keywords)
                            │
                            ├─► T9 (calendar)
                            │
                            └─► T10 (portal)
                                    │
                                    ▼
                              T5 (progress-block)
                              [can be built alongside T6-T7]
```

T1 is the foundation — all other tasks depend on tokens being in place.

---

## Plans

- [ ] `94-01-PLAN.md` — Foundation: Tokens + Fonts (T1, T2)
- [ ] `94-02-PLAN.md` — Primitives: Card + Button + Badge (T3, T4, T5)
- [ ] `94-03-PLAN.md` — Pipeline & Quality: Article Pipeline + Quality Score (T6, T7)
- [ ] `94-04-PLAN.md` — Data Views: Keywords + Calendar (T8, T9)
- [ ] `94-05-PLAN.md` — Portal Polish: Component updates (T10)

---

## Anti-Patterns to Avoid

| Tell | Fix |
|------|-----|
| Inter/system font | Geist + Newsreader |
| Tailwind slate grays | Warm-shifted text ramp |
| `border: 1px solid` | Ghost-edge shadows |
| All info visible | Hover-to-reveal |
| Generic green checks | Semantic-tinted icons |
| Pulsing dots | Static with soft halo |
| `text-transform: uppercase` | `font-variant-caps: all-small-caps` |

---

*Phase created: 2026-05-06*
*Source: UI-REDESIGN-AUDIT.md (5 Opus subagent analysis)*
