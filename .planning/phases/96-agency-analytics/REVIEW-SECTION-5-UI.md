## 5. UI/UX & Client Portal Review

> **Audit Date:** 2026-05-08
> **Reviewer:** Senior Frontend Engineer (Phase 96 Auditor)
> **Scope:** Phase 96 UI components, client portal UX, design system compliance

---

### 5.1 Component Inventory

| Component | Location | Purpose | Status |
|-----------|----------|---------|--------|
| **MasterDashboard** | `client/features/analytics/components/MasterDashboard.tsx` | Main analytics dashboard with KPI grid and site table | Implemented |
| **ClientPortalDashboard** | `client/features/analytics/components/ClientPortalDashboard.tsx` | White-label client-facing dashboard | Implemented |
| **KPICard** | `client/features/analytics/components/KPICard.tsx` | Individual metric cards | Implemented |
| **DateRangePicker** | `client/features/analytics/components/DateRangePicker.tsx` | Period selector with comparison toggle | Implemented |
| **SiteTable** | `client/features/analytics/components/SiteTable.tsx` | CSS Grid table with sparklines | Implemented |
| **SparklineChart** | `client/features/analytics/components/SparklineChart.tsx` | Recharts trend visualization | Implemented |
| **CtrBenchmarkChart** | `client/features/analytics/components/CtrBenchmarkChart.tsx` | CTR vs position comparison chart | Implemented |
| **BrandedSplitCard** | `client/features/analytics/components/BrandedSplitCard.tsx` | Branded vs non-branded traffic split | Implemented |
| **PortfolioMetrics** | `client/features/analytics/components/PortfolioMetrics.tsx` | Cross-client aggregate dashboard | Implemented |
| **ExportMenu** | `client/features/analytics/components/ExportMenu.tsx` | CSV/Google Sheets export dropdown | Implemented |
| **VisibilityConfigPanel** | `client/features/analytics/components/VisibilityConfigPanel.tsx` | Admin panel for client visibility settings | Implemented |
| **ReportScheduleModal** | `client/features/analytics/components/ReportScheduleModal.tsx` | Automated report schedule setup | Implemented |
| **TagFilter** | `client/features/analytics/components/TagFilter.tsx` | Multi-select tag filter dropdown | Implemented |
| **ContentGroupCard** | `components/analytics/ContentGroupCard.tsx` | Content group display with metrics | Implemented |
| **TopicClusterVisualization** | `components/analytics/TopicClusterVisualization.tsx` | Hub+spoke SVG visualization | Implemented |
| **IndexCoverageChart** | `components/analytics/IndexCoverageChart.tsx` | Index coverage stats visualization | Implemented |

**Missing Components (from review mission):**
| Component | Status | Notes |
|-----------|--------|-------|
| TrendChart (Growing/Decaying) | NOT FOUND | No dedicated component; trend data shown via SparklineChart |
| StrikingDistanceTable | NOT FOUND | Position 11-20 table not implemented as separate component |
| CannibalizationPanel | NOT FOUND | Keyword conflict UI not found |
| AnnotationTimeline | NOT FOUND | Algorithm update markers not implemented |
| GscPropertySelector | NOT FOUND | Property dropdown not found as standalone |
| MetricsOverviewCard | PARTIAL | KPICard serves this purpose |

---

### 5.2 Design System Compliance

#### 5.2.1 Typography Assessment

| Requirement | Spec (v6) | Actual Implementation | Compliance |
|-------------|-----------|----------------------|------------|
| **Display Font** | Newsreader | `font-display` class used | PARTIAL |
| **UI Font** | Geist | Inter fallback (`font-family: Inter, ui-sans-serif`) | NON-COMPLIANT |
| **12px Floor** | All text >= 12px | Most text >= 12px, some 11px instances | PARTIAL |
| **Body Size** | 14px | 13-14px used consistently | COMPLIANT |

**Findings:**

1. **Font Family Mismatch (CRITICAL):** The `app.css` specifies `font-family: Inter, ui-sans-serif, system-ui, sans-serif` as the body font (line 128). Design system v6 requires **Geist** as the primary sans-serif font. This is a significant deviation.
   - Location: `open-seo-main/src/client/styles/app.css:128`
   
2. **Newsreader Usage (PARTIAL):** Components like `KPICard.tsx`, `BrandedSplitCard.tsx`, and `PortfolioMetrics.tsx` correctly use `font-display` class for numeric values:
   ```tsx
   // KPICard.tsx:40
   <div className="font-display text-[clamp(36px,3vw,44px)] font-normal tracking-[-0.026em] tabular-nums lining-nums text-text-1">
   ```
   However, the `font-display` CSS variable is not defined in `app.css` - components reference it but the actual font declaration is missing.

