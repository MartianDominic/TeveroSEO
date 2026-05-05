# Consolidated Phase Roadmap: World-Class Keyword Analysis

> **Source:** WORLD-CLASS-KEYWORD-ANALYSIS.md (8,695 lines, 18 sections)
> **Original:** 10 phases x 3 waves = 30 waves
> **Consolidated:** 8 phases x 3-5 waves = 33 waves (bulletproof coverage)
> **Methodology:** Merge by technical cohesion, user value delivery, and skill requirements
> **Verified:** 140+ items across all 18 sections mapped to phases

---

## Consolidation Rationale

### Why Fewer Phases, More Waves?

1. **Technical Cohesion**: Phases 84 (Input) and 85 (Controls) both modify `KeywordAnalysisChat.tsx` and `ConstraintExtractor.ts` - merge them
2. **User Value Bundles**: Users don't care about "Output" vs "Explainability" separately - they want professional deliverables with explanations
3. **Skill Requirements**: Frontend-heavy phases (85, 86, 87) can combine into one "Analysis Experience" phase
4. **Dependency Chains**: Phases 89 (Workflow) + 92 (Pricing) are both about "agency business" - merge them
5. **Testing Efficiency**: Larger phases with more waves allow better E2E testing coverage per phase

### Merge Decisions

| Original Phases | New Phase | Rationale |
|-----------------|-----------|-----------|
| 83 | 83 | Foundation is prerequisite, keep separate |
| 84 + part of 85 | 84 | Input + client detection = one data flow |
| 85 controls + 86 output + 87 explainability | 85 | All touch AnalysisResults.tsx, same user journey |
| 88 | 86 | Semantic intelligence is backend-heavy, keep separate |
| 89 workflow + 92 pricing | 87 | Agency business = proposals + pricing + ROI |
| 90 cross-ref + 91 collab | 88 | Both require background jobs + learning systems |

---

## Phase 83: Foundation & Reliability (UNCHANGED)

**Goal:** Make the existing system bulletproof before adding features
**Why First:** Users will abandon a flaky tool no matter how feature-rich
**Source Sections:** §6 Cost, §7 Performance, §8 Edge Cases
**Duration:** 2 weeks

### Wave 1: Error Handling & Recovery
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| SSE auto-reconnect (5 retries + backoff) | §8.2 | 9/10 | `useKeywordAnalysis.ts` |
| Checkpoint/resume system (IndexedDB) | §8.1 | 10/10 | NEW: `checkpoint-manager.ts` |
| Graceful degradation (skip optional stages) | §8.4 | 7/10 | `analysis-pipeline.ts` |
| Error message templates | §8.3 | 6/10 | NEW: `error-handler.ts` |
| Database offline queue + local storage | §8 EC-04 | 8/10 | NEW: `offline-queue.ts` |
| Rate limit backoff + batch splitting | §8 EC-06 | 8/10 | `EmbeddingService.ts` |
| DataForSEO timeout fallback | §8 EC-08 | 7/10 | `DataForSEOService.ts` |
| Input validation (encoding, dupes) | §8 EC-09/11 | 6/10 | NEW: `input-validator.ts` |

### Wave 2: Performance & Caching
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Constraint caching (skip LLM repeats) | §6.1 | 10/10 | `ConstraintExtractor.ts` |
| Parallel pipeline execution | §7.1 | 9/10 | `analysis-pipeline.ts` |
| Embedding cache (3-tier) | §6.2 | 8/10 | `EmbeddingService.ts` |
| LLM classification cache | §6.3 | 7/10 | `GrokClassifier.ts`, `FunnelLLMClassifier.ts` |
| Optimistic first result (0ms perceived) | §7 PERF-04 | 10/10 | `analysis-pipeline.ts` |
| Progressive result streaming | §7 PERF-10 | 9/10 | `useKeywordAnalysis.ts` |
| Worker thread pool (CPU stages) | §7 PERF-05 | 8/10 | NEW: `worker-pool.ts` |
| Memory pressure monitoring (50k+) | §8 EC-05 | 8/10 | NEW: `memory-monitor.ts` |
| Client-side RAF buffering | §7 PERF-14 | 7/10 | `useKeywordAnalysis.ts` |
| Stale-while-revalidate pattern | §7 PERF-09 | 7/10 | `cache-utils.ts` |

