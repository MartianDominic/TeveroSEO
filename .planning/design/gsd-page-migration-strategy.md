# GSD Plan: Design System v6 Page Migration

> **Objective:** Systematically migrate all existing pages in `apps/web` to be fully compliant with design-system-v6.
>
> **Prerequisites:** Phase 44 (Design System Foundation) must be complete — tokens layer, Tailwind config, font loading, shell components, card primitives, and type primitives must exist before page migration begins.
>
> **Reference docs:**
> - `.planning/design/design-system-v6.md` — The specification
> - `.planning/design/design-decisions-and-rationale.md` — Anti-patterns and rationale

---

## 1. V6 Compliance Checklist (Per-Page Audit Rubric)

A page is "v6 compliant" when ALL of the following are true. Score each item 0 (missing), 1 (partial), or 2 (complete). **Minimum passing score: 36/40 (90%).**

### 1.1 Surface & Shadow (10 points)

| # | Item | Points | How to verify |
|---|------|--------|---------------|
| 1 | Cards use `--shadow-card` (ghost-edge), not `border: 1px solid` | 2 | Search for `border:` on Card components — should only find internal hairlines |
| 2 | Cards lift on hover via `translateY(-1px)` + `--shadow-lift` | 2 | Hover test in browser, inspect computed styles |
| 3 | Canvas uses `--canvas` (#FAFAF7), cards use `--surface` (#FFFFFF) | 2 | Check background-color on body and cards |
| 4 | Hairlines use transparent rgba (`--hairline`, `--hairline-2`, `--hairline-3`) | 2 | Search for `border-color` — should use variables |
| 5 | Primary CTA uses gradient + `--shadow-cta` | 2 | Inspect primary buttons |

### 1.2 Typography (10 points)

| # | Item | Points | How to verify |
|---|------|--------|---------------|
| 6 | No text below 12px (WCAG floor) | 2 | Inspect smallest text elements |
| 7 | Body text is 14px (`--type-body`) | 2 | Check default paragraph/table cell font-size |
| 8 | Display numerals use Newsreader with tabular-nums | 2 | Check KPI numerals, hero numbers |
| 9 | Eyebrows/labels use `font-variant-caps: all-small-caps`, not `text-transform: uppercase` | 2 | Search for `uppercase` — should not find |
| 10 | Page title uses Newsreader serif (`--font-display`) | 2 | Check page header `<h1>` font-family |

### 1.3 Motion & Interaction (8 points)

| # | Item | Points | How to verify |
|---|------|--------|---------------|
| 11 | Hover transitions use `--ease-smooth` or `--ease-quick`, never `linear` | 2 | Search for `transition:` — no `linear` |
| 12 | All transitions specify properties, never `all` | 2 | Search for `transition: all` — should not find |
| 13 | Transitions are 160-280ms (never > 320ms) | 2 | Check transition-duration values |
| 14 | Hover reveals are opacity + translateX, not just opacity | 2 | Test sparklines, action arrows |

### 1.4 Layout & Responsiveness (6 points)

| # | Item | Points | How to verify |
|---|------|--------|---------------|
| 15 | Card-internal grids use container queries, not viewport media queries | 2 | Check `@container` vs `@media` usage |
| 16 | Tables use CSS Grid pattern, not `<table>` or flex rows | 2 | Inspect table components |
| 17 | Spacing uses fluid `clamp()` tokens | 2 | Check padding/margin values |

### 1.5 Accessibility (4 points)

| # | Item | Points | How to verify |
|---|------|--------|---------------|
| 18 | Focus rings use `--accent` color, not default browser | 2 | Tab through page, inspect focus styles |
| 19 | `prefers-reduced-motion` respected | 2 | Check for `@media (prefers-reduced-motion)` |

### 1.6 Color (2 points)

| # | Item | Points | How to verify |
|---|------|--------|---------------|
| 20 | No hardcoded colors — all use CSS variables | 2 | Search for `#` in color values |

---

## 2. Page Inventory & Complexity Classification

### 2.1 Page Categories

Based on the codebase audit, pages fall into four complexity tiers:

| Tier | Type | Characteristics | Example Pages |
|------|------|-----------------|---------------|
| **Simple** | List/Index | Single data table, minimal interactive elements, page header + table | `clients/page.tsx`, `prospects/page.tsx` |
| **Medium** | Form/Settings | Form fields, tabs, validation states, save/cancel actions | `settings/voice/page.tsx`, `settings/branding/page.tsx`, `settings/webhooks/page.tsx` |
| **Complex** | Dashboard | Multiple cards, KPIs, charts, data visualizations, right rail | `dashboard/page.tsx`, `clients/[clientId]/page.tsx` |
| **Interactive** | Builder/Editor | Rich interactions, drag-drop, live preview, multi-step flows | `articles/[articleId]/page.tsx`, `proposal/builder/page.tsx` |

### 2.2 Full Page Inventory (44 pages)

#### Tier 1: Simple (13 pages) — 2-4 hours each

| Page | Path | Priority | Notes |
|------|------|----------|-------|
| Home | `/` | P3 | Marketing/landing — may be out of scope |
| Sign In | `/sign-in` | P3 | Clerk-managed, limited customization |
| Sign Up | `/sign-up` | P3 | Clerk-managed, limited customization |
| Connect | `/connect/[token]` | P2 | OAuth flow page |
| Connect Success | `/connect/success` | P2 | Simple confirmation |
| Clients List | `/(shell)/clients` | P1 | Core navigation |
| Prospects List | `/(shell)/prospects` | P1 | Core navigation |
| Settings Index | `/(shell)/settings` | P2 | Settings hub |
| Reports List | `/(shell)/clients/[clientId]/reports` | P2 | Simple table |
| Alerts | `/(shell)/clients/[clientId]/alerts` | P2 | Alert list |
| SEO Projects | `/(shell)/clients/[clientId]/seo` | P2 | Project list |
| Keywords Quick Check | `/(shell)/prospects/keywords/quick-check` | P3 | Single-purpose tool |
| Keywords Import | `/(shell)/prospects/[prospectId]/keywords/import` | P3 | Import flow |

#### Tier 2: Medium (14 pages) — 4-8 hours each

| Page | Path | Priority | Notes |
|------|------|----------|-------|
| Voice Settings | `/(shell)/clients/[clientId]/settings/voice` | P1 | Complex form with tabs |
| Branding Settings | `/(shell)/clients/[clientId]/settings/branding` | P2 | Image upload, color pickers |
| Report Settings | `/(shell)/clients/[clientId]/settings/reports` | P2 | Schedule configuration |
| Webhook Settings | `/(shell)/clients/[clientId]/settings/webhooks` | P2 | CRUD forms |
| Client Settings | `/(shell)/clients/[clientId]/settings` | P2 | Settings hub with sections |
| Connections | `/(shell)/clients/[clientId]/connections` | P1 | OAuth integration cards |
| Calendar | `/(shell)/clients/[clientId]/calendar` | P2 | Calendar widget + event forms |
| Changes | `/(shell)/clients/[clientId]/changes` | P2 | Change log with filters |
| Report Detail | `/(shell)/clients/[clientId]/reports/[reportId]` | P2 | Report viewer |
| Prospect Detail | `/(shell)/prospects/[prospectId]` | P1 | Prospect overview |
| Prospect Keywords | `/(shell)/prospects/[prospectId]/keywords` | P2 | Keyword list with actions |
| Competitor Spy | `/(shell)/prospects/keywords/competitor-spy` | P2 | Analysis tool |
| SEO Domain | `/(shell)/clients/[clientId]/seo/[projectId]/domain` | P2 | Domain settings |
| SEO Links | `/(shell)/clients/[clientId]/seo/[projectId]/links` | P2 | Link management |

#### Tier 3: Complex (12 pages) — 8-16 hours each

| Page | Path | Priority | Notes |
|------|------|----------|-------|
| Agency Dashboard | `/(shell)/dashboard` | P0 | Primary landing — set the standard |
| Client Overview | `/(shell)/clients/[clientId]` | P0 | Goal hero, KPIs, charts — flagship |
| Analytics | `/(shell)/clients/[clientId]/analytics` | P1 | Charts, data viz |
| Intelligence | `/(shell)/clients/[clientId]/intelligence` | P1 | AI insights cards |
| Articles List | `/(shell)/clients/[clientId]/articles` | P1 | Content pipeline with status |
| SEO Audit | `/(shell)/clients/[clientId]/seo/[projectId]/audit` | P1 | Finding tiers, severity dots |
| SEO Backlinks | `/(shell)/clients/[clientId]/seo/[projectId]/backlinks` | P1 | Link metrics table |
| SEO Keywords | `/(shell)/clients/[clientId]/seo/[projectId]/keywords` | P1 | Keyword tracking table |
| Keyword Mapping | `/(shell)/clients/[clientId]/seo/[projectId]/keyword-mapping` | P2 | Content-keyword matrix |
| Audit Page Detail | `/(shell)/clients/[clientId]/seo/[projectId]/audit/[pageId]` | P2 | Single-page audit findings |
| Audit Issue Detail | `/(shell)/clients/[clientId]/seo/[projectId]/audit/issues/[resultId]` | P2 | Issue remediation |
| Keyword Detail | `/(shell)/clients/[clientId]/seo/[projectId]/keywords/[keywordId]` | P2 | Keyword history, SERP |

#### Tier 4: Interactive (5 pages) — 16-24 hours each

| Page | Path | Priority | Notes |
|------|------|----------|-------|
| Article Editor | `/(shell)/clients/[clientId]/articles/[articleId]` | P1 | Rich text editor, side panels |
| New Article | `/(shell)/clients/[clientId]/articles/new` | P1 | Creation flow |
| Proposal Builder | `/(shell)/prospects/[prospectId]/proposal/builder` | P2 | Multi-step builder |
| Proposal Preview | `/(shell)/prospects/[prospectId]/proposal/preview` | P2 | Print/export view |
| Prospects Keywords | `/(shell)/prospects/keywords` | P2 | Keyword research tool |

---

## 3. Migration Strategy

### 3.1 Approach: Component-First Migration

**Do NOT rewrite pages from scratch.** Instead:

1. **Foundation Layer** (Phase 44 prerequisite):
   - Create `apps/web/src/lib/design/tokens.css` with all v6 CSS variables
   - Update Tailwind config to map tokens
   - Add fonts to layout.tsx
   - Build shell primitives: `<AppShell>`, `<Sidebar>`, `<Rail>`, `<UtilityBar>`
   - Build card primitives: `<Card>`, `<CardHead>`, `<CardFoot>`
   - Build type primitives: `<PageTitle>`, `<NumMega>`, `<SectionTitle>`

2. **Shared Component Migration** (before pages):
   - Migrate `@tevero/ui` components to v6 tokens
   - Migrate dashboard components (KPI cards, tables, charts)
   - This ripples through all pages automatically

3. **Page Migration** (per-page):
   - Audit page against checklist
   - Replace inline styles with v6 tokens
   - Replace hardcoded colors with CSS variables
   - Add hover interactions and motion
   - Test at all breakpoints

### 3.2 Migration Order (Priority-Based)

**Wave 1 (P0) — Set the standard:**
1. Agency Dashboard (`/dashboard`)
2. Client Overview (`/clients/[clientId]`)

These two pages establish the pattern. All subsequent pages follow.

**Wave 2 (P1) — Core user journeys:**
3. Clients List (`/clients`)
4. Prospects List (`/prospects`)
5. Prospect Detail (`/prospects/[prospectId]`)
6. Connections (`/clients/[clientId]/connections`)
7. Voice Settings (`/clients/[clientId]/settings/voice`)
8. Articles List (`/clients/[clientId]/articles`)
9. Article Editor (`/clients/[clientId]/articles/[articleId]`)
10. Analytics (`/clients/[clientId]/analytics`)
11. Intelligence (`/clients/[clientId]/intelligence`)
12. SEO Audit (`/clients/[clientId]/seo/[projectId]/audit`)
13. SEO Backlinks (`/clients/[clientId]/seo/[projectId]/backlinks`)
14. SEO Keywords (`/clients/[clientId]/seo/[projectId]/keywords`)

**Wave 3 (P2) — Supporting pages:**
15-36. Remaining pages by complexity (Simple first, then Medium, then Complex)

**Wave 4 (P3) — Edge cases:**
37-44. Auth pages, marketing pages, minor tools

### 3.3 Incremental Migration Within a Page

For complex pages, migrate incrementally:

1. **Phase A: Tokens & Variables** (~20% of effort)
   - Replace all hardcoded colors with CSS variables
   - Replace `Inter` with `Geist`/`Newsreader`
   - Replace hardcoded spacing with `--space-*` tokens

2. **Phase B: Surface & Shadow** (~30% of effort)
   - Replace `border: 1px solid` with `--shadow-card`
   - Add hover lift animations
   - Update hairlines to transparent rgba

3. **Phase C: Typography** (~25% of effort)
   - Ensure 12px floor
   - Convert uppercase to small-caps
   - Apply proper figure styles (tabular vs oldstyle)
   - Add Newsreader to display numerals

4. **Phase D: Motion & Interaction** (~15% of effort)
   - Add hover-reveal patterns
   - Update transitions to proper curves
   - Add focus rings

5. **Phase E: Responsiveness** (~10% of effort)
   - Add container queries to cards
   - Test at all breakpoints
   - Add compact-height mode

---

## 4. Effort Estimates

### 4.1 Per-Page Estimates (Including Testing)

| Tier | Type | Effort | Includes |
|------|------|--------|----------|
| Simple | List/Index | 2-4 hours | Token replacement, table styling, basic interactions |
| Medium | Form/Settings | 4-8 hours | Form component styling, tabs, validation states, save flows |
| Complex | Dashboard | 8-16 hours | Multiple cards, KPIs, charts, rail content, container queries |
| Interactive | Builder/Editor | 16-24 hours | Rich interactions, state management, live preview, edge cases |

### 4.2 Total Migration Estimate

| Tier | Count | Hours/Page | Total Hours | Days (8h) |
|------|-------|------------|-------------|-----------|
| Simple | 13 | 3 avg | 39 | 5 |
| Medium | 14 | 6 avg | 84 | 10.5 |
| Complex | 12 | 12 avg | 144 | 18 |
| Interactive | 5 | 20 avg | 100 | 12.5 |
| **Total** | **44** | — | **367** | **46** |

**With 20% buffer for unforeseen issues: ~55 developer-days**

### 4.3 Shared Component Migration (Before Pages)

| Component Category | Effort | Notes |
|--------------------|--------|-------|
| Shell components | 16 hours | AppShell, Sidebar, Rail, UtilityBar |
| Card primitives | 8 hours | Card, CardHead, CardFoot |
| Type primitives | 4 hours | PageTitle, NumMega, etc. |
| Button system | 4 hours | btn, btn-primary, ghost-btn, icon-btn |
| Table components | 8 hours | Table head, rows, hover states, priority indicator |
| Form components | 12 hours | Inputs, selects, validation states |
| Dashboard components | 24 hours | KPI cards, charts, sparklines, status pills |
| **Total** | **76 hours** | **9.5 days** |

**Grand total: ~65 developer-days for complete migration**

---

## 5. Testing Strategy

### 5.1 Visual Regression Testing

Use Playwright with `expect(page).toHaveScreenshot()` for each page:

```typescript
// tests/visual/dashboard.spec.ts
test('dashboard matches v6 design', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveScreenshot('dashboard-1280.png', { maxDiffPixels: 100 });
});
```

**Capture snapshots at:**
- 1280px width (small desktop)
- 1440px width (standard desktop)
- 1920px width (large desktop)
- 2560px width (4K)
- 720px height (compact mode)

### 5.2 Checklist Audit Automation

Create a Playwright test that scores each page against the compliance checklist:

```typescript
// tests/audit/v6-compliance.spec.ts
test('page meets v6 compliance threshold', async ({ page }) => {
  const score = await auditPageV6Compliance(page);
  expect(score.total).toBeGreaterThanOrEqual(36); // 90% threshold
  expect(score.failures).toEqual([]); // Log specific failures
});
```

### 5.3 Manual QA Checklist

For each migrated page, verify:

- [ ] Hover lift on cards
- [ ] Sparkline reveal on KPI hover
- [ ] Action arrow reveal on table row hover
- [ ] Focus rings visible on tab navigation
- [ ] Text readable at 100% zoom
- [ ] No visual breakage at 1280/1440/1920/2560
- [ ] No visual breakage at max-height: 720px
- [ ] `prefers-reduced-motion` disables animations

---

## 6. Page Migration Ticket Template

Copy this template for each page migration ticket:

```markdown
# [PAGE-XXX] Migrate [Page Name] to Design System v6

## Page
- **Path:** `/(shell)/path/to/page`
- **Tier:** [Simple | Medium | Complex | Interactive]
- **Estimated effort:** X hours
- **Priority:** [P0 | P1 | P2 | P3]

## Prerequisites
- [ ] Phase 44 (Design System Foundation) complete
- [ ] Shared component migration complete: [list relevant components]

## Acceptance Criteria

### Surface & Shadow
- [ ] Cards use `--shadow-card`, not borders
- [ ] Cards lift on hover with `translateY(-1px)` + `--shadow-lift`
- [ ] Canvas is `--canvas`, cards are `--surface`
- [ ] Hairlines use transparent rgba variables
- [ ] Primary CTA uses gradient + `--shadow-cta`

### Typography
- [ ] No text below 12px
- [ ] Body text is 14px (`--type-body`)
- [ ] Display numerals use Newsreader with tabular-nums
- [ ] Eyebrows use `font-variant-caps: all-small-caps`
- [ ] Page title uses Newsreader serif

### Motion & Interaction
- [ ] Transitions use `--ease-smooth` or `--ease-quick`
- [ ] No `transition: all`
- [ ] Transitions are 160-280ms
- [ ] Hover reveals use opacity + translateX

### Layout & Responsiveness
- [ ] Card-internal grids use container queries
- [ ] Tables use CSS Grid
- [ ] Spacing uses fluid `clamp()` tokens

### Accessibility
- [ ] Focus rings use `--accent` color
- [ ] `prefers-reduced-motion` respected

### Color
- [ ] No hardcoded colors

## Testing
- [ ] Visual regression snapshots captured at 1280/1440/1920/2560
- [ ] Compact-height mode (720px) tested
- [ ] Manual QA checklist passed
- [ ] V6 compliance audit score >= 36/40

## Notes
[Any page-specific considerations, edge cases, or dependencies]
```

---

## 7. Anti-Patterns to Watch For (Per design-decisions-and-rationale.md)

During migration, actively search for and remove these patterns:

### Visual Anti-Patterns
- `border: 1px solid` on cards (replace with `--shadow-card`)
- `filter: drop-shadow` (use `box-shadow`)
- Tinted card backgrounds (use white on canvas)
- Dot grain / noise textures
- Multiple chromatic accents
- Pulsing animations on indicators
- `transform: scale()` on hover (use `translateY`)
- Hatched fills outside distribution bars

### Typography Anti-Patterns
- Inter / SF Pro font family (replace with Geist)
- Tailwind `slate` text ramp (replace with warmth-shifted)
- `text-transform: uppercase` on small text (use small-caps)
- Universal `line-height: 1.5` (use role-based)
- Lining figures in prose (use oldstyle)
- Decorative italic (italic is semantic only)
- Font sizes below 12px

### Layout Anti-Patterns
- `max-width` on main content column
- Fixed-pixel sidebar/rail widths (use `clamp()`)
- Viewport media queries for card internals (use container queries)
- Centered single-column layouts on wide viewports

### Interaction Anti-Patterns
- All secondary actions visible at rest
- `transition: all`
- `linear` easing
- Animations > 320ms
- No `prefers-reduced-motion` handling

---

## 8. Success Metrics

Migration is complete when:

1. **100% of pages score >= 36/40** on the V6 compliance audit
2. **Zero anti-patterns** found in codebase search
3. **Visual regression tests pass** at all breakpoints
4. **No accessibility violations** flagged by aXe/WAVE
5. **User feedback** confirms "world-class / SOTD" quality

---

## 9. Dependencies & Blockers

### Phase 44 (Foundation) Must Be Complete First
- [ ] `apps/web/src/lib/design/tokens.css` exists with all v6 variables
- [ ] Tailwind config maps tokens to utilities
- [ ] Fonts loaded in `layout.tsx`
- [ ] Shell components (`AppShell`, `Sidebar`, `Rail`) exist
- [ ] Card primitives (`Card`, `CardHead`, `CardFoot`) exist
- [ ] Type primitives (`PageTitle`, `NumMega`, etc.) exist

### External Dependencies
- Clerk auth pages have limited customization — may need custom wrapper
- `@tevero/ui` package components need migration before page-level migration

---

## 10. Rollout Plan

### Phase A: Foundation (Week 1)
- Complete Phase 44 foundation
- Migrate shared components
- Build visual regression test harness

### Phase B: Flagship Pages (Week 2)
- Migrate Wave 1 (P0): Dashboard, Client Overview
- Establish patterns and documentation

### Phase C: Core Journeys (Weeks 3-4)
- Migrate Wave 2 (P1): 12 pages
- Parallel track: Visual QA and bug fixes

### Phase D: Supporting Pages (Weeks 5-6)
- Migrate Wave 3 (P2): 22 pages
- Focus on efficiency — patterns established

### Phase E: Polish (Week 7)
- Migrate Wave 4 (P3): 8 pages
- Final QA pass
- Accessibility audit
- Performance audit

### Phase F: Ship (Week 8)
- Feature flag removal
- Production deployment
- Monitoring for regressions

---

*Last updated: 2026-04-29*
*Companion docs: `design-system-v6.md`, `design-decisions-and-rationale.md`*
