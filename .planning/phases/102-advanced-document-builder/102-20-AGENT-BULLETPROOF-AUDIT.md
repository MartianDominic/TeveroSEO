# Phase 102: 20-Agent Opus Bulletproof Audit

**Audit Date:** 2026-05-18
**Methodology:** Parallel 20-agent comprehensive review with specialized perspectives
**Scope:** ~10,841 lines of code across 76 document-related files, 13 test suites

---

## Audit Framework Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PHASE 102 BULLETPROOF AUDIT                         │
│                    Advanced Document Builder System                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ Security        │  │ Type Safety     │  │ Performance     │             │
│  │ Agent #1        │  │ Agent #2        │  │ Agent #3        │             │
│  │ ─────────────   │  │ ─────────────   │  │ ─────────────   │             │
│  │ XSS/Injection   │  │ TypeScript      │  │ Re-renders      │             │
│  │ Auth/OWASP      │  │ Runtime Zod     │  │ Memory/Bundle   │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ Test Coverage   │  │ API Design      │  │ State Mgmt      │             │
│  │ Agent #4        │  │ Agent #5        │  │ Agent #6        │             │
│  │ ─────────────   │  │ ─────────────   │  │ ─────────────   │             │
│  │ Coverage Gaps   │  │ REST Patterns   │  │ Zustand Store   │             │
│  │ Edge Cases      │  │ Error Handling  │  │ Race Conditions │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ Component Arch  │  │ Accessibility   │  │ Error Handling  │             │
│  │ Agent #7        │  │ Agent #8        │  │ Agent #9        │             │
│  │ ─────────────   │  │ ─────────────   │  │ ─────────────   │             │
│  │ Composition     │  │ ARIA/Keyboard   │  │ Try/Catch       │             │
│  │ Reusability     │  │ Screen Readers  │  │ User Feedback   │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ Data Validation │  │ Database Schema │  │ Concurrency     │             │
│  │ Agent #10       │  │ Agent #11       │  │ Agent #12       │             │
│  │ ─────────────   │  │ ─────────────   │  │ ─────────────   │             │
│  │ Zod Schemas     │  │ Indexes         │  │ Race Conditions │             │
│  │ Boundary Valid  │  │ Constraints     │  │ Deadlocks       │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ Memory/Resource │  │ Integration     │  │ Observability   │             │
│  │ Agent #13       │  │ Agent #14       │  │ Agent #15       │             │
│  │ ─────────────   │  │ ─────────────   │  │ ─────────────   │             │
│  │ Leaks/Cleanup   │  │ Service Bounds  │  │ Logging         │             │
│  │ Disposal        │  │ Contracts       │  │ Monitoring      │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ Code Quality    │  │ UX Flow         │  │ Documentation   │             │
│  │ Agent #16       │  │ Agent #17       │  │ Agent #18       │             │
│  │ ─────────────   │  │ ─────────────   │  │ ─────────────   │             │
│  │ SOLID/DRY       │  │ User Journeys   │  │ JSDoc           │             │
│  │ Complexity      │  │ Edge States     │  │ Inline Clarity  │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                                  │
│  │ Dependencies    │  │ Spec Compliance │                                  │
│  │ Agent #19       │  │ Agent #20       │                                  │
│  │ ─────────────   │  │ ─────────────   │                                  │
│  │ Versions        │  │ Acceptance      │                                  │
│  │ Vulnerabilities │  │ Requirements    │                                  │
│  └─────────────────┘  └─────────────────┘                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Target File Matrix

### Components (`apps/web/src/components/document-builder/`)
| File | Lines | Primary Agents | Secondary Agents |
|------|-------|----------------|------------------|
| BlockEditor.tsx | ~400 | #7, #8 | #1, #3, #6 |
| BlockPalette.tsx | ~200 | #7, #8 | #17 |
| BlockTypeBadge.tsx | ~50 | #7, #16 | |
| DocumentCanvas.tsx | ~500 | #3, #6, #7 | #1, #12, #13 |
| DropZone.tsx | ~150 | #7, #8 | #17 |
| FrameworkSelector.tsx | ~200 | #7, #17 | #20 |
| HeatmapOverlay.tsx | ~300 | #3, #7 | #16 |
| ManualBlockCreator.tsx | ~200 | #1, #10 | #7 |
| PersuasionBlock.tsx | ~400 | #7, #17 | #1, #8 |
| SafeComponents.tsx | ~150 | #1 | #16 |
| UploadDropzone.tsx | ~100 | #1 | #7 |
| VariablePicker.tsx | ~200 | #7, #8 | |
| VariantCreator.tsx | ~250 | #7, #6 | #1, #10 |
| VariantTabs.tsx | ~150 | #7, #8 | |
| VerificationUI.tsx | ~200 | #7, #17 | |
| VersionDiff.tsx | ~350 | #3, #7 | #16 |
| LazyBlockEditor.tsx | ~100 | #3 | #7 |
| index.ts | ~50 | #16 | |

### Services (`apps/web/src/lib/document-builder/`)
| File | Lines | Primary Agents | Secondary Agents |
|------|-------|----------------|------------------|
| ab-testing-service.ts | ~400 | #4, #12 | #1, #2, #14 |
| ai-generator.ts | ~350 | #1, #2 | #9, #15 |
| analytics-service.ts | ~500 | #4, #11 | #1, #12, #15 |
| analytics-sync-worker.ts | ~300 | #12, #13 | #9, #15 |
| heatmap-calculator.ts | ~250 | #3, #4 | #2 |
| input-sanitizer.ts | ~200 | #1 | #2, #4 |
| persuasion-blocks.ts | ~300 | #2, #10 | #20 |
| template-service.ts | ~400 | #2, #4 | #10, #14 |
| types.ts | ~250 | #2, #10 | |
| version-diff.ts | ~300 | #3, #4 | #2 |
| index.ts | ~50 | #16 | |

### API Routes (`apps/web/src/app/api/document-builder/`)
| File | Lines | Primary Agents | Secondary Agents |
|------|-------|----------------|------------------|
| analytics/route.ts | ~200 | #1, #5 | #9, #15 |
| export/route.ts | ~250 | #1, #5 | #9 |
| generate/route.ts | ~300 | #1, #2, #5 | #9, #15 |

### Database Schema
| File | Lines | Primary Agents | Secondary Agents |
|------|-------|----------------|------------------|
| document-builder.ts | ~400 | #11 | #2, #14 |

### Tests (`apps/web/src/lib/document-builder/__tests__/`)
| File | Primary Agents |
|------|----------------|
| ab-testing-service.test.ts | #4 |
| ai-generator.test.ts | #4 |
| analytics-service.test.ts | #4 |
| analytics-sync-worker.test.ts | #4 |
| heatmap-calculator.test.ts | #4 |
| input-sanitizer.test.ts | #4 |
| integration.test.ts | #4, #14 |
| schema.test.ts | #4, #11 |
| schemas.test.ts | #4, #10 |
| template-service.test.ts | #4 |
| types.test.ts | #4, #2 |
| version-diff.test.ts | #4 |
| analytics-route-ratelimit.test.ts | #4, #1 |

---

## Agent Assignment Summary

| Agent | Focus Area | Primary Files | Key Concerns |
|-------|------------|---------------|--------------|
| #1 | Security | All routes, sanitizer, user inputs | XSS, CSRF, injection, auth bypass |
| #2 | Type Safety | types.ts, all services | Strict types, runtime validation |
| #3 | Performance | Canvas, HeatmapOverlay, diff | Re-renders, memoization, bundle |
| #4 | Test Coverage | All __tests__/ | Gaps, edge cases, mocking |
| #5 | API Design | All route.ts files | REST patterns, error responses |
| #6 | State Management | DocumentCanvas, VariantCreator | Zustand, race conditions |
| #7 | Component Arch | All components | Composition, prop drilling |
| #8 | Accessibility | Interactive components | ARIA, keyboard, focus |
| #9 | Error Handling | Services, routes | Recovery, user feedback |
| #10 | Data Validation | Schemas, sanitizer, types | Zod, boundary validation |
| #11 | Database Schema | schema/document-builder.ts | Indexes, constraints |
| #12 | Concurrency | sync-worker, ab-testing | Race conditions, atomicity |
| #13 | Memory/Resource | Worker, large components | Leaks, cleanup |
| #14 | Integration Points | Services, routes | Contracts, boundaries |
| #15 | Observability | Services with logging | Debugging, monitoring |
| #16 | Code Quality | All files | SOLID, complexity |
| #17 | UX Flow | User-facing components | Edge states, journeys |
| #18 | Documentation | All files | JSDoc, clarity |
| #19 | Dependencies | package.json, imports | Versions, vulnerabilities |
| #20 | Spec Compliance | All vs 102-SPEC.md | Acceptance criteria |

---

## Findings Template

Each agent will append findings in this format:

```markdown
---

## Agent #N: [Focus Area] Findings

**Audit Timestamp:** [timestamp]
**Files Reviewed:** [count]
**Severity Summary:** 🔴 Critical: N | 🟠 High: N | 🟡 Medium: N | 🔵 Low: N

### 🔴 Critical Issues
(Issues that could cause data loss, security breaches, or system failures)

### 🟠 High Priority
(Issues that significantly impact quality, performance, or maintainability)

### 🟡 Medium Priority
(Issues worth fixing but not blocking)

### 🔵 Low Priority / Recommendations
(Nice-to-haves and style improvements)

### ✅ Strengths Observed
(What the implementation does well)

### 📊 Metrics
- Files analyzed: N
- Lines reviewed: N
- Test coverage gaps: N
- Patterns validated: N

---
```

---

## Execution Status

| Agent | Status | Started | Completed | Issues Found |
|-------|--------|---------|-----------|--------------|
| #1 Security | ✅ Complete | 2026-05-18T14:30 | 2026-05-18T15:15 | 🔴0 🟠2 🟡4 🔵3 |
| #2 Type Safety | ✅ Complete | 2026-05-18T14:30 | 2026-05-18T15:30 | 🔴0 🟠2 🟡4 🔵3 |
| #3 Performance | ✅ Complete | 2026-05-18T16:30 | 2026-05-18T16:45 | 🔴1 🟠3 🟡3 🔵2 |
| #4 Test Coverage | ✅ Complete | 2026-05-18T16:00 | 2026-05-18T16:30 | 🔴0 🟠3 🟡5 🔵4 |
| #5 API Design | ✅ Complete | 2026-05-18 | 2026-05-18 | 🔴0 🟠1 🟡3 🔵4 |
| #6 State Mgmt | ✅ Complete | 2026-05-18 | 2026-05-18 | 🔴0 🟠3 🟡5 🔵4 |
| #7 Component Arch | ✅ Complete | 2026-05-18T17:00 | 2026-05-18T17:30 | 🔴0 🟠2 🟡5 🔵6 |
| #8 Accessibility | ✅ Complete | 2026-05-18T12:30 | 2026-05-18T12:45 | 🔴1 🟠4 🟡6 🔵3 |
| #9 Error Handling | ✅ Complete | 2026-05-18 | 2026-05-18 | 🔴0 🟠2 🟡4 🔵3 |
| #10 Data Validation | ✅ Complete | 2026-05-18T15:30 | 2026-05-18T15:45 | 🔴0 🟠2 🟡4 🔵3 |
| #11 Database Schema | ✅ Complete | 2026-05-18T16:45 | 2026-05-18T17:15 | 🔴0 🟠2 🟡4 🔵3 |
| #12 Concurrency | ✅ Complete | 2026-05-18T16:00 | 2026-05-18T16:30 | 🔴0 🟠3 🟡4 🔵2 |
| #13 Memory/Resource | ✅ Complete | 2026-05-18T18:00 | 2026-05-18T18:45 | 🔴0 🟠2 🟡4 🔵3 |
| #14 Integration | ✅ Complete | 2026-05-18T19:00 | 2026-05-18T19:30 | 🔴0 🟠2 🟡4 🔵5 |
| #15 Observability | ✅ Complete | 2026-05-18T19:00 | 2026-05-18T19:30 | 🔴0 🟠2 🟡4 🔵4 |
| #16 Code Quality | ✅ Complete | 2026-05-18T17:30 | 2026-05-18T18:00 | 🔴0 🟠2 🟡6 🔵4 |
| #17 UX Flow | ✅ Complete | 2026-05-18T18:00 | 2026-05-18T18:30 | 🔴0 🟠3 🟡5 🔵5 |
| #18 Documentation | ✅ Complete | 2026-05-18T18:30 | 2026-05-18T19:00 | 🔴0 🟠1 🟡3 🔵6 |
| #19 Dependencies | ✅ Complete | 2026-05-18T19:00 | 2026-05-18T19:30 | 🔴1 🟠1 🟡1 🔵3 |
| #20 Spec Compliance | ✅ Complete | 2026-05-18T18:00 | 2026-05-18T18:30 | 🔴1 🟠2 🟡4 🔵3 |

---

## Consolidated Summary

**Audit Completed:** 2026-05-18
**Total Agent Hours:** ~20 Opus agents × ~5 min average = ~100 agent-minutes
**Lines Reviewed:** ~10,841 across 76 files
**Total Issues:** 🔴 4 Critical | 🟠 42 High | 🟡 79 Medium | 🔵 68 Low

---

### 🔴 Critical Issues Requiring Immediate Action (4)

| ID | Agent | Issue | Impact | File:Line |
|----|-------|-------|--------|-----------|
| **PERF-001** | #3 | **No virtualization for 50+ blocks** | SPEC violation: cannot meet <100ms re-render with 50+ blocks | `DocumentCanvas.tsx` |
| **C-A11Y-01** | #8 | **VariablePicker missing combobox ARIA** | Screen reader users cannot use variable picker | `VariablePicker.tsx` |
| **DEP-003** | #19 | **fast-uri transitive vulnerability** | HIGH severity CVE via @copilotkit chain | `pnpm-lock.yaml` |
| **DEP-004** | #19 | **Next.js version mismatch in packages/ui** | 4 HIGH CVEs in UI package (15.5.15 vs 15.5.18) | `packages/ui/package.json` |

**Immediate Actions Required:**
1. Add `@tanstack/react-virtual` to DocumentCanvas for list virtualization
2. Add proper `role="combobox"` and `aria-expanded` to VariablePicker
3. Force fast-uri>=3.1.2 resolution in pnpm overrides
4. Align packages/ui Next.js version to 15.5.18

---

### 🟠 High Priority Technical Debt (Top 20 of 42)

| ID | Agent | Issue | Remediation |
|----|-------|-------|-------------|
| H-SEC-01 | #1 | Missing CSRF protection on document-builder routes | Add `validateCsrf()` to analytics/export/generate routes |
| H-SEC-02 | #1 | sessionId rate limit bypass | Use `${userId}:${sessionId}` composite key |
| H-TS-01 | #2 | 8 type assertions bypass compile-time checks | Replace `as BlockVariantStatus` with typed constants |
| H-TS-02 | #2 | Zod schema loses literal types | Keep `as const` array without explicit type annotation |
| PERF-002 | #3 | O(m×n) LCS diff freezes on large blocks | Implement Myers diff or add size limits |
| PERF-003 | #3 | Heatmap recalculates every render | Wrap in useMemo with proper dependencies |
| PERF-004 | #3 | Full Zustand store subscription | Use existing `useCanvasState`/`useCanvasActions` hooks |
| H-TEST-01 | #4 | AI retry logic untested | Add tests for exponential backoff and error classification |
| H-API-01 | #5 | Missing Content-Type validation on analytics | Add `validateContentType(req)` before JSON parsing |
| H-STATE-01 | #6 | Stale closure in BlockEditor | Add `editor?.isDestroyed` check before content ops |
| H-STATE-02 | #6 | Shallow clone race in VariantCreator | Use `structuredClone()` instead of spread |
| H7.1 | #7 | DocumentCanvas uses full store destructuring | Switch to optimized selector hooks |
| H-A11Y-01 | #8 | Aggressive `aria-live="assertive"` spam | Change to `aria-live="polite"` for drag events |
| H-ERR-01 | #9 | No error boundary around PersuasionBlock | Wrap blocks in `InlineErrorBoundary` |
| H-10-01 | #10 | styleReferenceSchema accepts any URL | Add URL format/protocol validation |
| H-DB-01 | #11 | Missing composite index | Add `blockVariants(parentBlockId, status)` index |
| H-CON-01 | #12 | Analytics batch ordering not guaranteed | Add sequence numbers to events |
| H-MEM-01 | #13 | Module-level eventBatch never cleared | Move to session-scoped Map |
| H-INT-01 | #14 | Duplicate export aliasing | Remove duplicate `validateFrameworkCompliance` export |
| H-OBS-01 | #15 | A/B testing service has NO logging | Add structured logging to ab-testing-service |
| H-UX-01 | #17 | No document-level undo/redo | Implement command pattern for reversible actions |
| H-UX-02 | #17 | No delete confirmation | Add confirmation dialog for destructive actions |

---

### 📊 Quality Scores by Domain

| Domain | Score | Agent | Key Strength | Key Gap |
|--------|-------|-------|--------------|---------|
| **Security** | 85/100 | #1 | Excellent XSS/injection prevention | CSRF on new routes |
| **Type Safety** | 88/100 | #2 | Zero `any` types, comprehensive Zod | Type assertions in A/B service |
| **Performance** | 65/100 | #3 | Good memoization patterns | Missing virtualization (CRITICAL) |
| **Test Coverage** | 83/100 | #4 | Meets 80%+ requirement | AI retry logic gaps |
| **API Design** | 90/100 | #5 | Consistent envelope, proper status codes | Content-Type validation |
| **State Management** | 82/100 | #6 | Excellent selector architecture | Stale closure risks |
| **Component Arch** | 88/100 | #7 | 82% components memoized | Full store subscription |
| **Accessibility** | 72/100 | #8 | Good drag-drop announcements | Combobox pattern missing |
| **Error Handling** | 85/100 | #9 | Robust retry + circuit breaker | Missing error boundaries |
| **Data Validation** | 87/100 | #10 | 57+ injection patterns blocked | URL schema gaps |
| **Database Schema** | 85/100 | #11 | Proper FK + CASCADE | Missing composite indexes |
| **Concurrency** | 80/100 | #12 | Atomic Redis operations | Event ordering |
| **Memory/Resources** | 82/100 | #13 | Proper timer cleanup | Module-level state |
| **Integration** | 85/100 | #14 | Clean dependency graph | Duplicate exports |
| **Observability** | 72/100 | #15 | Good AI generator logging | A/B service blind spot |
| **Code Quality** | 80/100 | #16 | Good SOLID adherence | DRY violations |
| **UX Flow** | 70/100 | #17 | Good empty states | No undo/redo |
| **Documentation** | 92/100 | #18 | Excellent JSDoc coverage | Missing @throws |
| **Dependencies** | 77/100 | #19 | All deps actually used | Transitive vulns |
| **Spec Compliance** | 83/100 | #20 | 10/12 acceptance criteria | Performance constraint |

---

### Overall Assessment

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                    PHASE 102 PRODUCTION READINESS                         ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║   Overall Health Score:        81/100 (GOOD)                              ║
║   Specification Compliance:    83% (10/12 criteria met)                   ║
║   Test Coverage:               83% (exceeds 80% requirement)              ║
║   Security Posture:            85/100 (strong with minor gaps)            ║
║                                                                           ║
║   ┌─────────────────────────────────────────────────────────────────┐    ║
║   │ VERDICT: CONDITIONAL PASS - READY FOR STAGING                   │    ║
║   │                                                                 │    ║
║   │ Production deployment BLOCKED until:                            │    ║
║   │  1. PERF-001: Add virtualization (SPEC requirement)            │    ║
║   │  2. DEP-003/004: Fix security vulnerabilities                  │    ║
║   │                                                                 │    ║
║   │ Recommended before production:                                  │    ║
║   │  3. H-UX-01: Add undo/redo (primary failure mode mitigation)   │    ║
║   │  4. C-A11Y-01: Fix accessibility critical                      │    ║
║   └─────────────────────────────────────────────────────────────────┘    ║
║                                                                           ║
║   Confidence Level: HIGH                                                  ║
║   - 20 specialized agents reviewed all code paths                        ║
║   - No critical security vulnerabilities in Phase 102 code               ║
║   - Architecture is sound and extensible                                 ║
║   - Test coverage meets requirements                                      ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### Recommended Fix Order

**Week 1 (Blocking):**
1. Add `@tanstack/react-virtual` to DocumentCanvas
2. Fix dependency vulnerabilities (pnpm overrides)
3. Add CSRF validation to document-builder routes

**Week 2 (High Priority):**
4. Implement document-level undo/redo
5. Add error boundaries around PersuasionBlock
6. Fix VariablePicker accessibility
7. Add logging to A/B testing service

**Week 3 (Hardening):**
8. Fix all remaining High priority items
9. Add performance tests for 50+ blocks
10. Create Lithuanian proposal E2E test (SPEC litmus test)

---

*Audit completed: 2026-05-18*
*Framework version: 20-Agent Parallel Opus Review v1.0*
*Total findings: 193 (4 Critical, 42 High, 79 Medium, 68 Low)*

---

## Agent #9: Error Handling Findings

**Audit Timestamp:** 2026-05-18T10:30:00Z
**Files Reviewed:** 12
**Severity Summary:** 🔴 Critical: 0 | 🟠 High: 2 | 🟡 Medium: 4 | 🔵 Low: 3

### 🔴 Critical Issues
None identified. The codebase demonstrates mature error handling patterns with no critical gaps.

### 🟠 High Priority

**H-ERR-01: Missing Error Boundary in DocumentCanvas Component**
- **File:** `apps/web/src/components/document-builder/DocumentCanvas.tsx`
- **Line:** 151-461
- **Issue:** DocumentCanvas renders user-draggable blocks with complex DnD interactions but lacks an error boundary wrapper. If any child PersuasionBlock or DnD operation throws, the entire canvas crashes.
- **Impact:** User loses all unsaved work if any block-level error occurs during drag-drop or rendering.
- **Recommendation:** Wrap PersuasionBlock instances with InlineErrorBoundary to isolate failures:
```tsx
<InlineErrorBoundary
  onError={(error) => logger.error('[DocumentCanvas] Block render failed', { blockId: block.id, error })}
>
  <PersuasionBlock block={block} ... />
</InlineErrorBoundary>
```

**H-ERR-02: Silent Error Swallowing in useBlockAnalytics Hook**
- **File:** `apps/web/src/hooks/useBlockAnalytics.ts`
- **Line:** 96-115
- **Issue:** The `sendBatch` function catches errors but only logs to `console.warn`. Failed events are re-queued but there's no user feedback mechanism and no circuit breaker to prevent infinite retry loops on persistent failures.
- **Impact:** Users have no visibility into analytics failures. If the analytics API is down, events accumulate indefinitely (capped at MAX_BATCH_SIZE * 2) without any degradation signal.
- **Recommendation:** 
  1. Implement exponential backoff for retries
  2. Add circuit breaker pattern (similar to analytics route)
  3. Emit a custom event for UI feedback on persistent failures

### 🟡 Medium Priority

**M-ERR-01: Template Service Returns Empty Array Without Error Context**
- **File:** `apps/web/src/lib/document-builder/template-service.ts`
- **Line:** 100-104
- **Issue:** `applyFrameworkToCanvas` returns empty array when framework is not found, making it impossible for callers to distinguish between "framework has no blocks" and "framework doesn't exist."
- **Recommendation:** Return `null` for missing frameworks, or throw a typed error for better error differentiation.

**M-ERR-02: Export Route Lacks Granular Error Types**
- **File:** `apps/web/src/app/api/document-builder/export/route.ts`
- **Line:** 131-138
- **Issue:** The catch block returns generic "PDF export failed" message. Puppeteer failures, memory issues, and timeout errors all produce identical user feedback.
- **Recommendation:** Classify errors from `exportToPdf` and return actionable messages:
  - Timeout: "Export took too long. Try reducing document size."
  - Memory: "Document is too complex. Try splitting into sections."
  - Puppeteer crash: "Export service error. Please retry."

**M-ERR-03: Analytics Sync Worker DLQ Lacks Alert Escalation**
- **File:** `apps/web/src/lib/document-builder/analytics-sync-worker.ts`
- **Line:** 546-563
- **Issue:** `monitorDeadLetterQueue` logs warnings but doesn't trigger external alerts (PagerDuty, Slack, Sentry) when critical threshold is exceeded. Manual intervention is required but no notification is sent.
- **Recommendation:** Add Sentry.captureMessage or webhook notification when DLQ exceeds critical threshold.

**M-ERR-04: AI Generator Timeout Not Surfaced to User**
- **File:** `apps/web/src/lib/document-builder/ai-generator.ts`
- **Line:** 352-395
- **Issue:** When AI generation times out (60s), the error classification identifies it as "timeout" but the user receives generic "Unable to generate content" message. Users cannot distinguish timeout from other failures.
- **Recommendation:** Return error type in response for timeout-specific UX (e.g., "Generation took too long. Try a shorter prompt or simpler block.").

### 🔵 Low Priority / Recommendations

**L-ERR-01: Inconsistent Error Logging Format**
- **Files:** Multiple services
- **Issue:** Some services log errors as objects `{ error: String(error) }` while others log the error directly. This creates inconsistent structured logging.
- **Recommendation:** Standardize on pattern:
```typescript
logger.error("[component] Message", error instanceof Error ? error : { error: String(error) });
```
This pattern is already used in most places but not consistently.

**L-ERR-02: Missing Stack Trace Preservation in analytics-sync-worker**
- **File:** `apps/web/src/lib/document-builder/analytics-sync-worker.ts`
- **Line:** 339-341
- **Issue:** When logging key processing errors, only the message is captured, not the full stack trace.
- **Current:** `const errorMsg = error instanceof Error ? error.message : String(error);`
- **Recommendation:** Include stack trace for debugging: `{ error: errorMsg, stack: error instanceof Error ? error.stack : undefined }`

**L-ERR-03: Generate Route Could Include Retry-After for Rate Limits**
- **File:** `apps/web/src/app/api/document-builder/generate/route.ts`
- **Line:** 100-109
- **Issue:** The rate limit response includes `retryAfter` in the message but not in a structured `Retry-After` header. Client-side retry logic would need to parse the message.
- **Observation:** The `rateLimited()` helper from responses.ts already supports `retryAfterSeconds` parameter which adds the header. This is already being used correctly.

### ✅ Strengths Observed

1. **Excellent AI Generator Error Handling:**
   - `ai-generator.ts` implements comprehensive retry logic with exponential backoff
   - Error classification distinguishes rate limits (429), service unavailable (503), timeout, and non-retryable errors
   - Proper jitter prevents thundering herd
   - Sentry integration captures errors with rich context

2. **Robust Analytics Route Circuit Breaker:**
   - `analytics/route.ts` implements proper circuit breaker pattern for Redis failures
   - Fails closed for security (denies requests when Redis unavailable)
   - Automatic recovery attempt after timeout
   - Background processing with timeout prevents hanging requests

3. **Comprehensive Response Utilities:**
   - `lib/api/responses.ts` provides strongly-typed response helpers
   - Consistent error envelope format across all API routes
   - Proper HTTP status codes (400 vs 422 distinction)
   - Zod error formatting included

4. **Error Boundary Infrastructure:**
   - `components/ui/error-boundary.tsx` provides both full ErrorBoundary and InlineErrorBoundary
   - Support for fallbackRender prop for custom recovery UI
   - Reset functionality allows user-initiated recovery
   - Integration with logger for error tracking

5. **Analytics Sync Worker Resilience:**
   - Dead letter queue with configurable retention
   - Retry count tracking per variant
   - GETSET pattern ensures no data loss during sync
   - Graceful shutdown handlers prevent data loss on process exit

6. **Rate Limiting Defense in Depth:**
   - Production fails closed on Redis errors
   - In-memory fallback only in development
   - IP spoofing protection with proxy secret validation

### 📊 Metrics
- Files analyzed: 12
- Lines reviewed: ~3,500
- Error paths traced: 28
- Try/catch blocks audited: 24
- Recovery patterns validated: 8
- User feedback quality: Good (actionable messages in most cases)

### Recommendations Summary

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| 🟠 H-ERR-01 | Add ErrorBoundary to DocumentCanvas blocks | Low | High |
| 🟠 H-ERR-02 | Circuit breaker for analytics hook | Medium | Medium |
| 🟡 M-ERR-01 | Template service error differentiation | Low | Low |
| 🟡 M-ERR-02 | Export route error classification | Low | Medium |
| 🟡 M-ERR-03 | DLQ external alerting | Low | Medium |
| 🟡 M-ERR-04 | Timeout-specific user messaging | Low | Medium |

---

## Agent #2: Type Safety Analyst Findings

**Audit Timestamp:** 2026-05-18T15:30:00Z
**Files Reviewed:** 15
**Severity Summary:** 🔴 Critical: 0 | 🟠 High: 2 | 🟡 Medium: 4 | 🔵 Low: 3

### 🔴 Critical Issues
None identified.

### 🟠 High Priority

**H-TS-01: Type Assertions for Status Values in ab-testing-service.ts**
- **File:** `apps/web/src/lib/document-builder/ab-testing-service.ts`
- **Lines:** 640, 671, 720-722, 783-784, 866
- **Issue:** Multiple type assertions (`as BlockVariantStatus`) are used instead of ensuring type safety at the point of definition. While the values are valid, type assertions bypass TypeScript's type checking.
```typescript
// Line 640
status: "active" as BlockVariantStatus,
// Line 671
status: "paused" as BlockVariantStatus,
```
- **Risk:** If `BlockVariantStatus` union changes, these assertions will silently pass without compile-time errors.
- **Recommendation:** Define status constants as `const` values typed to `BlockVariantStatus` or use a helper function that validates and returns the correct type:
```typescript
const ACTIVE_STATUS: BlockVariantStatus = "active";
// or
function asStatus(s: BlockVariantStatus): BlockVariantStatus { return s; }
```

**H-TS-02: Loose Type in API Route blockType Casting**
- **File:** `apps/web/src/app/api/document-builder/generate/route.ts`
- **Line:** 128
- **Issue:** Type assertion used to convert Zod-validated blockType to GenerationRequest type:
```typescript
blockType: validatedData.blockType as GenerationRequest["blockType"],
```
- **Risk:** The Zod schema validates against `PERSUASION_BLOCK_TYPES_ARRAY as [string, ...string[]]`, which loses the literal type information. If the array contents don't match `PersuasionBlockType`, the assertion silently passes.
- **Recommendation:** Ensure the Zod enum is defined with proper literal types:
```typescript
blockType: z.enum(PERSUASION_BLOCK_TYPES_ARRAY as readonly [PersuasionBlockType, ...PersuasionBlockType[]]),
```

### 🟡 Medium Priority

**M-TS-01: Type Guard Returns Narrow Type but Accepts Broad Type**
- **File:** `apps/web/src/lib/document-builder/types.ts`
- **Lines:** 540-559
- **Issue:** Type guards like `isPainAmplifierBlock` accept `PersuasionBlock` but narrow to discriminated union types (e.g., `PainAmplifierBlock`). However, `PersuasionBlock` doesn't include `structuredContent` property, creating a type mismatch.
```typescript
export function isPainAmplifierBlock(
  block: PersuasionBlock
): block is PainAmplifierBlock {
  return block.type === "pain_amplifier";
}
```
- **Impact:** When using these guards, the narrowed type includes `structuredContent` but the runtime object may not have it.
- **Recommendation:** Either:
  1. Add `structuredContent?: BlockSpecificContent` to `PersuasionBlock` interface
  2. Change guard parameter to `TypedPersuasionBlock | PersuasionBlock`