3. **11px Text Found:** 
   - `CtrBenchmarkChart.tsx:244` - `text-[11px]` for benchmark comparison
   - `VisibilityConfigPanel.tsx:169` - `text-[11px]` for field descriptions
   - `PortfolioMetrics.tsx:219` - `text-[11px]` for change percentage
   - `ReportScheduleModal.tsx:199,264` - `text-[11px]` for helper text
   
   Per v6, minimum should be 12px for WCAG compliance.

#### 5.2.2 Color Token Assessment

| Token Category | v6 Spec | Implementation | Compliance |
|----------------|---------|----------------|------------|
| **Canvas** | `#FAFAF7` warm cream | HSL-based shadcn tokens | NON-COMPLIANT |
| **Surface** | `#FFFFFF` cards | `hsl(var(--card))` | PARTIAL |
| **Text Ramp** | `--text-1` to `--text-4` warm-shifted | Standard shadcn `foreground/muted` | NON-COMPLIANT |
| **Accent** | `#0F4F3D` forest green | `--primary: 234 75% 60%` (blue/purple) | NON-COMPLIANT |

**Findings:**

1. **Wrong Accent Color (CRITICAL):** Design system v6 specifies **forest green** (`#0F4F3D`) as the single chromatic accent. The current implementation uses a **blue/purple** primary (`234 75% 60%`).
   - Location: `open-seo-main/src/client/styles/app.css:14`

2. **Text Color Variables Missing:** Components reference v6 tokens (`text-text-1`, `text-text-3`, etc.) but these are not defined in the CSS. The actual CSS uses shadcn defaults (`foreground`, `muted-foreground`).

3. **Semantic Colors Present:** The implementation correctly includes success, warning, info, and destructive semantic colors.

#### 5.2.3 Shadow System Assessment

| Requirement | v6 Spec | Implementation | Compliance |
|-------------|---------|----------------|------------|
| **Card Shadow** | Ghost-edge layered shadows | Classes reference `shadow-card`, `shadow-lift` | MISSING DEFINITION |
| **No Hard Borders** | Cards use shadow not `border: 1px solid` | Mixed - some use borders | PARTIAL |

**Findings:**

1. **Shadow Variables Missing:** Components use `shadow-card`, `shadow-lift`, `shadow-pop` classes but these are not defined in `app.css`. The v6 shadow system (`--shadow-card`, `--shadow-lift`, etc.) is not implemented.

2. **Border Usage:** 
   - `ContentGroupCard.tsx:47`: Uses `border border-gray-200` (violates v6 no-border rule)
   - `TopicClusterVisualization.tsx:205`: Uses border for content gaps section
   - `IndexCoverageChart.tsx:144,188`: Uses borders on sections

#### 5.2.4 Motion Assessment

| Requirement | v6 Spec | Implementation | Compliance |
|-------------|---------|----------------|------------|
| **Ease Curve** | `cubic-bezier(0.16, 1, 0.3, 1)` | `transition-shadow`, `transition-colors` | PARTIAL |
| **Duration** | 160-280ms | Not explicitly controlled | UNKNOWN |
| **Hover Lift** | 1px translateY + shadow expansion | Not consistently implemented | PARTIAL |

**Findings:**

1. **Card Hover (PARTIAL):** `KPICard.tsx:37` implements hover shadow transition:
   ```tsx
   <Card className="bg-surface shadow-card hover:shadow-lift transition-shadow">
   ```
   But no `translateY(-1px)` transform as specified.

2. **Hover-to-reveal patterns:** `SiteTable.tsx:91-93` correctly implements arrow reveal on hover:
   ```tsx
   <div className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
   ```

---

### 5.3 Accessibility Audit

#### 5.3.1 Chart Accessibility

| Component | Text Alternative | Keyboard Nav | Screen Reader | Status |
|-----------|------------------|--------------|---------------|--------|
| **SparklineChart** | No alt text | No | No aria-label | FAIL |
| **CtrBenchmarkChart** | Tooltip only | No | Partial (legend text) | PARTIAL |
| **TopicClusterVisualization** | No alt text | Click only | No aria-labels | FAIL |
| **IndexCoverageChart** | Labels present | No | Icon has no aria | PARTIAL |

**Critical Issues:**

1. **SVG Charts Lack Accessible Names:** `TopicClusterVisualization.tsx` creates an SVG without `role="img"` or `aria-label`:
   ```tsx
   // Line 70 - no accessibility attributes
   <svg width={width} height={height} className="mx-auto">
   ```

2. **No Data Tables for Charts:** Screen reader users cannot access chart data in alternative format.

