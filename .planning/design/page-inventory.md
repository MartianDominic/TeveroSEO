# TeveroSEO Web App Page Inventory

> Generated for design-system-v6.md migration planning
> 
> **Total Pages:** 51 (page.tsx + layout.tsx files)
> **Total Routes:** 47 unique routes

---

## Summary by Domain

| Domain | Pages | Complexity Range |
|--------|-------|------------------|
| Auth | 2 | Simple |
| Dashboard | 1 | Very High |
| Client Management | 2 | Medium - High |
| Prospects | 7 | Simple - High |
| Client Dashboard | 1 | High |
| Client Content | 3 | High - Very High |
| Client Analytics | 2 | Simple - High |
| Client Intelligence | 1 | Very High |
| Client SEO | 11 | Medium - Very High |
| Client Settings | 6 | Medium - Very High |
| Client Misc | 3 | Medium |
| OAuth Flow | 2 | Simple - Medium |
| Global Settings | 1 | High |
| Layouts | 3 | Simple - Medium |

---

## Complete Page Inventory

### Auth Domain

| Route | File | Complexity | Key Components |
|-------|------|------------|----------------|
| `/sign-in` | `app/sign-in/[[...sign-in]]/page.tsx` | Simple | `SignIn` (@clerk/nextjs) |
| `/sign-up` | `app/sign-up/[[...sign-up]]/page.tsx` | Simple | `SignUp` (@clerk/nextjs) |

### Dashboard Domain

| Route | File | Complexity | Key Components |
|-------|------|------------|----------------|
| `/dashboard` | `app/(shell)/dashboard/page.tsx` | Very High | `ClientPortfolioTable`, `PortfolioHealthSummary`, `ActivityFeed`, `QuickStatsCards`, `AlertsSummaryCard`, `GoalsProgressCard`, `UpcomingTasksCard`, `RecentReportsCard`, `DateRangeSelector`, `PortfolioCharts`, `DashboardLoadingSkeleton`, Zustand stores |

### Client Management Domain

| Route | File | Complexity | Key Components |
|-------|------|------------|----------------|
| `/clients` | `app/(shell)/clients/page.tsx` | Medium | `GettingStartedCard`, `AddClientModal`, grid layout |
| `/clients/[clientId]` | `app/(shell)/clients/[clientId]/page.tsx` | High (~575 lines) | `IntelligenceStatusCard`, onboarding checklist, stat cards, activity table, `StatusChip`, `Badge`, `Tabs`, `Card` |

### Prospects Domain

| Route | File | Complexity | Key Components |
|-------|------|------------|----------------|
| `/prospects` | `app/(shell)/prospects/page.tsx` | Medium | `AddProspectDialog`, prospect list |
| `/prospects/keywords` | `app/(shell)/prospects/keywords/page.tsx` | Simple | Entry selector |
| `/prospects/keywords/quick-check` | `app/(shell)/prospects/keywords/quick-check/page.tsx` | Medium | Keyword table, search form |
| `/prospects/keywords/competitor-spy` | `app/(shell)/prospects/keywords/competitor-spy/page.tsx` | Medium | Competitor domain spy tool |
| `/prospects/[prospectId]` | `app/(shell)/prospects/[prospectId]/page.tsx` | High | `AnalysisResults`, `BusinessInfoFormWrapper` |
| `/prospects/[prospectId]/keywords` | `app/(shell)/prospects/[prospectId]/keywords/page.tsx` | High (~320 lines) | Keyword table, tier filtering, bulk actions, score weights |
| `/prospects/[prospectId]/keywords/import` | `app/(shell)/prospects/[prospectId]/keywords/import/page.tsx` | High | CSV import multi-step wizard |
| `/prospects/[prospectId]/proposal/builder` | `app/(shell)/prospects/[prospectId]/proposal/builder/page.tsx` | High (~430 lines) | 4-step proposal builder wizard |
| `/prospects/[prospectId]/proposal/preview` | `app/(shell)/prospects/[prospectId]/proposal/preview/page.tsx` | Medium | Proposal preview, PDF export |