### Wave 3: Cost Controls
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Cost tracking per analysis | §6.5 | 7/10 | NEW: `cost-tracker.ts` |
| Progressive model selection | §6.4 | 6/10 | `ConstraintExtractor.ts` |
| Usage dashboard | §6.5 | 5/10 | NEW: `UsageDashboard.tsx` |

**Verification:** All tests pass, SSE reconnects on network drop, cache hit rate >60%

---

## Phase 84: Conversational Input Integration (REVISED — Mostly Built)

**Goal:** Wire existing conversation intelligence into the keyword analysis pipeline
**Why Second:** Core services exist, need integration + UI polish
**Source Sections:** §2 Chat Memory, §5 Client Segmentation, §12 Data Sources
**Duration:** 1 week (reduced from 3 weeks — most already built)

> **STATUS CHECK (2026-05-05):** Investigation found most Phase 84 components already exist:
> - ConstraintExtractor.ts — ✅ Complete (Claude Sonnet, 7 constraint categories, confidence scoring)
> - KeywordGenerator — ✅ EXISTS in `/lib/opportunity/keywordGenerator.ts` (Phase 29)
> - CsvImportService — ✅ Complete (csv-parse, preview mode, BOM cleanup)
> - ColumnDetector — ✅ Complete (Ahrefs, SEMrush, Moz auto-detection)
> - NegativeAssociationExtractor — ✅ Complete
> - GSC Service — ✅ Complete in AI-Writer
>
> **PROSPECT vs CLIENT:** These are separate paths (`/prospects/:id` vs `/clients/:id`), not a "mode" to detect.

### Wave 1: Integration & Wiring (Actual Gaps)
| Item | Source | Impact | Status | Files |
|------|--------|--------|--------|-------|
| Wire KeywordGenerator into chat flow | §2.1 | 10/10 | GAP | `KeywordAnalysisChat.tsx` calls `/lib/opportunity/keywordGenerator.ts` |
| Clarifying question handler | §2.4 | 9/10 | GAP | Use `clarificationNeeded[]` from ConstraintExtractor in conversational loop |
| GSC data bridge for clients | §12.7 | 8/10 | GAP | Bridge open-seo-main ↔ AI-Writer GSC service |
| Frontend import dialog | §12.1 | 7/10 | GAP | UI for existing CsvImportService (API exists, no UI) |

### Wave 2: Polish & Enhancement (Lower Priority)
| Item | Source | Impact | Status | Files |
|------|--------|--------|--------|-------|
| Google Sheets sync | §12.4 | 6/10 | NOT BUILT | NEW: `sheets-integration.ts` |
| Constraint undo/redo | §2.3 | 5/10 | NOT BUILT | NEW: `constraint-history.ts` |
| Smart follow-up suggestions | §2.4 | 5/10 | NOT BUILT | NEW: `FollowUpSuggestions.tsx` |

### Already Complete (No Work Needed)
| Item | Location | Status |
|------|----------|--------|
| ConstraintExtractor | `conversation/ConstraintExtractor.ts` | ✅ Production-ready |
| Constraint schemas | `conversation/types.ts` | ✅ Complete Zod schemas |
| Extraction prompts | `conversation/prompts.ts` | ✅ Lithuanian examples |
| KeywordGenerator | `lib/opportunity/keywordGenerator.ts` | ✅ Claude generates 50-100 keywords |
| CsvImportService | `services/CsvImportService.ts` | ✅ Full CSV parsing |
| ColumnDetector | `services/ColumnDetector.ts` | ✅ Ahrefs/SEMrush/Moz |
| NegativeAssociationExtractor | `context/NegativeAssociationExtractor.ts` | ✅ Competitors, wrong intents |
| Client schemas | `db/client-schema.ts` | ✅ GSC credentials |
| GSC Service | `AI-Writer/backend/services/gsc_service.py` | ✅ Full OAuth + analytics |

