# World-Class Keyword Analysis: GSD Phase Roadmap

> **Source:** WORLD-CLASS-KEYWORD-ANALYSIS.md (8,695 lines, 18 sections)
> **Methodology:** Group by technical cohesion, sequence by dependencies, maximize waves per phase
> **Result:** 10 phases × 3 waves = 30 execution waves

---

## Design Principles

### Why This Structure?

1. **Dependencies First** — Can't build fancy features on a flaky foundation
2. **Input Before Output** — Data quality drives analysis quality
3. **User Journey Order** — Import → Analyze → Configure → Export → Collaborate → Track
4. **Technical Cohesion** — Group items touching same files/systems
5. **Value Velocity** — Deliver usable improvements each wave

### Phase Sizing

| Size | Waves | Duration | Team |
|------|-------|----------|------|
| Small | 2-3 | 1-2 weeks | 1 dev |
| Medium | 3-4 | 2-3 weeks | 1-2 devs |
| Large | 4-5 | 3-4 weeks | 2-3 devs |

**Target:** 3 waves per phase (medium size) for consistent velocity

---

## Phase 83: Foundation & Reliability

**Goal:** Make the existing system bulletproof before adding features
**Why First:** Users will abandon a flaky tool no matter how feature-rich
**Source Sections:** §6 Cost, §7 Performance, §8 Edge Cases

### Wave 1: Error Handling & Recovery
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| SSE auto-reconnect (5 retries + backoff) | §8.2 | 9/10 | `useKeywordAnalysis.ts` |
| Checkpoint/resume system (IndexedDB) | §8.1 | 10/10 | NEW: `checkpoint-manager.ts` |
| Graceful degradation (skip optional stages) | §8.4 | 7/10 | `analysis-pipeline.ts` |
| Error message templates | §8.3 | 6/10 | NEW: `error-handler.ts` |

### Wave 2: Performance & Caching
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Constraint caching (skip LLM repeats) | §6.1 | 10/10 | `ConstraintExtractor.ts` |
| Parallel pipeline execution | §7.1 | 9/10 | `analysis-pipeline.ts` |
| Embedding cache (3-tier) | §6.2 | 8/10 | `EmbeddingService.ts` |
| LLM classification cache | §6.3 | 7/10 | `GrokClassifier.ts`, `FunnelLLMClassifier.ts` |

### Wave 3: Cost Controls
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Cost tracking per analysis | §6.5 | 7/10 | NEW: `cost-tracker.ts` |
| Progressive model selection | §6.4 | 6/10 | `ConstraintExtractor.ts` |
| Usage dashboard | §6.5 | 5/10 | NEW: `UsageDashboard.tsx` |

**Verification:** All tests pass, SSE reconnects on network drop, cache hit rate >60%

---

## Phase 84: Input & Data Sources

**Goal:** Meet agencies where their data already lives
**Why Second:** Can't improve analysis without proper input
**Source Sections:** §12 Data Sources, §5 Client Segmentation

### Wave 1: Import Infrastructure
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| CSV import UI with column mapping | §12.1 | 10/10 | NEW: `CsvImportDialog.tsx` |
| Ahrefs/SEMrush format auto-detection | §12.2 | 9/10 | `CsvImportService.ts` |
| Bulk paste improvements (10K keywords) | §12.3 | 8/10 | `KeywordAnalysisChat.tsx` |

### Wave 2: External Integrations
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Google Sheets sync (read/write) | §12.4 | 8/10 | NEW: `sheets-integration.ts` |
| Competitor keyword import | §12.8 | 7/10 | `CompetitorSpyService.ts` |
| Auto-enrichment trigger | §12.3 | 7/10 | `analysis-pipeline.ts` |

### Wave 3: Client Data Integration
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Client website detection | §5.1 | 9/10 | `ConstraintExtractor.ts` |
| Client profile auto-injection | §2.2 | 8/10 | NEW: `client-context.ts` |
| Industry vertical detection | §5.2 | 7/10 | `ConstraintExtractor.ts` |
| GSC data overlay | §12.7 | 7/10 | `gsc_service.py` |

**Verification:** Import 1000 keywords from Ahrefs CSV in <5s, Sheets sync works bidirectionally

---

## Phase 85: Analysis Controls & UX

**Goal:** Give power users the controls they need
**Why Third:** Once input is solid, improve the analysis experience
**Source Sections:** §1 UX Controls, §16 Smart Defaults, §17 Intuitive vs Power