3. **Color-Only Information:** `TopicClusterVisualization.tsx` uses green/red colors to indicate link status without additional indicators for colorblind users.

#### 5.3.2 Interactive Element Accessibility

| Component | Focus Visible | Keyboard Operable | ARIA Labels | Status |
|-----------|---------------|-------------------|-------------|--------|
| **DateRangePicker** | Browser default | Buttons focusable | None | PARTIAL |
| **TagFilter** | Browser default | Checkbox focusable | None | PARTIAL |
| **ExportMenu** | Dropdown component | Yes (shadcn) | Inherits from shadcn | OK |
| **VisibilityConfigPanel** | Switch component | Yes (shadcn) | Labels present | OK |
| **ContentGroupCard** | No visible focus | onClick with role="button" | tabIndex present | PARTIAL |

**Findings:**

1. **ContentGroupCard Keyboard Access (GOOD):**
   ```tsx
   // Line 48-50
   role={onClick ? "button" : undefined}
   tabIndex={onClick ? 0 : undefined}
   ```
   Correctly adds role and tabIndex when clickable.

2. **Missing Focus Styles:** Most custom buttons use default browser focus, which may not meet v6 design system aesthetics.

#### 5.3.3 Color Contrast

| Element | Foreground | Background | Ratio (est.) | WCAG AA |
|---------|------------|------------|--------------|---------|
| Body text | `text-text-2` | white | ~7:1 | PASS |
| Muted text | `text-text-3` | white | ~4.5:1 | PASS |
| 11px helper | `text-text-3` | white | N/A (too small) | FAIL |

---

### 5.4 Client Portal Experience

#### 5.4.1 White-Label Consistency

| Aspect | Implementation | Quality |
|--------|----------------|---------|
| **Custom Logo** | Supported via `clientLogo` prop | GOOD |
| **Client Name** | Displayed in header | GOOD |
| **Hidden Metrics** | Conditionally rendered (not grayed) | EXCELLENT |
| **Export Branding** | No custom branding on CSV | MISSING |

**Findings:**

1. **Visibility Config Works Well:** `ClientPortalDashboard.tsx` correctly conditionally renders metrics based on visibility config:
   ```tsx
   // Lines 126-158 - metrics only render when enabled
   {showClicks && metrics && (
     <KPICard title="Clicks" value={metrics.clicks} ... />
   )}
   ```
   Metrics are fully hidden, not grayed out, providing clean UX.

2. **Missing Branded Export:** CSV exports do not include agency branding or customization options.

#### 5.4.2 Portal Route Structure

| Route | Component | Auth Level | Status |
|-------|-----------|------------|--------|
| `/portal/$token` | PortalEntryPage | token_only/email_verify/full_login | PLACEHOLDER |
| `/_app/clients/$clientId/analytics` | ClientAnalyticsPage | Authenticated | IMPLEMENTED |

**Findings:**

1. **Portal Route is Placeholder:** `routes/portal/$token.tsx` contains placeholder components:
   ```tsx
   // Line 131-148 - ClientPortalView is a stub
   function ClientPortalView({ clientId }: { clientId: string }) {
     return (
       <div className="min-h-screen bg-surface-1 p-8">
         <p className="text-text-2">Portal content coming in Phase 87-02.</p>
       </div>
     );
   }
   ```

2. **Token Validation Works:** Error handling for expired/revoked/not_found tokens is well implemented.

#### 5.4.3 Client Navigation

| Feature | Status | Notes |
|---------|--------|-------|
| Breadcrumbs | NOT FOUND | No breadcrumb component |
| Back navigation | NOT FOUND | No back button in portal |
| Section tabs | NOT FOUND | Single-page dashboard only |
| Export actions | IMPLEMENTED | Export menu works |

---

### 5.5 Responsive Design Assessment

#### 5.5.1 Breakpoint Handling

| Breakpoint | v6 Spec | Implementation | Status |
|------------|---------|----------------|--------|
| >= 1180px | 3-column shell | Not implemented (no rail) | N/A |
| 880-1179px | 2-column | Not implemented | N/A |
| < 880px | Single column | Partial via Tailwind responsive | PARTIAL |

**Findings:**

1. **No App Shell Implementation:** The v6 3-column shell (sidebar + main + rail) is not implemented. Components use standalone layouts.

2. **Grid Responsiveness:** `MasterDashboard.tsx:73` uses responsive grid:
   ```tsx
   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
   ```

3. **Table Not Horizontally Scrollable:** `SiteTable.tsx` uses CSS Grid without overflow handling. On narrow screens, content may be cut off.

#### 5.5.2 Chart Responsiveness