**Verification:** 
- PROSPECT: Describe business → KeywordGenerator produces 50+ keywords → full pipeline runs
- CLIENT: GSC data loads → shows ranking gaps alongside generated keywords
- Import: CsvImportDialog visible in UI, auto-detects Ahrefs/SEMrush format

---

## Phase 85: Analysis Experience (MERGED: 85 + 86 + 87)

**Goal:** Complete analysis UX from controls to output to explanations
**Why Third:** Once input is solid, deliver the full analysis experience
**Source Sections:** §1 UX Controls, §16 Smart Defaults, §17 Dual-Mode, §11 Output, §13 Explainability
**Duration:** 4 weeks

### Wave 1: Core Controls
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Funnel ratio sliders (BOFU/MOFU/TOFU) | §1.1 | 10/10 | NEW: `FunnelRatioSlider.tsx` |
| Target keyword count selector | §1.2 | 10/10 | NEW: `TargetCountSelector.tsx` |
| Difficulty range filter | §1.3 | 8/10 | NEW: `DifficultyFilter.tsx` |
| Volume threshold controls | §1.4 | 8/10 | NEW: `VolumeFilter.tsx` |

### Wave 2: Presets & Dual-Mode UX
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Industry presets (10 verticals) | §1.6, §16.2 | 8/10 | NEW: `IndustryPresets.tsx` |
| Smart defaults (40/35/25) | §16.1 | 8/10 | `types.ts` |
| Simple Mode ("Just Go") | §17.1 | 9/10 | `KeywordAnalysisChat.tsx` |
| Power Mode (full controls) | §17.2 | 8/10 | NEW: `PowerModePanel.tsx` |
| Mode toggle + keyboard shortcut | §17.3 | 7/10 | `KeywordAnalysisChat.tsx` |
| Geo/city toggle panel | §1.5 | 8/10 | NEW: `GeoTogglePanel.tsx` |

### Wave 3: Results Display & Filtering
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Column customization (sort, reorder) | §11.2 | 8/10 | `AnalysisResults.tsx` |
| Post-analysis filtering | §11.5 | 8/10 | NEW: `ResultsFilter.tsx` |
| Bulk selection & operations | §1.7 | 7/10 | NEW: `BulkOperations.tsx` |
| Comparison view (before/after) | §1.8 | 7/10 | NEW: `ComparisonView.tsx` |

### Wave 4: Export & Visualization
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Excel export with formatting | §11.1 | 10/10 | `ExportActions.tsx` |
| Google Sheets direct push | §11.1 | 9/10 | NEW: `sheets-export.ts` |
| Custom column selection | §11.2 | 8/10 | NEW: `ColumnSelector.tsx` |
| Funnel distribution charts | §11.3 | 7/10 | NEW: `FunnelChart.tsx` |
| Difficulty/volume scatter plot | §11.3 | 6/10 | NEW: `ScatterPlot.tsx` |

### Wave 5: Explainability & Trust
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Score breakdowns (weight contributions) | §13.1 | 10/10 | `AnalysisResults.tsx` |
| Human-readable exclusion reasons | §13.2 | 10/10 | `filtering/types.ts` |
| Confidence indicators | §13.3 | 8/10 | NEW: `ConfidenceIndicator.tsx` |
| "Why this keyword?" popover | §13.1 | 7/10 | NEW: `WhyPopover.tsx` |
| Auto-generated rationale templates | §13.6 | 9/10 | NEW: `rationale-generator.ts` |
| Annotations & notes | §11.6 | 6/10 | NEW: `KeywordNotes.tsx` |