### Client Content Domain

| Route | File | Complexity | Key Components |
|-------|------|------------|----------------|
| `/clients/[clientId]/articles` | `app/(shell)/clients/[clientId]/articles/page.tsx` | Very High (~960 lines) | Sortable table, bulk actions, `LazySparkline`, `RankHistorySparkline`, filters, `BulkActionBar`, `ExportDialog` |
| `/clients/[clientId]/articles/new` | `app/(shell)/clients/[clientId]/articles/new/page.tsx` | High (~480 lines) | Article form, voice template selector, blend weight slider, image generation panel |
| `/clients/[clientId]/articles/[articleId]` | `app/(shell)/clients/[clientId]/articles/[articleId]/page.tsx` | Very High (~880 lines) | Article editor, regeneration dialog, actions, `articleEditorStore` |
| `/clients/[clientId]/calendar` | `app/(shell)/clients/[clientId]/calendar/page.tsx` | Very High (~810 lines) | `react-big-calendar`, approval pipeline tab, CSV import, `contentCalendarStore` |

### Client Analytics Domain

| Route | File | Complexity | Key Components |
|-------|------|------------|----------------|
| `/clients/[clientId]/alerts` | `app/(shell)/clients/[clientId]/alerts/page.tsx` | Simple-Medium | Alerts table, `Suspense` |
| `/clients/[clientId]/analytics` | `app/(shell)/clients/[clientId]/analytics/page.tsx` | High | GSC/GA4 charts, `QueriesTable`, `DateRangeSelector`, `analyticsStore` |

### Client Intelligence Domain

| Route | File | Complexity | Key Components |
|-------|------|------------|----------------|
| `/clients/[clientId]/intelligence` | `app/(shell)/clients/[clientId]/intelligence/page.tsx` | Very High (~1015 lines) | 4-tab view (Overview, Keywords, Brand Voice, Content Gaps), WebSocket support, `intelligenceStore` |

### Client SEO Domain

| Route | File | Complexity | Key Components |
|-------|------|------------|----------------|
| `/clients/[clientId]/seo` | `app/(shell)/clients/[clientId]/seo/page.tsx` | Simple | Redirect to default project audit |
| `/clients/[clientId]/seo/[projectId]` (layout) | `app/(shell)/clients/[clientId]/seo/[projectId]/layout.tsx` | Simple | `TanStack QueryClientProvider` wrapper |
| `/clients/[clientId]/seo/[projectId]/audit` | `app/(shell)/clients/[clientId]/seo/[projectId]/audit/page.tsx` | Very High (~745 lines) | `LaunchView`, `AuditDetail`, `ProgressCard`, `ResultsView`, TanStack Query |
| `/clients/[clientId]/seo/[projectId]/audit/[pageId]` | `app/(shell)/clients/[clientId]/seo/[projectId]/audit/[pageId]/page.tsx` | High (~205 lines) | `ScoreCard`, `FindingsTable` |
| `/clients/[clientId]/seo/[projectId]/audit/issues/[resultId]` | `app/(shell)/clients/[clientId]/seo/[projectId]/audit/issues/[resultId]/page.tsx` | High (~216 lines) | Lighthouse issues detail |
| `/clients/[clientId]/seo/[projectId]/backlinks` | `app/(shell)/clients/[clientId]/seo/[projectId]/backlinks/page.tsx` | High (~327 lines) | 3-tab view (Overview, Referring Domains, Top Pages), TanStack Query, Zod validation |
| `/clients/[clientId]/seo/[projectId]/domain` | `app/(shell)/clients/[clientId]/seo/[projectId]/domain/page.tsx` | Medium (~257 lines) | Domain overview stats, top keywords list, competitors list |
| `/clients/[clientId]/seo/[projectId]/keyword-mapping` | `app/(shell)/clients/[clientId]/seo/[projectId]/keyword-mapping/page.tsx` | Medium (~204 lines) | `MappingTable`, `SuggestMappingButton`, stats cards |
| `/clients/[clientId]/seo/[projectId]/keywords` | `app/(shell)/clients/[clientId]/seo/[projectId]/keywords/page.tsx` | High (~373 lines) | Research form, saved keywords with `RankSparkline`, `PositionBadge`, TanStack Query mutations |
| `/clients/[clientId]/seo/[projectId]/keywords/[keywordId]` | `app/(shell)/clients/[clientId]/seo/[projectId]/keywords/[keywordId]/page.tsx` | Medium (~149 lines) | `RankHistoryChart`, `PositionBadge`, SERP features |
| `/clients/[clientId]/seo/[projectId]/links` | `app/(shell)/clients/[clientId]/seo/[projectId]/links/page.tsx` | High (~411 lines) | Link health metrics, distribution chart, opportunities table with approve/reject |