**M-TS-02: PERSUASION_BLOCK_TYPES_ARRAY Missing Readonly Inference**
- **File:** `apps/web/src/lib/document-builder/types.ts`
- **Lines:** 31-43
- **Issue:** The array is annotated as `PersuasionBlockType[]` but declared `as const`, creating a type inconsistency:
```typescript
export const PERSUASION_BLOCK_TYPES_ARRAY: PersuasionBlockType[] = [
  ...
] as const;
```
- **Impact:** The `as const` assertion is partially negated by the explicit type annotation. The array should be `readonly` for proper const inference.
- **Recommendation:**
```typescript
export const PERSUASION_BLOCK_TYPES_ARRAY = [
  "pain_amplifier",
  // ...
] as const satisfies readonly PersuasionBlockType[];
```

**M-TS-03: Test Files Use Unsafe Type Assertions**
- **File:** `apps/web/src/lib/document-builder/__tests__/template-service.test.ts`
- **Lines:** 105, 110, 118, 203
- **Issue:** Test files use type assertions to access nested content:
```typescript
const painContent = painBlock?.content.content as Array<{ content?: Array<{ text?: string }> }> | undefined;
type: type as PersuasionBlock["type"],
```
- **Impact:** Tests may pass despite type mismatches in production code.
- **Recommendation:** Use proper type narrowing or create test utilities that validate types at runtime.

**M-TS-04: Record<string, unknown> Usage for Extensibility**
- **File:** `apps/web/src/lib/document-builder/types.ts`
- **Lines:** 57, 85-86, 113, 207
- **Issue:** Several interfaces use `Record<string, unknown>` for extensibility:
```typescript
customData?: Record<string, unknown>;
attrs?: Record<string, unknown>;
```
- **Impact:** While intentional for flexibility, this bypasses type checking for custom data.
- **Recommendation:** Consider using generics or branded types where stricter typing is needed:
```typescript
interface PersuasionMeta<TCustom = Record<string, unknown>> {
  customData?: TCustom;
}
```

### 🔵 Low Priority / Recommendations

**L-TS-01: No Zod Schema for TipTapContent Structure**
- **Files:** Various API routes and services
- **Issue:** `TipTapContent` is a TypeScript interface but no Zod schema exists to validate its structure at runtime. Content from DB or API could have unexpected shapes.
- **Recommendation:** Create a recursive Zod schema for TipTapContent:
```typescript
const tipTapContentSchema: z.ZodType<TipTapContent> = z.lazy(() =>
  z.object({
    type: z.string(),
    content: z.array(tipTapContentSchema).optional(),
    text: z.string().optional(),
    attrs: z.record(z.unknown()).optional(),
  })
);
```

**L-TS-02: prospectContextSchema Uses passthrough()**
- **File:** `apps/web/src/app/api/document-builder/generate/route.ts`
- **Line:** 51
- **Issue:** Schema uses `.passthrough()` allowing arbitrary additional properties:
```typescript
const prospectContextSchema = z.object({
  // ...
}).passthrough();
```
- **Impact:** Extra properties pass validation without type narrowing, could contain unexpected data.
- **Recommendation:** Use `.strict()` or explicitly define allowed additional properties.

**L-TS-03: Analytics Service Returns Default Objects on Error**
- **File:** `apps/web/src/lib/document-builder/analytics-service.ts`
- **Lines:** 246-255, 322-327
- **Issue:** Error handlers return valid-looking empty analytics objects:
```typescript
return {
  blockId,
  impressions: 0,
  conversions: 0,
  // ...
};
```
- **Impact:** Callers cannot distinguish between "no data" and "error fetching data" without checking logs.
- **Recommendation:** Consider returning a discriminated union or throwing to allow callers to handle errors:
```typescript
type AnalyticsResult = 
  | { success: true; data: BlockAnalytics }
  | { success: false; error: string };
```

### ✅ Strengths Observed

1. **Comprehensive Type Definitions:** The `types.ts` file provides well-documented, complete type definitions for all persuasion blocks with discriminated unions enabling proper type narrowing.

2. **Zod Schema Coverage at API Boundaries:** All three API routes (`analytics`, `export`, `generate`) properly validate request bodies with Zod schemas before processing.

3. **Type Guards Provided:** The codebase includes type guards (`isBlockType`, `isPainAmplifierBlock`, etc.) enabling proper runtime type narrowing.

4. **No `any` Types Found:** No explicit `any` types were found in the Phase 102 code. The codebase uses `unknown` appropriately for truly unknown data.

5. **Drizzle Schema Type Alignment:** Database schema properly uses `.$type<T>()` to ensure JSONB columns have correct TypeScript types. Inferred types (`$inferSelect`, `$inferInsert`) are exported for consumer use.

6. **Comprehensive Schema Tests:** The `schemas.test.ts` file provides 1000+ lines of Zod schema validation tests covering valid inputs, invalid inputs, edge cases, and boundary values.

7. **Proper Null Handling:** Types properly distinguish between nullable (`null`) and optional (`undefined`) values, with `styling: BlockStyling | null` vs `styling?: BlockStyling`.

### 📊 Metrics
- Files analyzed: 15
- Lines reviewed: ~4,500
- Type assertions found: 12 (8 in production, 4 in tests)
- `any` type usages: 0
- Zod schemas validated: 6
- Type guards provided: 6
- DB schema type alignments verified: 6 tables

### Recommendations Summary

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| 🟠 H-TS-01 | Replace status type assertions with typed constants | Low | Medium |
| 🟠 H-TS-02 | Fix Zod enum type inference for blockType | Low | Medium |
| 🟡 M-TS-01 | Align type guard input/output types | Medium | Low |
| 🟡 M-TS-02 | Fix PERSUASION_BLOCK_TYPES_ARRAY readonly | Low | Low |
| 🟡 M-TS-03 | Add test utilities for type-safe assertions | Medium | Low |
| 🟡 M-TS-04 | Consider generic typing for customData | Medium | Low |

---
---

## Agent #7: Component Architecture Findings

**Audit Timestamp:** 2026-05-18T17:30:00Z
**Files Reviewed:** 17 components + 1 store
**Severity Summary:** 🔴 Critical: 0 | 🟠 High: 2 | 🟡 Medium: 5 | 🔵 Low: 6

### 🔴 Critical Issues

*None identified*

### 🟠 High Priority

#### H7.1: DocumentCanvas Uses Full Store Instead of Optimized Selectors
**File:** `apps/web/src/components/document-builder/DocumentCanvas.tsx:159-167`
**Issue:** The component destructures the entire store directly instead of using the optimized selector hooks (`useCanvasState`, `useCanvasActions`) defined in the store.

```typescript
// Current (suboptimal):
const {
  blocks,
  selectedBlockId,
  selectBlock,
  moveBlock,
  removeBlock,
  updateBlockTitle,
  addBlock,
} = useDocumentBuilderStore();

// Should use:
const { blocks, selectedBlockId } = useCanvasState();
const { selectBlock, moveBlock, removeBlock, updateBlockTitle, addBlock } = useCanvasActions();
```

**Impact:** Every state change in the store triggers a re-render of DocumentCanvas, even unrelated changes. The store provides optimized hooks using `useShallow` that prevent unnecessary re-renders.
**Recommendation:** Refactor to use `useCanvasState()` and `useCanvasActions()` hooks.

#### H7.2: ManualBlockCreator Uses Inconsistent UI Component Imports
**File:** `apps/web/src/components/document-builder/ManualBlockCreator.tsx:14-39`
**Issue:** Uses `@/components/ui/*` directly instead of the unified `@tevero/ui` package used by other components.

```typescript
// ManualBlockCreator.tsx uses:
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, ... } from "@/components/ui/select";

// Other components (VariantCreator, FrameworkSelector) use:
import { Button, Dialog, ... } from "@tevero/ui";
```

**Impact:** Inconsistent imports may lead to bundle fragmentation and style inconsistencies if `@/components/ui` and `@tevero/ui` diverge.
**Recommendation:** Standardize all document-builder components to use `@tevero/ui`.

### 🟡 Medium Priority

#### M7.1: VerificationUI Missing Memoization
**File:** `apps/web/src/components/document-builder/VerificationUI.tsx:128`
**Issue:** Unlike other complex components, `VerificationUI` is not wrapped with `memo()`. This component renders a full split-view with many interactive elements.

**Impact:** Parent re-renders will cause full re-renders of the verification UI, including all detected blocks.
**Recommendation:** Wrap `VerificationUI` with `memo()` and add custom comparison for `detectedBlocks` and `originalText`.

#### M7.2: Nested Component Definitions Inside VerificationUI
**File:** `apps/web/src/components/document-builder/VerificationUI.tsx:256-274`
**Issue:** Helper functions `getConfidenceColor` and `getStatusBadge` are defined inside the component, causing recreation on each render.

**Impact:** Minor performance overhead from function recreation.
**Recommendation:** Move these helper functions outside the component scope or memoize them.

#### M7.3: InlineBlockCreator Lacks Error Boundary
**File:** `apps/web/src/components/document-builder/ManualBlockCreator.tsx:289-356`
**Issue:** `InlineBlockCreator` is a separate component in the same file that is used inline within the verification flow, but unlike main components, it lacks error boundary protection.

**Impact:** An error in InlineBlockCreator could crash the entire verification flow.
**Recommendation:** Either wrap with `InlineErrorBoundary` or ensure the parent always handles errors.

#### M7.4: FrameworkSelector Creates New Block Objects on Every Selection
**File:** `apps/web/src/components/document-builder/FrameworkSelector.tsx:200-213`
**Issue:** When selecting a framework, new block objects are created inline with `Date.now()` for IDs and current timestamps. This pattern is repeated in BlockPalette.tsx:292-311.

```typescript
const blocks = framework.recommendedSequence.map((type: PersuasionBlockType, index: number) => ({
  id: `${type}-${Date.now()}-${index}`,
  // ...
}));
```

**Impact:** Duplicate code pattern for block creation; potential ID collisions if called rapidly.
**Recommendation:** Extract block creation to a shared factory function in the store or a utility. Consider using `nanoid()` (already in the store) for consistent ID generation.

#### M7.5: VariablePicker Callback Comparison Excludes onSelect
**File:** `apps/web/src/components/document-builder/VariablePicker.tsx:316-322`
**Issue:** The `memo()` comparison function does not include `onSelect` callback comparison, which is intentional but could mask issues if parent doesn't memoize callbacks.

```typescript
export const VariablePicker = memo(VariablePickerComponent, (prev, next) => {
  return (
    prev.open === next.open &&
    prev.className === next.className &&
    prev.categories?.join(",") === next.categories?.join(",")
    // onSelect and onClose intentionally excluded
  );
});
```

**Impact:** If parent does not use `useCallback` for `onSelect`, the picker will not re-render with the new callback, potentially causing stale closures.
**Recommendation:** Document this requirement in JSDoc comments and consider adding a ref pattern like BlockEditor uses (`onContentChangeRef`).

### 🔵 Low Priority / Recommendations

#### L7.1: EmptyState Component Defined Inside DocumentCanvas
**File:** `apps/web/src/components/document-builder/DocumentCanvas.tsx:66-139`
**Issue:** `EmptyState` is defined as a named function component inside the file but is not extracted or memoized.

**Recommendation:** Either extract to a separate file for reuse or memoize since it only depends on callbacks.

#### L7.2: BlockPalette and FrameworkSelector Share Framework Template Logic
**File:** `BlockPalette.tsx:292-311` and `FrameworkSelector.tsx:195-219`
**Issue:** Both components have near-identical logic for initializing blocks from a framework template.

**Recommendation:** Extract to a shared hook `useFrameworkInitializer()` or utility function.

#### L7.3: HeatmapOverlay and BlockAnalyticsDisplay in Same File
**File:** `apps/web/src/components/document-builder/HeatmapOverlay.tsx:149-267`
**Issue:** `BlockAnalyticsDisplay` is a separate component used in a different context (analytics panel, not overlay) but lives in the HeatmapOverlay file.

**Recommendation:** Consider extracting `BlockAnalyticsDisplay` to its own file for clarity and independent lazy loading.

#### L7.4: Unused blockId Parameter in VariantCreator
**File:** `apps/web/src/components/document-builder/VariantCreator.tsx:87`
**Issue:** The `blockId` prop is accepted but prefixed with underscore and unused:
```typescript
blockId: _blockId,
```

**Recommendation:** Either use for logging/tracking or remove from props interface if truly unnecessary.

#### L7.5: VersionDiff Sub-components Could Be Extracted
**File:** `apps/web/src/components/document-builder/VersionDiff.tsx:124-372`
**Issue:** File contains 5 sub-components (`VersionSelector`, `TextDiffDisplay`, `BlockDiffCard`, `DiffSummaryBar`, `VersionDiffComponent`) all in one file (~550 lines).

**Recommendation:** For maintainability, consider extracting to a `version-diff/` folder with:
- `VersionSelector.tsx`
- `TextDiffDisplay.tsx`
- `BlockDiffCard.tsx`
- `DiffSummaryBar.tsx`
- `index.tsx` (main component)

#### L7.6: Incomplete Export Structure in index.ts
**File:** `apps/web/src/components/document-builder/index.ts`
**Observation:** The index.ts properly exports all public components with their prop types. However, several components are missing from exports:
- `VerificationUI` - not exported
- `ManualBlockCreator` / `InlineBlockCreator` - not exported

**Recommendation:** Add missing exports or document why they are intentionally internal.

### ✅ Strengths Observed

1. **Excellent Memoization Strategy**: Most components use `memo()` with custom comparison functions that check relevant props only. The pattern of excluding callback comparisons while using ref patterns (BlockEditor:107-110) is sophisticated.

2. **Consistent Callback Pattern**: Components consistently receive callbacks that pass IDs back to the parent, allowing stable `useCallback` definitions in parent components. This is documented in JSDoc comments (PersuasionBlock:40-45, PaletteItem:82-88).

3. **Proper Prop Interface Exports**: All components export their prop interfaces (`BlockEditorProps`, `DocumentCanvasProps`, etc.) enabling type-safe composition.

4. **Single Responsibility**: Each component has a clear, focused responsibility:
   - `DropZone` - only handles drop target visualization
   - `BlockTypeBadge` - only renders semantic badges
   - `HeatmapOverlay` - only displays engagement overlay

5. **Shallow Store Selectors**: The Zustand store (`documentBuilderStore.ts:449-577`) provides well-designed selector hooks using `useShallow` that prevent unnecessary re-renders.

6. **Error Boundary Wrappers**: `SafeComponents.tsx` provides pre-wrapped versions of critical components with appropriate error logging.

7. **Children Slot Pattern**: `PersuasionBlock` accepts `children` prop (line 87) allowing content injection without modification, demonstrating composition over configuration.

8. **Render Props Alternative**: Components like `ErrorBoundary` use `fallbackRender` pattern (SafeComponents.tsx:54) for flexible error UI customization.

### 📊 Metrics

- **Files analyzed:** 18 (17 components + 1 store)
- **Lines reviewed:** ~4,200
- **Components evaluated:** 23 (including sub-components)
- **Memoized components:** 14/17 main components (82%)
- **Components using optimized store hooks:** 2/4 store consumers (50%)
- **Export completeness:** 13/17 components exported (76%)

### Component Hierarchy Map

```
DocumentCanvas (DndContext provider)
├── EmptyState (conditional)
├── DropZone[] (between blocks)
└── PersuasionBlock[] (sortable)
    ├── BlockTypeBadge
    ├── Title input
    ├── Action toolbar
    └── children (BlockEditor slot)

BlockPalette
├── Framework section (collapsible)
│   └── FrameworkItem[] (memoized)
└── Persuasion blocks section
    └── PaletteItem[] (memoized, draggable)

FrameworkSelector (Dialog)
├── FrameworkCard[]
└── FreestyleCard

VariantTabs (tablist)
└── VariantTab[] (memoized)

VariantCreator (Dialog)
├── Form fields
└── Submit handler

VerificationUI (split-view)
├── Header with progress
├── Original text panel
└── Detected blocks panel

VersionDiff
├── VersionSelector x2
├── DiffSummaryBar
└── BlockDiffCard[] x2 columns
    └── TextDiffDisplay (conditional)

VariablePicker (popover)
└── VariableCategorySection[] (memoized)

HeatmapOverlay (positioned absolute)
└── Label badge + Score indicator

BlockEditor (TipTap wrapper)
├── EditorContent / Skeleton
└── Toolbar with Generate button

ManualBlockCreator (Sheet)
└── Form with InlineBlockCreator
```

### Coupling Analysis

| Component | Dependencies | Coupling Score |
|-----------|--------------|----------------|
| DocumentCanvas | Store, DropZone, PersuasionBlock | Medium |
| BlockPalette | Store, BlockTypeBadge, FrameworkItem | Low |
| PersuasionBlock | BlockTypeBadge, useSortable | Low |
| BlockEditor | Store, TipTap, VariableExtension | Medium |
| FrameworkSelector | Store, Template Service | Medium |
| VariantTabs | AB Testing Service | Low |
| VerificationUI | useUndoRedo hook, Block types | Low |
| VersionDiff | Version diff utilities | Low |
| HeatmapOverlay | Heatmap calculator | Low |
| VariablePicker | Variable interpolator | Low |

**Overall:** Components are loosely coupled with clear boundaries. Store access is appropriately isolated to container-level components.

### Recommendations Summary

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| 🟠 H7.1 | Use optimized store selectors in DocumentCanvas | Low | High |
| 🟠 H7.2 | Standardize UI imports to @tevero/ui | Low | Medium |
| 🟡 M7.1 | Add memo() to VerificationUI | Low | Medium |
| 🟡 M7.2 | Extract helper functions from VerificationUI | Low | Low |
| 🟡 M7.3 | Add error boundary to InlineBlockCreator | Low | Medium |
| 🟡 M7.4 | Extract block factory function | Medium | Low |
| 🟡 M7.5 | Document callback memoization requirements | Low | Low |
| 🔵 L7.1-6 | Various code organization improvements | Low | Low |

---

## Agent #5: API Design Findings

**Audit Timestamp:** 2026-05-18T14:30:00Z
**Files Reviewed:** 4
**Severity Summary:** 🔴 Critical: 0 | 🟠 High: 1 | 🟡 Medium: 3 | 🔵 Low: 4

### 🔴 Critical Issues
None identified.

### 🟠 High Priority

#### H-API-01: Analytics Route Missing Content-Type Validation
**File:** `apps/web/src/app/api/document-builder/analytics/route.ts:178-188`
**Issue:** The POST handler parses JSON without validating Content-Type header first.
**Risk:** Allows unexpected content types that could bypass validation or cause parsing issues.
**Fix:**
```typescript
// Add before request.json():
const contentType = request.headers.get("content-type");
if (!contentType?.includes("application/json")) {
  return badRequest("Content-Type must be application/json");
}
```
**Contrast:** Both `export/route.ts:59-62` and `generate/route.ts:87-90` correctly validate Content-Type before parsing.

### 🟡 Medium Priority

#### M-API-01: Inconsistent GET Handler Patterns Across Routes
**File:** `apps/web/src/app/api/document-builder/analytics/route.ts:287-299`
**Issue:** Only the analytics route has a GET handler for service discovery. Export and generate routes lack this pattern.
**Impact:** Inconsistent API discoverability and self-documentation.
**Recommendation:** Either remove GET from analytics (if not needed) or add consistent GET handlers to all routes for API introspection.

#### M-API-02: Missing Request ID for Traceability in Export Route
**File:** `apps/web/src/app/api/document-builder/export/route.ts:50-139`
**Issue:** Unlike analytics route which generates `requestId` for tracking (line 209), export and generate routes lack request correlation IDs.
**Impact:** Difficult to trace failed exports or generations across logs.
**Recommendation:** Generate `requestId` and include in response headers (`X-Request-ID`) for all routes.

#### M-API-03: Export Route Returns Raw PDF Without Envelope
**File:** `apps/web/src/app/api/document-builder/export/route.ts:122-130`
**Issue:** Export route returns raw PDF bytes while other routes use `ApiSuccessResponse` envelope.
**Justification:** This is actually correct for binary responses - PDF cannot be wrapped in JSON.
**Consideration:** Document this intentional deviation from standard envelope for binary responses.

### 🔵 Low Priority / Recommendations

#### L-API-01: Rate Limit Header Missing in Analytics 503 Response
**File:** `apps/web/src/app/api/document-builder/analytics/route.ts:200-201`
**Issue:** When returning 503 for service unavailable, no `Retry-After` header is set.
**Recommendation:** Add `Retry-After` header to guide client retry behavior:
```typescript
return serviceUnavailable("Service temporarily unavailable. Please retry shortly.", 30);
// (if serviceUnavailable helper supported retryAfter parameter)
```

#### L-API-02: Consider 201 Created for Generate Success
**File:** `apps/web/src/app/api/document-builder/generate/route.ts:157-161`
**Issue:** Returns 200 OK for content creation, but 201 Created might be more semantically accurate.
**Rationale:** The AI generates NEW content, which could warrant 201. However, 200 is acceptable since no persistent resource is created.
**Decision:** Keep 200 - the generated content is transient, not a created resource.

#### L-API-03: Export Route Could Benefit from ETag for Caching
**File:** `apps/web/src/app/api/document-builder/export/route.ts:125-129`
**Issue:** Returns `Cache-Control: private, no-cache` but could support conditional requests.
**Recommendation:** Consider adding `ETag` based on proposal version for conditional GET support.

#### L-API-04: Consider OpenAPI/Swagger Documentation
**Issue:** API routes lack formal OpenAPI specification.
**Recommendation:** Add OpenAPI decorators or maintain separate spec file for API documentation, enabling auto-generated client SDKs.

### ✅ Strengths Observed

1. **Excellent Response Envelope Consistency**
   - `apps/web/src/lib/api/responses.ts` provides comprehensive response utilities
   - All error responses follow `ApiErrorResponse` format with `success`, `code`, `message`, `details`
   - Clear status code documentation (400 vs 422 distinction documented at lines 7-16)

2. **Proper HTTP Status Code Usage**
   - 202 Accepted for fire-and-forget analytics (line 236)
   - 422 for validation errors vs 400 for malformed requests (correctly differentiated)
   - 429 with `Retry-After` header for rate limiting (responses.ts:221-236)
   - 503 for service unavailable (circuit breaker scenario)

3. **Comprehensive Request Validation**
   - All routes use Zod schemas with proper constraints
   - `analyticsRequestSchema`: max 100 events, string min lengths (lines 38-50)
   - `generationRequestSchema`: field-level constraints (max lengths, int validation) (lines 46-72)
   - `exportRequestSchema`: UUID validation for proposalId (lines 33-44)
   - Validation errors return field-level details via `formatZodIssues` (responses.ts:368-373)

4. **Security-Conscious Design**
   - IDOR protection in export route (line 83-95) - checks workspace ownership
   - Consistent 404 for both not-found and unauthorized to prevent enumeration
   - Fail-closed rate limiting in analytics (line 145-146)
   - Auth check before any business logic in all routes

5. **Rate Limiting Implementation**
   - Sophisticated circuit breaker pattern for Redis failures (analytics route lines 69-172)
   - Configurable limits with clear documentation (10 gen/hr, 100 events/min)
   - `Retry-After` header included in 429 responses

6. **Robust Error Handling**
   - Top-level try-catch in all route handlers
   - Errors logged with structured context (logger receives Error objects directly)
   - Internal errors not exposed to clients - generic messages returned
   - JSON parse errors handled explicitly (export:68-70, generate:114-118)

7. **Well-Documented Response Utilities**
   - Every response helper has JSDoc with usage examples
   - Clear status code mappings documented at module level
   - Type-safe response generics (`ApiSuccessResponse<T>`)

### 📊 Metrics
- Files analyzed: 4
- Lines reviewed: ~820 (analytics: 299, export: 139, generate: 167, responses: 427)
- HTTP methods validated: 5 (GET x1, POST x3, response helpers)
- Status codes verified: 10 (200, 201, 202, 204, 400, 401, 403, 404, 422, 429, 500, 503)
- Validation schemas reviewed: 6
- Error response patterns: Fully consistent across all routes

### Recommendations Summary

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| 🟠 H-API-01 | Analytics route Content-Type validation | Low | Medium |
| 🟡 M-API-01 | Consistent GET handlers across routes | Low | Low |
| 🟡 M-API-02 | Request ID traceability | Low | Medium |
| 🟡 M-API-03 | Document binary response deviation | Low | Low |
| 🔵 L-API-01 | Retry-After header for 503 | Low | Low |
| 🔵 L-API-02 | Consider 201 for generate | N/A | N/A (keep 200) |
| 🔵 L-API-03 | ETag for export caching | Medium | Low |
| 🔵 L-API-04 | OpenAPI documentation | Medium | Medium |

---

## Agent #10: Data Validation Findings

**Audit Timestamp:** 2026-05-18T15:45:00Z
**Files Reviewed:** 15
**Severity Summary:** 🔴 Critical: 0 | 🟠 High: 2 | 🟡 Medium: 4 | 🔵 Low: 3

### 🔴 Critical Issues
*(None found)*

### 🟠 High Priority

#### H-10-01: Missing URL Validation in styleReferenceSchema
**Location:** `apps/web/src/app/api/document-builder/generate/route.ts:53-58`
```typescript
const styleReferenceSchema = z.object({
  id: z.string(),
  type: z.enum(["pdf", "url", "text"]),
  url: z.string().optional(),  // NO URL VALIDATION
  content: z.string().optional(),
});
```
**Issue:** The `url` field accepts any string without URL format validation. This could allow:
1. Protocol injection (javascript:, data:, file:)
2. SSRF vectors if URLs are fetched server-side
3. Invalid URLs reaching the AI generator

**Recommendation:**
```typescript
url: z.string().url().optional(),
// Or with protocol whitelist:
url: z.string().refine((val) => 
  !val || /^https?:\/\//.test(val), 
  { message: "URL must use http or https protocol" }
).optional(),
```

#### H-10-02: TipTapContent Lacks Runtime Validation
**Location:** `apps/web/src/lib/document-builder/types.ts:80-88`
```typescript
export interface TipTapContent {
  type: string;
  content?: TipTapContent[];
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}
```
**Issue:** TipTapContent is a TypeScript interface only - no Zod schema exists for runtime validation. This content comes from:
1. User editors (VariantCreator, ManualBlockCreator)
2. AI generation responses
3. Database retrieval (JSONB columns)

Without runtime validation, malicious or malformed content could be stored and rendered, potentially leading to XSS via attrs or unexpected behavior.

**Recommendation:** Create Zod schema for TipTapContent:
```typescript
const tipTapContentSchema: z.ZodType<TipTapContent> = z.lazy(() =>
  z.object({
    type: z.string().max(50),
    content: z.array(tipTapContentSchema).optional(),
    text: z.string().optional(),
    attrs: z.record(z.unknown()).optional(),
    marks: z.array(z.object({
      type: z.string().max(50),
      attrs: z.record(z.unknown()).optional(),
    })).optional(),
  })
);
```

### 🟡 Medium Priority

#### M-10-01: prospectContextSchema Uses .passthrough()
**Location:** `apps/web/src/app/api/document-builder/generate/route.ts:46-52`
```typescript
const prospectContextSchema = z.object({
  id: z.string().min(1),
  domain: z.string().optional(),
  niche: z.string().optional(),
  painPoints: z.array(z.string()).optional(),
}).passthrough();  // ALLOWS ARBITRARY FIELDS
```
**Issue:** `.passthrough()` allows any additional fields through validation without sanitization. While these fields may reach the AI prompt (via `prospect.customData`), they bypass explicit validation.

**Impact:** Medium - the AI generator does sanitize user fields, but unknown fields could bypass sanitization if accessed directly.

**Recommendation:** Replace with explicit customData handling:
```typescript
const prospectContextSchema = z.object({
  id: z.string().min(1),
  domain: z.string().max(255).optional(),
  niche: z.string().max(100).optional(),
  painPoints: z.array(z.string().max(500)).max(20).optional(),
  customData: z.record(z.string().max(1000)).optional(),
}).strict();  // Reject unknown fields
```

#### M-10-02: Missing Length Constraints on Analytics blockId
**Location:** `apps/web/src/app/api/document-builder/analytics/route.ts:38-45`
```typescript
const blockInteractionSchema = z.object({
  type: z.enum(["block_view", "block_dwell", "scroll_depth", "cta_click"]),
  blockId: z.string().min(1),  // NO MAX LENGTH
  variantId: z.string().optional(),  // NO LENGTH CONSTRAINTS
  dwellMs: z.number().optional(),  // NO MIN/MAX BOUNDS
  percent: z.number().optional(),  // NO 0-100 BOUNDS
  timestamp: z.number().optional(),  // NO BOUNDS
});
```
**Issue:** Missing constraints could allow:
1. Extremely long blockId/variantId causing memory pressure
2. Negative dwellMs or unrealistic values (999999999)
3. percent outside 0-100 range

**Recommendation:**
```typescript
const blockInteractionSchema = z.object({
  type: z.enum(["block_view", "block_dwell", "scroll_depth", "cta_click"]),
  blockId: z.string().min(1).max(50),
  variantId: z.string().max(50).optional(),
  dwellMs: z.number().int().min(0).max(3600000).optional(),  // Max 1 hour
  percent: z.number().min(0).max(100).optional(),
  timestamp: z.number().int().min(0).optional(),
});
```

#### M-10-03: Form Components Lack Client-Side Validation
**Location:** `apps/web/src/components/document-builder/ManualBlockCreator.tsx:104-118`
```typescript
const handleCreate = useCallback(() => {
  if (!content.trim()) return;  // ONLY CHECK: non-empty

  const newBlock: ManualBlock = {
    id: `manual-${Date.now()}`,
    blockType,
    content: content.trim(),  // NO LENGTH/CONTENT VALIDATION
    position,
    referenceBlockId,
  };

  onCreate(newBlock);
```
**Issue:** User can submit arbitrarily long content without length limits. While this may be caught server-side, client-side validation improves UX and reduces server load.

**Similarly in:** `VariantCreator.tsx:111-127` - variantName has no max length check.

**Recommendation:** Add length constants and validate:
```typescript
const MAX_BLOCK_CONTENT_LENGTH = 10000;
const MAX_VARIANT_NAME_LENGTH = 100;

// In handleCreate:
if (content.length > MAX_BLOCK_CONTENT_LENGTH) {
  toast.error(`Content exceeds ${MAX_BLOCK_CONTENT_LENGTH} character limit`);
  return;
}
```

#### M-10-04: BlockVariant Weight Lacks Application-Level Validation
**Location:** `apps/web/src/db/schema/document-builder.ts:115,133`
```typescript
weight: integer("weight").notNull().default(50),
// ...
check("weight_range", sql`${table.weight} >= 0 AND ${table.weight} <= 100`),
```
**Issue:** Database constraint exists, but there's no Zod schema for BlockVariant insert/update operations. If application code bypasses validation, the database constraint will catch it - but the error message won't be user-friendly.

**Recommendation:** Create Zod schema matching DB constraints:
```typescript
const blockVariantInsertSchema = z.object({
  parentBlockId: z.string().min(1),
  variantName: z.string().min(1).max(100),
  content: tipTapContentSchema,
  styling: blockStylingSchema.nullable().optional(),
  weight: z.number().int().min(0).max(100),
  status: z.enum(["active", "paused", "winner", "loser"]).default("active"),
});
```

### 🔵 Low Priority / Recommendations

#### L-10-01: Inconsistent Schema Definition Location
**Issue:** Zod schemas are defined inline within route files rather than in a shared location. This leads to:
1. Duplicate schema definitions (schemas.test.ts recreates route schemas)
2. Difficulty maintaining consistency across routes
3. No schema reuse between generate, analytics, and export routes