**Verification:** New users complete first analysis in <30s, power users access all controls, Excel exports with charts

---

## Phase 86: Semantic Intelligence (UNCHANGED from 88)

**Goal:** AI-powered clustering and insights
**Why Fourth:** Requires solid foundation + input quality
**Source Sections:** §3 Vectorization
**Duration:** 3 weeks

### Wave 1: Clustering Foundation
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| HDBSCAN semantic clustering | §3.2 | 9/10 | NEW: `SemanticClusterer.ts` |
| Intent similarity grouping | §3.3 | 8/10 | NEW: `IntentSimilarityScorer.ts` |
| Semantic deduplication | §3.4 | 7/10 | NEW: `SemanticDeduplicator.ts` |

### Wave 2: Classification Intelligence
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Embedding-based funnel classification | §3.5 | 8/10 | NEW: `EmbeddingFunnelClassifier.ts` |
| Success pattern mining | §4.7 | 7/10 | NEW: `SuccessPatternMiner.ts` |
| Quick win detection improvements | §3.6 | 7/10 | `RelevanceScorer.ts` |

### Wave 3: Advanced Semantics
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Cross-language LT↔EN matching | §3.7 | 6/10 | NEW: `CrossLanguageMatcher.ts` |
| Topic modeling | §3.8 | 5/10 | NEW: `TopicModeler.ts` |
| Keyword expansion suggestions | §3.9 | 5/10 | NEW: `ExpansionSuggester.ts` |
| Visual keyword clusters | §11.3 | 5/10 | NEW: `ClusterMap.tsx` |

**Verification:** 1000 keywords clustered into 15-25 semantic groups in <2s

---

## Phase 87: Agency Business (MERGED: 89 + 92)

**Goal:** End-to-end workflow from analysis to pricing to ROI
**Why Fifth:** Building on solid analysis + output
**Source Sections:** §9 Agency Workflow, §15 Pricing & ROI, §18 User Journey
**Duration:** 4 weeks

### Wave 1: Proposal Generation
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| One-click proposal export | §9.1 | 9/10 | NEW: `ProposalGenerator.tsx` |
| Package builder (Bronze/Silver/Gold) | §15.2 | 8/10 | NEW: `PackageBuilder.tsx` |
| Branded export templates | §11.7 | 6/10 | NEW: `export-templates/` |

### Wave 2: Pricing & Estimation
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Effort per keyword calculation | §15.1 | 9/10 | NEW: `EffortEstimator.ts` |
| Content pieces needed estimate | §15.1 | 8/10 | `EffortEstimator.ts` |
| Links needed estimate | §15.1 | 7/10 | `EffortEstimator.ts` |
| Pricing calculator | §15.3 | 8/10 | NEW: `PricingCalculator.tsx` |

### Wave 3: ROI & Projections
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Traffic projections | §15.4 | 9/10 | NEW: `RoiProjector.ts` |
| Conversion estimates | §15.4 | 8/10 | `RoiProjector.ts` |
| Break-even timeline | §15.4 | 7/10 | `RoiProjector.ts` |
| Client ROI dashboard | §15.5 | 8/10 | NEW: `RoiDashboard.tsx` |

### Wave 4: Content Handoff
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Bulk brief creation | §9.2 | 8/10 | NEW: `BulkBriefCreator.tsx` |
| Content calendar push | §9.3 | 7/10 | `contentCalendarStore.ts` |
| Team assignment queue | §9.4 | 7/10 | NEW: `TeamAssignment.tsx` |
| Client-facing share link | §9.3 | 8/10 | NEW: `ShareLink.tsx` |

### Wave 5: Client Delivery & Tracking
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Read-only client portal | §9.7 | 7/10 | NEW: `ClientPortal.tsx` |
| Feedback collection | §9.8 | 6/10 | NEW: `FeedbackWidget.tsx` |
| Case study generation | §15.5 | 7/10 | NEW: `CaseStudyGenerator.ts` |