| Component | Responsive | Status |
|-----------|------------|--------|
| SparklineChart | Yes (ResponsiveContainer) | GOOD |
| CtrBenchmarkChart | Yes (ResponsiveContainer) | GOOD |
| TopicClusterVisualization | Fixed width/height props | POOR |
| IndexCoverageChart | CSS Grid responsive | GOOD |

**Findings:**

1. **TopicClusterVisualization Fixed Size:** Uses hardcoded dimensions:
   ```tsx
   // Line 20-21
   width = 600,
   height = 400,
   ```
   No responsive behavior.

---

### 5.6 Component Reusability Assessment

#### 5.6.1 Props Interface Quality

| Component | Props Typed | Props Documented | Reusable |
|-----------|-------------|------------------|----------|
| KPICard | Yes (TypeScript) | No JSDoc | YES |
| SparklineChart | Yes | No | YES |
| CtrBenchmarkChart | Yes | No | YES |
| ClientPortalDashboard | Yes | No | PARTIAL |
| TopicClusterVisualization | Yes | No | LIMITED |

**Findings:**

1. **Good Type Coverage:** All components have TypeScript interfaces.
2. **No Documentation:** No JSDoc comments on component props.
3. **Tight Coupling:** `ClientPortalDashboard` has many responsibilities - could be split.

#### 5.6.2 Cross-App Portability

| Assessment Criteria | Status |
|---------------------|--------|
| Can be used in apps/web? | PARTIAL - depends on v6 token migration |
| Standalone imports work? | YES - most components self-contained |
| shadcn/ui dependency | YES - all use shadcn Card, Button, etc. |

---

### 5.7 UI Recommendations

#### 5.7.1 Critical (Must Fix)

| Issue | Location | Fix Required |
|-------|----------|--------------|
| **Font Family Mismatch** | `app.css:128` | Change from Inter to Geist font family |
| **Accent Color Wrong** | `app.css:14` | Change primary from blue/purple to forest green (#0F4F3D) |
| **Design System Tokens Missing** | `app.css` | Add v6 tokens: `--text-1` through `--text-4`, `--surface`, `--canvas`, `--hairline`, shadow variables |
| **11px Text Below Floor** | Multiple files | Replace all `text-[11px]` with `text-[12px]` |
| **Chart Accessibility** | SVG components | Add `role="img"`, `aria-label`, and accessible data tables |

#### 5.7.2 High Priority

| Issue | Location | Recommendation |
|-------|----------|----------------|
| **Card Borders** | ContentGroupCard, IndexCoverageChart | Replace `border` with ghost-edge shadows per v6 |
| **Portal Route Stubs** | `routes/portal/$token.tsx` | Implement actual client portal views |
| **Missing Components** | - | Implement StrikingDistanceTable, CannibalizationPanel, AnnotationTimeline |
| **TopicClusterVisualization Fixed Size** | Line 20-21 | Make width/height responsive to container |

#### 5.7.3 Medium Priority

| Issue | Location | Recommendation |
|-------|----------|----------------|
| **Hover Transforms** | KPICard, SiteTable | Add `transform: translateY(-1px)` on hover per v6 |
| **Focus Styles** | Custom buttons | Add visible focus rings matching v6 aesthetic |
| **Table Overflow** | SiteTable | Add horizontal scroll wrapper for mobile |
| **Export Branding** | ExportMenu | Add option for agency logo in CSV header |

#### 5.7.4 Low Priority (Polish)

| Issue | Recommendation |
|-------|----------------|
| **JSDoc Missing** | Add documentation to all exported components |
| **Container Queries** | Add `container-type: inline-size` to cards for responsive internals |
| **Reduced Motion** | Honor `prefers-reduced-motion` in all animations |
| **Compact Height Mode** | Implement `@media (max-height: 780px)` adjustments per v6 |

---

### 5.8 Summary Metrics

| Category | Score | Notes |
|----------|-------|-------|
| **Design System v6 Compliance** | 35% | Major gaps in typography, colors, shadows |
| **Accessibility (WCAG 2.1 AA)** | 55% | Charts need work, forms are OK |
| **Client Portal UX** | 60% | Visibility works, portal route incomplete |
| **Responsive Design** | 65% | Charts OK, tables need work |
| **Component Reusability** | 75% | Good typing, needs docs |

**Overall Assessment:** The Phase 96 UI components are functionally implemented but significantly deviate from the design system v6 specification. Priority should be given to:
1. Migrating CSS tokens to v6 spec
2. Replacing Inter with Geist font
3. Implementing ghost-edge shadow system
4. Adding accessibility attributes to charts

---

*End of Section 5: UI/UX & Client Portal Review*