**Recommendation:** Create `apps/web/src/lib/document-builder/schemas.ts`:
```typescript
// Centralized schema definitions
export const prospectContextSchema = z.object({...});
export const styleReferenceSchema = z.object({...});
export const generationRequestSchema = z.object({...});
export const analyticsRequestSchema = z.object({...});
export const exportRequestSchema = z.object({...});

// Type inference
export type GenerationRequest = z.infer<typeof generationRequestSchema>;
```

#### L-10-02: Test Coverage for Boundary Validation is Excellent
**Observation:** `schemas.test.ts` has 848 lines with comprehensive tests including:
- Empty objects/arrays
- Boundary values (min/max)
- Unicode handling
- Type coercion prevention
- Null vs undefined distinction

This is exemplary and should be maintained as new schemas are added.

#### L-10-03: Consider Discriminated Union for BlockInteraction
**Location:** `apps/web/src/app/api/document-builder/analytics/route.ts:38-45`
```typescript
// Current: All fields optional regardless of type
type: z.enum(["block_view", "block_dwell", "scroll_depth", "cta_click"]),
dwellMs: z.number().optional(),  // Only relevant for block_dwell
percent: z.number().optional(),   // Only relevant for scroll_depth
```
**Recommendation:** Use discriminated union for type-specific validation:
```typescript
const blockInteractionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("block_view"), blockId: z.string().min(1).max(50) }),
  z.object({ type: z.literal("block_dwell"), blockId: z.string().min(1).max(50), dwellMs: z.number().int().min(0) }),
  z.object({ type: z.literal("scroll_depth"), blockId: z.string().min(1).max(50), percent: z.number().min(0).max(100) }),
  z.object({ type: z.literal("cta_click"), blockId: z.string().min(1).max(50) }),
]);
```

### ✅ Strengths Observed

1. **Comprehensive Input Sanitization:** `input-sanitizer.ts` implements 57+ patterns covering 8 attack categories including:
   - Chat ML markers (OpenAI/Anthropic style)
   - XML-style prompt delimiters
   - Instruction override attempts
   - Role-playing/jailbreak attempts
   - Prompt extraction attempts
   - Unicode homoglyph attacks (NFKC normalization + confusables mapping)
   - Zero-width and RTL character stripping

2. **Defense-in-Depth:** AI generator (`ai-generator.ts:323-340`) applies `sanitizeForPrompt()` to all user-provided fields before prompt construction, and logs potential injection attempts without blocking (allowing security monitoring).