**Verification:** Analysis → signed proposal in <15 minutes, briefs auto-generated, ROI projections accurate

---

## Phase 88: Learning & Collaboration (MERGED: 90 + 91)

**Goal:** Learning system that improves + multi-user teams
**Why Sixth:** Requires historical data + solid workflow foundation
**Source Sections:** §4 Cross-Reference, §10 Competitive, §14 Collaboration
**Duration:** 4 weeks

### Wave 1: Outcome Tracking Foundation
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Keyword selection → ranking tracker | §4.1 | 10/10 | NEW: `keyword_selection_outcomes` schema |
| Actual vs projected comparison | §4.1 | 8/10 | NEW: `OutcomeComparison.tsx` |
| Success/failure logging | §4.1 | 7/10 | NEW: `outcome-logger.ts` |
| Decision audit trail | §13.5 | 8/10 | NEW: `analysis_audit_log` schema |

### Wave 2: Portfolio Intelligence
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Cross-client benchmarks by industry | §4.2 | 8/10 | NEW: `industry_keyword_benchmarks` schema |
| Strategy timeline per client | §4.3 | 7/10 | NEW: `StrategyTimeline.tsx` |
| Conflict detection (same keyword) | §4.5 | 6/10 | NEW: `ConflictDetector.ts` |
| Success pattern mining | §4.7 | 8/10 | NEW: `keyword_success_predictors` schema |

### Wave 3: Access Control & Teams
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Role-based access (analyst/manager/client) | §14.1 | 10/10 | NEW: `roles` schema, `RoleGuard.tsx` |
| Team templates | §14.4 | 7/10 | NEW: `TeamTemplates.tsx` |
| Workspace sharing | §14.4 | 7/10 | `workspace` schema updates |

### Wave 4: Review & Predictive
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Submit for review | §14.2 | 9/10 | NEW: `ReviewSubmit.tsx` |
| Manager approval | §14.2 | 8/10 | NEW: `ApprovalWorkflow.tsx` |
| Revision tracking | §14.2 | 7/10 | NEW: `analysis_revisions` schema |
| Time-to-rank estimation | §15.1 | 7/10 | NEW: `RankTimeEstimator.ts` |
| Competitor tracking | §4.4 | 6/10 | NEW: `competitor_keyword_tracking` schema |

### Wave 5: Real-Time & Notifications
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Presence awareness | §14.3 | 6/10 | NEW: `PresenceIndicator.tsx` |
| Activity notifications | §14.5 | 6/10 | NEW: `NotificationSystem.tsx` |
| @mentions in comments | §14.3 | 5/10 | NEW: `MentionInput.tsx` |
| What-if dry-run scenarios | §13.4 | 7/10 | NEW: `WhatIfPanel.tsx` |
| Low-confidence review queue | §13.3 | 6/10 | NEW: `ReviewQueue.tsx` |

**Verification:** System predicts ranking success with >70% accuracy after 50 analyses, manager approves before client delivery

---

## Phase 89: Client Acquisition & Activation (NEW - covers journey gaps)

**Goal:** Complete the agency journey from prospect to activated client
**Why Seventh:** Enables agencies to win AND onboard clients, not just serve them
**Source Sections:** §18 User Journey (Stages 1, 2, 6), §17 Power UX gaps
**Duration:** 4 weeks

### Wave 1: Prospect Discovery
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Prospect import from URL | §18 Stage 1 | 9/10 | NEW: `ProspectImporter.tsx` |
| Competitor auto-detection | §18 Stage 1 | 8/10 | NEW: `CompetitorDetector.ts` |
| Quick opportunity scan (<60s) | §18 Stage 1 | 9/10 | NEW: `OpportunityScanner.ts` |
| Discovery call prep sheet | §18 Stage 1 | 8/10 | NEW: `DiscoveryPrepSheet.tsx` |
| Existing content audit | §18 Stage 1 | 7/10 | NEW: `ContentAuditor.ts` |