### Wave 1: Core Controls
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Funnel ratio sliders (BOFU/MOFU/TOFU) | §1.1 | 10/10 | NEW: `FunnelRatioSlider.tsx` |
| Target keyword count selector | §1.2 | 10/10 | NEW: `TargetCountSelector.tsx` |
| Difficulty range filter | §1.3 | 8/10 | NEW: `DifficultyFilter.tsx` |
| Volume threshold controls | §1.4 | 8/10 | NEW: `VolumeFilter.tsx` |

### Wave 2: Presets & Defaults
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Industry presets (10 verticals) | §1.6, §16.2 | 8/10 | NEW: `IndustryPresets.tsx` |
| Smart defaults (40/35/25) | §16.1 | 8/10 | `types.ts` |
| Geo/city toggle panel | §1.5 | 8/10 | NEW: `GeoTogglePanel.tsx` |
| Conversation-based detection | §16.3 | 7/10 | `ConstraintExtractor.ts` |

### Wave 3: Dual-Mode UX
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Simple Mode ("Just Go") | §17.1 | 9/10 | `KeywordAnalysisChat.tsx` |
| Power Mode (full controls) | §17.2 | 8/10 | NEW: `PowerModePanel.tsx` |
| Mode toggle + keyboard shortcut | §17.3 | 7/10 | `KeywordAnalysisChat.tsx` |
| Progressive disclosure levels | §17.4 | 6/10 | NEW: `OnboardingTour.tsx` |

**Verification:** New users complete first analysis in <30s, power users access all 12 controls

---

## Phase 86: Output & Visualization

**Goal:** Professional deliverables for clients
**Why Fourth:** Better output = happier clients
**Source Sections:** §11 Output Controls

### Wave 1: Export Enhancements
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Excel export with formatting | §11.1 | 10/10 | `ExportActions.tsx` |
| Google Sheets direct push | §11.1 | 9/10 | NEW: `sheets-export.ts` |
| Custom column selection | §11.2 | 8/10 | NEW: `ColumnSelector.tsx` |
| Branded export templates | §11.7 | 6/10 | NEW: `export-templates/` |

### Wave 2: Results Display
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Column customization (sort, reorder) | §11.2 | 8/10 | `AnalysisResults.tsx` |
| Post-analysis filtering | §11.5 | 8/10 | NEW: `ResultsFilter.tsx` |
| Bulk selection & operations | §1.7 | 7/10 | NEW: `BulkOperations.tsx` |
| Comparison view (before/after) | §1.8 | 7/10 | NEW: `ComparisonView.tsx` |

### Wave 3: Visualization
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Funnel distribution charts | §11.3 | 7/10 | NEW: `FunnelChart.tsx` |
| Difficulty/volume scatter plot | §11.3 | 6/10 | NEW: `ScatterPlot.tsx` |
| Annotations & notes | §11.6 | 6/10 | NEW: `KeywordNotes.tsx` |
| Visual keyword clusters | §11.3 | 5/10 | NEW: `ClusterMap.tsx` |

**Verification:** Export to Excel with charts, client receives branded PDF report

---

## Phase 87: Explainability & Trust

**Goal:** Make AI decisions transparent and defensible
**Why Fifth:** Agencies need to justify recommendations to clients
**Source Sections:** §13 Explainability

### Wave 1: Score Transparency
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Score breakdowns (weight contributions) | §13.1 | 10/10 | `AnalysisResults.tsx` |
| Human-readable exclusion reasons | §13.2 | 10/10 | `filtering/types.ts` |
| Confidence indicators | §13.3 | 8/10 | NEW: `ConfidenceIndicator.tsx` |

### Wave 2: Audit & History
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Decision audit trail | §13.5 | 8/10 | NEW: `analysis_audit_log` schema |
| Constraint change logging | §13.5 | 7/10 | `session-service.ts` |
| What-if dry-run scenarios | §13.4 | 7/10 | NEW: `WhatIfPanel.tsx` |

### Wave 3: Client-Facing Explanations
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Auto-generated rationale templates | §13.6 | 9/10 | NEW: `rationale-generator.ts` |
| "Why this keyword?" popover | §13.1 | 7/10 | NEW: `WhyPopover.tsx` |
| Low-confidence review queue | §13.3 | 6/10 | NEW: `ReviewQueue.tsx` |

**Verification:** Every keyword has explainable score, client can ask "why" and get answer

---

## Phase 88: Semantic Intelligence

**Goal:** AI-powered clustering and insights
**Why Sixth:** Requires solid foundation + input quality
**Source Sections:** §3 Vectorization

### Wave 1: Clustering
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| HDBSCAN semantic clustering | §3.2 | 9/10 | NEW: `SemanticClusterer.ts` |
| Intent similarity grouping | §3.3 | 8/10 | NEW: `IntentSimilarityScorer.ts` |
| Semantic deduplication | §3.4 | 7/10 | NEW: `SemanticDeduplicator.ts` |