### Client Settings Domain

| Route | File | Complexity | Key Components |
|-------|------|------------|----------------|
| `/clients/[clientId]/settings` | `app/(shell)/clients/[clientId]/settings/page.tsx` | Very High (~1425 lines) | 4-tab view (Brand & AI, CMS Integration, Publishing, Goals), voice templates, model overrides, `ClientGoalsManager`, `contentCalendarStore` |
| `/clients/[clientId]/settings/branding` | `app/(shell)/clients/[clientId]/settings/branding/page.tsx` | Medium (~120 lines) | Server Component, `BrandingForm`, `Suspense` |
| `/clients/[clientId]/settings/reports` | `app/(shell)/clients/[clientId]/settings/reports/page.tsx` | Medium (~99 lines) | Server Component, `ScheduleForm`, `Suspense` |
| `/clients/[clientId]/settings/voice` | `app/(shell)/clients/[clientId]/settings/voice/page.tsx` | Very High (~234 lines) | 6-tab view, `VoiceModeWizard`, `TonePersonalityTab`, `VocabularyTab`, `WritingMechanicsTab`, `ProtectionRulesTab`, `VoicePreviewPanel`, `VoiceSidebarSummary` |
| `/clients/[clientId]/settings/webhooks` | `app/(shell)/clients/[clientId]/settings/webhooks/page.tsx` | Medium (~178 lines) | `WebhookList`, `WebhookForm`, event registry |

### Client Miscellaneous Domain

| Route | File | Complexity | Key Components |
|-------|------|------------|----------------|
| `/clients/[clientId]/changes` | `app/(shell)/clients/[clientId]/changes/page.tsx` | Medium | Changes list, filters, revert capability |
| `/clients/[clientId]/connections` | `app/(shell)/clients/[clientId]/connections/page.tsx` | High (~505 lines) | OAuth connections, CMS site connections, `ConnectionWizard` |
| `/clients/[clientId]/reports` | `app/(shell)/clients/[clientId]/reports/page.tsx` | Simple | Reports list, generate button |
| `/clients/[clientId]/reports/[reportId]` | `app/(shell)/clients/[clientId]/reports/[reportId]/page.tsx` | Medium | Report detail, preview, download |

### OAuth Flow Domain

| Route | File | Complexity | Key Components |
|-------|------|------------|----------------|
| `/connect/[token]` | `app/connect/[token]/page.tsx` | Medium | OAuth magic link landing, token validation |
| `/connect/success` | `app/connect/success/page.tsx` | Simple | Static success confirmation |

### Global Settings Domain

| Route | File | Complexity | Key Components |
|-------|------|------------|----------------|
| `/settings` | `app/(shell)/settings/page.tsx` | High (~1000 lines) | 3-tab view (API Integrations, Voice Templates, Model Defaults) |

### Layouts