### Wave 2: Discovery Call Assistant
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Live notes with constraint extraction | §18 Stage 2 | 9/10 | NEW: `LiveCallAssistant.tsx` |
| Instant 60-second analysis | §18 Stage 2 | 10/10 | NEW: `QuickAnalysis.ts` |
| Objection handler with data | §18 Stage 2 | 8/10 | NEW: `ObjectionHandler.tsx` |
| Live quote calculator | §18 Stage 2 | 8/10 | NEW: `LiveQuoteCalculator.tsx` |
| Voice note capture (optional) | §18 Stage 2 | 6/10 | NEW: `VoiceNoteCapture.tsx` |

### Wave 3: Contract & Onboarding
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Proposal to contract flow | §18 Stage 6 | 8/10 | NEW: `ContractGenerator.tsx` |
| E-signature integration (PandaDoc/DocuSign) | §18 Stage 6 | 7/10 | NEW: `esign-integration.ts` |
| Auto client creation (AI-Writer + open-seo) | §18 Stage 6 | 9/10 | NEW: `ClientActivator.ts` |
| Keyword lock-in as contracted scope | §18 Stage 6 | 8/10 | `keyword_contracts` schema |
| Onboarding checklist auto-generation | §18 Stage 6 | 7/10 | NEW: `OnboardingChecklist.tsx` |

### Wave 4: Power User Polish
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Batch operations (multi-client) | §17 | 7/10 | NEW: `BatchOperations.tsx` |
| Keyboard shortcuts system | §17 | 6/10 | NEW: `keyboard-shortcuts.ts` |
| Power Mode interactive tour | §17 | 5/10 | NEW: `PowerModeTour.tsx` |
| A/B testing framework | §17 | 4/10 | NEW: `ab-testing.ts` |

**Verification:** Prospect → signed contract in <30 minutes, auto client creation works, keyboard shortcuts documented

---

## Mapping: Old → New

| Old Phase | Old Name | New Phase | New Name | Notes |
|-----------|----------|-----------|----------|-------|
| 83 | Foundation & Reliability | 83 | Foundation & Reliability | Unchanged - prerequisite |
| 84 | Input & Data Sources | 84 | Conversational Input & Adaptive Context | Conversation-first + PROSPECT/CLIENT modes |
| 85 | Analysis Controls & UX | 85 | Analysis Experience | Merged with 86 + 87 |
| 86 | Output & Visualization | 85 | Analysis Experience | Wave 3-4 of new 85 |
| 87 | Explainability & Trust | 85 | Analysis Experience | Wave 5 of new 85 |
| 88 | Semantic Intelligence | 86 | Semantic Intelligence | Renumbered only |
| 89 | Agency Workflow | 87 | Agency Business | Merged with 92 |
| 90 | Cross-Reference Intelligence | 88 | Learning & Collaboration | Merged with 91 |
| 91 | Collaboration | 88 | Learning & Collaboration | Wave 3-5 of new 88 |
| 92 | Pricing & ROI | 87 | Agency Business | Wave 2-3 of new 87 |
| NEW | User Journey Gaps (§18) | 89 | Client Acquisition & Activation | Stages 1, 2, 6 + §17 gaps |

---

## Summary

| Phase | Name | Waves | Duration | Key Deliverable |
|-------|------|-------|----------|-----------------|
| 83 | Foundation & Reliability | 3 | 2 weeks | Bulletproof SSE + caching |
| 84 | Conversational Input Integration | 2 | 1 week | Wire existing KeywordGenerator + GSC bridge + import UI (mostly built) |
| 85 | Analysis Experience | 5 | 4 weeks | Controls + dual-mode + export + explainability |
| 86 | Semantic Intelligence | 3 | 3 weeks | HDBSCAN clustering, cross-language |
| 87 | Agency Business | 5 | 4 weeks | Proposals + pricing + ROI + handoff |
| 88 | Learning & Collaboration | 5 | 4 weeks | Outcome tracking + teams + review workflow |
| 89 | Client Acquisition & Activation | 4 | 4 weeks | Prospect → Contract → Activated client |