### Wave 2: Intelligence
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Embedding-based funnel classification | §3.5 | 8/10 | NEW: `EmbeddingFunnelClassifier.ts` |
| Success pattern mining | §4.7 | 7/10 | NEW: `SuccessPatternMiner.ts` |
| Quick win detection improvements | §3.6 | 7/10 | `RelevanceScorer.ts` |

### Wave 3: Advanced
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Cross-language LT↔EN matching | §3.7 | 6/10 | NEW: `CrossLanguageMatcher.ts` |
| Topic modeling | §3.8 | 5/10 | NEW: `TopicModeler.ts` |
| Keyword expansion suggestions | §3.9 | 5/10 | NEW: `ExpansionSuggester.ts` |

**Verification:** 1000 keywords clustered into 15-25 semantic groups in <2s

---

## Phase 89: Agency Workflow

**Goal:** End-to-end workflow automation
**Why Seventh:** Building on solid analysis + output
**Source Sections:** §9 Agency Workflow, §15 Pricing & ROI, §18 User Journey

### Wave 1: Proposal Generation
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| One-click proposal export | §9.1 | 9/10 | NEW: `ProposalGenerator.tsx` |
| Package builder (Bronze/Silver/Gold) | §15.2 | 8/10 | NEW: `PackageBuilder.tsx` |
| Pricing calculator | §15.3 | 8/10 | NEW: `PricingCalculator.tsx` |

### Wave 2: Content Handoff
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Bulk brief creation | §9.2 | 8/10 | NEW: `BulkBriefCreator.tsx` |
| Content calendar push | §9.3 | 7/10 | `contentCalendarStore.ts` |
| Team assignment queue | §9.4 | 7/10 | NEW: `TeamAssignment.tsx` |

### Wave 3: Client Delivery
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Client-facing share link | §9.3 | 8/10 | NEW: `ShareLink.tsx` |
| Read-only client portal | §9.7 | 7/10 | NEW: `ClientPortal.tsx` |
| Feedback collection | §9.8 | 6/10 | NEW: `FeedbackWidget.tsx` |

**Verification:** Analysis → signed proposal in <15 minutes, briefs auto-generated

---

## Phase 90: Cross-Reference Intelligence

**Goal:** Learning system that improves over time
**Why Eighth:** Requires historical data to be meaningful
**Source Sections:** §4 Cross-Reference, §10 Competitive Differentiation

### Wave 1: Outcome Tracking
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Keyword selection → ranking tracker | §4.1 | 10/10 | NEW: `keyword_selection_outcomes` schema |
| Actual vs projected comparison | §4.1 | 8/10 | NEW: `OutcomeComparison.tsx` |
| Success/failure logging | §4.1 | 7/10 | NEW: `outcome-logger.ts` |

### Wave 2: Portfolio Intelligence
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Cross-client benchmarks by industry | §4.2 | 8/10 | NEW: `industry_keyword_benchmarks` schema |
| Strategy timeline per client | §4.3 | 7/10 | NEW: `StrategyTimeline.tsx` |
| Conflict detection (same keyword) | §4.5 | 6/10 | NEW: `ConflictDetector.ts` |

### Wave 3: Predictive
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Success pattern mining | §4.7 | 8/10 | NEW: `keyword_success_predictors` schema |
| Time-to-rank estimation | §15.1 | 7/10 | NEW: `RankTimeEstimator.ts` |
| Competitor tracking | §4.4 | 6/10 | NEW: `competitor_keyword_tracking` schema |

**Verification:** System predicts ranking success with >70% accuracy after 50 analyses

---

## Phase 91: Collaboration

**Goal:** Multi-user agency teams
**Why Ninth:** Individual workflow must be solid first
**Source Sections:** §14 Collaboration

### Wave 1: Access Control
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Role-based access (analyst/manager/client) | §14.1 | 10/10 | NEW: `roles` schema, `RoleGuard.tsx` |
| Team templates | §14.4 | 7/10 | NEW: `TeamTemplates.tsx` |
| Workspace sharing | §14.4 | 7/10 | `workspace` schema updates |

### Wave 2: Review Workflow
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Submit for review | §14.2 | 9/10 | NEW: `ReviewSubmit.tsx` |
| Manager approval | §14.2 | 8/10 | NEW: `ApprovalWorkflow.tsx` |
| Revision tracking | §14.2 | 7/10 | NEW: `analysis_revisions` schema |

