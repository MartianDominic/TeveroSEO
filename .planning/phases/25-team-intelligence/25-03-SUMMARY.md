---
phase: 25
plan: 03
subsystem: analytics
tags: [predictions, goals, alerts, linear-regression]
dependency_graph:
  requires: [25-02]
  provides: [goal-projections, predictive-alerts, traffic-decline-detection]
  affects: [dashboard, client-detail]
tech_stack:
  added: []
  patterns: [linear-regression, trend-analysis, confidence-scoring]
key_files:
  created:
    - apps/web/src/types/predictions.ts
    - apps/web/src/lib/analytics/predictions.ts
    - apps/web/src/actions/analytics/get-predictions.ts
    - apps/web/src/components/goals/GoalProjectionCard.tsx
    - apps/web/src/components/dashboard/PredictiveAlertsPanel.tsx
  modified:
    - apps/web/src/components/goals/index.ts
decisions:
  - Linear regression for trend prediction with R-squared confidence
  - 7+ data points required for meaningful projections
  - Declining trend when slope < -0.5
  - Traffic decline alert when >10% decline predicted
  - Goal at-risk when declining or >90 days to target
  - Goal achievable when <30 days and >70% confidence
  - Workspace predictions cached 5 minutes in Redis
metrics:
  duration_minutes: 7
  completed_at: "2026-04-20T12:54:00Z"
---

# Phase 25 Plan 03: Predictive Alerts + Goal Projection Summary

Linear extrapolation-based goal projections with confidence scoring and predictive alerts for declining trends.

## Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Create prediction types | 6ce2dd0a | predictions.ts |
| 2 | Create prediction utilities | cfc73029 | lib/analytics/predictions.ts |
| 3 | Create server actions | bd36b8b8 | actions/analytics/get-predictions.ts |
| 4 | Create GoalProjectionCard | ea56887f | GoalProjectionCard.tsx, index.ts |
| 5 | Create PredictiveAlertsPanel | d794f3fa | PredictiveAlertsPanel.tsx |

## Implementation Details

### Prediction Types (Task 1)
- `GoalProjection`: goalId, currentValue, targetValue, projectedCompletionDate, confidence, trend
- `PredictiveAlert`: id, type, clientId, message, probability, timeframe
- `TrendDirection`: accelerating | steady | decelerating | declining
- `PredictionType`: traffic_decline | goal_at_risk | goal_achievable | ranking_drop | ctr_decline

### Prediction Utilities (Task 2)
- `linearRegression()`: Simple linear regression with R-squared coefficient
- `projectGoalCompletion()`: Extrapolates when goal will be met based on history
- `predictTrafficDecline()`: Detects declining trends early (>10% decline trigger)
- `calculateConfidence()`: Confidence based on data point count and R-squared fit
- `formatTimeframe()`: Human-readable timeframe strings

### Server Actions (Task 3)
- `getGoalProjections(clientId)`: Returns projections for all client goals
- `getClientPredictions(clientId)`: Returns predictive alerts for a client
- `getWorkspacePredictions(workspaceId)`: Aggregates across all clients with Redis caching
- `getPredictionCounts(workspaceId)`: Returns critical/warning/total counts for badges

### GoalProjectionCard (Task 4)
- Progress bar with color-coded attainment (blue < 80%, yellow 80-99%, green 100%+)
- Trend indicator with weekly velocity display (+X/wk)
- Confidence badge (High >= 70%, Medium >= 40%, Low < 40%)
- Projected completion date with calendar icon
- At-risk warning for declining or slow-progressing goals

### PredictiveAlertsPanel (Task 5)
- List of predicted issues across workspace clients
- Severity-based styling (critical = red, warning = yellow, info = blue)
- Probability and timeframe display per alert
- Action suggestions based on prediction type
- Collapsible panel with expand/collapse toggle
- Links to client detail pages for investigation

## Algorithm Details

### Linear Regression
```
slope = (n * SUM(xy) - SUM(x) * SUM(y)) / (n * SUM(x^2) - SUM(x)^2)
intercept = (SUM(y) - slope * SUM(x)) / n
R^2 = 1 - SS_residual / SS_total
```

### Confidence Scoring
- Data contribution: min(dataPoints / 50, 1) * 50 (max 50%)
- Fit contribution: R^2 * 50 (max 50%)
- Total confidence capped at 95%

### Trend Classification
- Declining: slope < -0.5
- Steady: -0.5 <= slope < 0.5
- Accelerating: slope > previous_slope * 1.2
- Decelerating: slope < previous_slope * 0.8

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] apps/web/src/types/predictions.ts exists
- [x] apps/web/src/lib/analytics/predictions.ts exists
- [x] apps/web/src/actions/analytics/get-predictions.ts exists
- [x] apps/web/src/components/goals/GoalProjectionCard.tsx exists
- [x] apps/web/src/components/dashboard/PredictiveAlertsPanel.tsx exists
- [x] Commit 6ce2dd0a exists
- [x] Commit cfc73029 exists
- [x] Commit bd36b8b8 exists
- [x] Commit ea56887f exists
- [x] Commit d794f3fa exists
- [x] TypeScript compilation passes for prediction files