| Route | File | Complexity | Key Components |
|-------|------|------------|----------------|
| `/` (root) | `app/layout.tsx` | Simple | `ClerkProvider`, basic HTML |
| `/` (root page) | `app/page.tsx` | Simple | Redirect logic |
| `(shell)` | `app/(shell)/layout.tsx` | Medium | `AppShell`, `ThemeProvider`, `ErrorBoundary` |
| `seo/[projectId]` | `app/(shell)/clients/[clientId]/seo/[projectId]/layout.tsx` | Simple | `QueryClientProvider` |

---

## Complexity Rating Legend

| Rating | Criteria |
|--------|----------|
| **Simple** | < 150 lines, few components, minimal state |
| **Medium** | 150-400 lines, moderate component usage, some state management |
| **High** | 400-700 lines, many components, complex state, forms |
| **Very High** | > 700 lines, extensive component usage, multiple stores, complex interactions |

---

## Key Component Libraries Used

### @tevero/ui (shadcn-based)
- `Button`, `Card`, `CardContent`, `CardHeader`, `CardTitle`
- `Input`, `Label`, `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
- `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger`
- `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`
- `Badge`, `StatusChip`, `Skeleton`, `Separator`, `Switch`, `Slider`
- `Dialog`, `PageHeader`, `Textarea`

### State Management (Zustand)
- `clientStore` - Client context and list
- `analyticsStore` - GSC/GA4 data
- `intelligenceStore` - Intelligence module state
- `articleEditorStore` - Article editing state
- `contentCalendarStore` - Calendar and publishing settings

### Data Fetching
- TanStack Query (`@tanstack/react-query`) - SEO pages
- Server Actions - Most other data operations
- `fetch` with Clerk auth tokens - Server Components

### Icons
- `lucide-react` - Extensive usage across all pages

### Third-Party
- `react-big-calendar` - Calendar page
- `@clerk/nextjs` - Auth pages
- `zod` - Input validation

---

## Migration Priority Recommendations

### Phase 1: High-Traffic, High-Visibility
1. `/dashboard` - Agency command center (Very High complexity)
2. `/clients/[clientId]` - Client dashboard (High complexity)
3. `/clients/[clientId]/articles` - Article library (Very High complexity)

### Phase 2: Core Workflows
4. `/clients/[clientId]/intelligence` - Intelligence module (Very High complexity)
5. `/clients/[clientId]/settings` - Client settings (Very High complexity)
6. `/clients/[clientId]/calendar` - Content calendar (Very High complexity)

### Phase 3: SEO Tools
7. `/clients/[clientId]/seo/[projectId]/audit` - Site audit (Very High complexity)
8. `/clients/[clientId]/seo/[projectId]/keywords` - Keyword research (High complexity)
9. `/clients/[clientId]/seo/[projectId]/links` - Link health (High complexity)
10. `/clients/[clientId]/seo/[projectId]/backlinks` - Backlinks (High complexity)

### Phase 4: Prospects & Settings
11. `/prospects/[prospectId]/proposal/builder` - Proposal wizard (High complexity)
12. `/clients/[clientId]/settings/voice` - Voice profile (Very High complexity)
13. `/settings` - Global settings (High complexity)

### Phase 5: Simple Pages
- All Simple/Medium complexity pages

---

## Notes for Migration

1. **Client Components**: Most pages are client components (`"use client"`) due to interactive requirements
2. **Server Components**: Settings pages (branding, reports) use Server Components with Suspense
3. **Shared State**: Multiple pages share Zustand stores - migration must preserve store compatibility
4. **TanStack Query**: SEO pages use QueryClientProvider - maintain query key conventions
5. **Form Patterns**: Most forms use controlled components with local state + API calls on blur/submit
6. **Toast Notifications**: Custom toast implementations vary across pages - should unify
7. **Loading States**: Mix of Skeleton components and Loader2 spinners - should standardize
