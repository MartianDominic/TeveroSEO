# Phases 84-89 Codebase Audit

> **Generated:** 2026-05-05
> **Method:** Parallel Opus agent investigation of existing codebase
> **Purpose:** Identify what's already built vs actual gaps before planning

---

## Executive Summary

| Phase | Name | Built | Gaps | Effort |
|-------|------|-------|------|--------|
| 84 | Conversational Input Integration | 90% | Integration wiring | ~2 days |
| 85 | Analysis Experience | 50% | UI controls, export options | ~2 weeks |
| 86 | Semantic Intelligence | 30% | HDBSCAN, cross-language | ~3 weeks |
| 87 | Agency Business | 40% | Effort calc, ROI dashboard | ~3 weeks |
| 88 | Learning & Collaboration | 25% | Learning loop, team features | ~3 weeks |
| 89 | Client Acquisition | 65% | Call assistant, e-signature | ~2 weeks |

**Total revised estimate:** ~13 weeks (down from 24 weeks in original roadmap)

---

## Phase 84: Conversational Input Integration

### Status: 90% Built — Integration Work Only

| Component | Status | Location |
|-----------|--------|----------|
| ConstraintExtractor | ✅ Complete | `conversation/ConstraintExtractor.ts` |
| Constraint schemas | ✅ Complete | `conversation/types.ts` |
| Extraction prompts | ✅ Complete | `conversation/prompts.ts` |
| KeywordGenerator | ✅ Complete | `lib/opportunity/keywordGenerator.ts` |
| CsvImportService | ✅ Complete | `services/CsvImportService.ts` |
| ColumnDetector | ✅ Complete | `services/ColumnDetector.ts` |
| NegativeAssociationExtractor | ✅ Complete | `context/NegativeAssociationExtractor.ts` |
| Client schemas (GSC creds) | ✅ Complete | `db/client-schema.ts` |
| GSC Service | ✅ Complete | `AI-Writer/backend/services/gsc_service.py` |

### Actual Gaps

| Gap | Description | Effort |
|-----|-------------|--------|
| KeywordGenerator wiring | Connect to chat flow | 2-3 hrs |
| Clarifying question loop | Use `clarificationNeeded[]` | 3-4 hrs |
| GSC bridge | open-seo-main → AI-Writer HTTP call | 2-3 hrs |
| CsvImportDialog.tsx | Frontend for existing backend | 3-4 hrs |
| Google Sheets sync | NOT BUILT — lower priority | Deferred |

**Plan created:** `84-01-PLAN.md`

---

## Phase 85: Analysis Experience

### Status: 50% Built — Backend solid, UI incomplete

| Component | Status | Location | Gap |
|-----------|--------|----------|-----|
| ConstraintFilter Pipeline | ✅ Complete | `filtering/` | None |
| CompositeScorer | ✅ Complete | `filtering/scoring.ts` | None |
| CascadeSelector | ✅ Complete | `selection/CascadeSelector.ts` | None |
| Industry Presets | ✅ Complete | `selection/presets.ts` | 4 presets exist, no UI selector |
| Funnel Breakdown UI | ✅ Complete | `AnalysisResults.tsx` | None |
| Exclusion Reasons | ✅ Complete | `filtering/types.ts` | `humanReadableReason()` exists |
| Basic Filters | ⚠️ Partial | `keywordResearchDesktopFilters.tsx` | Min/max only, no sliders |
| Confidence Indicator | ⚠️ Partial | `AnalysisResults.tsx` | Constraint-level only, not per-keyword |
| Funnel Ratio Sliders | ❌ Missing | - | No BOFU/MOFU/TOFU ratio adjustment |
| Simple/Power Mode | ❌ Missing | - | No mode toggle |
| Column Customization | ❌ Missing | - | No column visibility toggles |
| Bulk Operations | ❌ Missing | - | No multi-select actions |
| Excel Export | ❌ Missing | - | Only CSV via ExportActions |
| Google Sheets Push | ❌ Missing | - | Not implemented |
| Charts | ❌ Missing | - | No funnel/scatter visualizations |
| "Why this keyword?" | ❌ Missing | - | No score breakdown popover |

### Summary
Backend filtering/scoring is ~90% complete. UI is ~30% complete.