**Total:** 8 phases x ~4 waves = **29 waves** (bulletproof coverage)
**Duration:** ~24 weeks (complete agency journey from prospect to results)

---

## Dependency Graph

```
Phase 83 (Foundation)
    |
    v
Phase 84 (Conversational Input + Adaptive Context)
    |
    +------------------+
    |                  |
    v                  v
Phase 85 (Analysis Experience)
    |                  |
    v                  |
Phase 86 (Semantic) <--+
    |
    v
Phase 87 (Agency Business)
    |
    +------------------+
    |                  |
    v                  v
Phase 88 (Learning)    Phase 89 (Client Acquisition)
```

**Critical Path:** 83 → 84 → 85 → 87 → 89

**Parallelizable:**
- Phase 86 (Semantic) can start after Phase 84 Wave 3
- Phase 88 (Learning) and Phase 89 (Acquisition) can run in parallel after Phase 87 Wave 1
- Phase 89 Wave 1-2 (Prospect/Discovery) can start after Phase 87 Wave 1 (has proposal foundation)

---

## Why This Structure is Better

### For Users
1. **Coherent Value Delivery**: Phase 85 delivers "complete analysis experience" not fragmented pieces
2. **Faster Business Value**: Phase 87 delivers proposals + pricing together (what agencies actually sell)
3. **No Orphan Features**: Explainability ships WITH output, not as separate phase

### For Development
1. **Fewer Context Switches**: Backend devs stay on 86 (semantic), frontend on 85 (UX)
2. **Better Testing**: E2E tests cover complete user flows per phase
3. **Cleaner PRs**: Changes to AnalysisResults.tsx happen in one phase, not three

### For Planning
1. **Clearer Dependencies**: 7 phases easier to sequence than 10
2. **Milestone Alignment**: Each phase = shippable product increment
3. **Resource Planning**: 4-week phases fit sprint boundaries better

---

## Implementation Notes

### Wave Execution Pattern

Each wave follows GSD execute-plan workflow:
1. Create `XX-YY-PLAN.md` with tasks
2. Execute with `gsd-executor` subagent
3. TDD for service code (RED → GREEN commits)
4. Verify with tests + manual check
5. Create `XX-YY-SUMMARY.md`

### File Naming

```
.planning/phases/85-analysis-experience/
├── 85-CONTEXT.md
├── 85-01-PLAN.md (Wave 1: Core Controls)
├── 85-01-SUMMARY.md
├── 85-02-PLAN.md (Wave 2: Presets & Dual-Mode)
├── 85-02-SUMMARY.md
├── 85-03-PLAN.md (Wave 3: Results Display)
├── 85-03-SUMMARY.md
├── 85-04-PLAN.md (Wave 4: Export & Viz)
├── 85-04-SUMMARY.md
├── 85-05-PLAN.md (Wave 5: Explainability)
└── 85-05-SUMMARY.md
```

### Success Metrics Per Phase

| Phase | Primary Metric | Target |
|-------|---------------|--------|
| 83 | Error recovery rate | 99%+ |
| 84 | KeywordGenerator wired + GSC bridge + import UI | 95%+ |
| 85 | Time to first analysis + export quality | <30s, Excel works |
| 86 | Cluster quality (silhouette score) | >0.5 |
| 87 | Proposal generation + ROI adoption | 80%+ |
| 88 | Prediction accuracy + review completion | >70%, 90%+ |
| 89 | Prospect → contract conversion time | <30 min |

---

*Consolidation completed: 2026-05-05*
*Updated: 2026-05-05 - Added Phase 89 (Client Acquisition & Activation) for bulletproof coverage*
*Methodology: PM-driven value bundling with technical cohesion*
*Coverage: 100% of WORLD-CLASS-KEYWORD-ANALYSIS.md (18 sections, 8 journey stages)*