### Wave 3: Real-Time
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Presence awareness | §14.3 | 6/10 | NEW: `PresenceIndicator.tsx` |
| Activity notifications | §14.5 | 6/10 | NEW: `NotificationSystem.tsx` |
| @mentions in comments | §14.3 | 5/10 | NEW: `MentionInput.tsx` |

**Verification:** Manager approves analysis before client delivery, activity logged

---

## Phase 92: Pricing & ROI

**Goal:** Help agencies sell and prove value
**Why Tenth:** Final layer after core features complete
**Source Sections:** §15 Pricing & ROI

### Wave 1: Estimation
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Effort per keyword calculation | §15.1 | 9/10 | NEW: `EffortEstimator.ts` |
| Content pieces needed estimate | §15.1 | 8/10 | `EffortEstimator.ts` |
| Links needed estimate | §15.1 | 7/10 | `EffortEstimator.ts` |

### Wave 2: ROI Projections
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Traffic projections | §15.4 | 9/10 | NEW: `RoiProjector.ts` |
| Conversion estimates | §15.4 | 8/10 | `RoiProjector.ts` |
| Break-even timeline | §15.4 | 7/10 | `RoiProjector.ts` |

### Wave 3: Success Tracking
| Item | Source | Impact | Files |
|------|--------|--------|-------|
| Client ROI dashboard | §15.5 | 8/10 | NEW: `RoiDashboard.tsx` |
| Case study generation | §15.5 | 7/10 | NEW: `CaseStudyGenerator.ts` |
| Win/loss price correlation | §15.6 | 5/10 | NEW: `PriceAnalytics.ts` |

**Verification:** Proposal includes projected ROI, dashboard shows actual vs projected

---

## Summary

| Phase | Name | Waves | Key Deliverable |
|-------|------|-------|-----------------|
| 83 | Foundation & Reliability | 3 | Bulletproof SSE + caching |
| 84 | Input & Data Sources | 3 | CSV/Sheets import, client detection |
| 85 | Analysis Controls & UX | 3 | Funnel sliders, presets, dual-mode |
| 86 | Output & Visualization | 3 | Excel export, charts, filtering |
| 87 | Explainability & Trust | 3 | Score breakdowns, "why" answers |
| 88 | Semantic Intelligence | 3 | HDBSCAN clustering, deduplication |
| 89 | Agency Workflow | 3 | One-click proposal, briefs |
| 90 | Cross-Reference Intelligence | 3 | Outcome tracking, benchmarks |
| 91 | Collaboration | 3 | RBAC, approval workflow |
| 92 | Pricing & ROI | 3 | Effort estimation, ROI dashboard |

**Total:** 10 phases × 3 waves = **30 waves**
**Duration:** ~20-30 weeks (assuming 1 wave/week pace)

---

## Dependency Graph

```
Phase 83 (Foundation)
    ↓
Phase 84 (Input) ────────────────────┐
    ↓                                │
Phase 85 (Controls) ──→ Phase 86 (Output)
    ↓                        ↓
Phase 87 (Explainability) ───┘
    ↓
Phase 88 (Semantic) ──→ Phase 89 (Workflow)
                              ↓
Phase 90 (Cross-Ref) ←────────┘
    ↓
Phase 91 (Collaboration)
    ↓
Phase 92 (Pricing & ROI)
```

**Critical Path:** 83 → 84 → 85 → 86 → 89 → 90

**Parallelizable:**
- Phase 87 (Explainability) can run parallel to Phase 86 (Output)
- Phase 88 (Semantic) can start after Phase 85 (Controls)
- Phase 91 (Collaboration) can start after Phase 89 (Workflow)

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
.planning/phases/83-foundation-reliability/
├── 83-CONTEXT.md
├── 83-01-PLAN.md (Wave 1: Error Handling)
├── 83-01-SUMMARY.md
├── 83-02-PLAN.md (Wave 2: Performance)
├── 83-02-SUMMARY.md
├── 83-03-PLAN.md (Wave 3: Cost Controls)
└── 83-03-SUMMARY.md
```

### Success Metrics Per Phase

| Phase | Primary Metric | Target |
|-------|---------------|--------|
| 83 | Error recovery rate | 99%+ |
| 84 | Import success rate | 95%+ |
| 85 | Time to first analysis | <30s |
| 86 | Export usage rate | 80%+ |
| 87 | "Why" question rate | <5% (means clear enough) |
| 88 | Cluster quality (silhouette) | >0.5 |
| 89 | Proposal generation rate | 80%+ |
| 90 | Prediction accuracy | >70% |
| 91 | Review completion rate | 90%+ |
| 92 | ROI tracking adoption | 60%+ |