---

## Phase 86: Semantic Intelligence

### Status: 30% Built — Embeddings exist, clustering missing

| Component | Status | Location | Gap |
|-----------|--------|----------|-----|
| EmbeddingService | ✅ Complete | `services/EmbeddingService.ts` | Matryoshka, L2 norm, caching |
| RelevanceScorer | ✅ Complete | `relevance/RelevanceScorer.ts` | Multi-dimensional scoring |
| QuickWinDetector | ✅ Complete | `services/QuickWinDetector.ts` | Rule-based |
| KeywordUniverseBuilder | ✅ Complete | `universe/KeywordUniverseBuilder.ts` | DataForSEO expansion |
| AdaptiveIntentRouter | ✅ Complete | `intent/AdaptiveIntentRouter.ts` | Quick vs full routing |
| KeywordDeduplicator | ⚠️ Partial | `services/KeywordDeduplicator.ts` | Text normalization only, no embedding dedup |
| Funnel Types | ⚠️ Partial | `filtering/types.ts` | Types exist, no embedding classifier |
| HDBSCAN Clustering | ❌ Missing | - | Uses naive 3-char prefix grouping |
| Intent Similarity Grouping | ❌ Missing | - | Not implemented |
| Semantic Deduplication | ❌ Missing | - | No embedding-based dedup |
| Cross-language LT↔EN | ❌ Missing | - | Not implemented |
| Topic Modeling | ❌ Missing | - | Not implemented |
| Visual Cluster Map | ❌ Missing | - | Not implemented |

### Summary
Wave 1 foundation exists (embeddings, similarity). HDBSCAN and Waves 2-3 missing.

---

## Phase 87: Agency Business

### Status: 40% Built — Proposal basics exist, ROI missing

| Component | Status | Location | Gap |
|-----------|--------|----------|-----|
| Package Selector | ✅ Complete | `PackageSelector.tsx`, `ServiceCatalogService.ts` | Works |
| Proposal Schema | ✅ Complete | `proposal-schema.ts` | Sections, brandConfig |
| PDF Generation | ✅ Complete | `proposals/signing/pdf.ts` | For signing flow |
| ROI Prompts | ⚠️ Partial | `prompts/roi-projections.xml` | AI prompt exists, no UI |
| Branded Templates | ⚠️ Partial | `TemplateService.ts` | BrandConfig exists, no gallery |
| Brief Generator | ⚠️ Partial | `BriefGenerator.ts` | Single brief only, no bulk |
| Effort Calculation | ❌ Missing | - | No effort-per-keyword logic |
| Pricing Calculator | ❌ Missing | - | No interactive calculator |
| ROI Dashboard | ❌ Missing | - | No dedicated dashboard |
| Content Calendar | ❌ Missing | - | No calendar integration |
| Team Assignment | ❌ Missing | - | No assignment features |
| Client Portal | ❌ Missing | - | Not implemented |
| Feedback Collection | ❌ Missing | - | Not implemented |
| Case Study Generation | ❌ Missing | - | Not implemented |

### Summary
Wave 1 (proposals) partially done. Waves 2-5 (ROI, calendar, portal) mostly missing.

---

## Phase 88: Learning & Collaboration

### Status: 25% Built — Schemas exist, no learning loop

| Component | Status | Location | Gap |
|-----------|--------|----------|-----|
| Roles Schema | ✅ Complete | `db/schema.ts` (users.role) | Basic roles exist |
| Workspace Sharing | ⚠️ Partial | `workspace` schema | Basic workspace exists |
| Analysis Sessions | ⚠️ Partial | Phase 82 design | Schema designed, not tracking outcomes |
| Keyword Outcome Tracking | ❌ Missing | - | No selection → ranking tracker |
| Success Pattern Mining | ❌ Missing | - | No ML/pattern detection |
| Cross-client Benchmarks | ❌ Missing | - | No industry benchmarks |
| Strategy Timeline | ❌ Missing | - | No timeline visualization |
| Conflict Detection | ❌ Missing | - | No same-keyword-multiple-client detection |
| Team Templates | ❌ Missing | - | Not implemented |
| Review/Approval Workflow | ❌ Missing | - | Not implemented |
| Revision Tracking | ❌ Missing | - | Not implemented |
| Presence Awareness | ❌ Missing | - | Not implemented |
| Notifications | ❌ Missing | - | Not implemented |
| @Mentions | ❌ Missing | - | Not implemented |