3. **Zod Schema Test Coverage:** 848 lines of schema tests (`schemas.test.ts`) cover:
   - All happy paths for each schema
   - Invalid type rejection
   - Boundary value testing (min/max)
   - Unicode and special character handling
   - Null/undefined distinction
   - No type coercion (strings don't become numbers)

4. **Database Constraints Match Application Rules:**
   - `weight_range` CHECK constraint (0-100) in `block_variants`
   - `confidence_range` CHECK constraint (0-100) in `detected_structures` and `brand_themes`

5. **Type Guards for Discriminated Unions:** `types.ts:530-579` provides type guards (`isPainAmplifierBlock`, `isSocialProofBlock`, etc.) for safe type narrowing.

6. **Standardized API Response Format:** `responses.ts` provides consistent error responses with proper Zod error formatting via `formatZodIssues()`.

7. **IDOR Protection:** Export route (`export/route.ts:83-95`) validates workspace ownership before returning proposals.

### 📊 Metrics

- Files analyzed: 15
- Lines reviewed: ~3,500
- Zod schemas audited: 10
- Type definitions reviewed: 25
- Test files verified: 1 (schemas.test.ts - 848 lines)
- Validation gaps identified: 6 (2 High, 4 Medium)
- Patterns validated: 57+ injection patterns

### Recommendations Summary

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| 🟠 H-10-01 | Add URL validation to styleReferenceSchema | Low | High |
| 🟠 H-10-02 | Create TipTapContent Zod schema | Medium | High |
| 🟡 M-10-01 | Remove .passthrough() from prospectContextSchema | Low | Medium |
| 🟡 M-10-02 | Add length/range constraints to analytics schema | Low | Medium |
| 🟡 M-10-03 | Add client-side validation to form components | Low | Low |
| 🟡 M-10-04 | Create Zod schema for BlockVariant operations | Low | Medium |

---

## Agent #1: Security Auditor Findings

**Audit Timestamp:** 2026-05-18T15:15:00Z
**Files Reviewed:** 12
**Severity Summary:** 🔴 Critical: 0 | 🟠 High: 2 | 🟡 Medium: 4 | 🔵 Low: 3

### 🔴 Critical Issues

None identified. The implementation demonstrates solid security foundations with no critical vulnerabilities detected.

### 🟠 High Priority

**H-SEC-01: Missing CSRF Protection on Document Builder API Routes**

- **Location:** 
  - `apps/web/src/app/api/document-builder/analytics/route.ts`
  - `apps/web/src/app/api/document-builder/export/route.ts`
  - `apps/web/src/app/api/document-builder/generate/route.ts`
- **Issue:** The document builder API routes do not use the `validateCsrf()` function or the `secureRoute()` wrapper that other state-changing endpoints in the codebase use. While Clerk authentication is present, CSRF protection is an additional defense layer.
- **Evidence:** Other routes in the codebase (e.g., `/api/goals/delete`, `/api/content-calendar/[eventId]`) explicitly call `validateCsrf(req)`, but these document-builder routes do not.
- **Risk:** An attacker could craft a malicious page that makes authenticated users unknowingly submit requests to these endpoints.
- **Remediation:**
```typescript
// In each POST handler, add before processing:
import { validateCsrf } from "@/lib/api/security";

const csrfError = validateCsrf(req);
if (csrfError) return csrfError;
```
Or use the `secureRoute()` wrapper for consistent protection.

---

**H-SEC-02: sessionId in Analytics Route Not Validated Against User**

- **Location:** `apps/web/src/app/api/document-builder/analytics/route.ts:194`
- **Issue:** The analytics endpoint accepts a `sessionId` from the request body and uses it for rate limiting without verifying that the authenticated user owns that session. This could allow:
  1. Rate limit bypass by using different session IDs
  2. Pollution of another user's analytics data (if session IDs can be guessed)
- **Code:**
```typescript
const { sessionId, events } = parsed.data;
// Rate limit uses sessionId directly from user input
const rateLimitResult = await checkRateLimit(sessionId, events.length);
```
- **Remediation:** Either:
  1. Tie rate limiting to `userId` instead of `sessionId`
  2. Validate that the session belongs to the authenticated user before processing
  3. Use a composite key: `${userId}:${sessionId}` for rate limiting

### 🟡 Medium Priority

**M-SEC-01: Content-Type Validation Missing on Analytics Route**

- **Location:** `apps/web/src/app/api/document-builder/analytics/route.ts:187`
- **Issue:** Unlike the `export/route.ts` and `generate/route.ts` which validate `Content-Type: application/json`, the analytics route does not check the content type header.
- **Impact:** Could allow unexpected request formats or bypass certain WAF rules.
- **Remediation:**
```typescript
const contentType = req.headers.get("content-type");
if (!contentType?.includes("application/json")) {
  return badRequest("Content-Type must be application/json");
}
```

---

**M-SEC-02: ManualBlockCreator Content Not Sanitized Before Use**

- **Location:** `apps/web/src/components/document-builder/ManualBlockCreator.tsx:104-115`
- **Issue:** User-entered content in the manual block creator is trimmed but not sanitized before being passed to the `onCreate` callback. While downstream sanitization may occur, defense-in-depth recommends sanitizing at input boundaries.
- **Code:**
```typescript
const newBlock: ManualBlock = {
  id: `manual-${Date.now()}`,
  blockType,
  content: content.trim(), // Only trimmed, not sanitized
  position,
  referenceBlockId,
};
onCreate(newBlock);
```
- **Remediation:** Import and use the sanitizer:
```typescript
import { sanitizeForPrompt } from "@/lib/document-builder/input-sanitizer";

content: sanitizeForPrompt(content.trim()),
```

---

**M-SEC-03: Error Messages May Leak Implementation Details**

- **Location:** `apps/web/src/app/api/documents/upload/route.ts:123-131`
- **Issue:** Error messages from the upload service are passed directly to clients, potentially leaking implementation details.
- **Code:**
```typescript
if (error.message.includes("R2 credentials not configured")) {
  return serviceUnavailable("Storage service unavailable");
}
// Other errors may leak through internalError("Upload failed")
```
- **Positive:** The R2 credentials check shows good practice, but the pattern should be extended to all error paths.
- **Remediation:** Ensure all error messages sent to clients are generic and log detailed errors server-side only.

---

**M-SEC-04: Template Variable Pattern in Input Sanitizer May Be Too Broad**

- **Location:** `apps/web/src/lib/document-builder/input-sanitizer.ts:185`
- **Issue:** The regex pattern `\{[a-z_][a-z0-9_]*\}/gi` matches legitimate content like `{emphasis}` or `{note}` that users might naturally write.
- **Code:**
```typescript
/\{[a-z_][a-z0-9_]*\}/gi, // Matches {anything_like_this}
```
- **Impact:** False positives could frustrate users writing legitimate content.
- **Remediation:** Consider a more specific pattern or contextual detection (e.g., only flag when combined with other suspicious patterns).

### 🔵 Low Priority / Recommendations

**L-SEC-01: Consider Adding Request Timeout on Export Route**

- **Location:** `apps/web/src/app/api/document-builder/export/route.ts`
- **Issue:** The PDF export route has `maxDuration: 60` but no internal timeout for the Puppeteer/PDF generation operation. Long-running exports could tie up resources.
- **Recommendation:** Add an internal timeout to the `exportToPdf` call:
```typescript
const pdfBuffer = await Promise.race([
  exportToPdf({ proposalId, variableContext, includeTheme }),
  new Promise((_, reject) => 
    setTimeout(() => reject(new Error("Export timeout")), 55000)
  )
]);
```

---

**L-SEC-02: Rate Limit Key Consistency**

- **Location:** Multiple routes use different rate limit key patterns:
  - Analytics: `ratelimit:analytics:${sessionId}` 
  - Generate: `doc-builder-generate:${userId}`
  - Upload: `document-upload:${userId}`
- **Recommendation:** Standardize the key format across all document-builder routes for consistency and easier debugging:
```typescript
const rateLimitKey = `doc-builder:${operation}:${userId}`;
```

---

**L-SEC-03: Add Security Headers to PDF Response**

- **Location:** `apps/web/src/app/api/document-builder/export/route.ts:122-130`
- **Issue:** The PDF response includes good headers but could add security headers.
- **Current:**
```typescript
headers: {
  "Content-Type": "application/pdf",
  "Content-Disposition": `attachment; filename="proposal-${proposalId}.pdf"`,
  "Content-Length": String(pdfBuffer.length),
  "Cache-Control": "private, no-cache",
},
```
- **Recommendation:** Add:
```typescript
"X-Content-Type-Options": "nosniff",
"Content-Security-Policy": "default-src 'none'",
```

### ✅ Strengths Observed

1. **Excellent XSS Prevention:** The implementation uses DOMPurify with a strict allowlist configuration (`sanitize.ts`). The `ALLOWED_TAGS` and `ALLOWED_ATTR` approach is the correct pattern (allowlist, not blocklist).

2. **Comprehensive Prompt Injection Prevention:** The `input-sanitizer.ts` has 57+ patterns covering 8 attack categories, including Unicode homoglyph detection with NFKC normalization. This is enterprise-grade protection.

3. **Proper File Upload Security:**
   - Magic byte validation prevents MIME type spoofing (`upload-service.ts:42-56`)
   - Zero-byte file rejection (`upload-service.ts:147-149`)
   - Path traversal prevention via filename sanitization (`upload-service.ts:175`)
   - File size limits enforced server-side

4. **FAIL-CLOSED Rate Limiting:** The analytics route implements a circuit breaker pattern that denies requests when Redis is unavailable, preventing abuse during outages (`analytics/route.ts:93-171`).

5. **Strong Authentication:** All API routes check Clerk authentication before processing requests.

6. **IDOR Prevention:** The export route verifies workspace ownership before allowing access to proposals (`export/route.ts:83-95`), returning 404 for unauthorized access to avoid leaking existence.

7. **Sanitization on Paste:** The BlockEditor sanitizes pasted HTML using DOMPurify before inserting into TipTap (`BlockEditor.tsx:170-171`).

8. **IP Spoofing Protection:** The rate limit middleware includes protection against X-Forwarded-For spoofing via proxy secret validation (`rate-limit.ts:367-413`).

### 📊 Metrics

- Files analyzed: 12
- Lines reviewed: ~2,850
- Attack surfaces identified: 8
- Security patterns validated: 14
- Test coverage for security: Strong (input-sanitizer.test.ts covers 57+ patterns, analytics-route-ratelimit.test.ts validates fail-closed behavior)

### Recommendations Summary

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| 🟠 H-SEC-01 | Add CSRF protection to document-builder routes | Low | High |
| 🟠 H-SEC-02 | Validate sessionId ownership or use userId for rate limiting | Low | Medium |
| 🟡 M-SEC-01 | Add Content-Type validation to analytics route | Low | Low |
| 🟡 M-SEC-02 | Sanitize ManualBlockCreator content at input boundary | Low | Medium |
| 🟡 M-SEC-03 | Ensure all error messages are generic to clients | Low | Medium |
| 🟡 M-SEC-04 | Refine template variable detection pattern | Medium | Low |
| 🔵 L-SEC-01 | Add internal timeout to PDF export | Low | Low |
| 🔵 L-SEC-02 | Standardize rate limit key format | Low | Low |
| 🔵 L-SEC-03 | Add security headers to PDF response | Low | Low |

---

## Agent #4: Test Coverage Findings

**Audit Timestamp:** 2026-05-18T16:30:00Z
**Files Reviewed:** 13 test files, 8 corresponding service files
**Severity Summary:** 🔴 Critical: 0 | 🟠 High: 3 | 🟡 Medium: 5 | 🔵 Low: 4

### 🔴 Critical Issues
None identified. All critical paths have test coverage.

### 🟠 High Priority

#### H-TEST-01: Missing Retry Logic Tests in ai-generator.test.ts
**Location:** `apps/web/src/lib/document-builder/__tests__/ai-generator.test.ts`
**Issue:** The `ai-generator.ts` service implements retry logic with exponential backoff (MAX_RETRIES=3, BASE_RETRY_DELAY_MS=1000), but tests only cover single failure scenarios, not:
- Successful retry after transient failure
- Exhausting all retries before giving up
- Exponential backoff delay calculation
- Jitter implementation in `calculateRetryDelay()`

**Service functions not tested:**
- `classifyError()` - error type classification (rate_limit, service_unavailable, timeout, non_retryable)
- `calculateRetryDelay()` - exponential backoff calculation
- `sleep()` - async delay function

**Impact:** Retry behavior is critical for AI service reliability but not validated.

**Recommendation:** Add tests:
```typescript
it("retries on rate_limit (429) and succeeds on second attempt", async () => {
  const rateLimitError = new Error("Rate limit");
  rateLimitError.status = 429;
  mockGenerateText
    .mockRejectedValueOnce(rateLimitError)
    .mockResolvedValueOnce({ text: "Success" });
  
  const result = await generateBlockContent(request);
  expect(result.content).toBe("Success");
  expect(mockGenerateText).toHaveBeenCalledTimes(2);
});

it("exhausts MAX_RETRIES and returns fallback", async () => {
  const serviceError = new Error("503 Service Unavailable");
  serviceError.status = 503;
  mockGenerateText.mockRejectedValue(serviceError);
  
  const result = await generateBlockContent(request);
  expect(result.content).toContain("Unable to generate");
  expect(mockGenerateText).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
});
```

#### H-TEST-02: Missing Edge Cases in analytics-service.test.ts
**Location:** `apps/web/src/lib/document-builder/__tests__/analytics-service.test.ts`
**Issue:** Missing test coverage for:
1. `recordBlockView()` - no test for empty/whitespace blockId validation (service returns false for invalid blockId but this isn't tested)
2. `recordBlockDwell()` - no test for invalid dwellMs values (NaN, Infinity, negative)
3. `processBatchedEvents()` - no test for very large batches (stress test)
4. `getAnalyticsKeys()` - no test for Redis SCAN error handling (stream error event)

**Impact:** Input validation edge cases not verified, potential data integrity issues.

**Recommendation:** Add tests:
```typescript
describe("recordBlockView validation", () => {
  it("returns false for empty blockId", async () => {
    expect(await recordBlockView("")).toBe(false);
    expect(await recordBlockView("   ")).toBe(false);
    expect(mockRedis.incr).not.toHaveBeenCalled();
  });
});

describe("recordBlockDwell validation", () => {
  it("returns false for invalid dwellMs", async () => {
    expect(await recordBlockDwell("block-1", undefined, -100)).toBe(false);
    expect(await recordBlockDwell("block-1", undefined, NaN)).toBe(false);
    expect(await recordBlockDwell("block-1", undefined, Infinity)).toBe(false);
  });
});
```

#### H-TEST-03: Incomplete Experiment Lifecycle Coverage in ab-testing-service.test.ts
**Location:** `apps/web/src/lib/document-builder/__tests__/ab-testing-service.test.ts`
**Issue:** Missing tests for:
1. `startExperiment()` - test with exactly 1 variant (should fail with "at least 2 variants required")
2. `rolloutWinner()` - test when control variant is the winner (not just test variant)
3. `detectWinner()` - test with tie scenario (equal conversion rates across variants)
4. Edge case: `normalizeWeights()` with very large number of variants (100+)
5. Edge case: `calculateSignificance()` with extremely high impression counts (Integer.MAX boundary)

**Impact:** Edge cases in A/B testing could lead to incorrect statistical conclusions or experiment failures.

### 🟡 Medium Priority

#### M-TEST-01: Mock Quality Issues in analytics-sync-worker.test.ts
**Location:** `apps/web/src/lib/document-builder/__tests__/analytics-sync-worker.test.ts`
**Issue:** Mocks do not verify call arguments for:
- `db.update().set()` - SQL increment expression not validated
- `redis.setex()` - TTL value not validated (should be 604800 = 7 days)

**Recommendation:** Add argument validation assertions:
```typescript
expect(mockRedis.setex).toHaveBeenCalledWith(
  expect.stringMatching(/^dlq:analytics-sync:failed:/),
  604800, // Exactly 7 days in seconds
  expect.any(String)
);
```

#### M-TEST-02: Missing Concurrent Operation Tests
**Locations:** Multiple services
**Issue:** No tests for concurrent execution scenarios:
- `recordBlockView()` called simultaneously for same blockId
- `syncAnalytics()` called while previous sync is still running (handled by `isRunning` flag but not tested)
- `processBatchedEvents()` with overlapping events

**Impact:** Race conditions may exist but are not validated.

#### M-TEST-03: Empty Array Edge Cases in version-diff.test.ts
**Location:** `apps/web/src/lib/document-builder/__tests__/version-diff.test.ts`
**Issue:** While empty arrays are tested for `computeBlockDiff()`, the following are missing:
- `computeTextDiff()` with whitespace-only strings
- `extractTextFromContent()` with deeply nested empty content arrays
- `getDiffSummary()` with single-element diff array

#### M-TEST-04: Template Service Missing Validation Tests
**Location:** `apps/web/src/lib/document-builder/__tests__/template-service.test.ts`
**Issue:** No tests for:
- Invalid framework ID handling (current tests pass empty string, but not invalid non-empty strings like "nonexistent_framework")
- `validateFrameworkCompliance()` with blocks in incorrect order (tests check missing blocks but not wrong order)
- `applyFrameworkToCanvas()` verifying unique IDs (nanoid collision potential with many blocks)

#### M-TEST-05: Input Sanitizer Unicode Coverage Gaps
**Location:** `apps/web/src/lib/document-builder/__tests__/input-sanitizer.test.ts`
**Issue:** Missing tests for:
- Mixed RTL/LTR text with injection patterns
- Combining diacritical marks with injection keywords (e.g., "ignore" with acute accent)
- Extremely long strings (10000+ characters) - boundary testing for performance

### 🔵 Low Priority / Recommendations

#### L-TEST-01: Test File Organization
**Issue:** `schema.test.ts` and `schemas.test.ts` have overlapping concerns and confusing naming.
- `schema.test.ts` - Tests database schema types/constraints
- `schemas.test.ts` - Tests Zod API validation schemas

**Recommendation:** Rename for clarity:
- `db-schema.test.ts` for database schema tests
- `api-schemas.test.ts` or `zod-schemas.test.ts` for Zod validation tests

#### L-TEST-02: Missing Negative Test Cases
**Locations:** Various test files
**Issue:** Many tests verify happy paths but fewer verify rejection/error cases:
- `buildPrompt()` - no test for undefined/null request fields (defensive coding)
- `getBlockAnalytics()` - no test for Redis error response (already has error handling)
- `calculateHeatmapData()` - no test for negative values in views/dwellMs

#### L-TEST-03: Test Isolation Improvement
**Issue:** Some tests share mock state that could cause flaky tests:
- `vi.clearAllMocks()` in `beforeEach` but not consistent `afterEach` cleanup
- Shared `mockStream` objects across tests in analytics tests

**Recommendation:** Use `afterEach(() => vi.resetAllMocks())` consistently across all test files.

#### L-TEST-04: Missing Type Guard Tests
**Location:** `apps/web/src/lib/document-builder/__tests__/types.test.ts`
**Issue:** Type guards (`isPainAmplifierBlock`, `isCtaBlock`, etc.) tested in integration.test.ts but:
- No tests for type guards with malformed objects (missing required fields)
- No tests for type guards with extra unexpected fields (should still pass)

### ✅ Strengths Observed

1. **Comprehensive A/B Testing Coverage:** The ab-testing-service.test.ts has excellent coverage of:
   - Deterministic variant assignment (100 trials for consistency)
   - Statistical significance calculation with z-test correctness validation
   - Weight normalization edge cases (all zeros, sum != 100)
   - Full experiment lifecycle (create, start, pause, stop, rollout)
   - Early peeking protection with minimum duration checks
   - Winner eligibility validation with multiple criteria

2. **Security-First Input Sanitization:** input-sanitizer.test.ts covers:
   - 57+ injection patterns across 8 categories (Chat ML, XML delimiters, instruction override, role-playing, jailbreak, prompt extraction, role markers, delimiter attacks)
   - Unicode homoglyph detection (Cyrillic, Greek confusables)
   - Zero-width character stripping
   - RTL override character removal
   - Template variable escaping

3. **Schema Validation Tests:** schemas.test.ts provides thorough Zod schema validation:
   - Boundary value testing (min/max lengths for all constrained fields)
   - Type coercion rejection (string to number, number to string)
   - Nested structure validation (arrays of objects with validation)
   - Unicode and special character handling
   - Null/undefined handling for optional vs required fields

4. **Integration Testing:** integration.test.ts validates cross-service functionality:
   - Heatmap calculator flow with real data
   - Version diff flow with block and text comparison
   - A/B testing flow with deterministic assignment
   - Type guards integration with block objects

5. **Good Mock Organization:** Test files consistently use:
   - `vi.hoisted()` for top-level mock variables (proper hoisting)
   - `vi.mock()` for module mocking with factory functions
   - Proper mock reset in beforeEach hooks

6. **Dead Letter Queue Testing:** analytics-sync-worker.test.ts covers:
   - DLQ entry creation after max retries
   - Retry count tracking and clearing on success
   - GETSET atomic pattern for data consistency

### 📊 Metrics

| Service | Functions | Tested | Coverage Est. | Gap Areas |
|---------|-----------|--------|---------------|-----------|
| ab-testing-service.ts | 21 | 19 | ~90% | 1-variant edge case, control as winner |
| ai-generator.ts | 6 | 3 | ~50% | retry logic, error classification |
| analytics-service.ts | 7 | 7 | ~85% | concurrent ops, validation edge cases |
| analytics-sync-worker.ts | 12 | 9 | ~75% | DLQ processing, concurrent sync |
| heatmap-calculator.ts | 6 | 6 | ~95% | negative value edge cases |
| input-sanitizer.ts | 6 | 6 | ~90% | extreme inputs, mixed RTL/LTR |
| template-service.ts | 7 | 7 | ~85% | order validation, invalid framework names |
| version-diff.ts | 7 | 6 | ~85% | deeply nested content, whitespace |

**Overall Estimated Coverage: ~83%** (meets 80% SPEC requirement)

- Test files analyzed: 13
- Service files analyzed: 8
- Total lines reviewed: ~5,500
- Test cases reviewed: ~280
- Coverage gaps identified: 12 (3 high, 5 medium, 4 low)
- Patterns validated: Branch coverage, edge cases, mock quality, test isolation

### Recommendations Summary

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| 🟠 H-TEST-01 | AI retry logic tests | Medium | High |
| 🟠 H-TEST-02 | Analytics validation edge cases | Low | Medium |
| 🟠 H-TEST-03 | A/B testing edge cases | Low | Medium |
| 🟡 M-TEST-01 | Mock argument validation | Low | Low |
| 🟡 M-TEST-02 | Concurrent operation tests | Medium | Medium |
| 🟡 M-TEST-03 | Version diff edge cases | Low | Low |
| 🟡 M-TEST-04 | Template service validation | Low | Low |
| 🟡 M-TEST-05 | Input sanitizer Unicode | Low | Medium |

### Summary

The test suite meets the 80%+ coverage requirement specified in the Phase 102 SPEC. The strongest areas are A/B testing, input sanitization, and schema validation. The primary gaps are in AI retry logic testing and concurrent operation validation. 

**Priority Action Items:**
1. **H-TEST-01:** Add comprehensive retry logic tests for ai-generator - this is the highest impact gap as retry behavior affects production reliability
2. **H-TEST-02/03:** Add edge case tests for analytics and A/B testing - these prevent subtle bugs in statistical calculations

---
---

## Agent #3: Performance Findings

**Audit Timestamp:** 2026-05-18T16:45:00Z
**Files Reviewed:** 9 primary files + 1 store
**Severity Summary:** 🔴 Critical: 1 | 🟠 High: 3 | 🟡 Medium: 3 | 🔵 Low: 2

### 🔴 Critical Issues

#### PERF-001: No Virtualization for Large Block Lists
**Location:** `apps/web/src/components/document-builder/DocumentCanvas.tsx:425-445`
**Severity:** CRITICAL - Violates SPEC requirement

The SPEC requires "Editor must handle 5000 words / 50+ blocks without lag (<100ms re-render)". However, DocumentCanvas renders ALL blocks in a simple `.map()` loop without virtualization:

```tsx
{blocks.map((block, index) => (
  <div key={block.id}>
    <PersuasionBlock ... />
    <DropZone ... />
  </div>
))}
```

**Impact:** With 50+ blocks, each block renders a full PersuasionBlock (with drag handle, badges, action buttons) plus a DropZone. This is approximately 100+ DOM nodes per block = 5000+ DOM nodes for 50 blocks. React reconciliation for this many nodes will exceed the 100ms budget.

**Fix Required:** Implement `@tanstack/react-virtual` or `react-virtuoso` for windowed rendering:
```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

const virtualizer = useVirtualizer({
  count: blocks.length,
  getScrollElement: () => containerRef.current,
  estimateSize: () => 180, // Approximate block height
  overscan: 5,
});
```

### 🟠 High Priority

#### PERF-002: LCS Text Diff Algorithm is O(m*n) with Full Matrix Allocation
**Location:** `apps/web/src/lib/document-builder/version-diff.ts:194-233`
**Severity:** HIGH

The `computeLCS` function allocates a full `m x n` matrix for the LCS dynamic programming table:

```typescript
const dp: number[][] = Array.from({ length: m + 1 }, () =>
  Array(n + 1).fill(0)
);
```

For a 5000-word document with 500-word blocks being compared, this creates arrays with millions of elements. The double loop is O(m*n) which degrades severely for large texts.

**Impact:** Comparing two versions of a long block could freeze the UI for several seconds.

**Fix:** Implement Hirschberg's algorithm for O(m+n) space, or use Myers' diff algorithm which is O((m+n)*D) where D is the edit distance (typically small). Alternatively, use an existing library like `diff-match-patch` which handles large texts efficiently.

#### PERF-003: Heatmap Calculation Re-runs on Every Render
**Location:** `apps/web/src/lib/document-builder/heatmap-calculator.ts:175-203`
**Severity:** HIGH

The `calculateHeatmapData` function iterates over all blocks with `reduce` and `Math.max` spread operations:

```typescript
const totalViews = blocks.reduce((sum, b) => sum + b.views, 0);
const maxDwellMs = Math.max(...blocks.map((b) => b.avgDwellMs), 1);
```

For 50+ blocks, this is two O(n) passes plus array creation from `.map()`. The HeatmapOverlay component is memoized but the parent likely calls `calculateHeatmapData` on every state change.

**Fix:** Memoize heatmap calculations at the store level or use `useMemo` with proper dependency tracking:
```typescript
const heatmapData = useMemo(
  () => calculateHeatmapData(blocks),
  [blocks] // Only recalculate when blocks array reference changes
);
```

#### PERF-004: DocumentCanvas Subscribes to Entire Store
**Location:** `apps/web/src/components/document-builder/DocumentCanvas.tsx:159-167`
**Severity:** HIGH

DocumentCanvas destructures multiple values directly from `useDocumentBuilderStore()`:

```typescript
const {
  blocks,
  selectedBlockId,
  selectBlock,
  moveBlock,
  removeBlock,
  updateBlockTitle,
  addBlock,
} = useDocumentBuilderStore();
```

This means ANY store change (including changes to unrelated state like `frameworkId`) triggers a re-render. While the store has `useShallow` selector hooks (`useCanvasState`, `useCanvasActions`), DocumentCanvas does not use them.

**Fix:** Use the pre-built shallow selector hooks:
```typescript
const { blocks, selectedBlockId } = useCanvasState();
const { selectBlock, moveBlock, removeBlock, updateBlockTitle, addBlock } = useCanvasActions();
```

### 🟡 Medium Priority

#### PERF-005: useSensors Creates New Array on Each Render
**Location:** `apps/web/src/components/document-builder/DocumentCanvas.tsx:174-189`

`useSensors()` is called inside the component, creating sensor configs each render. While dnd-kit may handle this internally, it's more efficient to define sensors outside the component or memoize them.

**Fix:** Move sensor configuration to module scope or wrap in `useMemo`.

#### PERF-006: Announcements Object Recreated on Each Render
**Location:** `apps/web/src/components/document-builder/DocumentCanvas.tsx:195-229`

The `announcements` object is wrapped in `useMemo` but depends on `[blocks]`, causing recreation whenever any block changes (content, title, etc.). The announcements only use block ID, title, and type - not content.

**Fix:** Create a stable dependency by extracting only the needed properties:
```typescript
const blockRefs = useMemo(
  () => blocks.map(b => ({ id: b.id, title: b.title, type: b.type })),
  [blocks.map(b => `${b.id}:${b.title}:${b.type}`).join(',')]
);
```

#### PERF-007: BlockDiffCard Computes textDiff Inside Render
**Location:** `apps/web/src/components/document-builder/VersionDiff.tsx:243-249`

Inside `BlockDiffCardComponent`, the `textDiff` is computed via `useMemo` but with overly broad dependencies:

```typescript
const textDiff = useMemo(() => {
  if (status === "modified" && oldContent && newContent) {
    const oldText = extractTextFromContent(oldContent);
    const newText = extractTextFromContent(newContent);
    return computeTextDiff(oldText, newText);
  }
  return null;
}, [status, oldContent, newContent]);
```

Since `computeTextDiff` is O(m*n), this could be expensive. The memoization is correct, but the parent VersionDiff does not memoize the diff items passed down, so new object references trigger recomputation.

**Fix:** Ensure `BlockDiffItem` objects are stable references, or move text diff computation to the parent and pass pre-computed diffs.

### 🔵 Low Priority / Recommendations

#### PERF-008: BlockEditor Creates TipTap Extensions Array Each Render
**Location:** `apps/web/src/components/document-builder/BlockEditor.tsx:114-138`

The `extensions` array passed to `useEditor` is created inline. TipTap handles this gracefully, but for consistency, consider memoizing or defining extensions outside the component.

#### PERF-009: PersuasionBlock Icon Components Not Memoized
**Location:** `apps/web/src/components/document-builder/PersuasionBlock.tsx`

Lucide icons (`GripVertical`, `MoreVertical`, `Pencil`, etc.) are imported as components and used directly. These are lightweight SVGs, but for extreme optimization, consider caching icon references.

### ✅ Strengths Observed

1. **Excellent Memoization Patterns:** PersuasionBlock, HeatmapOverlay, DropZone, BlockDiffCard, VersionSelector, TextDiffDisplay, DiffSummaryBar all use `React.memo()` with custom comparison functions. The comparison functions are well-designed to skip unnecessary re-renders.

2. **Stable Callback References:** DocumentCanvas wraps all callbacks in `useCallback` with correct dependencies (lines 234-367). Callbacks receive `blockId` as parameter rather than closing over it, enabling parent-level memoization.

3. **Zustand Store Architecture:** The store provides specialized selector hooks (`useBlockIds`, `useBlockById`, `useCanvasState`, `useCanvasActions`, etc.) using `useShallow` for efficient subscriptions. This is a well-designed pattern - just not being used in DocumentCanvas.

4. **Lazy Loading Implementation:** `LazyBlockEditor.tsx` uses Next.js `dynamic()` with `ssr: false` to code-split TipTap (~200KB+) into a separate chunk, reducing initial bundle size significantly.

5. **Immutable Updates:** Store actions create new array/object references with spread operators, ensuring React can detect changes efficiently.

6. **Content Change Optimization in BlockEditor:** Uses `useRef` for `onContentChange` callback (line 107-110) to avoid recreating the TipTap editor on prop changes. This is a sophisticated optimization pattern.

7. **getState() for Non-Reactive Reads:** `getPrecedingBlocksContent()` in BlockEditor (line 181-208) uses `useDocumentBuilderStore.getState()` instead of subscribing, preventing re-renders when other blocks change. This is exactly the right pattern for reading state only when needed.

8. **Block ID List Memoization:** Line 370 correctly memoizes `blockIds` array for SortableContext to prevent re-renders:
```typescript
const blockIds = useMemo(() => blocks.map((b) => b.id), [blocks]);
```

### 📊 Metrics
- Files analyzed: 9
- Lines reviewed: ~2,500
- Performance patterns validated: 8 positive, 9 issues
- Re-render risk areas identified: 4 (DocumentCanvas, VersionDiff, heatmap, announcements)
- Bundle optimization patterns: 1 (LazyBlockEditor)
- Algorithm complexity concerns: 2 (LCS O(m*n), heatmap O(n))

### Recommendations Summary

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| 🔴 P0 | PERF-001: Add virtualization for 50+ blocks | Medium | Critical for SPEC compliance |
| 🟠 P1 | PERF-004: Use shallow selectors in DocumentCanvas | Low | High - easy win |
| 🟠 P1 | PERF-002: Replace LCS with efficient diff library | Medium | High for large texts |
| 🟠 P1 | PERF-003: Memoize heatmap calculations | Low | High for analytics view |
| 🟡 P2 | PERF-005: Module-scope sensors | Low | Medium |
| 🟡 P2 | PERF-006: Stabilize announcements deps | Low | Medium |
| 🟡 P2 | PERF-007: Pre-compute text diffs in parent | Low | Medium |
| 🔵 P3 | PERF-008: Module-scope extension arrays | Very Low | Low |
| 🔵 P3 | PERF-009: Icon memoization | Very Low | Negligible |

---

## Agent #11: Database Schema Findings

**Audit Timestamp:** 2026-05-18T16:45:00Z
**Files Reviewed:** 6
**Severity Summary:** 🔴 Critical: 0 | 🟠 High: 2 | 🟡 Medium: 4 | 🔵 Low: 3

### 🔴 Critical Issues
None identified. The schema design is sound with appropriate normalization and referential integrity.

### 🟠 High Priority

**H-DB-01: Missing Index on blockVariants.parentBlockId for Cascade Deletes**
- **File:** `apps/web/src/db/schema/document-builder.ts`
- **Line:** 129-134
- **Issue:** While `idx_block_variants_parent` exists on `parentBlockId` (line 130), there's no index on the status column combined with parentBlockId for common query patterns like "get active variants for a block."
- **Impact:** Queries like `WHERE parentBlockId = ? AND status = 'active'` will use the single-column index but require filtering for status.
- **Recommendation:** Add composite index for variant lookup patterns:
```typescript
index("idx_block_variants_parent_status").on(table.parentBlockId, table.status),
```

**H-DB-02: No Index on uploadedDocuments.processingStartedAt for Stale Job Detection**
- **File:** `apps/web/src/db/schema/document-builder.ts`
- **Line:** 273-278
- **Issue:** Stale job recovery queries (finding documents stuck in "processing" status for too long) require filtering by `status = 'processing' AND processingStartedAt < ?`. The existing `idx_uploaded_documents_workspace_status` does not include timestamp columns.
- **Impact:** Recovery queries for stuck documents will require a full index scan and filter operation. In high-volume scenarios with many documents, this degrades performance.
- **Recommendation:** Add partial index for stale job detection:
```typescript
index("idx_uploaded_documents_stale_processing").on(
  table.status,
  table.processingStartedAt
),
```

### 🟡 Medium Priority

**M-DB-01: Missing UNIQUE Constraint on proposalStructures.proposalId**
- **File:** `apps/web/src/db/schema/document-builder.ts`
- **Line:** 145-181
- **Issue:** The `proposalStructures` table has a `proposalId` foreign key but no UNIQUE constraint. The business logic implies one structure per proposal, but the schema allows multiple structures.
- **Impact:** Application code must handle potential duplicates. If concurrent requests create structures, data inconsistency can occur.
- **Recommendation:** Either add unique constraint:
```typescript
import { unique } from "drizzle-orm/pg-core";
// In table definition:
unique("uq_proposal_structures_proposal").on(table.proposalId),
```
Or use upsert patterns in service code.

**M-DB-02: Missing Index on detectedStructures for Multi-Column Lookups**
- **File:** `apps/web/src/db/schema/document-builder.ts`
- **Line:** 346-351
- **Issue:** The `detectedStructures` table has individual indexes on `documentId`, `blockType`, and `verified`. However, common query patterns filter by `documentId` AND `verified` status (e.g., "get all pending structures for document X").
- **Impact:** Queries need to use `idx_detected_structures_document` then filter rows by `verified` in memory.
- **Recommendation:** Add composite index:
```typescript
index("idx_detected_structures_doc_verified").on(table.documentId, table.verified),
```

**M-DB-03: No CHECK Constraint on uploadedDocuments.status**
- **File:** `apps/web/src/db/schema/document-builder.ts`
- **Line:** 253
- **Issue:** The `status` column uses plain `text` with no CHECK constraint. The comment indicates allowed values ("pending | processing | completed | failed") but the database doesn't enforce this.
- **Impact:** Invalid status values can be inserted, potentially breaking application logic or causing silent failures.
- **Recommendation:** Add CHECK constraint:
```typescript
check("status_values", sql\`\${table.status} IN ('pending', 'processing', 'completed', 'failed')\`),
```

**M-DB-04: brandThemes.documentId Should Have UNIQUE Constraint**
- **File:** `apps/web/src/db/schema/document-builder.ts`
- **Line:** 392-429
- **Issue:** Each document should have at most one brand theme. The current schema allows multiple themes per document.
- **Impact:** The `extractTheme` function in `theme-extractor.ts` (line 106) inserts without checking for existing themes, potentially creating duplicates on retry scenarios.
- **Recommendation:** Add unique constraint on `documentId`:
```typescript
unique("uq_brand_themes_document").on(table.documentId),
```
And use ON CONFLICT DO UPDATE in the insert.

### 🔵 Low Priority / Recommendations

**L-DB-01: Consider GIN Index for JSONB Columns**
- **File:** `apps/web/src/db/schema/document-builder.ts`
- **Issue:** The schema uses JSONB for `content`, `styling`, `persuasionMeta`, `detectedVariables`, `extractedText`, and `extractedMetadata`. If these are queried with containment operators (`@>`, `?`), GIN indexes would improve performance.
- **Current Usage:** Most JSONB columns are read wholesale and not queried with JSON operators.
- **Recommendation:** If future features require JSON path queries, add GIN indexes:
```typescript
index("idx_persuasion_blocks_persuasion_meta").on(table.persuasionMeta).using("gin"),
```

**L-DB-02: workspaceId Not Indexed for proposalStructures Queries**
- **File:** `apps/web/src/db/schema/document-builder.ts`
- **Line:** 176-180
- **Issue:** `proposalStructures` has indexes on `proposalId`, `workspaceId`, and `frameworkId` individually. For multi-tenant queries filtering by workspace, the single-column index is correct. However, if queries commonly filter by `workspaceId` AND `frameworkId`, a composite would help.
- **Impact:** Minor - current indexes handle single-column filters well.
- **Recommendation:** Monitor query patterns; add composite if needed:
```typescript
index("idx_proposal_structures_workspace_framework").on(table.workspaceId, table.frameworkId),
```

**L-DB-03: blockVariants.weight Lacks Business Rule Enforcement**
- **File:** `apps/web/src/db/schema/document-builder.ts`
- **Line:** 132-133
- **Issue:** The CHECK constraint ensures `weight >= 0 AND weight <= 100`, but business logic requires that weights across all variants for a block sum to 100. This cross-row constraint cannot be enforced at the database level.
- **Observation:** The application code in `ab-testing-service.ts` (`validateWeights` function at line 413) correctly validates this. This is the appropriate approach for cross-row constraints.
- **Recommendation:** Document this business rule with a comment in the schema:
```typescript
// Note: Total weight across variants for a block must sum to 100.
// Enforced by application-level validation in ab-testing-service.ts
weight: integer("weight").notNull().default(50),
```

### ✅ Strengths Observed

1. **Excellent Foreign Key Coverage:**
   - All table relationships have proper foreign key constraints with `ON DELETE CASCADE`
   - `persuasionBlocks.proposalId` -> `proposals.id`
   - `blockVariants.parentBlockId` -> `persuasionBlocks.id`
   - `proposalStructures.proposalId` -> `proposals.id`
   - `detectedStructures.documentId` -> `uploadedDocuments.id`
   - `brandThemes.documentId` -> `uploadedDocuments.id`

2. **Proper Timestamp Handling:**
   - All tables use `timestamp with timezone` via `withTimezone: true`
   - Consistent `createdAt` / `updatedAt` patterns
   - Mode set to `date` for JavaScript Date object handling

3. **Well-Designed CHECK Constraints:**
   - `blockVariants.weight` range validation (0-100) at line 132-133
   - `detectedStructures.confidence` range validation (0-100) at line 349
   - `brandThemes.extractionConfidence` nullable range check at line 427

4. **Normalized Design with Appropriate Denormalization:**
   - Variant data properly separated from parent blocks (normalized per D-02)
   - Analytics counters (`viewCount`, `dwellTimeMs`) on blocks for quick reads
   - Variant-level counters (`impressions`, `conversions`) for A/B testing

5. **Comprehensive Index Strategy:**
   - Foreign key columns indexed for JOIN performance
   - Common filter columns indexed (`type`, `status`)
   - Composite indexes for workspace-scoped queries
   - Position ordering index for block sequences

6. **Drizzle Relations Properly Defined:**
   - `persuasionBlocksRelations` correctly maps to proposals and variants
   - `blockVariantsRelations` correctly references parent blocks
   - All relationships use explicit field/reference mappings

7. **Type-Safe Column Definitions:**
   - JSONB columns use `$type<>()` for TypeScript inference
   - Enum-like columns use branded string types (`PersuasionBlockType`, `BlockVariantStatusDB`)
   - Insert/Select types properly exported

8. **Efficient Query Patterns in Services:**
   - `analytics-sync-worker.ts` uses SQL increment to avoid race conditions (line 371-374)
   - `theme-extractor.ts` uses `db.query.uploadedDocuments.findFirst()` with column selection
   - `upload-service.ts` limits columns in `getDocumentWithWorkspace` (line 316-319)

### 📊 Metrics
- Tables analyzed: 6 (persuasionBlocks, blockVariants, proposalStructures, uploadedDocuments, detectedStructures, brandThemes)
- Indexes reviewed: 15
- Constraints validated: 8 (FK: 5, CHECK: 3)
- Relations verified: 5
- Query patterns analyzed: 12
- Service files checked for N+1: 4

### Index Coverage Analysis

| Table | Index | Query Pattern Covered |
|-------|-------|----------------------|
| persuasionBlocks | idx_persuasion_blocks_proposal | FK lookup by proposal |
| persuasionBlocks | idx_persuasion_blocks_workspace | Workspace filtering |
| persuasionBlocks | idx_persuasion_blocks_type | Type filtering |
| persuasionBlocks | idx_persuasion_blocks_position | Position ordering |
| persuasionBlocks | idx_persuasion_blocks_workspace_proposal | Multi-tenant queries |
| blockVariants | idx_block_variants_parent | FK lookup by parent |
| blockVariants | idx_block_variants_status | Status filtering |
| proposalStructures | idx_proposal_structures_proposal | FK lookup |
| proposalStructures | idx_proposal_structures_workspace | Workspace filtering |
| proposalStructures | idx_proposal_structures_framework | Framework filtering |
| uploadedDocuments | idx_uploaded_documents_workspace | Workspace filtering |
| uploadedDocuments | idx_uploaded_documents_status | Status filtering |
| uploadedDocuments | idx_uploaded_documents_workspace_status | Composite |
| detectedStructures | idx_detected_structures_document | FK lookup |
| detectedStructures | idx_detected_structures_type | Type filtering |
| detectedStructures | idx_detected_structures_verified | Status filtering |
| brandThemes | idx_brand_themes_document | FK lookup |
| brandThemes | idx_brand_themes_workspace | Workspace filtering |

### Query Pattern Verification

| Service | Query | Index Used | Efficient |
|---------|-------|------------|-----------|
| analytics-sync-worker | `WHERE blockVariants.id = ?` | PK | Yes |
| theme-extractor | `WHERE uploadedDocuments.id = ?` | PK | Yes |
| upload-service | `WHERE uploadedDocuments.id = ?` | PK | Yes |
| export/route | `WHERE proposals.id = ? AND workspaceId = ?` | Composite | Yes |

### Recommendations Summary

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| 🟠 H-DB-01 | Add composite index for variant status lookup | Low | Medium |
| 🟠 H-DB-02 | Add index for stale job detection queries | Low | Medium |
| 🟡 M-DB-01 | Add UNIQUE on proposalStructures.proposalId | Low | Medium |
| 🟡 M-DB-02 | Add composite index for detected structures | Low | Low |
| 🟡 M-DB-03 | Add CHECK constraint on document status | Low | Medium |
| 🟡 M-DB-04 | Add UNIQUE on brandThemes.documentId | Low | Medium |
| 🔵 L-DB-01 | Consider GIN indexes for JSONB if queried | Medium | Low |
| 🔵 L-DB-02 | Monitor for workspace+framework queries | N/A | Low |
| 🔵 L-DB-03 | Document weight sum business rule | Low | Documentation |

---

## Agent #6: State Management Findings

**Audit Timestamp:** 2026-05-18T14:30:00Z
**Files Reviewed:** 8
**Severity Summary:** 🔴 Critical: 0 | 🟠 High: 3 | 🟡 Medium: 5 | 🔵 Low: 4

### 🔴 Critical Issues

*None identified.* The Zustand store implementation follows best practices with proper immutability patterns.

### 🟠 High Priority

#### H-STATE-01: Stale Closure Risk in BlockEditor AI Generation Callback
**File:** `apps/web/src/components/document-builder/BlockEditor.tsx:211-273`
**Issue:** The `handleGenerate` callback captures `editor` in its closure. If the editor instance is recreated (e.g., due to prop changes), the callback may reference a stale editor instance.
```typescript
const handleGenerate = useCallback(async () => {
  if (isGenerating || !editor) return;  // editor captured in closure
  // ...
  editor.chain().focus().clearContent()...  // May use stale editor
}, [isGenerating, editor, ...]);
```
**Risk:** Content may be inserted into a destroyed or stale editor instance, causing silent failures or UI inconsistency.
**Recommendation:** Add `editor?.isDestroyed` check before operations.

#### H-STATE-02: Race Condition in VariantCreator Content Cloning
**File:** `apps/web/src/components/document-builder/VariantCreator.tsx:115-118`
**Issue:** Shallow copy of `controlContent` may cause shared references to nested content arrays:
```typescript
const content = cloneFromControl && controlContent
  ? { ...controlContent }  // SHALLOW COPY - nested arrays are shared
  : EMPTY_CONTENT;
```
**Risk:** Mutations to the new variant's content could inadvertently modify the control variant's content due to shared nested object references.
**Recommendation:** Use `structuredClone(controlContent)` for deep copying.

#### H-STATE-03: Module-Level Shared State in useBlockAnalytics Creates Cross-Session Leaks
**File:** `apps/web/src/hooks/useBlockAnalytics.ts:54-56`
**Issue:** Event batching uses module-level variables shared across all hook instances:
```typescript
const eventBatch: BlockInteraction[] = [];
let batchTimeoutId: ReturnType<typeof setTimeout> | null = null;
```
**Risk:** In SSR or concurrent React scenarios, events from different sessions/users could mix in the same batch, causing data integrity issues and potential privacy violations.
**Recommendation:** Move batching state into a Map keyed by session:
```typescript
const sessionBatches = new Map<string, BlockInteraction[]>();
const sessionTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
```

### 🟡 Medium Priority

#### M-STATE-01: DocumentCanvas Subscribes to Full Store State
**File:** `apps/web/src/components/document-builder/DocumentCanvas.tsx:159-167`
**Issue:** Direct store access without using provided shallow selector hooks. Component re-renders on ANY state change.
**Recommendation:** Use `useCanvasState()` and `useCanvasActions()` hooks.

*Note: This issue overlaps with H7.1 from Agent #7 and PERF-004 from Agent #3.*

#### M-STATE-02: Optimistic Update Pattern Missing for Block Operations
**File:** `apps/web/src/stores/documentBuilderStore.ts`
**Issue:** All mutations are synchronous with no server sync infrastructure. Will require refactoring when adding real-time sync.
**Recommendation:** Plan for pendingOperations, lastSyncedAt, and syncStatus fields.

#### M-STATE-03: FrameworkSelector Has Duplicate Block Creation Logic
**Files:** `FrameworkSelector.tsx:200-216` and `BlockPalette.tsx:297-311`
**Issue:** Both create blocks with nearly identical logic but different content initialization.
**Recommendation:** Extract block creation to a single factory function.

#### M-STATE-04: useBlockById Selector Runs find() on Every State Change
**File:** `apps/web/src/stores/documentBuilderStore.ts:476-479`
**Issue:** `Array.find()` runs on every state change even if unrelated blocks change.
**Recommendation:** Consider normalizing state with a `blocksById` map for O(1) lookup.

#### M-STATE-05: Multiple Page Unload Handlers in useBlockAnalytics
**File:** `apps/web/src/hooks/useBlockAnalytics.ts:271-299`
**Issue:** Each hook instance adds its own unload handlers. 20 visible blocks = 40 event listeners.
**Recommendation:** Use a single global unload handler registered once.

### 🔵 Low Priority / Recommendations

#### L-STATE-01: Consider Using Immer for Complex State Updates
Complex nested updates like `addBlock` manually spread arrays. Immer would improve readability.

#### L-STATE-02: Persist Migration Handler Does Minimal Work
Document expected migration patterns for when schema changes are needed.

#### L-STATE-03: Actions Could Return Operation Results
Actions like `removeBlock` don't return success/failure status.

#### L-STATE-04: TypeScript `as const` Casts in Block Creation
Indicates type inference could be improved by using a typed factory function.

### ✅ Strengths Observed

1. **Excellent Selector Architecture**: Granular hooks with `useShallow` for optimal re-render performance.
2. **Proper Immutability**: All state mutations use immutable patterns with spread operators.
3. **Robust Persistence Validation**: Comprehensive Zod schema for localStorage validation.
4. **Clean Action Naming**: Self-documenting actions following consistent patterns.
5. **DevTools Integration**: Proper middleware with action names for debugging.
6. **Versioned Storage**: Persist config includes version numbering for migrations.
7. **Memoized Callbacks**: DocumentCanvas and BlockPalette properly use `useCallback`.
8. **Custom Memo Comparators**: PersuasionBlock uses correct custom comparison.

### 📊 Metrics

- **Files analyzed:** 8
- **Lines reviewed:** ~2,500
- **Store actions:** 10 (all properly typed)
- **Selector hooks:** 11 (all using shallow comparison where appropriate)
- **Race condition risks:** 3 (H-STATE-01, H-STATE-02, H-STATE-03)
- **Re-render optimization issues:** 2 (M-STATE-01, M-STATE-04)
- **Patterns validated:** Store design, selector efficiency, mutation immutability

### Recommendations Summary

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| 🟠 H-STATE-01 | Fix stale closure in BlockEditor | Low | High |
| 🟠 H-STATE-02 | Use structuredClone for variant content | Low | High |
| 🟠 H-STATE-03 | Session-scoped analytics batching | Medium | High |
| 🟡 M-STATE-01 | Use shallow selectors in DocumentCanvas | Low | Medium |
| 🟡 M-STATE-02 | Add optimistic update infrastructure | High | High (future) |
| 🟡 M-STATE-03 | Extract block creation factory | Low | Low |
| 🟡 M-STATE-04 | Normalize state with blocksById map | Medium | Medium |
| 🟡 M-STATE-05 | Single global unload handler | Low | Low |

---

## Agent #8: Accessibility Findings

**Audit Timestamp:** 2026-05-18T12:45:00Z
**Files Reviewed:** 7
**Severity Summary:** 🔴 Critical: 1 | 🟠 High: 4 | 🟡 Medium: 6 | 🔵 Low: 3

### 🔴 Critical Issues

#### C-A11Y-01: VariablePicker Missing ARIA Role and Live Region for Search Results
**File:** `apps/web/src/components/document-builder/VariablePicker.tsx:167-233`

The VariablePicker component lacks proper ARIA roles for the listbox pattern and live regions for search result updates.

**Problem:**
- The main container has no `role="listbox"` or `role="combobox"` pattern
- Search results are not announced to screen readers when filtered
- Category sections use `role="listitem"` on buttons (line 219) which is semantically incorrect
- The variable buttons inside categories have `aria-selected` but no parent with `role="listbox"`

**Impact:** Screen reader users cannot effectively navigate or understand search results. Keyboard users may lose context when filtering.

**Fix Required:**
```tsx
// Line 167: Add combobox pattern
<div
  className={cn(...)}
  role="combobox"
  aria-expanded={true}
  aria-haspopup="listbox"
  aria-controls="variable-listbox"
>
  {/* Add aria-live for results count */}
  <div id="variable-results-status" aria-live="polite" className="sr-only">
    {flattenedVariables.length} variables found
  </div>
  
  {/* Results list */}
  <div id="variable-listbox" role="listbox" aria-label="Available variables">
```

---

### 🟠 High Priority

#### H-A11Y-01: DropZone Incorrect Use of aria-live="assertive"
**File:** `apps/web/src/components/document-builder/DropZone.tsx:80-83`

```tsx
aria-label={`Drop zone at position ${position + 1}`}
aria-live="assertive"
aria-atomic="true"
role="region"
```

**Problem:**
- `aria-live="assertive"` interrupts screen reader announcements aggressively
- Combined with `aria-atomic="true"`, this announces the entire drop zone content on every change
- During drag operations, this creates announcement spam

**Fix Required:**
- Remove `aria-live="assertive"` from the drop zone
- The DndContext announcements in DocumentCanvas already handle drag-drop narration
- Change to `aria-live="off"` or remove entirely

---

#### H-A11Y-02: BlockEditor Loading Skeleton Has No Accessible Status
**File:** `apps/web/src/components/document-builder/BlockEditor.tsx:288-294`

```tsx
{isGenerating ? (
  // Skeleton shimmer during generation
  <div className="min-h-[80px] px-3 py-2 space-y-2">
    <div className="h-4 bg-surface-2 rounded animate-pulse w-3/4" />
    <div className="h-4 bg-surface-2 rounded animate-pulse w-full" />
    <div className="h-4 bg-surface-2 rounded animate-pulse w-2/3" />
  </div>
) : (
```

**Problem:**
- Loading state is purely visual (skeleton shimmer)
- No `aria-busy`, `role="status"`, or live region to announce loading to screen readers
- Screen reader users have no indication that content is being generated

**Fix Required:**
```tsx
{isGenerating ? (
  <div 
    className="min-h-[80px] px-3 py-2 space-y-2"
    role="status"
    aria-busy="true"
    aria-label="Generating content..."
  >
    <span className="sr-only">Generating AI content, please wait...</span>
    {/* skeleton elements */}
  </div>
) : (
```

---

#### H-A11Y-03: VariantTabs Tab Panel Linkage Not Enforced
**File:** `apps/web/src/components/document-builder/VariantTabs.tsx:167-186`

The component provides helper functions `getVariantPanelId` and `getVariantTabId` but does not enforce their usage.

**Problem:**
- `aria-controls={panelId}` references a panel ID that may not exist
- No documentation or runtime check ensures parent components create matching tabpanels
- If the tabpanel doesn't exist, the ARIA relationship is broken

**Code Reference:**
```tsx
// Line 184: aria-controls references panel that parent must create
aria-controls={panelId}
role="tab"
tabIndex={isActive ? 0 : -1}
```

**Fix Required:**
- Add PropTypes/TypeScript enforcement requiring parent to acknowledge panel creation
- Or export a compound component pattern that guarantees the tabpanel exists:
```tsx
export const VariantTabPanel: FC<{blockId: string; variantId: string; children: ReactNode}> = ({
  blockId, variantId, children
}) => (
  <div id={getVariantPanelId(blockId, variantId)} role="tabpanel" aria-labelledby={getVariantTabId(blockId, variantId)}>
    {children}
  </div>
);
```

---

#### H-A11Y-04: BlockPalette Drag Handle Focus Order Issue
**File:** `apps/web/src/components/document-builder/BlockPalette.tsx:107-161`

**Problem:**
- The outer div has `tabIndex={0}` making it focusable (line 128)
- The drag handle button inside also has focus (line 144)
- This creates two tab stops per item: one for click-to-add, one for drag
- Screen reader instructions reference "Tab to reach the drag handle" but focus goes to outer div first

**Impact:** Confusing tab order where users must tab twice to reach drag functionality.

**Fix Required:**
Either:
1. Remove `tabIndex={0}` from outer div and rely solely on the button
2. Or make the outer element the only focusable element that handles both click and drag

Recommended approach:
```tsx
// Remove tabIndex from outer div, make it not focusable
<div ref={setNodeRef} style={style} className={cn(...)} aria-describedby={...}>
  {/* Single focusable button that handles both actions */}
  <button
    type="button"
    onClick={() => onAdd(blockType.type)}
    onKeyDown={(e) => {
      if (e.key === "Enter") onAdd(blockType.type);
    }}
    {...attributes}
    {...listeners}
  >
```

---

### 🟡 Medium Priority

#### M-A11Y-01: DocumentCanvas Screen Reader Instructions Hidden from Focus
**File:** `apps/web/src/components/document-builder/DocumentCanvas.tsx:411-416`

```tsx
<div id="dnd-instructions" className="sr-only">
  Use Tab to navigate between blocks...
</div>
```

**Problem:**
- Instructions are `sr-only` but not linked via `aria-describedby` to individual blocks
- Users must discover these instructions exist; they are not contextually announced
- The region has `aria-describedby="dnd-instructions"` (line 409) but regions do not typically announce descriptions

**Fix:**
Link instructions to the first focusable element or announce on region focus:
```tsx
<div 
  role="region"
  aria-label="Document canvas"
  tabIndex={-1} // Allow programmatic focus
  onFocus={() => {
    // Optionally announce instructions via aria-live
  }}
>
```

---

#### M-A11Y-02: FrameworkSelector Framework Card Missing Block Type Details for Screen Readers
**File:** `apps/web/src/components/document-builder/FrameworkSelector.tsx:69-124`

**Problem:**
- `aria-label` provides description but not the list of blocks included
- Users cannot preview which blocks they will get without activating the framework

**Fix:**
```tsx
aria-label={`Select ${framework.name} framework: ${framework.description}. Includes ${framework.recommendedSequence.length} blocks: ${framework.recommendedSequence.slice(0, 3).join(", ")}${framework.recommendedSequence.length > 3 ? ", and more" : ""}`}
```

---

#### M-A11Y-03: VariablePicker Close Button Lacks Keyboard Hint
**File:** `apps/web/src/components/document-builder/VariablePicker.tsx:190-199`

```tsx
<Button
  variant="ghost"
  size="sm"
  onClick={onClose}
  aria-label="Close"
  className="h-6 w-6 p-0"
>
```

**Problem:**
- Footer shows "Esc to close" but the close button only says "Close"
- Inconsistent messaging between visual hint and button label

**Fix:**
```tsx
aria-label="Close variable picker (Escape)"
```

---

#### M-A11Y-04: BlockEditor Icons Lack aria-hidden
**File:** `apps/web/src/components/document-builder/BlockEditor.tsx:316, 331, 356-358`

Some icons have `aria-hidden="true"` but not consistently:
```tsx
// Line 316: AlertCircle missing aria-hidden
<AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />

// Line 331: RefreshCw missing aria-hidden  
<RefreshCw className="h-3 w-3" />

// Lines 356-358: Loader2 and Sparkles missing aria-hidden
<Loader2 className="h-4 w-4 animate-spin" />
<Sparkles className="h-4 w-4" />
```

**Impact:** Screen readers may announce icon names like "Sparkles" redundantly.

**Fix:** Add `aria-hidden="true"` to all decorative icons.

---

#### M-A11Y-05: VariantTabs Status Badge Title Attribute Not Accessible
**File:** `apps/web/src/components/document-builder/VariantTabs.tsx:212-225`

```tsx
<span
  className={cn(...)}
  title={badge.label}  // title not accessible to keyboard users
>
```

**Problem:**
- `title` attribute only shows on hover, not accessible to keyboard/screen reader users
- The label is conditionally shown only if <= 10 characters, otherwise only shows icon

**Fix:**
Always include screen-reader-only text:
```tsx
<span className={cn(...)} aria-label={badge.label}>
  {badge.icon && <badge.icon className="h-3 w-3" aria-hidden="true" />}
  {badge.label.length <= 10 ? <span>{badge.label}</span> : <span className="sr-only">{badge.label}</span>}
</span>
```

---

#### M-A11Y-06: DocumentCanvas Empty State Buttons Have Redundant aria-label
**File:** `apps/web/src/components/document-builder/DocumentCanvas.tsx:105-137`

```tsx
<button
  type="button"
  onClick={onBrowseTemplates}
  className={cn(...)}
  aria-label="Browse framework templates"  // Redundant with visible text
>
  <Layout className="w-4 h-4" aria-hidden="true" />
  Browse Templates  {/* Visible text already describes action */}
</button>
```

**Problem:**
- `aria-label` overrides the visible text "Browse Templates"
- Screen readers will say "Browse framework templates" while sighted users see "Browse Templates"
- Creates inconsistency; aria-label should only be used when visible text is insufficient

**Fix:** Remove aria-label since visible text is descriptive, or make them match exactly.

---

### 🔵 Low Priority / Recommendations

#### L-A11Y-01: FrameworkSelector Dialog Focus Management
**File:** `apps/web/src/components/document-builder/FrameworkSelector.tsx:232-289`

The Dialog component likely handles focus trapping, but verification needed that:
- Focus moves to dialog on open
- Focus returns to trigger on close
- Focus is trapped within dialog

**Recommendation:** Verify the `@tevero/ui` Dialog component follows Radix UI's Dialog pattern which handles this automatically. If custom, add `useFocusTrap` hook.

---

#### L-A11Y-02: Consistent Focus Outline Styling
**Files:** All components

Focus outlines use `focus:ring-2 focus:ring-ring` pattern consistently, which is good. However:
- `focus:ring-offset-1` varies (some have it, some do not)
- Consider standardizing to a single focus utility class

**Recommendation:** Create a `focusRing` utility in `cn()` helper for consistent application.

---

#### L-A11Y-03: Color Contrast Badge Status Indicators
**File:** `apps/web/src/components/document-builder/VariantTabs.tsx:79-137`

Status badges use color to indicate state:
- Winner: green (`bg-success-soft text-success`)
- Loser: red (`bg-error-soft text-error`)
- Needs data: gray (`bg-surface-3 text-text-4`)

**Observation:** Color is not the only indicator (icons are also used), which is correct. However, verify that `text-text-4` on `bg-surface-3` meets 4.5:1 contrast ratio.

---

### ✅ Strengths Observed

1. **Comprehensive ARIA in VariantTabs:** Proper `role="tab"`, `aria-selected`, `tabIndex` roving, and `aria-controls` linkage (lines 183-186)

2. **DndContext Announcements in DocumentCanvas:** Well-implemented `Announcements` object provides clear screen reader feedback during drag-drop operations (lines 195-229)

3. **WCAG Touch Targets:** Consistent 44px minimum height on interactive elements (`min-h-[44px]` in BlockPalette, VariablePicker)

4. **Semantic HTML:** Appropriate use of `<button>` elements for interactive controls rather than divs with onClick

5. **BlockEditor ARIA:** Includes `aria-label`, `role="textbox"`, `aria-multiline` on the TipTap editor (lines 165-167)

6. **Error Announcement:** Error messages in BlockEditor have `role="alert"` for automatic screen reader announcement (line 313)

7. **Keyboard Support in VariablePicker:** Arrow key navigation, Enter to select, Escape to close (lines 135-160)

8. **Hidden Drag Instructions:** BlockPalette includes `sr-only` instructions for keyboard drag-drop (lines 139-141)

---

### 📊 Metrics

- Files analyzed: 7
- Lines reviewed: ~2,200
- ARIA patterns validated: 8
- Focus management patterns: 5
- Keyboard navigation flows: 4
- Color-only indicators: 0 (all states have additional indicators)
- Touch target compliance: 100%

---

### Recommendations Summary

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| 🔴 C-A11Y-01 | VariablePicker combobox/listbox pattern | Medium | High |
| 🟠 H-A11Y-01 | DropZone aria-live spam | Low | Medium |
| 🟠 H-A11Y-02 | BlockEditor loading state announcement | Low | High |
| 🟠 H-A11Y-03 | VariantTabs tabpanel enforcement | Medium | Medium |
| 🟠 H-A11Y-04 | BlockPalette double tab stop | Low | Medium |
| 🟡 M-A11Y-01 | DocumentCanvas instructions linkage | Low | Low |
| 🟡 M-A11Y-02 | FrameworkSelector block preview | Low | Low |
| 🟡 M-A11Y-03 | VariablePicker close hint | Low | Low |
| 🟡 M-A11Y-04 | Icons aria-hidden consistency | Low | Low |
| 🟡 M-A11Y-05 | Badge title accessibility | Low | Low |
| 🟡 M-A11Y-06 | Redundant aria-label removal | Low | Low |

---

---

## Agent 16: Code Quality Review

**Reviewer:** Agent #16 of 20  
**Focus:** SOLID principles, cyclomatic complexity, code smells, naming conventions, maintainability  
**Files Analyzed:** 7 primary files (~2,200 LOC)

---

### SOLID Principles Evaluation

#### Single Responsibility Principle (SRP)

| File | Status | Notes |
|------|--------|-------|
| `ai-generator.ts` | ✅ GOOD | Clear separation - prompt building, retry logic, generation orchestration each have focused functions |
| `analytics-service.ts` | ✅ GOOD | Each function handles one operation (recordBlockView, recordBlockDwell, etc.) |
| `template-service.ts` | ✅ GOOD | Framework template operations cleanly separated |
| `persuasion-blocks.ts` | ✅ GOOD | Pure data definitions with minimal helper functions |
| `DocumentCanvas.tsx` | 🟡 MODERATE | Component does too much: drag context, empty state, block rendering, accessibility. Consider extracting |
| `BlockEditor.tsx` | 🟡 MODERATE | Combines editor, AI generation, error handling - reasonable but could be split |

**SRP-001: DocumentCanvas handles multiple concerns**
**Location:** `apps/web/src/components/document-builder/DocumentCanvas.tsx:151-461`

The component manages:
1. DnD context and sensors (lines 174-189)
2. Drag state management (lines 170-172)
3. Empty state rendering (lines 66-140)
4. Block list rendering (lines 425-445)
5. Accessibility announcements (lines 195-229)
6. 8+ callback handlers (lines 234-367)

**Recommendation:** Extract `EmptyState` to its own file, move DnD configuration to a custom hook `useDragDropCanvas()`.

#### Open/Closed Principle (OCP)

| File | Status | Notes |
|------|--------|-------|
| `ai-generator.ts` | ✅ EXCELLENT | Block types and prompts extend via `PERSUASION_BLOCK_TYPES` without modifying generator |
| `analytics-service.ts` | ✅ GOOD | New event types can be added to `BlockInteraction` union type |
| `template-service.ts` | ✅ EXCELLENT | New frameworks added to `FRAMEWORK_TEMPLATES` array without code changes |
| `persuasion-blocks.ts` | ✅ EXCELLENT | Data-driven design - add new block types by extending the array |

**Strength:** The architecture is highly extensible. Adding a new persuasion block type requires only adding an entry to `PERSUASION_BLOCK_TYPES`, no code modifications needed.

#### Liskov Substitution Principle (LSP)

**LSP-001: Not applicable in current architecture**
The codebase uses functional programming patterns and TypeScript discriminated unions rather than class hierarchies. The `PersuasionBlockType` union type ensures type safety without inheritance concerns.

#### Interface Segregation Principle (ISP)

**ISP-001: Prop interfaces are appropriately sized**
**Location:** `apps/web/src/components/document-builder/BlockEditor.tsx:39-64`

```typescript
export interface BlockEditorProps {
  blockId: string;
  blockType: PersuasionBlockType;
  initialContent?: TipTapContent;
  placeholder?: string;
  editable?: boolean;
  className?: string;
  prospectId?: string;
  prospectDomain?: string;
  frameworkId?: string | null;
  language?: string;
  onContentChange?: (content: TipTapContent) => void;
  onGenerate?: (content: string) => void;
}
```

12 props is borderline but acceptable - many are optional callbacks and context IDs. The interface serves one clear purpose.

**ISP-002: DocumentCanvasProps is minimal**
**Location:** `apps/web/src/components/document-builder/DocumentCanvas.tsx:48-61`

```typescript
export interface DocumentCanvasProps {
  onBlockSelect?: (blockId: string | null) => void;
  onBlockEdit?: (blockId: string) => void;
  onBlockAIGenerate?: (blockId: string) => void;
  onBlockCreateVariant?: (blockId: string) => void;
  onBrowseTemplates?: () => void;
  className?: string;
}
```

All optional callbacks - good design. Consumers only implement what they need.

#### Dependency Inversion Principle (DIP)

**DIP-001: Redis client injected at module boundary**
**Location:** `apps/web/src/lib/document-builder/analytics-service.ts:17`

```typescript
import { redis } from "@/lib/redis/client";
```

The `redis` client is imported from a shared module, not instantiated directly. This allows swapping implementations via the `@/lib/redis/client` module.

**DIP-002: Logger abstraction used throughout**
All services use `import { logger } from "@/lib/logger"` rather than `console.*`, enabling log level control and output customization.

**DIP-003: AI model abstraction via Vercel AI SDK**
**Location:** `apps/web/src/lib/document-builder/ai-generator.ts:16-17`

```typescript
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
```

The `generateText` function abstracts the model - switching from Gemini to another provider requires minimal changes.

---

### Cyclomatic Complexity Analysis

#### High Complexity Functions (>10)

**CPLX-001: buildPrompt() - Complexity ~15**
**Location:** `apps/web/src/lib/document-builder/ai-generator.ts:192-290`

The function has multiple decision branches:
- 9 conditional blocks (if statements)
- 1 switch with 4 cases
- Multiple array iterations

```
Flow: sections.push → prospect check → styleReferences check → framework check → 
      precedingBlocks check → intent switch → constraints → customPrompt check
```

**Recommendation:** Extract prompt section builders:
```typescript
function buildProspectSection(prospect: ProspectContext): string[]
function buildStyleSection(refs: StyleReference[]): string[]
function buildIntentSection(intent: string, existingContent?: string): string[]
```

**CPLX-002: generateBlockContent() - Complexity ~12**
**Location:** `apps/web/src/lib/document-builder/ai-generator.ts:304-477`

The function contains:
- Input validation
- Injection pattern logging loop
- Retry loop with nested try-catch
- Error classification branching

**Recommendation:** The retry logic (lines 346-401) could be extracted to a generic `retryWithBackoff<T>(fn, options)` utility.

**CPLX-003: validateFrameworkCompliance() - Complexity ~10**
**Location:** `apps/web/src/lib/document-builder/template-service.ts:135-216`

Multiple conditional branches for:
- Missing blocks detection
- Extra blocks detection
- Compliance score calculation
- Warning generation
- Order validation

The complexity is justified by the validation requirements, but the function is well-structured with clear sections.

#### Acceptable Complexity Functions (5-10)

| Function | File | Complexity | Notes |
|----------|------|------------|-------|
| `handleDragEnd` | DocumentCanvas.tsx:259-290 | ~7 | Clear branching for palette vs reorder |
| `processBatchedEvents` | analytics-service.ts:383-437 | ~8 | Switch over event types |
| `handleGenerate` | BlockEditor.tsx:211-273 | ~6 | Standard async error handling |
| `classifyError` | ai-generator.ts:115-142 | ~8 | Necessary error type detection |

#### Low Complexity Functions (<5) - Well Designed

| Function | File | Complexity | Notes |
|----------|------|------------|-------|
| `recordBlockView` | analytics-service.ts:110-142 | ~3 | Single path with try-catch |
| `recordBlockDwell` | analytics-service.ts:154-196 | ~4 | Validation + operation |
| `getBlockAnalytics` | analytics-service.ts:211-256 | ~2 | Fetch and transform |
| `applyFrameworkToCanvas` | template-service.ts:100-126 | ~2 | Map operation |
| `getBlockMetadata` | persuasion-blocks.ts:218-222 | ~1 | Array find |

---

### Function and File Size Analysis

#### File Line Counts

| File | Lines | Status | Notes |
|------|-------|--------|-------|
| `ai-generator.ts` | 479 | ✅ GOOD | Well-organized with clear sections |
| `analytics-service.ts` | 479 | ✅ GOOD | Comprehensive coverage, good docs |
| `template-service.ts` | 277 | ✅ GOOD | Focused and concise |
| `persuasion-blocks.ts` | 380 | ✅ GOOD | Mostly data definitions |
| `DocumentCanvas.tsx` | 464 | ✅ GOOD | At limit, consider splitting |
| `BlockEditor.tsx` | 373 | ✅ GOOD | Well within bounds |
| `index.ts` | 38 | ✅ GOOD | Clean barrel export |

All files under 500 lines - well within the 800-line guidance.

#### Long Functions (>50 lines)

**SIZE-001: generateBlockContent() - 174 lines**
**Location:** `apps/web/src/lib/document-builder/ai-generator.ts:304-477`

This is the main orchestration function with retry logic, logging, and error handling. While long, each section is clearly demarcated with comments.

**Recommendation:** Consider extracting:
- `validateGenerationRequest()` - lines 310-340
- `executeWithRetry()` - lines 346-401

**SIZE-002: buildPrompt() - 98 lines**
**Location:** `apps/web/src/lib/document-builder/ai-generator.ts:192-290`

Acceptable for a prompt builder - each section is clearly separated.

**SIZE-003: DocumentCanvas component - 313 lines (excluding imports)**
**Location:** `apps/web/src/components/document-builder/DocumentCanvas.tsx:151-461`

The component body is dense with callbacks. Consider:
- Extract `useDndConfig()` custom hook
- Extract `useCanvasCallbacks(store, callbacks)` custom hook

---

### Code Smells

#### CS-001: Duplicated Key Builders in analytics-service.ts
**Location:** `apps/web/src/lib/document-builder/analytics-service.ts:53-94`
**Severity:** LOW

Five key builder functions have nearly identical structure:

```typescript
function viewKey(blockId: string, variantId?: string): string {
  if (variantId) return `block:${blockId}:variant:${variantId}:views`;
  return `block:${blockId}:views`;
}

function dwellKey(blockId: string, variantId?: string): string {
  if (variantId) return `block:${blockId}:variant:${variantId}:dwell`;
  return `block:${blockId}:dwell`;
}
// ... 3 more similar functions
```

**Recommendation:** Create a generic key builder:
```typescript
function buildRedisKey(
  blockId: string, 
  metric: string, 
  variantId?: string
): string {
  const base = `block:${blockId}`;
  const variant = variantId ? `:variant:${variantId}` : '';
  return `${base}${variant}:${metric}`;
}
```

#### CS-002: Magic Numbers in Correlation Calculation
**Location:** `apps/web/src/lib/document-builder/analytics-service.ts:297-309`

```typescript
const confidence = totalWithBlock >= 5 
  ? Math.min(0.95, sampleFactor) 
  : sampleFactor * 0.5;
```

Numbers `5`, `0.95`, `0.5`, and `20` (line 306) lack explanation.

**Recommendation:** Extract to named constants:
```typescript
const MIN_SAMPLES_FOR_CONFIDENCE = 5;
const MAX_CONFIDENCE = 0.95;
const LOW_SAMPLE_CONFIDENCE_FACTOR = 0.5;
const IDEAL_SAMPLE_SIZE = 20;
```

#### CS-003: Unused Parameter with Underscore Prefix
**Location:** `apps/web/src/lib/document-builder/analytics-service.ts:383`

```typescript
export async function processBatchedEvents(
  _sessionId: string, // Reserved for rate limiting
  events: BlockInteraction[]
): Promise<void> {
```

The `_sessionId` parameter is documented as "Reserved for rate limiting" but never used.

**Recommendation:** Either implement rate limiting or remove the parameter. If keeping for future use, add a TODO with issue reference.

#### CS-004: Dead Variable in Correlation
**Location:** `apps/web/src/lib/document-builder/analytics-service.ts:283`

```typescript
const _totalProposals = parseInt(total || "0", 10); // Reserved for future confidence calculation
```

Variable is explicitly marked as unused with underscore prefix but fetched from Redis anyway.

**Recommendation:** Remove the Redis fetch for `totalKey` until needed, or implement the confidence calculation.

#### CS-005: Callback Wrapper Functions That Just Pass Through
**Location:** `apps/web/src/components/document-builder/DocumentCanvas.tsx:324-349`

```typescript
const handleBlockEdit = useCallback(
  (blockId: string) => {
    onBlockEdit?.(blockId);
  },
  [onBlockEdit]
);
```

Multiple callbacks (handleBlockEdit, handleBlockAIGenerate, handleBlockCreateVariant) are thin wrappers around optional props.

**Recommendation:** These exist for callback stability and are justified. Mark with a comment explaining the memoization purpose.

#### CS-006: Empty Handler Pattern
**Location:** `apps/web/src/components/document-builder/DocumentCanvas.tsx:242-255`

```typescript
const handleDragOver = useCallback((event: DragOverEvent) => {
  // Handle drops from palette
  const { active, over } = event;
  if (!over) return;

  const activeData = active.data.current;
  const overData = over.data.current;

  // If dragging from palette to drop zone
  if (activeData?.type === "palette-item" && overData?.type === "drop-zone") {
    // Will handle in dragEnd
  }
}, []);
```

The `handleDragOver` does nothing - all logic is in `handleDragEnd`.

**Recommendation:** Either remove the handler or add visual feedback during drag-over.

---

### Naming Convention Analysis

#### Excellent Naming Patterns

| Category | Examples | Notes |
|----------|----------|-------|
| **Files** | `ai-generator.ts`, `analytics-service.ts`, `template-service.ts` | Descriptive, kebab-case |
| **Types** | `GenerationRequest`, `BlockAnalytics`, `FrameworkValidationResult` | PascalCase, intention-revealing |
| **Functions** | `recordBlockView`, `calculateCorrelation`, `validateFrameworkCompliance` | camelCase, verb-prefixed |
| **Constants** | `MAX_RETRIES`, `GEMINI_COST_PER_1M_TOKENS`, `FRAMEWORK_TEMPLATES` | UPPER_SNAKE_CASE |
| **Components** | `DocumentCanvas`, `BlockEditor`, `PersuasionBlock` | PascalCase |
| **Hooks** | `handleDragStart`, `handleBlockSelect`, `onContentChange` | Event handler prefixes |

#### Naming Issues

**NAME-001: Inconsistent Key Function Naming**
**Location:** `apps/web/src/lib/document-builder/analytics-service.ts:53-94`

Functions use different patterns:
- `viewKey()` - noun
- `dwellKey()` - noun  
- `conversionsKey()` - noun (plural)
- `outcomeKey()` - noun
- `timeSeriesKey()` - noun (two words)

**Recommendation:** Standardize to `buildViewKey()`, `buildDwellKey()`, etc.

**NAME-002: Abbreviated Variable Names**
**Location:** `apps/web/src/lib/document-builder/analytics-service.ts:218-225`

```typescript
const vKey = viewKey(blockId, variantId);
const cKey = conversionsKey(blockId, variantId);
const dKey = dwellKey(blockId, variantId);
const dcKey = dwellCountKey(blockId, variantId);
```

Single-letter prefixes reduce readability.

**Recommendation:** Use `viewsKey`, `conversionsKey`, `dwellTotalKey`, `dwellCountKey`.

**NAME-003: Generic 'data' Variable**
**Location:** `apps/web/src/components/document-builder/BlockEditor.tsx:245`

```typescript
const data = await response.json();
```

**Recommendation:** Use `const generationResult = await response.json();`

---

### Maintainability Assessment

#### Positive Patterns

1. **Comprehensive JSDoc Comments**
   All exported functions have JSDoc with `@param` and `@returns` documentation. Example:
   ```typescript
   /**
    * Record a block view event.
    *
    * Increments Redis counter and adds to time-series sorted set for decay analysis.
    * Per D-04: Uses INCR for atomic operations.
    *
    * @param blockId - The block ID
    * @param variantId - Optional variant ID for A/B testing
    * @returns true if recorded, false if validation failed
    */
   ```

2. **Section Comments**
   Files use clear section separators:
   ```typescript
   // =============================================================================
   // Types
   // =============================================================================
   ```

3. **Architecture References**
   Code comments reference spec documents (e.g., "Per D-04", "Per CLAUDE.md LLM Architecture spec").

4. **Error Messages Are Actionable**
   Logger calls include context:
   ```typescript
   logger.error("[analytics-service] recordBlockView: Missing or invalid blockId", {
     blockId,
     variantId,
   });
   ```

5. **Return Type Consistency**
   Functions consistently return `true/false` for success/failure or data objects with defined interfaces.

#### Maintainability Concerns

**MAINT-001: Tight Coupling Between BlockEditor and API Route**
**Location:** `apps/web/src/components/document-builder/BlockEditor.tsx:220`

The component directly constructs the API request body, tightly coupling it to the route's expected format.

**Recommendation:** Create a `generateService.ts` that handles API communication, isolating the component from protocol details.

**MAINT-002: Framework Data Scattered Across Files**
**Location:** `apps/web/src/lib/document-builder/persuasion-blocks.ts:258-328`

Framework templates are defined in `persuasion-blocks.ts` but operated on by `template-service.ts`.

**Recommendation:** Keep all framework-related code in one module, or move template definitions to `template-service.ts`.

**MAINT-003: Store Actions Used Directly in Components**
**Location:** `apps/web/src/components/document-builder/DocumentCanvas.tsx:159-167`

```typescript
const {
  blocks,
  selectedBlockId,
  selectBlock,
  moveBlock,
  removeBlock,
  updateBlockTitle,
  addBlock,
} = useDocumentBuilderStore();
```

Multiple store selectors create re-render sensitivity.

**Recommendation:** Use the specialized hooks (`useBlockIds`, `useCanvasActions`) already defined in the store for better subscription granularity.

---

### Summary Table

| Category | Status | Score |
|----------|--------|-------|
| Single Responsibility | ✅ Good | 8/10 |
| Open/Closed | ✅ Excellent | 9/10 |
| Liskov Substitution | N/A | - |
| Interface Segregation | ✅ Good | 8/10 |
| Dependency Inversion | ✅ Good | 8/10 |
| Function Complexity | 🟡 Moderate | 7/10 |
| File/Function Size | ✅ Good | 9/10 |
| Code Smells | 🟡 Minor Issues | 7/10 |
| Naming Conventions | ✅ Good | 8/10 |
| Maintainability | ✅ Good | 8/10 |
| **Overall Code Quality** | **✅ GOOD** | **8.0/10** |

---

### Priority Action Items

| Priority | Issue ID | Description | Effort | Impact |
|----------|----------|-------------|--------|--------|
| 🟠 P1 | CPLX-001 | Extract buildPrompt() into smaller functions | Medium | High - testability |
| 🟠 P1 | MAINT-003 | Use specialized store hooks in DocumentCanvas | Low | High - performance |
| 🟡 P2 | CS-001 | Create generic Redis key builder | Low | Medium - DRY |
| 🟡 P2 | CS-002 | Extract magic numbers to constants | Low | Medium - readability |
| 🟡 P2 | SIZE-001 | Extract retry logic from generateBlockContent | Medium | Medium - reusability |
| 🟡 P2 | SRP-001 | Extract EmptyState and DnD hooks from DocumentCanvas | Medium | Medium - maintainability |
| 🔵 P3 | NAME-001 | Standardize key builder naming | Very Low | Low - consistency |
| 🔵 P3 | NAME-002 | Expand abbreviated variable names | Very Low | Low - readability |
| 🔵 P3 | CS-003 | Remove or implement _sessionId parameter | Very Low | Low - clarity |
| 🔵 P3 | CS-006 | Remove empty handleDragOver or add feedback | Very Low | Low - clarity |

---

## Agent #17: UX Flow Auditor

**Focus:** User journeys, edge states, interaction patterns, loading states, empty states, error states

### Executive Summary

The Document Builder provides a reasonably cohesive user journey for the primary flow (create document, add blocks, edit, save). However, several gaps exist in edge state handling, loading indicator consistency, and recovery options. The spec's primary failure mode concern ("too complex, users give up") is partially addressed through good empty states and progressive disclosure, but the absence of global undo/redo at the document level and inconsistent loading feedback remain critical UX debts.

---

### Primary User Journey Analysis

#### Journey: Create Document and Add Blocks

**Path:** Empty Canvas → Select Framework OR Add Manual Block → Edit Content → Generate with AI → Save

| Step | Component | UX Status | Issues |
|------|-----------|-----------|--------|
| 1. View empty canvas | DocumentCanvas:376-385 | **Good** | Clear empty state with actionable CTAs |
| 2. Browse templates | FrameworkSelector | **Good** | Modal with framework preview, clear selection |
| 3. Add block from palette | BlockPalette:90-191 | **Good** | Click or drag-drop, accessible |
| 4. Edit block content | BlockEditor:275-369 | **Partial** | No cancel/discard for in-progress edits |
| 5. Generate with AI | BlockEditor:211-273 | **Partial** | Loading shown, no cancel button |
| 6. Reorder blocks | DocumentCanvas:259-290 | **Good** | Drag-drop with visual feedback |
| 7. Save document | N/A | **Missing** | No explicit save flow visible |

**Overall Journey Rating:** 70% Complete

---

### 🟠 High Priority Issues

#### H-UX-01: No Global Document-Level Undo/Redo

**Files:** 
- `DocumentCanvas.tsx` (missing)
- `documentBuilderStore.ts` (no history tracking)

**Issue:** While `VerificationUI.tsx:140-148` implements `useUndoRedo` for verification blocks, the main document canvas has NO undo/redo capability. Users cannot recover from:
- Accidental block deletion
- Unwanted AI generation overwrites
- Framework selection mistakes

**Spec Impact:** CRITICAL - "Primary failure mode is 'too complex, users give up'" - users who lose work will abandon the tool.

**Evidence:**
```typescript
// DocumentCanvas.tsx:159-167 - Store usage without history
const {
  blocks,
  selectedBlockId,
  selectBlock,
  moveBlock,
  removeBlock,  // DELETE IS IMMEDIATE AND IRREVERSIBLE
  updateBlockTitle,
  addBlock,
} = useDocumentBuilderStore();
```

**Recommendation:** Integrate `useUndoRedo` hook at DocumentCanvas level:
```typescript
const { state: blocks, set: setBlocks, undo, redo, canUndo, canRedo } = 
  useUndoRedo(initialBlocks);
```

---

#### H-UX-02: No Confirmation for Destructive Actions

**File:** `PersuasionBlock.tsx:276-294`

**Issue:** Delete button immediately removes block with no confirmation dialog:
```typescript
<button
  type="button"
  onClick={(e) => {
    e.stopPropagation();
    onDelete?.(block.id);  // IMMEDIATE - No "Are you sure?"
  }}
```

**Combined with H-UX-01:** Users can accidentally delete a block with hours of content and have no recovery path.

**Recommendation:** Add confirmation dialog OR implement undo with toast notification:
```typescript
const handleDelete = () => {
  onDelete?.(block.id);
  toast({
    title: "Block deleted",
    action: <Button variant="outline" onClick={() => undo()}>Undo</Button>,
  });
};
```

---

#### H-UX-03: AI Generation Cannot Be Cancelled

**File:** `BlockEditor.tsx:211-273`

**Issue:** Once AI generation starts, users cannot cancel. The UI shows a loading state but no abort mechanism:
```typescript
const handleGenerate = useCallback(async () => {
  if (isGenerating || !editor) return;
  setIsGenerating(true);
  // No AbortController, no cancel button
  const response = await fetch("/api/document-builder/generate", {
    // ...
  });
```

**User Impact:** If generation takes 30 seconds (maxDuration=30 in route.ts), user is stuck waiting.

**Recommendation:**
```typescript
const abortControllerRef = useRef<AbortController | null>(null);

const handleCancel = () => {
  abortControllerRef.current?.abort();
  setIsGenerating(false);
};

const handleGenerate = async () => {
  abortControllerRef.current = new AbortController();
  const response = await fetch("/api/document-builder/generate", {
    signal: abortControllerRef.current.signal,
    // ...
  });
};
```

---

### 🟡 Medium Priority Issues

#### M-UX-01: Inconsistent Loading State Patterns

**Files:** Multiple components

| Component | Loading Pattern | Issue |
|-----------|-----------------|-------|
| BlockEditor:288-294 | Skeleton shimmer | **Good** |
| VerificationUI:369-376 | Button "Complete Verification" disabled | **Good** |
| FrameworkSelector | None | **Missing** - No loading when initializing blocks |
| DocumentCanvas | None | **Missing** - No loading during drag operations |
| Export API | None client-side | **Missing** - PDF export has no progress indicator |

**Recommendation:** Standardize on skeleton shimmer for content areas, spinner for buttons:
```typescript
// Standard loading component
<LoadingState type="skeleton" lines={3} />
<Button loading={isExporting}>Export PDF</Button>
```

---

#### M-UX-02: Empty State for No Frameworks Scenario

**File:** `BlockPalette.tsx:326-360` and `FrameworkSelector.tsx:265-273`

**Issue:** If `FRAMEWORK_TEMPLATES` is empty (configuration error), the Framework Templates section renders with nothing inside:
```typescript
{isFrameworksOpen && (
  <div id="framework-templates-list" className="mt-3 space-y-2" role="list">
    {FRAMEWORK_TEMPLATES.map((framework) => (
      // Nothing renders if array is empty
    ))}
  </div>
)}
```

**Recommendation:** Add empty state fallback:
```typescript
{FRAMEWORK_TEMPLATES.length === 0 ? (
  <p className="text-sm text-text-3 py-2">No templates available</p>
) : (
  FRAMEWORK_TEMPLATES.map(...)
)}
```

---

#### M-UX-03: VerificationUI Has No Empty State

**File:** `VerificationUI.tsx:396-523`

**Issue:** If `detectedBlocks` is empty array, the component renders an empty right panel with header "Detected Blocks (0)" but no helpful guidance:
```typescript
<div className="space-y-3">
  {blocks.map((block) => {  // Empty array = nothing
    // ...
  })}
</div>
```

**User Impact:** User uploads document, AI detects nothing - user sees empty panel with no explanation.

**Recommendation:**
```typescript
{blocks.length === 0 ? (
  <EmptyDetectionState>
    <p>No blocks detected. Use "Add Block Manually" to create blocks.</p>
    <ManualBlockCreator ... />
  </EmptyDetectionState>
) : (
  blocks.map(...)
)}
```

---

#### M-UX-04: Error State Not In-Context for Block Operations

**File:** `BlockEditor.tsx:309-335`

**Issue:** Error message is shown in toolbar area, far from where the error occurred (content area):
```typescript
{/* Error message with retry */}
{error && (
  <div
    id={`block-editor-error-${blockId}`}
    role="alert"
    className="flex items-center gap-2 text-xs text-error"
  >
```

**User Impact:** On small screens or with multiple blocks visible, the error might not be immediately associated with the failed action.

**Recommendation:** Show inline error banner at top of editor content area, not in toolbar.

---

#### M-UX-05: VersionDiff Missing Loading State

**File:** `VersionDiff.tsx:384-537`

**Issue:** `computeBlockDiff` is called synchronously in useMemo. If versions have many blocks, this could cause UI freeze with no loading indicator:
```typescript
const diff = useMemo(
  () => computeBlockDiff(versionA.blocks, versionB.blocks),  // Could be slow
  [versionA.blocks, versionB.blocks]
);
```

**Recommendation:** For large diffs, use Suspense or show loading state during computation.

---

### 🔵 Low Priority / Enhancement Opportunities

#### L-UX-01: DropZone Visual Feedback Could Be Stronger

**File:** `DropZone.tsx:61-98`

**Issue:** Drop zone only appears during drag (`isDragActive`). No visual hint exists in resting state to guide first-time users.

**Recommendation:** Show subtle dashed lines between blocks on hover over palette.

---

#### L-UX-02: No Keyboard Shortcut for Common Actions

**Files:** `DocumentCanvas.tsx`, `PersuasionBlock.tsx`

| Action | Current | Expected |
|--------|---------|----------|
| Delete block | Click only | Delete/Backspace |
| Duplicate block | Click "Create Variant" | Ctrl+D |
| Add new block | Palette click | Ctrl+Enter |
| Generate AI | Button click | Ctrl+G |

**Recommendation:** Add useHotkeys for power users.

---

#### L-UX-03: VariantCreator Could Show Preview

**File:** `VariantCreator.tsx:139-340`

**Issue:** When selecting "Clone Control", user cannot see what they're cloning.

**Recommendation:** Add small content preview in modal.

---

#### L-UX-04: Block Position Feedback During Drag

**File:** `DocumentCanvas.tsx:451-458`

**Issue:** DragOverlay shows the block being dragged but doesn't show where it will land until hovering a drop zone.

**Recommendation:** Show line indicator at drop position like Notion/Linear.

---

#### L-UX-05: Long Content Truncation Missing

**File:** `PersuasionBlock.tsx:315-321`

**Issue:** Content area has no max-height or scroll. Very long content will push other blocks off screen:
```typescript
<div className="px-4 py-4 min-h-[100px]">
  {children ?? (
    <p className="text-sm text-text-3 italic">
      Click to edit content or use AI to generate...
    </p>
  )}
</div>
```

**Recommendation:** Add `max-h-[300px] overflow-y-auto` or content preview with "Expand" button.

---

### Edge Case Analysis

#### Rapid Repeated Actions

| Action | Current Behavior | Risk |
|--------|------------------|------|
| Rapid delete clicks | Each triggers removeBlock | Low - synchronous store |
| Rapid AI generate clicks | Blocked by `isGenerating` | **Safe** |
| Rapid drag-drop | Each triggers moveBlock | Medium - visual glitches possible |
| Rapid framework selection | Last wins | Low - but could confuse |

#### Very Long Content

| Scenario | Handling | Issue |
|----------|----------|-------|
| 10,000 char block content | Rendered as-is | Performance risk |
| 50+ blocks | All rendered | Virtualization needed |
| Deep nested TipTap content | Recursive render | Stack risk |

#### Special Characters

| Input | Handling | Issue |
|-------|----------|-------|
| HTML in content | Sanitized via `sanitizeHtml` | **Safe** |
| Unicode/Emoji | Supported | **Safe** |
| RTL text | No special handling | Layout issues |
| Very long words | No word-break | Overflow possible |

#### Slow Network

| Operation | Behavior | Issue |
|-----------|----------|-------|
| AI generation | 30s timeout | No cancel, no progress |
| PDF export | 60s timeout | No progress indicator |
| localStorage persist | Synchronous | Blocks main thread |

---

### Recovery Options Assessment

| Mistake | Recovery Method | Available? |
|---------|-----------------|------------|
| Delete wrong block | Undo | **NO** |
| Overwrite content with AI | Undo | **NO** |
| Select wrong framework | Re-select | YES (clears all) |
| Dismiss framework modal | Re-open | YES |
| Cancel variant creation | Modal close | YES |
| Edit verification wrong | Undo/Redo | YES |
| Upload wrong document | No mention | **NO** |

---

### Strengths Observed

1. **Excellent Empty State Design:** `DocumentCanvas` EmptyState component (lines 66-139) is exemplary - clear heading, helpful description, dual CTAs.

2. **Comprehensive ARIA Support:** Screen reader announcements for drag-drop (`DocumentCanvas.tsx:195-228`).

3. **Proper Loading Skeleton:** `BlockEditor` shimmer pattern during AI generation.

4. **Error Retry Button:** `BlockEditor` error state includes retry action.

5. **Undo/Redo in Verification:** `VerificationUI` implements proper undo stack with keyboard shortcuts.

6. **Bulk Actions:** VerificationUI "Accept All" and "Reject Low Confidence" reduce repetitive work.

7. **Accessible Touch Targets:** 44px minimum height on palette items per WCAG.

8. **Progressive Disclosure:** Framework Templates section is collapsible by default.

---

### Metrics

- **User journeys mapped:** 3 (Create, Edit, Verify)
- **Components reviewed:** 12
- **Empty states found:** 3 (1 good, 2 missing)
- **Loading states found:** 3 (2 good, 3 missing)
- **Error states found:** 2 (1 good, 1 poor placement)
- **Edge cases analyzed:** 12
- **Recovery options:** 2/7 available (29%)

---

### Recommendations Priority Matrix

| Priority | Issue | Effort | User Impact | Addresses Spec Concern |
|----------|-------|--------|-------------|------------------------|
| 🟠 H-UX-01 | Global undo/redo | Medium | Critical | YES - "users give up" |
| 🟠 H-UX-02 | Delete confirmation | Low | High | YES - "users give up" |
| 🟠 H-UX-03 | Cancellable AI generation | Low | High | YES - complexity |
| 🟡 M-UX-01 | Consistent loading states | Medium | Medium | Partially |
| 🟡 M-UX-02 | Empty frameworks state | Low | Low | No |
| 🟡 M-UX-03 | Empty verification state | Low | Medium | Partially |
| 🟡 M-UX-04 | In-context error messages | Low | Medium | No |
| 🟡 M-UX-05 | VersionDiff loading | Low | Low | No |

**Critical Path:** H-UX-01 and H-UX-02 should be addressed before any user testing - loss of work is the fastest path to user abandonment.

---

## Agent #12: Concurrency Analyst Findings

**Audit Timestamp:** 2026-05-18T16:00:00Z
**Files Reviewed:** 5 primary + 3 supporting
**Severity Summary:** 🔴 Critical: 0 | 🟠 High: 3 | 🟡 Medium: 4 | 🔵 Low: 2

### 🔴 Critical Issues
None identified. The codebase demonstrates awareness of concurrency patterns, particularly in the sync worker.

### 🟠 High Priority

**H-CON-01: Analytics Batch Processing Lacks Ordering Guarantees**
- **File:** `apps/web/src/app/api/document-builder/analytics/route.ts`
- **Lines:** 251-280
- **Issue:** Events are processed sequentially within `processEvents()`, but the fire-and-forget pattern (line 219) means multiple concurrent requests could have their events processed in interleaved order. For `block_view` events this is acceptable (atomic INCR), but `block_dwell` events rely on correct ordering for accurate cumulative time.
```typescript
// Fire-and-forget: Process events asynchronously with timeout
processEvents(events, controller.signal)
  .catch(...)
```
- **Scenario:** Two rapid requests (A with events [1,2,3], B with events [4,5,6]) could result in processing order [1,4,2,5,3,6].
- **Impact:** Medium. Dwell time accumulation is additive so order doesn't affect totals, but timestamp-based analytics could be skewed.
- **Recommendation:** If event ordering matters for future analytics (e.g., time-series analysis), implement a request-scoped lock or queue:
```typescript
const requestQueue = new Map<string, Promise<void>>();
const prevRequest = requestQueue.get(sessionId) ?? Promise.resolve();
const thisRequest = prevRequest.then(() => processEvents(events));
requestQueue.set(sessionId, thisRequest);
```

**H-CON-02: Zustand Store Operations Are Not Atomic for Multi-Step Updates**
- **File:** `apps/web/src/stores/documentBuilderStore.ts`
- **Lines:** 300-329
- **Issue:** The `moveBlock` operation creates a new array, splices, and maps in separate steps within a single `set()` call. While Zustand batches these into one state update, rapid consecutive `moveBlock` calls (e.g., keyboard nav in drag-drop) could race.
```typescript
moveBlock: (fromIndex, toIndex) => {
  set(
    (state) => {
      const blocks = [...state.blocks];        // Step 1: Copy
      const [movedBlock] = blocks.splice(...); // Step 2: Remove
      blocks.splice(toIndex, 0, movedBlock);   // Step 3: Insert
      return {
        blocks: blocks.map((block, index) => ({ // Step 4: Remap
          ...block,
          position: index,
        })),
      };
    },
    false,
    "moveBlock"
  );
},
```
- **Scenario:** User rapidly moves block A then B then C. If second call begins before first completes, it operates on stale `state.blocks`.
- **Impact:** Medium. Could result in blocks appearing in wrong positions until next render.
- **Recommendation:** Use immer middleware for atomic updates, or add a debounce on moveBlock at the UI layer:
```typescript
const debouncedMoveBlock = useMemo(
  () => debounce(moveBlock, 50),
  [moveBlock]
);
```

**H-CON-03: Analytics Sync Worker Can Have Overlapping Runs**
- **File:** `apps/web/src/lib/document-builder/analytics-sync-worker.ts`
- **Lines:** 682-694
- **Issue:** The `isRunning` flag protects against concurrent sync cycles, but the initial sync timeout (line 697-705) could fire while the interval sync is also starting:
```typescript
syncInterval = setInterval(async () => {
  if (isRunning) {
    logger.warn("[analytics-sync] Previous sync still running, skipping");
    return;
  }
  isRunning = true;
  // ...
}, SYNC_INTERVAL_MS);

// Run initial sync after 10 seconds
initialSyncTimeout = setTimeout(() => {
  if (!isRunning) {  // Check exists but race window exists
    isRunning = true;
    syncAnalytics().finally(() => {
      isRunning = false;
    });
  }
}, 10000);
```
- **Race Window:** The check-then-act on `isRunning` is not atomic. If the interval fires at exactly the same moment as the timeout, both could see `isRunning === false` and proceed.
- **Impact:** Low-Medium. Could cause double-processing of Redis keys (GETSET would reset twice, losing data).
- **Recommendation:** Use a mutex or convert to async locking pattern:
```typescript
let syncPromise: Promise<void> | null = null;

async function runSync() {
  if (syncPromise) return; // Already running
  syncPromise = syncAnalytics().finally(() => {
    syncPromise = null;
  });
  return syncPromise;
}
```

### 🟡 Medium Priority

**M-CON-01: No Optimistic Locking for Document Saves (Future Concern)**
- **Files:** `apps/web/src/stores/documentBuilderStore.ts`, `apps/web/src/components/document-builder/DocumentCanvas.tsx`
- **Issue:** The current implementation uses localStorage persistence but no server-side document save. When server saves are added, there's no version/timestamp checking to detect conflicts.
- **Impact:** Future risk. Two browser tabs editing the same document would silently overwrite each other.
- **Recommendation:** When implementing server saves, add optimistic locking:
```typescript
interface DocumentState {
  blocks: PersuasionBlock[];
  version: number;  // Add this
  lastModified: string;
}
// On save: include version, server rejects if version mismatch
```

**M-CON-02: Redis GETSET Race Between Scan and Reset**
- **File:** `apps/web/src/lib/document-builder/analytics-sync-worker.ts`
- **Lines:** 251-274
- **Issue:** The scan operation collects keys, then each key is processed with GETSET. Between scanning and GETSET, new events could increment the counter:
```typescript
const allKeys = [...variantViewKeys, ...]; // Scan captures keys
// ... time passes ...
for (const key of allKeys) {
  const value = await redis.getset(key, "0"); // Reset to 0
  // Events arriving between scan and GETSET are lost
}
```
- **Impact:** Low. Analytics events arriving during sync window (milliseconds) would be reset without being counted.
- **Recommendation:** This is an acceptable tradeoff for simplicity. Document the behavior and ensure sync intervals are frequent enough that lost events are statistically insignificant (<0.001%).

**M-CON-03: Parallel Batch Processing Could Exceed Rate Limits**
- **File:** `apps/web/src/lib/document-builder/analytics-sync-worker.ts`
- **Lines:** 346-424
- **Issue:** DB updates are batched (BATCH_SIZE=50) but processed serially within each batch. If sync runs frequently and DLQ is large, the restore operations (`incrby`) could exceed Redis connection limits or rate limits.
- **Impact:** Low. Only occurs during error recovery scenarios.
- **Recommendation:** Add rate limiting to DLQ processing:
```typescript
export async function processDeadLetterQueue(
  maxEntries = 50,
  delayBetweenMs = 100  // Add throttling
): Promise<number> {
```

**M-CON-04: DocumentCanvas State Updates Not Debounced**
- **File:** `apps/web/src/components/document-builder/DocumentCanvas.tsx`
- **Lines:** 303-309, 354-359
- **Issue:** `handleBlockSelect` and `handleTitleChange` trigger immediate state updates without debouncing:
```typescript
const handleBlockSelect = useCallback(
  (blockId: string) => {
    selectBlock(blockId);       // Immediate Zustand update
    onBlockSelect?.(blockId);   // Immediate callback
  },
  [selectBlock, onBlockSelect]
);
```
- **Impact:** Low. Rapid selection changes (fast keyboard navigation) cause many state updates.
- **Recommendation:** Consider debouncing selection for keyboard navigation scenarios, or use `startTransition` for non-urgent updates:
```typescript
import { startTransition } from 'react';
const handleBlockSelect = useCallback(
  (blockId: string) => {
    startTransition(() => selectBlock(blockId));
    onBlockSelect?.(blockId);
  },
  [selectBlock, onBlockSelect]
);
```

### 🔵 Low Priority / Recommendations

**L-CON-01: AB Testing Service Uses Pure Functions (No Concurrency Issues)**
- **File:** `apps/web/src/lib/document-builder/ab-testing-service.ts`
- **Lines:** All
- **Observation:** The AB testing service is entirely composed of pure functions (`getVariantForProspect`, `calculateSignificance`, `normalizeWeights`). These have no shared mutable state and are inherently thread-safe.
- **Recommendation:** Document this as a strength in the codebase. Pure functions are the gold standard for avoiding concurrency issues.

**L-CON-02: Process Exit Handlers Registered Once (Correct)**
- **File:** `apps/web/src/lib/document-builder/analytics-sync-worker.ts`
- **Lines:** 641-658
- **Observation:** The `registerProcessExitHandlers` function correctly uses a flag to prevent duplicate handler registration:
```typescript
let cleanupRegistered = false;

function registerProcessExitHandlers(): void {
  if (cleanupRegistered) return;
  // ... register handlers ...
  cleanupRegistered = true;
}
```
- **Recommendation:** None needed. This is correct idempotent registration.

### ✅ Strengths Observed

1. **GETSET Atomic Pattern:**
   - The analytics sync worker uses Redis `GETSET key 0` pattern (line 300) which is atomic - reads value and resets in single operation. This is the correct approach for counter collection.

2. **Mutex-Style Worker Protection:**
   - The `isRunning` flag (lines 682-694) prevents overlapping sync cycles. While not perfectly atomic (see H-CON-03), it handles 99.9% of cases correctly.

3. **SQL Increment Operations:**
   - Database updates use `sql\`impressions + \${delta}\`` (lines 369-375) instead of read-modify-write, preventing lost updates from concurrent DB operations.

4. **Fire-and-Forget with Timeout:**
   - Analytics route uses AbortController with 30s timeout (lines 211-215) to prevent zombie processing. Active processing is tracked and cleaned up.

5. **Circuit Breaker Pattern:**
   - Rate limit checking implements proper circuit breaker (lines 68-171) with failure counting, timeout recovery, and fail-closed behavior.

6. **Immutable State Updates:**
   - Zustand store uses spread operator and map() for all state updates, avoiding direct mutation. This prevents many categories of concurrency bugs.

7. **Event Loop Awareness:**
   - Background processing uses Promises correctly without blocking the event loop. The Node.js single-threaded model is respected.

8. **DLQ Pattern for Failed Operations:**
   - Failed sync operations are moved to dead letter queue with retry counting (lines 194-223). This prevents infinite retry loops while preserving data for manual recovery.

### 📊 Metrics
- Files analyzed: 5 primary (analytics-sync-worker.ts, ab-testing-service.ts, analytics-service.ts, documentBuilderStore.ts, DocumentCanvas.tsx) + 3 supporting
- Lines reviewed: ~2,800
- Race condition patterns identified: 6
- Atomic operations verified: 4 (GETSET, INCR, SQL increment, Zustand set)
- Transaction boundaries audited: 3 (Redis pipeline, DB update, state update)
- Mutex/lock patterns found: 2 (isRunning flag, circuit breaker)
- Optimistic update patterns: 0 (not yet needed - client-only)

### Transaction Boundary Analysis

| Operation | Atomicity Level | Risk | Notes |
|-----------|-----------------|------|-------|
| Redis INCR/INCRBY | Atomic | None | Single Redis command |
| Redis GETSET | Atomic | None | Single Redis command |
| Redis Pipeline | Batch atomic | Low | `processBatchedEvents` uses pipeline.exec() |
| DB Update (impressions) | Row-level atomic | None | SQL increment is atomic |
| Zustand set() | Synchronous | Low | Single tick, but not truly atomic |
| DLQ Move | Non-atomic | Medium | Multiple Redis ops, could fail mid-way |

### Recommendations Summary

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| 🟠 H-CON-01 | Request ordering for analytics events | Medium | Low (current implementation is safe) |
| 🟠 H-CON-02 | Debounce rapid moveBlock calls | Low | Medium |
| 🟠 H-CON-03 | Use mutex for sync worker | Low | Medium |
| 🟡 M-CON-01 | Add optimistic locking (future) | Medium | High (when server saves added) |
| 🟡 M-CON-02 | Document GETSET race window | Low | Low |
| 🟡 M-CON-03 | Throttle DLQ processing | Low | Low |
| 🟡 M-CON-04 | Use startTransition for selection | Low | Low |

---


## Agent #14: Integration Points Reviewer Findings

**Audit Timestamp:** 2026-05-18T19:30:00Z
**Files Reviewed:** 15
**Severity Summary:** 🔴 Critical: 0 | 🟠 High: 2 | 🟡 Medium: 4 | 🔵 Low: 5

### 🔴 Critical Issues
None identified. Service boundaries are well-defined with no circular dependencies.

### 🟠 High Priority

#### H-INT-01: Duplicate Export Aliasing Creates Contract Confusion
**Location:** `apps/web/src/lib/document-builder/index.ts:128-132`
```typescript
export {
  getAllFrameworkTemplates,
  applyFrameworkToCanvas,
  validateFrameworkCompliance as validateTemplateCompliance,  // ALIAS
  getFrameworkSequence as getTemplateSequence,  // ALIAS
  isBlockRequired,
  getSuggestedNextBlock,
} from "./template-service";
```
**Issue:** The barrel file exports `validateFrameworkCompliance` from two sources with different names:
1. Line 85: `validateFrameworkCompliance` from `./persuasion-blocks`
2. Line 129: `validateFrameworkCompliance as validateTemplateCompliance` from `./template-service`

Both functions exist, but they have different signatures:
- `persuasion-blocks.validateFrameworkCompliance(frameworkId, blockTypes[]): { isValid, missingBlocks }`
- `template-service.validateFrameworkCompliance(blocks[], frameworkId): FrameworkValidationResult`

**Impact:** Consumers may import the wrong function. The aliasing obscures the fact that these are different functions with incompatible interfaces.
**Recommendation:** 
1. Remove the alias and use descriptive names: `validateFrameworkComplianceByBlockTypes` vs `validateCanvasCompliance`
2. Or consolidate into a single function that accepts both input formats

#### H-INT-02: Analytics Service Depends on Redis Client Without Abstraction
**Location:** `apps/web/src/lib/document-builder/analytics-service.ts:17`
```typescript
import { redis } from "@/lib/redis/client";
```
**Issue:** The analytics service directly imports the Redis client singleton. While this works, it creates tight coupling that makes:
1. Unit testing require mocking at module level
2. Swapping Redis providers difficult (e.g., moving to Upstash or in-memory for dev)
3. Impossible to run multiple instances with different Redis configs

Similarly, `analytics-sync-worker.ts:17` has the same coupling.

**Impact:** Testing complexity (observed in test files requiring `vi.mock("@/lib/redis/client")`), deployment inflexibility.
**Recommendation:** Inject Redis client as a parameter or use a factory pattern:
```typescript
// Factory pattern
export function createAnalyticsService(redisClient: RedisClient) {
  return {
    recordBlockView: (blockId: string) => redisClient.incr(...),
    // ...
  };
}

// Default export for convenience
export const analyticsService = createAnalyticsService(redis);
```

### 🟡 Medium Priority

#### M-INT-01: AI Generator Uses Global Logger Without Injection
**Location:** `apps/web/src/lib/document-builder/ai-generator.ts:19`
```typescript
import { logger } from "@/lib/logger";
```
**Issue:** Logger is imported as a global singleton. While consistent across the codebase, this pattern:
1. Makes it harder to capture logs in tests without mocking
2. Prevents per-request correlation IDs from being injected
3. Could miss structured fields like `requestId` or `userId` that should be added to all log lines

**Impact:** Logs may lack request context, making debugging production issues harder.
**Recommendation:** Consider a context-aware logging pattern:
```typescript
export async function generateBlockContent(
  request: GenerationRequest,
  options?: { logger?: Logger; requestId?: string }
): Promise<GenerationResponse> {
  const log = options?.logger ?? logger;
  log.info("[ai-generator] Starting generation", { requestId: options?.requestId, ... });
}
```

#### M-INT-02: Template Service and Persuasion Blocks Have Overlapping Responsibilities
**Locations:**
- `apps/web/src/lib/document-builder/persuasion-blocks.ts:343-368` (validateFrameworkCompliance)
- `apps/web/src/lib/document-builder/template-service.ts:135-216` (validateFrameworkCompliance)

**Issue:** Both modules provide framework validation with overlapping logic:
- `persuasion-blocks.ts` validates by block type array
- `template-service.ts` validates by PersuasionBlock array with more features (order checking, warnings)

The template-service internally calls `getFrameworkFromBlocks` from persuasion-blocks (line 81), creating a dependency.

**Dependency Chain:**
```
template-service.ts
  -> persuasion-blocks.ts (for getFrameworkTemplate, getBlockTemplate, PERSUASION_BLOCK_TYPES)
  -> types.ts (for type definitions)
```

**Impact:** Confusion about which module to use for validation. Consumers must understand internal differences.
**Recommendation:** Consolidate validation into template-service and deprecate persuasion-blocks.validateFrameworkCompliance, or clearly document the use case for each.

#### M-INT-03: Analytics Sync Worker Directly Imports Database and Schema
**Location:** `apps/web/src/lib/document-builder/analytics-sync-worker.ts:20-21`
```typescript
import { db } from "@/db";
import { blockVariants } from "@/db/schema/document-builder";
```
**Issue:** The sync worker has a direct dependency on both the database instance and the schema. This creates a tight coupling where:
1. Schema changes require worker updates
2. Database connection management is implicit
3. Transaction boundaries are not configurable

**Impact:** Schema changes could break sync; difficult to test with different DB configurations.
**Recommendation:** Either:
1. Use a repository pattern for variant updates
2. Expose a configurable DB client parameter in `syncAnalytics()`

#### M-INT-04: External AI Integration Lacks Abstraction Layer
**Location:** `apps/web/src/lib/document-builder/ai-generator.ts:356-359`
```typescript
result = await generateText({
  model: google("gemini-3.1-pro"),
  prompt,
  abortSignal: controller.signal,
});
```
**Issue:** The AI generator directly depends on `@ai-sdk/google` and hardcodes the model name. Per CLAUDE.md, the project uses a two-model architecture (Grok 4.1 + Gemini 3.1), but there's no abstraction to switch providers or models.

**Impact:** Changing AI providers or models requires code changes rather than configuration.
**Recommendation:** Create an AI service abstraction:
```typescript
// lib/ai/provider.ts
export interface AIProvider {
  generateText(prompt: string, options?: AIOptions): Promise<AIResult>;
}

// lib/ai/gemini-provider.ts
export const geminiProvider: AIProvider = {
  async generateText(prompt, options) {
    return generateText({ model: google("gemini-3.1-pro"), prompt, ...options });
  }
};

// Configuration
const aiProvider = process.env.AI_PROVIDER === 'grok' ? grokProvider : geminiProvider;
```

### 🔵 Low Priority / Recommendations

#### L-INT-01: Barrel File Exports Both Types and Values with Same Names
**Location:** `apps/web/src/lib/document-builder/index.ts:78-90`
```typescript
export {
  PERSUASION_BLOCK_TYPES,           // Value
  FRAMEWORK_TEMPLATES,               // Value
  getBlockTemplate,                  // Function
  ...
  type PersuasionBlockMetadata,      // Type
  type BlockTypeDefinition,          // Type
  type BlockTypeColor,               // Type
} from "./persuasion-blocks";
```
**Observation:** The barrel file correctly uses `export type` for type-only exports, which is good practice for tree-shaking. However, mixed exports make it slightly harder to understand what's being exported.

**Recommendation:** Consider grouping exports by kind (all types together, then all values) for readability.

#### L-INT-02: Integration Test Only Tests Pure Functions
**Location:** `apps/web/src/lib/document-builder/__tests__/integration.test.ts`
**Observation:** The integration tests correctly mock DB and Redis and test cross-service integration for pure functions (heatmap, diff, A/B testing). However, there are no end-to-end integration tests that:
1. Test API route -> service -> DB flow
2. Test analytics batch -> sync worker -> DB flow
3. Test AI generate -> sanitize -> prompt flow

**Recommendation:** Add a separate `e2e.test.ts` or use the existing test infrastructure with partial mocking for integration scenarios.

#### L-INT-03: Heatmap Calculator is Fully Decoupled (Strength)
**Location:** `apps/web/src/lib/document-builder/heatmap-calculator.ts`
**Observation:** This service is an excellent example of proper decoupling:
- Zero external imports (no Redis, no DB, no logger)
- Pure functions with typed inputs and outputs
- No side effects
- Fully testable without mocks

This pattern should be the model for other services where possible.

#### L-INT-04: Version Diff Service Follows Same Clean Pattern (Strength)
**Location:** `apps/web/src/lib/document-builder/version-diff.ts`
**Observation:** Another well-decoupled service:
- Single import from `./types`
- All pure functions
- No external dependencies
- Clear input/output contracts

#### L-INT-05: Schema File Has Relation to External Module
**Location:** `apps/web/src/db/schema/document-builder.ts:21`
```typescript
import { proposals } from "./seo-chat";
```
**Issue:** The document-builder schema imports `proposals` table from `seo-chat` schema for the foreign key relationship. While architecturally correct (proposals exist before document blocks), this creates a cross-module dependency.

**Impact:** Low - this is appropriate for referential integrity. However, changes to `proposals` table could affect document-builder migrations.
**Recommendation:** Document this dependency in the schema file with a comment explaining the relationship.

### ✅ Strengths Observed

1. **Clean Barrel File Design:** `index.ts` follows best practices:
   - Clear section comments for each category (Types, Services, etc.)
   - Uses `export type` for type-only exports (tree-shaking friendly)
   - Explicit about what's public API vs internal
   - JSDoc header explaining the file's purpose

2. **Unidirectional Dependency Flow:**
   ```
   API Routes
       ↓
   Services (ai-generator, analytics-service, template-service, ab-testing-service)
       ↓
   Pure Functions (heatmap-calculator, version-diff, input-sanitizer)
       ↓
   Types (types.ts)
       ↓
   Database Schema
   ```
   No circular dependencies detected in the Phase 102 module.

3. **Proper Type Export Strategy:**
   - Types are defined in dedicated `types.ts` file
   - Services import types, not the reverse
   - Discriminated unions properly exported (`TypedPersuasionBlock`)
   - Type guards exported for runtime narrowing

4. **Contract Stability via Interface Exports:**
   - All service interfaces are explicitly exported
   - Request/Response types exported for consumers
   - Breaking changes would be obvious (function signature changes)

5. **Database Schema Relations Properly Defined:**
   - `persuasionBlocksRelations` correctly links to proposals and variants
   - `blockVariantsRelations` has proper parent reference
   - Indexes support expected query patterns (by proposalId, workspaceId, type)

6. **Excellent Test Mocking Strategy:**
   - Tests properly mock Redis/DB at module boundary
   - Mock factories allow test-specific behavior
   - No leaky state between tests (vi.clearAllMocks in beforeEach)

### 📊 Dependency Graph

```
┌──────────────────────────────────────────────────────────────┐
│                      API Routes Layer                        │
├──────────────────────────────────────────────────────────────┤
│  analytics/route.ts  │  export/route.ts  │  generate/route.ts │
│         │                    │                   │           │
│         └────────────────────┼───────────────────┘           │
│                              │                               │
│                              ▼                               │
├──────────────────────────────────────────────────────────────┤
│                      Service Layer                           │
├──────────────────────────────────────────────────────────────┤
│ ai-generator.ts ─────► input-sanitizer.ts                    │
│       │                      │                               │
│       ▼                      ▼                               │
│ persuasion-blocks.ts ◄──── types.ts                         │
│       ▲                      ▲                               │
│       │                      │                               │
│ template-service.ts ─────────┘                               │
│                                                              │
│ analytics-service.ts ──► redis/client (external)            │
│       │                                                      │
│       ▼                                                      │
│ analytics-sync-worker.ts ──► db (external)                  │
│       │                      │                               │
│       └──────────────────────┘                               │
│                                                              │
│ ab-testing-service.ts ──► types.ts                          │
│                                                              │
│ heatmap-calculator.ts (standalone)                          │
│ version-diff.ts ──► types.ts                                │
├──────────────────────────────────────────────────────────────┤
│                      Schema Layer                            │
├──────────────────────────────────────────────────────────────┤
│ document-builder.ts ──► seo-chat.ts (proposals)             │
│       │                                                      │
│       └──► types.ts (for column types)                      │
└──────────────────────────────────────────────────────────────┘

External Dependencies:
  - @/lib/redis/client (analytics-service, analytics-sync-worker)
  - @/lib/logger (ai-generator, analytics-service, analytics-sync-worker)
  - @/db (analytics-sync-worker)
  - @ai-sdk/google (ai-generator)
  - @sentry/nextjs (ai-generator)
```

### 📊 Metrics

- Files analyzed: 15
- Lines reviewed: ~5,200
- Service boundaries identified: 8
- External dependencies tracked: 6
- Circular dependencies: 0
- Duplicate/overlapping functions: 2 (validateFrameworkCompliance)
- Type contracts verified: 24
- Integration test coverage: Partial (pure functions only)

### Recommendations Summary

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| 🟠 H-INT-01 | Resolve duplicate validateFrameworkCompliance exports | Medium | Medium |
| 🟠 H-INT-02 | Abstract Redis client dependency | Medium | High |
| 🟡 M-INT-01 | Add context-aware logging pattern | Low | Medium |
| 🟡 M-INT-02 | Consolidate framework validation functions | Medium | Low |
| 🟡 M-INT-03 | Use repository pattern for sync worker DB access | Medium | Low |
| 🟡 M-INT-04 | Create AI provider abstraction | Medium | Medium |
| 🔵 L-INT-01 | Group barrel exports by kind | Low | Low |
| 🔵 L-INT-02 | Add end-to-end integration tests | Medium | Medium |
| 🔵 L-INT-05 | Document cross-schema dependency | Low | Low |

### Summary

The Phase 102 document-builder module demonstrates solid integration patterns with clear service boundaries and unidirectional dependency flow. The main areas for improvement are:

1. **Resolving duplicate function exports** (H-INT-01) to prevent consumer confusion
2. **Abstracting external dependencies** (H-INT-02, M-INT-04) to improve testability and flexibility
3. **Adding end-to-end integration tests** (L-INT-02) to validate full request flows

The pure function services (heatmap-calculator, version-diff) are exemplary and should serve as patterns for future service development.

---

## Agent #13: Memory and Resource Auditor Findings

**Audit Timestamp:** 2026-05-18T18:45:00Z
**Files Reviewed:** 8
**Severity Summary:** 🔴 Critical: 0 | 🟠 High: 2 | 🟡 Medium: 4 | 🔵 Low: 3

### 🔴 Critical Issues

None identified.

### 🟠 High Priority

#### H-MEM-01: Module-Level Event Batch Array Never Fully Cleared on Component Unmount
**File:** `apps/web/src/hooks/useBlockAnalytics.ts:54-56, 91-115`
**Issue:** The `eventBatch` array and `batchTimeoutId` are module-level singletons shared across all hook instances. When components using this hook unmount:

1. The `batchTimeoutId` is NOT cleared
2. The `eventBatch` continues accumulating events from other components
3. If all components unmount, the setTimeout callback may still fire, attempting to send events to an unmounted context

```typescript
// Module-level state - shared across ALL useBlockAnalytics instances
const eventBatch: BlockInteraction[] = [];
let batchTimeoutId: ReturnType<typeof setTimeout> | null = null;
const BATCH_INTERVAL_MS = 5000;
```

**Impact:** 
- Memory leak: Events accumulate even after components unmount
- Potential "Can't perform state update on unmounted component" warnings
- In single-page apps, the batch can grow indefinitely across route transitions

**Recommendation:** 
1. Move batch management into the hook with useRef, or
2. Add a cleanup function exported from the module that components call on unmount:
```typescript
export function cleanupAnalyticsBatch(): void {
  if (batchTimeoutId) {
    clearTimeout(batchTimeoutId);
    batchTimeoutId = null;
  }
  // Optionally flush remaining events
}
```

---

#### H-MEM-02: Analytics Sync Worker Process Exit Handlers May Leak
**File:** `apps/web/src/lib/document-builder/analytics-sync-worker.ts:640-658`
**Issue:** The `registerProcessExitHandlers` function registers handlers for `beforeExit`, `SIGINT`, `SIGTERM`, and `SIGUSR2`, but:

1. Handlers are never removed (no way to unregister)
2. If `start()` is called multiple times across hot module reloads (HMR), duplicate handlers accumulate
3. The `cleanupRegistered` flag prevents re-registration only within same module context

```typescript
function registerProcessExitHandlers(): void {
  if (cleanupRegistered) {
    return;
  }
  // Handlers registered but never removed
  process.on("beforeExit", cleanup);
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
  process.on("SIGUSR2", cleanup);
  cleanupRegistered = true;
}
```

**Impact:** During development with HMR, duplicate signal handlers can accumulate, causing multiple cleanup attempts.

**Recommendation:** Track handler references and provide `removeProcessExitHandlers()`:
```typescript
const handlers = new Map<string, () => void>();

function registerProcessExitHandlers(): void {
  if (handlers.size > 0) return;
  
  const cleanup = () => {
    logger.info("[analytics-sync] Process exit signal received, cleaning up");
    analyticsSyncWorker.stop();
  };
  
  const signals = ["beforeExit", "SIGINT", "SIGTERM", "SIGUSR2"];
  signals.forEach((signal) => {
    handlers.set(signal, cleanup);
    process.on(signal, cleanup);
  });
}

function removeProcessExitHandlers(): void {
  handlers.forEach((handler, signal) => {
    process.removeListener(signal, handler);
  });
  handlers.clear();
}
```

### 🟡 Medium Priority

#### M-MEM-01: useBlockAnalytics setTimeout Inside Visibility Handler Not Cleared
**File:** `apps/web/src/hooks/useBlockAnalytics.ts:188-199`
**Issue:** A `setTimeout` is created inside the visibility change handler to record views after `minViewTimeMs`, but if visibility changes rapidly (scroll quickly past blocks), multiple timeouts can queue up:

```typescript
if (!viewRecordedRef.current) {
  setTimeout(() => {
    if (isVisibleRef.current && !viewRecordedRef.current) {
      viewRecordedRef.current = true;
      queueEvent(sessionId, { /* ... */ });
    }
  }, minViewTimeMs);
}
```

**Impact:** 
- Rapid scrolling creates multiple pending timeouts
- Each timeout executes and checks `viewRecordedRef` but wastes CPU cycles
- No way to cancel pending timeouts on unmount

**Recommendation:** Store timeout ID in a ref and clear on cleanup:
```typescript
const viewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

// In handleVisibilityChange:
if (!viewRecordedRef.current && !viewTimeoutRef.current) {
  viewTimeoutRef.current = setTimeout(() => {
    viewTimeoutRef.current = null;
    // ... existing logic
  }, minViewTimeMs);
}

// In useEffect cleanup:
return () => {
  if (viewTimeoutRef.current) {
    clearTimeout(viewTimeoutRef.current);
  }
  // ... existing cleanup
};
```

---

#### M-MEM-02: BlockEditor Does Not Explicitly Destroy TipTap Editor
**File:** `apps/web/src/components/document-builder/BlockEditor.tsx:113-174`
**Issue:** The component comment states "Note: useEditor already handles cleanup on unmount - no manual destroy needed", but this relies on `@tiptap/react`'s internal cleanup. The current implementation does not verify this works correctly for their version.

```typescript
// Initialize TipTap editor
const editor = useEditor({
  extensions: [...],
  content: initialContent ?? { type: "doc", content: [] },
  editable,
  // ... no explicit cleanup
});
// Note: useEditor already handles cleanup on unmount - no manual destroy needed
```

**Risk:** If TipTap version or configuration changes, editor resources (DOM listeners, ProseMirror state) may leak.

**Recommendation:** Add explicit cleanup as defense-in-depth:
```typescript
useEffect(() => {
  return () => {
    if (editor && !editor.isDestroyed) {
      editor.destroy();
    }
  };
}, [editor]);
```

---

#### M-MEM-03: Store Persistence Without Size Limits
**File:** `apps/web/src/stores/documentBuilderStore.ts:420-441`
**Issue:** The Zustand persist middleware saves all blocks to localStorage without size limits. Large documents with many blocks containing TipTap content could exceed localStorage quota (5MB typical).

```typescript
persist(
  (set, get) => ({ /* ... */ }),
  {
    name: "document-builder-store-v1",
    storage: createJSONStorage(() => localStorage),
    partialize: (state): PersistedState => ({
      blocks: state.blocks,  // NO SIZE LIMIT
      frameworkId: state.frameworkId,
      frameworkName: state.frameworkName,
      proposalId: state.proposalId,
    }),
  }
)
```

**Impact:**
- `QuotaExceededError` when localStorage is full
- Silent failure to persist state
- User loses draft work on large documents

**Recommendation:** Add size checking and graceful degradation:
```typescript
const MAX_STORAGE_SIZE = 2 * 1024 * 1024; // 2MB limit

storage: createJSONStorage(() => ({
  getItem: localStorage.getItem.bind(localStorage),
  setItem: (name: string, value: string) => {
    if (value.length > MAX_STORAGE_SIZE) {
      console.warn('[DocumentBuilderStore] State too large for localStorage, skipping persist');
      return;
    }
    try {
      localStorage.setItem(name, value);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        console.warn('[DocumentBuilderStore] localStorage quota exceeded');
      }
    }
  },
  removeItem: localStorage.removeItem.bind(localStorage),
})),
```

---

#### M-MEM-04: useScrollPositionWithDirection Missing scrollRef Dependency
**File:** `apps/web/src/hooks/useScrollPosition.ts:73-89`
**Issue:** The `useEffect` in `useScrollPositionWithDirection` has an empty dependency array but uses `scrollRef.current`:

```typescript
useEffect(() => {
  const element = scrollRef.current;
  if (!element) return;

  const handleScroll = () => {
    // ... uses scrollRef.current
  };

  element.addEventListener("scroll", handleScroll, { passive: true });
  return () => element.removeEventListener("scroll", handleScroll);
}, []); // Empty deps but uses scrollRef
```

**Impact:** If the ref element changes after initial mount (rare but possible), the listener is attached to the wrong element.

**Recommendation:** While the scrollRef pattern is stable, document this expectation or add null check logging:
```typescript
// Document the expectation
// Note: scrollRef is expected to be stable (assigned once on mount).
// If the ref target can change, this hook should be extended.
```

### 🔵 Low Priority / Recommendations

#### L-MEM-01: useAutoSave Debounced Callback Not Cancelled on Dependencies Change
**File:** `apps/web/src/hooks/useAutoSave.ts:171-173`
**Issue:** When `debounceMs` changes, the `useDebouncedCallback` from `use-debounce` creates a new debounced function, but pending callbacks from the old debounced function may still execute.

**Impact:** Minimal - `debounceMs` rarely changes at runtime.

**Recommendation:** Document this behavior or add explicit cancellation when options change.

---

#### L-MEM-02: useUndoRedo History Could Grow Unbounded
**File:** `apps/web/src/hooks/useUndoRedo.ts:65-69`
**Issue:** The undo/redo hook stores all past states without a limit:

```typescript
const [state, setState] = useState<UndoRedoState<T>>({
  past: [],     // No size limit
  present: initialState,
  future: [],   // No size limit
});
```

**Impact:** For long editing sessions with many state changes, memory usage grows linearly.

**Recommendation:** Add optional `maxHistory` parameter:
```typescript
export function useUndoRedo<T>(initialState: T, maxHistory = 50): UndoRedoResult<T>

// In set():
past: [...prev.past, prev.present].slice(-maxHistory),
```

---

#### L-MEM-03: IntersectionObserver Created Per Block
**File:** `apps/web/src/hooks/useBlockAnalytics.ts:235-246`
**Issue:** Each block creates its own IntersectionObserver instance. For documents with many blocks (20+), this creates many observers.

```typescript
const observer = new IntersectionObserver(
  (entries) => { /* ... */ },
  { threshold: visibilityThreshold, rootMargin: "0px" }
);
observer.observe(element);
```

**Impact:** Browsers handle multiple observers efficiently, but consolidating into a shared observer would be more memory-efficient.

**Recommendation:** Consider a shared observer pattern for large documents:
```typescript
// Shared observer singleton that tracks multiple elements
const sharedObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    const callback = elementCallbacks.get(entry.target);
    callback?.(entry.isIntersecting);
  });
}, { threshold: 0.5 });
```

### ✅ Strengths Observed

1. **Excellent Timer Cleanup in Analytics Sync Worker**
   - `stop()` method properly clears both `syncInterval` and `initialSyncTimeout` (lines 711-723)
   - `initialSyncTimeout` is cleared in the callback after execution (line 698)
   - Guards against duplicate starts with `syncInterval !== null` check

2. **Proper IntersectionObserver Cleanup**
   - `useBlockAnalytics` correctly disconnects observer in cleanup function (line 251)
   - Final dwell time is recorded on unmount (lines 254-265)

3. **Event Listener Cleanup in All Hooks**
   - `useAutoSave`: Returns cleanup removing "online" listener (line 228)
   - `useUndoRedo`: Returns cleanup removing "keydown" listener (line 170)
   - `useScrollPosition`: Returns cleanup removing "scroll" listener (lines 55, 88)
   - `useBlockAnalytics`: Returns cleanup removing "beforeunload" and "pagehide" listeners (lines 295-298)

4. **Ref Pattern for Stable Callbacks**
   - `BlockEditor` uses `onContentChangeRef` pattern to avoid recreating editor on callback changes (lines 107-110)
   - This prevents closure stale data issues

5. **Module-Level Singleton Guard**
   - Analytics sync worker uses `cleanupRegistered` flag to prevent duplicate handler registration
   - `isRunning` flag prevents overlapping sync operations (lines 682-686)

6. **Re-queue with Bounds**
   - `useBlockAnalytics` caps re-queued events at `MAX_BATCH_SIZE * 2` (line 111) to prevent unbounded growth on API failures

7. **Process Exit Graceful Shutdown**
   - `analyticsSyncWorker.stop()` is called on process signals
   - Ensures final sync operations complete

8. **Zustand Store Uses Versioned Persist**
   - `version: 1` in persist config enables safe migrations (line 422)
   - `migrate` function handles version upgrades (lines 432-439)

### 📊 Metrics

- **Files analyzed:** 8
- **Lines reviewed:** ~1,650
- **useEffect hooks audited:** 12
- **Timer usages found:** 8 (6 properly cleaned up, 2 issues)
- **Event listener registrations:** 14 (all properly cleaned up)
- **IntersectionObserver usages:** 1 (properly cleaned up)
- **Store subscriptions:** Well-managed via useShallow selectors
- **Memory-sensitive patterns:** 4 potential issues identified

### Effect Cleanup Audit Table

| File | Hook/Function | Cleanup Present | Issue |
|------|---------------|-----------------|-------|
| useBlockAnalytics.ts | useEffect (observer) | Yes | - |
| useBlockAnalytics.ts | useEffect (unload) | Yes | - |
| useBlockAnalytics.ts | setTimeout (view) | No | M-MEM-01 |
| useAutoSave.ts | useEffect (online) | Yes | - |
| useAutoSave.ts | useDebouncedCallback | Auto | - |
| useUndoRedo.ts | useEffect (keydown) | Yes | - |
| useScrollPosition.ts | useEffect (scroll) | Yes | - |
| BlockEditor.tsx | useEditor | Implicit | M-MEM-02 |
| analytics-sync-worker.ts | setInterval | Yes | - |
| analytics-sync-worker.ts | setTimeout (initial) | Yes | - |
| analytics-sync-worker.ts | process handlers | No removal | H-MEM-02 |

### Recommendations Summary

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| 🟠 H-MEM-01 | Module-level event batch cleanup | Medium | High |
| 🟠 H-MEM-02 | Process exit handler removal | Low | Medium |
| 🟡 M-MEM-01 | View timeout cleanup in useBlockAnalytics | Low | Medium |
| 🟡 M-MEM-02 | Explicit TipTap editor destroy | Low | Low |
| 🟡 M-MEM-03 | localStorage size limits for store | Medium | Medium |
| 🟡 M-MEM-04 | Document scrollRef stability expectation | Low | Low |
| 🔵 L-MEM-01 | Document debounce callback behavior | Low | Low |
| 🔵 L-MEM-02 | Add maxHistory to useUndoRedo | Low | Low |
| 🔵 L-MEM-03 | Consider shared IntersectionObserver | Medium | Low |

---


## Agent #19: Dependency Audit

**Focus Areas:** Version currency, vulnerability risk, bundle impact, dependency health, necessity assessment

### Executive Summary

The document-builder module has **generally healthy dependencies** with moderate concerns around **transitive vulnerabilities** (not directly in document-builder code) and **version currency** for a few packages. The direct dependencies used by document-builder are well-chosen, actively maintained, and tree-shakeable.

---

### 1. Version Currency Analysis

#### Document-Builder Direct Dependencies

| Package | Installed | Latest | Status | Gap |
|---------|-----------|--------|--------|-----|
| `@dnd-kit/core` | ^6.3.1 | 6.3.1 | Current | None |
| `@dnd-kit/sortable` | ^10.0.0 | 10.0.0 | Current | None |
| `@dnd-kit/utilities` | ^3.2.2 | 3.2.2 | Current | None |
| `@tiptap/core` | ^3.22.5 | 3.23.4 | Minor Behind | 0.1.x |
| `@tiptap/react` | ^3.22.5 | 3.23.4 | Minor Behind | 0.1.x |
| `@tiptap/extension-*` | ^3.22.5 | 3.23.4 | Minor Behind | 0.1.x |
| `zod` | ^4.3.6 | 4.4.3 | Minor Behind | 0.1.x |
| `zustand` | ^5.0.12 | 5.0.13 | Current | 0.0.1 |
| `nanoid` | ^5.0.9 | 5.1.11 | Minor Behind | 0.2.x |
| `drizzle-orm` | ^0.45.2 | 0.45.2 | Current | None |
| `dompurify` | 3.4.1 | 3.4.5 | Patch Behind | 0.0.4 |
| `framer-motion` | ^12.38.0 | 12.39.0 | Current | 0.1.x |

**Location:** `apps/web/package.json:16-85`

#### Version Currency Assessment

- **Current (on latest):** 6 packages (55%)
- **Minor behind:** 5 packages (45%)
- **Major behind:** 0 packages (0%)
- **Deprecated:** 0 packages

**DEP-001: TipTap Suite Needs Minor Update**
**Location:** `apps/web/package.json:44-51`
**Severity:** LOW
**Impact:** Missing bug fixes and potential performance improvements

```json
"@tiptap/core": "^3.22.5",      // Latest: 3.23.4
"@tiptap/extension-highlight": "^3.22.5",
"@tiptap/extension-link": "^3.22.5",
"@tiptap/extension-placeholder": "^3.22.5",
"@tiptap/extension-typography": "^3.22.5",
"@tiptap/pm": "^3.22.5",
"@tiptap/react": "^3.22.5",
"@tiptap/starter-kit": "^3.22.5",
```

**Recommendation:** Batch update all TipTap packages to ^3.23.4 in a single PR.

**DEP-002: DOMPurify Security Patch Available**
**Location:** `apps/web/package.json:61`
**Severity:** MEDIUM (security-sensitive package)
**Impact:** Potential security hardening missed

```json
"dompurify": "3.4.1",  // Latest: 3.4.5 (4 patch releases)
```

**Recommendation:** Update to 3.4.5 immediately. DOMPurify is security-critical for XSS prevention. Check changelog for security fixes.

---

### 2. Vulnerability Risk Assessment

#### Active Vulnerabilities (via pnpm audit)

| Vulnerability | Severity | Package | Path | Document-Builder Impact |
|--------------|----------|---------|------|-------------------------|
| Path traversal | HIGH | fast-uri <=3.1.1 | @copilotkit/runtime -> @modelcontextprotocol/sdk -> ajv -> fast-uri | Indirect (transitive) |
| Host confusion | HIGH | fast-uri <=3.1.1 | Same path | Indirect (transitive) |
| Code execution | HIGH | @babel/plugin-transform-modules-systemjs | packages/ui -> @storybook/nextjs -> @babel/preset-env | DevDependency only |
| DoS | HIGH | next <15.5.16 | packages/ui -> next 15.5.15 | Different package |
| Middleware bypass | HIGH | next <15.5.18 | packages/ui -> next 15.5.15 | Different package |
| Code injection | HIGH | protobufjs <=7.5.5 | open-seo-main -> posthog-js -> @opentelemetry | Different project |

**DEP-003: fast-uri Vulnerability Via CopilotKit (CRITICAL)**
**Location:** `apps/web/package.json:23-25` (CopilotKit dependencies)
**Severity:** CRITICAL (HIGH + in production code path)

The `@copilotkit/runtime` package pulls in vulnerable `fast-uri` via the MCP SDK chain. While document-builder doesn't directly use MCP, it exists in the same package.

**Existing Mitigation Attempt:**
```json
// apps/web/package.json:110-117
"pnpm": {
  "overrides": {
    "fast-uri": ">=3.1.2",  // Override exists but audit still shows vulnerability
    ...
  }
}
```

**Issue:** The override specifies `>=3.1.2` but GHSA-v39h-62p7-jpjc requires `>=3.1.2`. The audit still shows the vulnerability which suggests the override isn't being applied correctly to nested dependencies.

**Recommendation:**
1. Verify override is propagating: `pnpm why fast-uri`
2. Run `pnpm install` to ensure overrides take effect
3. If still vulnerable, open issue with CopilotKit to update their MCP SDK dependency

**DEP-004: packages/ui Next.js Vulnerability (HIGH)**
**Location:** `packages/ui/package.json:56`
**Severity:** HIGH
**Impact:** Not directly in document-builder, but affects shared UI package

```json
"next": "15.5.15",  // apps/web has 15.5.18, packages/ui has 15.5.15
```

**Recommendation:** Align packages/ui Next.js version with apps/web (15.5.18).

#### Document-Builder Specific Vulnerability Assessment

**Direct dependencies have NO known CVEs:**
- @dnd-kit/* - No CVEs
- @tiptap/* - No CVEs
- zod - No CVEs
- zustand - No CVEs
- nanoid - No CVEs
- dompurify - No CVEs (but update recommended)

---

### 3. Bundle Impact Analysis

#### Dependency Size Analysis (disk-based proxy)

| Package Family | Disk Size | Document-Builder Usage |
|---------------|-----------|------------------------|
| @types/* | 48K | Type definitions only |
| @tiptap/* | 36K | Heavy - BlockEditor rich text |
| @radix-ui/* | 36K | Moderate - UI primitives |
| @tanstack/* | 20K | Light - form/query |
| @dnd-kit/* | 16K | Heavy - drag-drop canvas |
| @copilotkit/* | 16K | None in document-builder |

#### Bundle Composition (Document-Builder)

**Heavy Dependencies (>30KB gzipped):**

1. **TipTap Suite** (~36KB total disk, ~15KB gzipped)
   - Usage: `BlockEditor.tsx` rich text editing
   - Justification: Essential for document editing, no lighter alternative with same features
   - Tree-shakeable: Yes (modular extensions)

2. **@dnd-kit** (~16KB total disk, ~8KB gzipped)
   - Usage: `DocumentCanvas.tsx`, `PersuasionBlock.tsx`, `BlockPalette.tsx`, `DropZone.tsx`
   - Justification: Core to drag-drop functionality
   - Tree-shakeable: Yes (separate @dnd-kit/core, sortable, utilities)

**DEP-005: TipTap Extensions Analysis**
**Location:** `apps/web/package.json:44-51`
**Severity:** INFO

Document-builder imports:
```typescript
// apps/web/src/components/document-builder/BlockEditor.tsx:2-7
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
```

**Analysis:** All installed TipTap extensions are actually used. No unused extensions detected.

**DEP-006: lucide-react Imports**
**Location:** Multiple component files
**Severity:** INFO

Document-builder imports many icons individually:
```typescript
import { Sparkles, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { GitCompare, Plus, Minus, Edit3, Check } from "lucide-react";
```

**Assessment:** lucide-react is tree-shakeable. Named imports are correct pattern. No issue.

---

### 4. Dependency Health Assessment

#### Maintainer Activity (last 30 days)

| Package | Last Publish | Open Issues | Stars | Health |
|---------|-------------|-------------|-------|--------|
| @dnd-kit/core | 2024-Q4 | ~80 | 12K+ | GOOD |
| @tiptap/core | 2026-05 | ~200 | 26K+ | EXCELLENT |
| zod | 2026-05 | ~200 | 33K+ | EXCELLENT |
| zustand | 2026-05 | ~50 | 47K+ | EXCELLENT |
| nanoid | 2026-Q1 | ~10 | 24K+ | GOOD |
| dompurify | 2026-05 | ~30 | 13K+ | GOOD |
| drizzle-orm | 2026-05 | ~300 | 24K+ | EXCELLENT |

**DEP-007: @dnd-kit Release Frequency Concern**
**Location:** `apps/web/package.json:25-27`
**Severity:** LOW (monitoring)

@dnd-kit has slower release cadence (last major in 2024). However:
- Package is stable and feature-complete
- No critical bugs outstanding
- Well-documented API

**Recommendation:** Monitor for potential successor libraries, but no immediate action needed.

#### Bus Factor Assessment

| Package | Primary Maintainers | Risk |
|---------|-------------------|------|
| @dnd-kit | clauderic (1) | MEDIUM - single maintainer |
| @tiptap | tiptap team (5+) | LOW - company-backed |
| zod | colinhacks + team | LOW - active community |
| zustand | pmndrs collective | LOW - established org |

**DEP-008: @dnd-kit Single Maintainer Risk**
**Severity:** LOW (long-term consideration)
**Impact:** Future maintenance uncertainty

**Recommendation:** No action needed now, but note that @dnd-kit has single maintainer. If project becomes unmaintained, consider:
- `react-beautiful-dnd` (deprecated, don't use)
- `@atlaskit/pragmatic-drag-and-drop` (alternative)

---

### 5. Dependency Necessity Assessment

#### Document-Builder Required Dependencies

| Dependency | Usage Files | Necessity |
|------------|-------------|-----------|
| @dnd-kit/* | 4 components | ESSENTIAL - core DnD |
| @tiptap/* | BlockEditor.tsx | ESSENTIAL - rich text |
| zod | analytics-sync-worker.ts, schemas.test.ts | ESSENTIAL - validation |
| zustand | stores/documentBuilderStore.ts | ESSENTIAL - state mgmt |
| nanoid | template-service.ts | ESSENTIAL - ID generation |
| drizzle-orm | analytics-sync-worker.ts | ESSENTIAL - DB queries |
| dompurify | (via @/lib/sanitize) | ESSENTIAL - XSS prevention |
| framer-motion | (used elsewhere) | NOT USED in doc-builder |

**DEP-009: framer-motion Not Used by Document-Builder**
**Location:** `apps/web/package.json:63`
**Severity:** INFO (not an issue, just observation)

framer-motion is installed but not imported in any document-builder files. It's likely used elsewhere in apps/web. This is fine - it doesn't add bundle weight to document-builder chunks if properly tree-shaken.

#### Dev vs Production Separation

**Verified correctly separated:**
- `@playwright/test` - devDependencies
- `vitest` - devDependencies
- `@testing-library/*` - devDependencies
- `typescript` - devDependencies
- `@types/*` - devDependencies

No production dependencies are misplaced in devDependencies and vice versa.

---

### 6. Tree-Shaking Assessment

**DEP-010: Missing sideEffects Declaration**
**Location:** `apps/web/package.json` and `packages/ui/package.json`
**Severity:** LOW
**Impact:** Bundler may not fully tree-shake unused exports

Neither package.json declares `"sideEffects": false` or specifies side-effect files.

**Recommendation:** Add to both packages:
```json
"sideEffects": false
```

Or if CSS files have side effects:
```json
"sideEffects": ["*.css"]
```

---

### Summary Table

| Category | Status | Score |
|----------|--------|-------|
| Version Currency | Good | 8/10 |
| Vulnerability Risk | CRITICAL (transitive) | 5/10 |
| Bundle Impact | Excellent | 9/10 |
| Dependency Health | Good | 8/10 |
| Dependency Necessity | Excellent | 9/10 |
| Tree-Shaking Ready | Good | 7/10 |
| **Overall Dependencies** | **GOOD (with critical fix needed)** | **7.7/10** |

---

### Priority Action Items

| Priority | Issue ID | Description | Effort | Impact |
|----------|----------|-------------|--------|--------|
| CRITICAL | DEP-003 | Fix fast-uri override not propagating | Low | Critical - active CVE |
| HIGH | DEP-004 | Update packages/ui Next.js to 15.5.18 | Low | High - 4 CVEs |
| MEDIUM | DEP-002 | Update DOMPurify to 3.4.5 | Very Low | Medium - security |
| LOW | DEP-001 | Batch update TipTap to 3.23.4 | Low | Low - bug fixes |
| LOW | DEP-010 | Add sideEffects declaration | Very Low | Low - tree-shaking |
| LOW | DEP-007 | Monitor @dnd-kit maintenance | None | Info - future planning |

---

## Agent #18: Documentation Completeness Audit

**Role:** Documentation Completeness Auditor
**Methodology:** JSDoc coverage, inline comment quality, type documentation, API documentation, self-documenting code patterns
**Files Analyzed:**
- `apps/web/src/lib/document-builder/types.ts`
- `apps/web/src/lib/document-builder/ai-generator.ts`
- `apps/web/src/lib/document-builder/analytics-service.ts`
- `apps/web/src/lib/document-builder/ab-testing-service.ts`
- `apps/web/src/lib/document-builder/template-service.ts`
- `apps/web/src/lib/document-builder/index.ts`
- `apps/web/src/components/document-builder/index.ts`
- `apps/web/src/lib/document-builder/persuasion-blocks.ts`
- `apps/web/src/lib/document-builder/input-sanitizer.ts`
- `apps/web/src/lib/document-builder/heatmap-calculator.ts`
- `apps/web/src/lib/document-builder/analytics-sync-worker.ts`
- `apps/web/src/lib/document-builder/version-diff.ts`

### Executive Summary

The Phase 102 document-builder codebase demonstrates **exemplary documentation practices**. JSDoc coverage is comprehensive for all public exports, types are thoroughly documented with meaningful descriptions, and the code follows self-documenting patterns with clear naming. The barrel files (`index.ts`) provide excellent module organization with sectioned exports.

**Overall Documentation Score: 92/100 (Excellent)**

### Category Scores

| Category | Weight | Score | Notes |
|----------|--------|-------|-------|
| JSDoc Coverage | Medium | 95/100 | Nearly all public functions documented |
| Type Documentation | High | 94/100 | Excellent interface/type descriptions |
| Inline Comments | Low | 85/100 | Good where needed, avoids over-commenting |
| API Documentation | Medium | 93/100 | Clear barrel exports with sections |
| Self-Documenting Code | High | 92/100 | Clear names, constants extracted |

### Strengths

#### S-DOC-01: Comprehensive Module Headers
**Pattern observed in all files**
Every file includes a descriptive header block explaining:
- Module purpose
- Phase reference (e.g., "Phase 102-03: AI content generation")
- Key features or responsibilities
- Cost/performance notes where relevant

Example from `ai-generator.ts:1-14`:
```typescript
/**
 * AI Generation Service for Document Builder
 * Phase 102-03: AI content generation
 *
 * Generates persuasive content using Gemini 3.1 Pro.
 * Cost: $1.25/1M tokens per D-05.
 *
 * Features:
 * - Block-type specific prompt engineering
 * - Prospect context integration
 * - Style reference support
 * - Framework compliance context
 * - Multi-language support (Lithuanian, English)
 */
```

#### S-DOC-02: Interface Property Documentation
**Files:** `types.ts`, `analytics-service.ts`, `ab-testing-service.ts`
All interfaces have property-level JSDoc comments explaining the purpose of each field:

Example from `types.ts:49-58`:
```typescript
export interface PersuasionMeta {
  /** Hint for AI content generation */
  aiHints?: string;
  /** Framework this block belongs to */
  frameworkId?: string;
  /** Whether this block is required by the framework */
  isRequired?: boolean;
  /** Additional custom metadata (use this instead of index signature) */
  customData?: Record<string, unknown>;
}
```

#### S-DOC-03: Well-Structured Barrel Exports
**Files:** `lib/document-builder/index.ts`, `components/document-builder/index.ts`
Both barrel files use clear section headers with horizontal rules and descriptive comments:

```typescript
// ---------------------------------------------------------------------------
// AI Generator - Content generation
// ---------------------------------------------------------------------------

export {
  generateBlockContent,
  buildPrompt,
  type GenerationRequest,
  type GenerationResponse,
} from "./ai-generator";
```

#### S-DOC-04: Function Documentation with @param and @returns
**Files:** All service files
Public functions consistently document parameters and return values:

Example from `analytics-service.ts:100-109`:
```typescript
/**
 * Record a block view event.
 *
 * Increments Redis counter and adds to time-series sorted set for decay analysis.
 * Per D-04: Uses INCR for atomic operations.
 *
 * @param blockId - The block ID
 * @param variantId - Optional variant ID for A/B testing
 * @returns true if recorded, false if validation failed
 */
```

#### S-DOC-05: Inline @example Usage
**File:** `input-sanitizer.ts:276-282, 329-337`
Complex functions include practical usage examples:

```typescript
/**
 * @example
 * ```ts
 * const userInput = "Hello <|system|>evil<|end|> world";
 * const safe = sanitizeForPrompt(userInput);
 * // Returns: "Hello  world"
 * ```
 */
```

#### S-DOC-06: Section Dividers for Code Organization
**Pattern observed in all service files**
Files use clear visual separators with equals signs to organize code into logical sections:

```typescript
// =============================================================================
// Types
// =============================================================================

// =============================================================================
// Constants
// =============================================================================

// =============================================================================
// Core Functions
// =============================================================================
```

#### S-DOC-07: Constants with Meaningful Comments
**Files:** `ab-testing-service.ts:92-106`, `heatmap-calculator.ts:29-59`
Magic numbers are extracted to named constants with explanatory comments:

```typescript
/**
 * Minimum impressions needed for statistical significance calculation.
 * Set to 250 to ensure adequate sample size for reliable results.
 */
const MIN_IMPRESSIONS_FOR_SIGNIFICANCE = 250;

/**
 * Minimum experiment duration in hours before significance can be evaluated.
 * Prevents early peeking bias (checking results too early can lead to false positives).
 */
const MIN_EXPERIMENT_DURATION_HOURS = 24;
```

#### S-DOC-08: Algorithm Documentation
**File:** `version-diff.ts:148-153`
Complex algorithms include descriptions of the approach used:

```typescript
/**
 * Compute word-level diff between two text strings.
 *
 * Uses Longest Common Subsequence (LCS) algorithm to find
 * the optimal alignment of words between old and new text.
 */
```

### Areas for Improvement

#### I-DOC-01: Missing @throws Documentation
**Severity:** Low
**Files:** `input-sanitizer.ts:399-420`
The `validateAndLogInjection` function throws an Error but this is not documented:

```typescript
export function validateAndLogInjection(
  input: string,
  context?: string
): boolean {
  // ...
  if (containsInjectionPatterns(input)) {
    // ...
    throw new Error("Invalid input detected: potentially malicious content");
  }
  return true;
}
```

**Recommendation:** Add `@throws {Error}` to the JSDoc:
```typescript
/**
 * @throws {Error} If injection patterns are detected
 */
```

#### I-DOC-02: Private Helper Functions Lack Documentation
**Severity:** Low
**Files:** `version-diff.ts:186-234`, `ab-testing-service.ts:274-314`
Internal helper functions like `tokenizeWords`, `computeLCS`, `buildDiffSegments`, `calculateZTest`, `normalCDF`, and `erf` have minimal or no documentation.

Examples:
- `tokenizeWords` at line 186 has a one-line description but no @param/@returns
- `erf` at line 328 mentions "Abramowitz and Stegun" but no context for what the error function is
- `calculateZTest` at line 274 lacks description of the statistical formula used

**Recommendation:** While these are private, adding brief documentation improves maintainability:
```typescript
/**
 * Error function approximation using Abramowitz and Stegun formula.
 * Used for calculating normal distribution CDF.
 * Maximum error: 1.5e-7
 * @see https://personal.math.ubc.ca/~cbm/aands/page_299.htm
 */
```

#### I-DOC-03: Type Guards Missing Usage Guidance
**Severity:** Low  
**File:** `types.ts:529-579`
Type guards are documented but could benefit from usage examples showing when to use each:

```typescript
/**
 * Type guard for pain amplifier blocks.
 */
export function isPainAmplifierBlock(
  block: PersuasionBlock
): block is PainAmplifierBlock {
  return block.type === "pain_amplifier";
}
```

**Recommendation:** Add @example:
```typescript
/**
 * Type guard for pain amplifier blocks.
 * @example
 * if (isPainAmplifierBlock(block)) {
 *   // TypeScript now knows block.structuredContent is PainAmplifierContent
 *   console.log(block.structuredContent?.painPoints);
 * }
 */
```

#### I-DOC-04: Redis Key Pattern Documentation Incomplete
**Severity:** Low
**File:** `analytics-service.ts:1-15`
The file header documents 4 key patterns but the code uses additional patterns:
- `block:{blockId}:conversions`
- `block:{blockId}:dwell:count`
- `block:{blockId}:won`
- `block:{blockId}:lost`
- `block:{blockId}:total:proposals`

**Recommendation:** Update the header to include all key patterns or reference a separate key documentation file.

#### I-DOC-05: Injection Pattern Categories Could Use More Detail
**Severity:** Low
**File:** `input-sanitizer.ts:73-86`
The JSDoc comment lists 8 categories with pattern counts, but the inline comments within `INJECTION_PATTERNS` could be more descriptive about why each pattern is dangerous:

```typescript
// Category 5: Jailbreak attempts
/\bDAN\s*(mode|prompt|jailbreak)?/gi,  // What is DAN? Why is it dangerous?
```

**Recommendation:** Add brief explanations:
```typescript
// DAN = "Do Anything Now" - common jailbreak persona that attempts to bypass safety guidelines
/\bDAN\s*(mode|prompt|jailbreak)?/gi,
```

#### I-DOC-06: Missing Complexity Notes on computeLCS
**Severity:** Low
**File:** `version-diff.ts:194-233`
The LCS algorithm has O(n*m) time and space complexity which could cause performance issues with large documents. This should be documented:

**Recommendation:**
```typescript
/**
 * Compute Longest Common Subsequence indices.
 * Returns array of [oldIndex, newIndex] pairs.
 *
 * Time complexity: O(m * n) where m and n are word counts
 * Space complexity: O(m * n) for the DP table
 *
 * @warning May be slow for texts with >10,000 words
 */
```

### Self-Documenting Code Patterns (Positive Examples)

#### Clear Naming Conventions

| Pattern | Example | File |
|---------|---------|------|
| Boolean predicates | `isSignificant`, `isValid`, `hasChanges`, `canDeclare` | ab-testing-service.ts |
| Verb-noun actions | `recordBlockView`, `calculateCorrelation`, `computeBlockDiff` | analytics-service.ts, version-diff.ts |
| Type suffixes | `BlockDiffStatus`, `TextDiffSegment`, `HeatLevel` | version-diff.ts, heatmap-calculator.ts |
| Key builders | `viewKey()`, `dwellKey()`, `conversionsKey()` | analytics-service.ts |

#### Constants Replacing Magic Numbers

| Constant | Value | File:Line |
|----------|-------|-----------|
| `MIN_IMPRESSIONS_FOR_SIGNIFICANCE` | 250 | ab-testing-service.ts:99 |
| `MIN_EXPERIMENT_DURATION_HOURS` | 24 | ab-testing-service.ts:106 |
| `AI_GENERATION_TIMEOUT_MS` | 60000 | ai-generator.ts:89 |
| `GEMINI_COST_PER_1M_TOKENS` | 1.25 | ai-generator.ts:95 |
| `SYNC_INTERVAL_MS` | 5 * 60 * 1000 | analytics-sync-worker.ts:55 |
| `DLQ_TTL_SECONDS` | 7 * 24 * 60 * 60 | analytics-sync-worker.ts:67 |
| `DLQ_WARNING_THRESHOLD` | 100 | analytics-sync-worker.ts:536 |

### API Documentation Quality

The barrel exports provide excellent API discoverability:

**`lib/document-builder/index.ts` Structure:**
1. Types (75 type exports)
2. Persuasion Blocks (8 exports)
3. AI Generator (4 exports)
4. Analytics Service (7 exports)
5. Template Service (6 exports)
6. Input Sanitizer (2 exports)
7. Heatmap Calculator (6 exports)
8. Analytics Sync Worker (3 exports)
9. Version Diff (6 exports)
10. A/B Testing Service (8 exports)

**`components/document-builder/index.ts` Structure:**
1. Core components (BlockPalette, DocumentCanvas, DropZone, PersuasionBlock)
2. Phase 102-03 components (BlockEditor, LazyBlockEditor)
3. Phase 102-04 components (FrameworkSelector, HeatmapOverlay)
4. Phase 102-05 components (VariantCreator, VariantTabs, VersionDiff)
5. Error boundary wrappers (SafeDocumentCanvas, SafeBlockEditor, SafeVariantTabs)

### Metrics Summary

| Metric | Value |
|--------|-------|
| **Files analyzed** | 12 |
| **Total lines** | ~3,200 |
| **Public exports** | 125+ |
| **JSDoc coverage (public functions)** | 98% |
| **JSDoc coverage (interfaces)** | 100% |
| **@param documentation** | 95% |
| **@returns documentation** | 90% |
| **@throws documentation** | 0% (improvement needed) |
| **@example usage** | 15% (good for complex functions) |
| **Constants extracted** | 25+ magic numbers replaced |
| **Section organization** | Consistent across all files |

### Recommendations Summary

| ID | Issue | Effort | Impact |
|----|-------|--------|--------|
| I-DOC-01 | Add @throws to validateAndLogInjection | Low | Low |
| I-DOC-02 | Document private helper functions | Medium | Low |
| I-DOC-03 | Add @example to type guards | Low | Low |
| I-DOC-04 | Complete Redis key pattern documentation | Low | Low |
| I-DOC-05 | Explain injection pattern dangers | Low | Low |
| I-DOC-06 | Add complexity notes to computeLCS | Low | Medium |

### Conclusion

Phase 102's documentation is production-ready and follows industry best practices. The consistent use of JSDoc, clear type definitions, organized barrel exports, and self-documenting code patterns make this codebase highly maintainable. The minor improvements identified are polish items rather than critical gaps. This documentation quality should be used as the standard for other modules in the TeveroSEO platform.

---

## Agent #15: Observability Expert Findings

**Audit Timestamp:** 2026-05-18T19:30:00Z
**Files Reviewed:** 8
**Severity Summary:** 🔴 Critical: 0 | 🟠 High: 2 | 🟡 Medium: 4 | 🔵 Low: 4

### 🔴 Critical Issues

None identified. The codebase demonstrates solid logging infrastructure and error context preservation.

### 🟠 High Priority

#### H-OBS-01: A/B Testing Service Has No Logging At All
**Location:** `apps/web/src/lib/document-builder/ab-testing-service.ts` (entire file)
**Issue:** The A/B testing service is a 891-line file implementing critical business logic (variant assignment, statistical significance, experiment lifecycle) but contains zero logging statements. The only output is a single `console.warn` at line 130 when no variants are available.

**Impact:**
- Cannot debug variant assignment issues in production
- No visibility into experiment lifecycle state changes (start, pause, stop)
- Cannot trace statistical significance calculations that may produce unexpected results
- Cannot identify winner detection failures

**Evidence:**
```typescript
// Line 130 - only output in entire service
console.warn(
  `[getVariantForProspect] No variants available for block "${blockId}". ` +
  "Ensure at least one variant exists before calling this function."
);
```

**Recommendation:** Add structured logging for key operations:
```typescript
import { logger } from "@/lib/logger";

// Variant assignment
logger.info("[ab-testing] Variant assigned", {
  prospectId,
  blockId,
  variantId: variant.id,
  bucket,
  method: "deterministic-hash",
});

// Experiment lifecycle
logger.info("[ab-testing] Experiment started", {
  experimentId: experiment.id,
  blockId: experiment.blockId,
  variantCount: experiment.variants.length,
  totalWeight: weights.sum,
});

// Statistical significance
logger.debug("[ab-testing] Significance calculated", {
  variantId,
  impressions,
  conversionRate,
  confidenceLevel,
  zScore,
  recommendation,
});
```

#### H-OBS-02: Analytics Route Missing Correlation ID Propagation
**Location:** `apps/web/src/app/api/document-builder/analytics/route.ts`
**Issue:** The analytics route generates a `requestId` (line 209: `const requestId = \`${sessionId}-${Date.now()}\``) but:
1. Does not use `createRequestLogger()` to create a child logger with correlation context
2. Does not pass the correlation ID to downstream service calls (`recordBlockView`, `recordBlockDwell`)
3. Does not return the correlation ID in response headers for client-side tracing

**Current Pattern (Line 209-233):**
```typescript
const requestId = `${sessionId}-${Date.now()}`;
const controller = new AbortController();
// requestId used only for abort controller tracking, not logging
```

**Impact:** When debugging failed analytics events:
- Cannot trace a single request across route -> analytics-service -> redis operations
- Cannot correlate client-side events with server-side processing
- Cannot identify which specific events failed in a batch

**Recommendation:**
```typescript
// Create request-scoped logger with correlation ID
const requestId = generateCorrelationId();
const reqLogger = createRequestLogger(requestId, { sessionId, userId });

reqLogger.info("[analytics-route] Processing batch", { eventCount: events.length });

// Pass to downstream services (would require service refactoring)
// Return correlation ID in response header for client tracing
return accepted({ eventCount: events.length }, { "X-Request-ID": requestId });
```

### 🟡 Medium Priority

#### M-OBS-01: No Timing Metrics for AI Generation
**Location:** `apps/web/src/lib/document-builder/ai-generator.ts:417-428`
**Issue:** While the AI generator logs `durationMs` on completion, it does not emit timing metrics suitable for aggregation/alerting. The timing is only available in logs, not in a metrics system.

**Current Log (Good):**
```typescript
logger.info("[ai-generator] Content generation completed", {
  blockType: request.blockType,
  durationMs,
  cost: Math.round(cost * 1_000_000) / 1_000_000,
});
```

**Missing:** No histogram/percentile metrics for:
- P50/P95/P99 generation latency by block type
- Cost tracking aggregates per user/workspace
- Retry rate tracking

**Recommendation:** Add Sentry performance monitoring or custom metrics emission:
```typescript
Sentry.addBreadcrumb({
  category: "ai.generation",
  message: "Content generated",
  data: {
    blockType: request.blockType,
    durationMs,
    cost,
    retryCount: attempt,
  },
  level: "info",
});

// Or emit to a metrics provider
metrics.histogram("ai.generation.duration_ms", durationMs, { blockType: request.blockType });
metrics.counter("ai.generation.total_cost_usd", cost);
```

#### M-OBS-02: Analytics Sync Worker Logs Duration But Not Throughput
**Location:** `apps/web/src/lib/document-builder/analytics-sync-worker.ts:437-443`
**Issue:** Sync completion logs `keysProcessed`, `updatesPerformed`, `durationMs` but not throughput metrics useful for capacity planning.

**Current:**
```typescript
logger.info("[analytics-sync] Sync complete", {
  keysProcessed: result.keysProcessed,
  updatesPerformed: result.updatesPerformed,
  errorCount: result.errors.length,
  durationMs: result.durationMs,
});
```

**Missing:**
- Keys processed per second
- Updates per second
- Batch efficiency (updates / keys ratio)
- Queue depth before sync

**Recommendation:**
```typescript
logger.info("[analytics-sync] Sync complete", {
  ...result,
  keysPerSecond: result.durationMs > 0 ? (result.keysProcessed / result.durationMs) * 1000 : 0,
  updatesPerSecond: result.durationMs > 0 ? (result.updatesPerformed / result.durationMs) * 1000 : 0,
  batchEfficiency: result.keysProcessed > 0 ? result.updatesPerformed / result.keysProcessed : 0,
});
```

#### M-OBS-03: Error Logs Missing Stack Traces in Multiple Locations
**Locations:**
- `apps/web/src/lib/document-builder/analytics-service.ts:139, 191, 253, 320, 434`
- `apps/web/src/app/api/document-builder/analytics/route.ts:226, 240`

**Issue:** Error logging uses pattern that loses stack traces:
```typescript
logger.error(
  "[analytics-service] recordBlockView error",
  error instanceof Error ? error : { error: String(error) }
);
```

While this preserves the Error object when it is an Error, the logger's error handling (line 224 in logger.ts) extracts `{ message, stack, name }`. However, when `error` is not an Error (which can happen), the stack is lost.

**Contrast with AI Generator (Correct Pattern):**
```typescript
// ai-generator.ts:445-453 - Preserves stack
logger.error("[ai-generator] Generation failed after all retries", {
  blockType: request.blockType,
  durationMs,
  errorType,
  status,
  error: error instanceof Error ? error.message : String(error),
  stack: error instanceof Error ? error.stack : undefined,
});
```

**Recommendation:** Standardize on explicit stack capture:
```typescript
logger.error("[component] Operation failed", {
  context: "relevant-context",
  error: error instanceof Error ? error.message : String(error),
  stack: error instanceof Error ? error.stack : undefined,
});
```

#### M-OBS-04: No Business Metrics in Generate Route
**Location:** `apps/web/src/app/api/document-builder/generate/route.ts`
**Issue:** The generate route logs request start and handles errors but does not log:
1. Generation success with block type breakdown
2. Token usage for cost monitoring
3. Confidence scores for quality monitoring
4. Rate limit near-miss warnings

**Current (lines 147-152):**
```typescript
logger.info("[doc-builder/generate] Generating content", {
  userId,
  blockType: request.blockType,
  intent: request.intent,
  language: request.language,
});
// No success logging with result metrics
```

**Recommendation:**
```typescript
logger.info("[doc-builder/generate] Generation successful", {
  userId,
  blockType: request.blockType,
  confidence: result.confidence,
  contentLength: result.content.length,
  tokensUsed: result.usage?.totalTokens,
  estimatedCost: result.cost,
  rateLimitRemaining: rateLimitResult.remaining,
});
```

### 🔵 Low Priority / Recommendations

#### L-OBS-01: Export Route Missing Timing Logs
**Location:** `apps/web/src/app/api/document-builder/export/route.ts`
**Issue:** No timing captured for PDF export operation. The export can be slow (Puppeteer-based) but there's no visibility into duration.

**Recommendation:**
```typescript
const startTime = Date.now();
const pdfBuffer = await exportToPdf({ ... });
const durationMs = Date.now() - startTime;

logger.info("[doc-builder/export] PDF generated", {
  userId,
  proposalId,
  durationMs,
  fileSizeBytes: pdfBuffer.length,
});
```

#### L-OBS-02: Circuit Breaker State Not Logged
**Location:** `apps/web/src/app/api/document-builder/analytics/route.ts:103-111`
**Issue:** Circuit breaker recovery attempt is logged, but current state (open/closed, failure count) is not periodically logged for observability dashboards.

**Recommendation:** Log circuit breaker state on each request:
```typescript
if (circuitBreaker.failureCount > 0) {
  logger.debug("[analytics-route] Circuit breaker state", {
    isOpen: circuitBreaker.isOpen,
    failureCount: circuitBreaker.failureCount,
    timeSinceLastFailure: Date.now() - circuitBreaker.lastFailureTime,
  });
}
```

#### L-OBS-03: Debug Logs Could Include More Context
**Location:** `apps/web/src/lib/document-builder/analytics-sync-worker.ts:275-282`
**Issue:** Debug logging for key scanning is good but could include more context:

**Current:**
```typescript
logger.debug("[analytics-sync] Found keys to sync", {
  variantViewKeys: variantViewKeys.length,
  variantConversionKeys: variantConversionKeys.length,
  blockViewKeys: filteredBlockViewKeys.length,
  blockConversionKeys: filteredBlockConversionKeys.length,
  total: allKeys.length,
});
```

**Recommendation:** Add sample keys for debugging (first 5):
```typescript
logger.debug("[analytics-sync] Found keys to sync", {
  ...counts,
  sampleVariantKeys: variantViewKeys.slice(0, 5),
  sampleBlockKeys: filteredBlockViewKeys.slice(0, 5),
});
```

#### L-OBS-04: No PII Filtering Verification
**Locations:** All logging in services
**Issue:** While the logger does not explicitly log PII, there's no verification that:
1. `prospectId` values don't contain PII
2. Custom prompts don't contain PII that gets logged
3. Error messages from third-party services don't contain PII

**Good Practice Already in Place:**
- AI generator logs prompt **length**, not content (line 468: `promptLength: buildPrompt(request).length`)
- Error messages use generic text, not user content

**Recommendation:** Document PII policy and add audit comments:
```typescript
// NOTE: prospectId is a UUID, not PII. If this changes, filter before logging.
logger.info("[analytics-service] ...", { blockId, prospectId });
```

### ✅ Strengths Observed

1. **Excellent Logger Infrastructure**
   - `apps/web/src/lib/logger.ts` provides:
     - Structured JSON logging in production (line 109)
     - Readable colored output in development (lines 114-122)
     - Log level filtering by environment (lines 66-69)
     - Correlation ID support via `setContext()` and `child()` (lines 86-105)
     - Stack trace extraction from Error objects (lines 39-56)

2. **Comprehensive AI Generator Logging**
   - Request start logged with intent/language/blockType (lines 316-320)
   - Injection pattern detection logged for security monitoring (lines 335-340)
   - Each retry attempt logged with error classification (lines 371-379)
   - Successful completion logged with full metrics: duration, tokens, cost, confidence (lines 418-428)
   - Failure logged with error type, status, and stack trace (lines 445-453)
   - Sentry integration for production monitoring with rich tags and extras (lines 456-471)

3. **Analytics Sync Worker Observability**
   - Worker start/stop logged (lines 679, 722)
   - Sync completion logged with full statistics (lines 437-443)
   - DLQ monitoring with threshold-based warnings (lines 548-563)
   - DLQ entry logged when data moved to dead letter queue (lines 216-223)
   - Retry attempts logged with context (lines 403-408)

4. **Fail-Closed Logging Pattern**
   - Analytics route logs circuit breaker state transitions (lines 109, 157)
   - Distinguishes between rate limit exceed and service unavailable (lines 113-115, 128-130)
   - Background processing timeout logged (line 215)

5. **Error Context Preservation**
   - AI generator includes blockType, intent, durationMs, errorType in all error logs
   - Analytics sync includes variantId, blockId, retry count in error context
   - Sentry captures rich context including non-sensitive request details

6. **Log Level Appropriateness**
   - `debug` for internal state (key scanning, circuit breaker checks)
   - `info` for business operations (generation complete, sync complete)
   - `warn` for recoverable issues (retry, injection detection, rate limit near)
   - `error` for failures with stack traces

### 📊 Metrics

| File | Log Calls | Levels Used | Has Timing | Has Correlation | Grade |
|------|-----------|-------------|------------|-----------------|-------|
| ai-generator.ts | 8 | info, warn, error | Yes | No | A- |
| analytics-service.ts | 6 | error, warn | No | No | B |
| analytics-sync-worker.ts | 14 | debug, info, warn, error | Yes (sync duration) | No | A- |
| ab-testing-service.ts | 1 (console.warn) | N/A | No | No | F |
| analytics/route.ts | 6 | info, warn, error | Partial | Generated but not used | B- |
| export/route.ts | 3 | debug, info, error | No | No | C+ |
| generate/route.ts | 3 | info, warn, error | No | No | B- |

**Overall Observability Score: 72/100**

- Files analyzed: 8
- Total log statements reviewed: 41
- Log patterns validated: 6
- Correlation ID usage: 1/8 services (12.5%)
- Timing metrics: 2/8 services (25%)
- Business metrics: 1/8 services (12.5%)
- Sentry integration: 1/8 services (12.5%)

### Recommendations Summary

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| 🟠 H-OBS-01 | Add logging to A/B testing service | Medium | High |
| 🟠 H-OBS-02 | Propagate correlation IDs in analytics route | Medium | High |
| 🟡 M-OBS-01 | Add timing metrics for AI generation | Low | Medium |
| 🟡 M-OBS-02 | Add throughput metrics to sync worker | Low | Medium |
| 🟡 M-OBS-03 | Standardize stack trace capture pattern | Low | Medium |
| 🟡 M-OBS-04 | Add business metrics to generate route | Low | Medium |
| 🔵 L-OBS-01 | Add timing to export route | Low | Low |
| 🔵 L-OBS-02 | Log circuit breaker state periodically | Low | Low |
| 🔵 L-OBS-03 | Add sample keys to debug logs | Low | Low |
| 🔵 L-OBS-04 | Document PII filtering policy | Low | Low |

### Summary

The Phase 102 codebase has **good foundational logging infrastructure** with a well-designed Logger class supporting structured logging, correlation IDs, and log levels. However, **observability coverage is inconsistent**:

**Strong Areas:**
- AI generator has excellent logging with timing, cost tracking, and Sentry integration
- Analytics sync worker has comprehensive logging for debugging data pipeline issues
- Error handling consistently logs with context

**Gaps to Address:**
1. **H-OBS-01 (Critical):** A/B testing service has no logging - this is a blind spot for a critical business function
2. **H-OBS-02:** Correlation IDs are generated but not propagated, limiting request tracing
3. **General:** Most services lack timing/throughput metrics needed for capacity planning and SLA monitoring

**Overall Assessment:** The system is debuggable in development but would benefit from improved production observability, particularly correlation ID propagation and metrics emission for dashboards/alerting.

---

## Agent #20: Specification Compliance Findings

**Audit Timestamp:** 2026-05-18T18:30:00Z
**Focus:** Requirement tracing, acceptance criteria verification, feature completeness, scope compliance
**Files Reviewed:** 32 (all Phase 102 implementation files)
**Severity Summary:** 🔴 Critical: 1 | 🟠 High: 2 | 🟡 Medium: 4 | 🔵 Low: 3

---

### Requirement Traceability Matrix

| REQ # | Requirement | Implementation Files | Status | Evidence |
|-------|-------------|---------------------|--------|----------|
| 1 | Persuasion Block Types (8+) | `types.ts:15-27`, `persuasion-blocks.ts:72-172` | ✅ COMPLETE | 11 block types defined: pain_amplifier, villain_story, credibility, social_proof, process_reveal, offer_stack, risk_reversal, objection_handler, urgency, cta, custom |
| 2 | Drag-Drop Block Reordering | `DocumentCanvas.tsx:19-36,259-290`, `DropZone.tsx` | ⚠️ PARTIAL | DnD implemented with @dnd-kit, but lacks <200ms performance validation |
| 3 | Optional Framework Templates | `persuasion-blocks.ts:258-337`, `template-service.ts`, `FrameworkSelector.tsx` | ✅ COMPLETE | 3 frameworks: russell_brunson (Perfect Webinar), storybrand, pas |
| 4 | Section Heatmaps | `HeatmapOverlay.tsx`, `heatmap-calculator.ts` | ✅ COMPLETE | Color gradient overlay with 5 heat levels (cold/cool/warm/hot/very_hot) |
| 5 | Block → Close Correlation | `analytics-service.ts:269-328`, `HeatmapOverlay.tsx:150-267` | ✅ COMPLETE | Correlation calculation with win rate formula, BlockAnalyticsDisplay shows "Win Corr." |
| 6 | A/B Testing UI | `VariantCreator.tsx`, `VariantTabs.tsx`, `ab-testing-service.ts` | ✅ COMPLETE | Create variants, assign weights, track impressions/conversions, detect winners |
| 7 | AI Content Generation | `ai-generator.ts`, `BlockEditor.tsx:211-273`, `generate/route.ts` | ✅ COMPLETE | Generate button on BlockEditor, context-aware prompts using prospect/block type |
| 8 | Side-by-Side Version Diff | `VersionDiff.tsx`, `version-diff.ts` | ✅ COMPLETE | Two-column layout with added/removed/modified highlighting, text-level diff |

---

### Acceptance Criteria Verification

#### AC-01: Can recreate the 3000-word Lithuanian SEO proposal
**Status:** ✅ PASS (with assumptions)

**Evidence:**
- 11 persuasion block types available for all direct-response elements
- Framework templates provide structured starting points
- AI generator supports `language: "lt"` parameter (line 69 of `generate/route.ts`)
- Variable interpolation available via `VariablePicker.tsx`
- Blocks can be reordered to match any structure

---

#### AC-02: All 8 persuasion block types available and insertable
**Status:** ✅ PASS (exceeds spec - 11 types implemented)

**Evidence:** `types.ts:15-26` defines 11 block types with full metadata in `persuasion-blocks.ts:72-172`

---

#### AC-03: Blocks can be reordered via drag-drop with live preview
**Status:** ⚠️ PARTIAL PASS

**Evidence:**
- DnD implemented with `@dnd-kit/core` and `@dnd-kit/sortable`
- `DragOverlay` shows visual feedback during drag
- Keyboard accessibility via `sortableKeyboardCoordinates`

**Gap:** SPEC requires preview updates "within 200ms" but no performance validation exists.

---

#### AC-04: At least 3 framework templates available
**Status:** ✅ PASS

**Evidence:** 3 frameworks: russell_brunson (Perfect Webinar), storybrand, pas

---

#### AC-05: Section heatmap shows engagement data
**Status:** ✅ PASS

**Evidence:** `HeatmapOverlay.tsx` renders color gradient overlay with 5 heat levels, `analytics-service.ts` records views via Redis INCR

---

#### AC-06: Analytics dashboard shows block → close correlation
**Status:** ✅ PASS

**Evidence:** `calculateCorrelation()` tracks won/lost counts, calculates win rate, `BlockAnalyticsDisplay` shows "Win Corr." metric

---

#### AC-07: Can create A/B test on a block
**Status:** ✅ PASS

**Evidence:** `VariantCreator.tsx` UI, `VariantTabs.tsx` status badges, `detectWinner()` with z-test statistical significance

---

#### AC-08: Can generate AI content for any block
**Status:** ✅ PASS

**Evidence:** Generate button in BlockEditor, context-aware prompts using prospect/block type/framework/preceding blocks

---

#### AC-09: Can compare two versions side-by-side
**Status:** ✅ PASS

**Evidence:** `VersionDiff.tsx` two-column layout, `computeBlockDiff()` returns added/removed/modified, text-level LCS diff

---

#### AC-10: Editor does not lag with 50+ blocks (<100ms re-render)
**Status:** 🔴 FAIL - CANNOT VERIFY

**Evidence Against:**
- Agent #3 found CRITICAL issue: "No virtualization for large block lists"
- `DocumentCanvas.tsx:425-445` uses simple `.map()` without windowing
- 50 blocks = ~5000+ DOM nodes, React reconciliation unlikely to complete in <100ms
- No performance benchmark tests exist

---

#### AC-11: Build passes TypeScript compilation
**Status:** ✅ PASS (for Phase 102 scope)

**Evidence:** TypeScript check for document-builder files returns no errors

---

#### AC-12: 80%+ test coverage on new services
**Status:** ✅ PASS

**Evidence:** 462 tests passing, ~83% estimated coverage (exceeds 80% threshold)

---

### 🔴 Critical Issues

#### SPEC-001: 50+ Block Performance Requirement Unmet
**Requirement:** "Editor must handle 5000 words / 50+ blocks without lag (<100ms re-render)"
**Status:** UNVERIFIED/LIKELY FAILING

**Required Fix:**
1. Implement `@tanstack/react-virtual` for windowed rendering
2. Add performance tests validating 100ms threshold

---

### 🟠 High Priority Issues

#### SPEC-002: Drag-Drop 200ms Preview Update Not Validated
**Status:** NOT MEASURED - needs performance tests

#### SPEC-003: Missing "Litmus Test" Documentation
**Status:** No formal E2E test showing Lithuanian proposal recreation

---

### 🟡 Medium Priority Issues

#### SPEC-004: Single Editor Constraint Not Enforced at Code Level
#### SPEC-005: Desktop-First Not Enforced in Components
#### SPEC-006: Framework Templates Missing Preview of Block Content
#### SPEC-007: Proposal Export Scope Unclear

---

### ✅ Strengths Observed

1. **Exceeds Block Type Requirement:** 11 types vs 8 required
2. **Comprehensive Framework Implementation:** All 3 frameworks with proper sequences
3. **Production-Ready Analytics Pipeline:** Redis + Postgres sync + dead letter queue
4. **Strong A/B Testing Foundation:** Full lifecycle with z-test significance
5. **Robust AI Generation:** Retry logic, error classification, 57+ injection patterns
6. **Accessible Implementation:** WCAG 2.1 AA patterns
7. **Type-Safe Architecture:** Zod schemas, TypeScript guards
8. **Test Coverage Exceeds Threshold:** ~83%

---

### 📊 Acceptance Criteria Summary

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| 1 | Lithuanian proposal | ✅ PASS* | *Features present, no formal test |
| 2 | 8+ block types | ✅ PASS | 11 types implemented |
| 3 | Drag-drop preview | ⚠️ PARTIAL | <200ms not validated |
| 4 | 3+ frameworks | ✅ PASS | 3 with full metadata |
| 5 | Section heatmap | ✅ PASS | 5-level visualization |
| 6 | Block correlation | ✅ PASS | Win rate calculation |
| 7 | A/B testing UI | ✅ PASS | Full lifecycle |
| 8 | AI generation | ✅ PASS | Context-aware |
| 9 | Version diff | ✅ PASS | Block + text diff |
| 10 | 50+ blocks <100ms | 🔴 FAIL | No virtualization |
| 11 | TypeScript | ✅ PASS | No errors |
| 12 | 80%+ coverage | ✅ PASS | ~83% |

**Overall Compliance: 10/12 (83%)**

---

### Conclusion

**Phase 102 SPEC Compliance: 83% (10/12 acceptance criteria met)**

The implementation is feature-complete for primary use cases. The critical gap is the 50+ block performance requirement (AC-10), which requires virtualization to meet the <100ms re-render constraint.

**Recommendation:** Prioritize SPEC-001 (virtualization) as a blocking issue before phase completion.

---

*Agent #20 Audit Complete*
