# Phase 94: Design System v6 Migration - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning
**Source:** UI-REDESIGN-AUDIT.md (5 Opus subagent analysis)

<domain>
## Phase Boundary

Transform the TeveroSEO agency UI from "functional SaaS" to "$100M-software polish" by implementing design-system-v6 across all components. This includes:

- Token layer updates (shadows, colors, typography)
- Component primitive rewrites (card, button, badge)
- Feature component redesigns (pipeline, quality score, keywords, calendar)
- Portal polish pass

**Not in scope:** Backend changes, API modifications, new features
</domain>

<decisions>
## Implementation Decisions

### Typography
- Newsreader serif for display numerals (metrics, scores, KPIs)
- Geist sans for UI text
- Geist Mono for data/keywords
- `font-variant-numeric: tabular-nums lining-nums` for numeric alignment

### Color System
- Warm-shifted grays: #14141A, #54545A, #93939A, #C4C3BB (not Tailwind slate)
- Semantic colors with soft backgrounds (success-soft, error-soft, warning-soft)
- Accent: #0F4F3D with accent-soft: #EAF1ED

### Shadow System
- Ghost-edge shadows replace `border: 1px solid`
- `--shadow-card` with inset highlight for depth
- `--shadow-lift` on hover for interactivity
- `--shadow-cta` for buttons

### Interaction Patterns
- Hover-to-reveal for secondary actions
- 280ms transition with ease-smooth curve
- Expandable details with tree structure (`├─`, `└─`)
- Static dots (no pulsing animations)

### Component Patterns
- Progress block: Big serif number / smaller target
- Status pill: small-caps, 0.06em tracking, semantic color
- Semantic-tinted icons: 26×26px, 6px radius, soft background
- One editorial moment per card (single hero metric)

### Claude's Discretion
- Exact component file structure
- CSS-in-JS vs CSS modules vs Tailwind approach
- Animation timing adjustments within v6 constraints
- Component API design (props, variants)
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design System
- `.planning/design/design-system-v6.md` — Complete v6 specification
- `.planning/design/prototypes/client-hub-v6.html` — Reference implementation with all CSS

### Audit & Analysis
- `.planning/design/UI-REDESIGN-AUDIT.md` — Comprehensive findings, redesign specs, migration checklist

### Phase Plan
- `.planning/phases/94-design-system-v6/94-MASTER.md` — Task breakdown and dependencies
</canonical_refs>

<specifics>
## Specific Requirements

### Must implement these v6 patterns:

1. **Ghost-edge shadows** (no `border: 1px solid`):
```css
--shadow-card: 
  0 0 0 1px rgba(20, 20, 26, 0.045),
  0 1px 2px rgba(20, 20, 26, 0.03),
  inset 0 1px 0 rgba(255, 255, 255, 0.5);
```

2. **Progress block pattern**:
```
100 / 100   (Newsreader, 58-80px / 38px)
  ▲      ▲
 mega   muted
```

3. **Status pill pattern**:
```css
font-variant-caps: all-small-caps;
letter-spacing: 0.06em;
```

4. **Expandable "under the hood" details**:
```
├─ Detail line 1
├─ Detail line 2
└─ Final detail
```

### Files to create/modify (from 94-MASTER.md):
- `packages/ui/src/lib/tokens.css`
- `packages/ui/src/components/card.tsx`
- `packages/ui/src/components/button.tsx`
- `packages/ui/src/components/badge.tsx`
- `packages/ui/src/components/progress-block.tsx` (new)
- `apps/web/src/app/layout.tsx` (fonts)
- Article pipeline components
- Quality score components
- Keyword table components
- Content calendar components (new)
- Portal components
</specifics>

<deferred>
## Deferred Ideas

- Dark mode implementation
- Mobile-specific optimizations
- Animation library integration
- Design tokens JSON export
</deferred>

---

*Phase: 94-design-system-v6*
*Context gathered: 2026-05-06 from UI-REDESIGN-AUDIT.md*