### Summary
Basic schemas exist. Learning loop and collaboration features not built.

---

## Phase 89: Client Acquisition & Activation

### Status: 65% Built — Prospect flow works, polish missing

| Component | Status | Location | Gap |
|-----------|--------|----------|-----|
| Prospect Schema | ✅ Complete | `prospect-schema.ts` | Full schema |
| Prospect Pipeline | ✅ Complete | v4.0 (Phases 26-30) | 8-stage pipeline |
| Competitor Detection | ✅ Complete | `CompetitorSpyService` | Automatic |
| Quick Analysis | ✅ Complete | `OpportunityScanner` | <60s scan |
| Proposal Builder | ✅ Complete | Phase 46-47 | Full builder |
| Contract Flow | ✅ Complete | Phase 48 | Contract + signing |
| E-signature | ✅ Complete | Phase 59 | Dokobit integration |
| Auto Client Creation | ⚠️ Partial | `OnboardingService` | Basic onboarding exists |
| Live Call Assistant | ❌ Missing | - | No live notes/constraint extraction |
| Objection Handler | ❌ Missing | - | Not implemented |
| Live Quote Calculator | ❌ Missing | - | Not implemented |
| Keyword Lock-in | ❌ Missing | - | No contracted scope tracking |
| Batch Operations | ❌ Missing | - | Not implemented |
| Keyboard Shortcuts | ❌ Missing | - | Not implemented |
| Power Mode Tour | ❌ Missing | - | Not implemented |

### Summary
Prospect-to-contract flow (Waves 1, 3) 80% complete. Live call features (Wave 2) and polish (Wave 4) missing.

---

## Data Integrations Status

### GSC (Google Search Console)

| Component | Status | Location |
|-----------|--------|----------|
| OAuth Flow | ✅ Complete | `AI-Writer/backend/services/gsc_service.py` |
| Search Analytics | ✅ Complete | Same — query/page/date dimensions |
| Client Credentials | ✅ Complete | `client-schema.ts` — gscRefreshToken, gscSiteUrl |
| Bridge to Keywords | ❌ Missing | Need HTTP call from open-seo-main to AI-Writer |

**Gap:** GSC service works in AI-Writer. Need bridge to expose it to open-seo-main keyword analysis.

### Google Sheets

| Component | Status | Location |
|-----------|--------|----------|
| OAuth Setup | ❌ Missing | - |
| Read Sync | ❌ Missing | - |
| Write/Push | ❌ Missing | - |

**Gap:** Not implemented at all. Lower priority — agencies can use CSV export as workaround.

---

## Revised Phase Timeline

| Phase | Original | Revised | Reason |
|-------|----------|---------|--------|
| 84 | 3 weeks | 1 week | 90% built, integration only |
| 85 | 4 weeks | 2 weeks | Backend done, UI work |
| 86 | 3 weeks | 3 weeks | HDBSCAN needs research |
| 87 | 4 weeks | 3 weeks | Proposal basics exist |
| 88 | 4 weeks | 3 weeks | Schemas exist, features missing |
| 89 | 4 weeks | 2 weeks | 65% already built |
| **Total** | **24 weeks** | **14 weeks** | **42% reduction** |

---

## Recommendations

1. **Phase 84:** Execute immediately — mostly integration work (~2 days)

2. **Phase 85:** Focus on UI controls (sliders, mode toggle, export) — backend is solid

3. **Phase 86:** Research HDBSCAN implementation or use existing clustering library before planning

4. **Phase 87:** Leverage existing proposal builder — add ROI calculator and effort estimation

5. **Phase 88:** Deprioritize collaboration features — focus on outcome tracking for learning loop

6. **Phase 89:** Polish existing prospect flow — add live call assistant if high value

7. **Google Sheets:** Defer until agencies specifically request it — CSV export is viable workaround

8. **GSC Bridge:** Priority for Phase 84 — enables client keyword gap analysis

---

*Audit completed: 2026-05-05*
*Investigators: 5 parallel Opus agents*
