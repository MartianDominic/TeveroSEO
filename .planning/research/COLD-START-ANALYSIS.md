# Cold Start Problem Analysis: Keyword Analysis SaaS

> **Generated:** 2026-05-05
> **Context:** TeveroSEO v1.0 launch planning
> **Methodology:** Rigorous statistical analysis of learning feature viability

---

## Executive Summary

This document analyzes the cold start problem for TeveroSEO's keyword analysis system at launch. The core tension: **features in Phases 85-88 assume historical data that does not exist at v1.0**.

### The Brutal Reality

| Timeframe | Internal Analyses | Outcome Data | Statistical Validity |
|-----------|-------------------|--------------|---------------------|
| Launch Day | 0 | 0 | None |
| Month 1 | ~5-15 | 0 | Meaningless |
| Month 3 | ~30-50 | 0 | Still inadequate |
| Month 6 | ~100-200 | ~10-30 (first rankings) | Barely testable |
| Month 12 | ~300-600 | ~80-150 | Approaching minimal |
| Month 18 | ~500-1000 | ~200-400 | Statistically meaningful |

**Key Insight:** Ranking outcomes take 6+ months to materialize. Even with aggressive growth, statistically meaningful learning requires 12-18 months of operation.

---

## Part 1: Feature Categorization by Data Dependency

### Category A: Works From Day 1 (No Historical Data Needed)

These features use deterministic rules, external APIs, or real-time computation.

| Feature | Phase | Data Source | Notes |
|---------|-------|-------------|-------|
| Funnel classification (BOFU/MOFU/TOFU) | 76 | Pattern library + DataForSEO intent | Lithuanian patterns work immediately |
| Geographic filtering | 77 | City database (50+ cities) | Static morphological variants |
| Relevance scoring | 78 | jina-embeddings-v3 | Real-time embedding similarity |
| Constraint filtering | 79 | Business rules | Hard filters, no learning |
| Cascade selection | 80 | Configurable algorithm | Target count-based selection |
| Conversation extraction | 75 | Claude LLM | Real-time extraction |
| DataForSEO metrics | 84 | External API | Volume, difficulty, CPC |
| CSV/Sheets import | 84 | User upload | No learning needed |
| Column customization | 86 | User preference | Stored per user |
| Export to Excel/PDF | 86 | Current analysis | No historical context |
| Score breakdowns | 87 | Current weights | Deterministic calculation |
| Exclusion reasons | 87 | Current filters | Real-time generation |
| HDBSCAN clustering | 88/86 | Current embeddings | Mathematical, no training |
| Semantic deduplication | 88/86 | Current embeddings | Similarity threshold |

**V1 Recommendation:** Ship all Category A features without modification.

---

### Category B: Needs External Data (Research/Industry Reports/APIs)

These features CAN work at v1 but require sourcing external baselines.

| Feature | Phase | External Source Options | Recommended Approach |
|---------|-------|------------------------|---------------------|
| Industry presets | 85 | SEO research, competitor analysis | Option 3 (see below) |
| Smart defaults (40/35/25) | 85 | Industry research | Justify with citations |
| Difficulty thresholds by industry | 85 | DataForSEO aggregate data | Query API for benchmarks |
| Volume thresholds by vertical | 85 | Industry reports | Published research |
| Effort estimation | 92 | Industry standards | Content marketing benchmarks |

**V1 Recommendation:** Research and cite sources. Mark as "Industry Standard" not "Our Data".

---

### Category C: Needs Internal Data (Our Own Analyses)

These features degrade gracefully with low data but improve over time.

| Feature | Phase | Minimum Viable n | Confidence at n=50 |
|---------|-------|------------------|-------------------|
| Client-specific patterns | 84 | n=5 per client | Low but useful |
| Session memory | 84 | n=1 (same user) | Works immediately |
| Constraint preferences | 84 | n=3 per client | Reasonable |
| Analysis templates | 89 | n=10 | Usable patterns |
| Team templates | 91 | n=5 per team | Sufficient |

**V1 Recommendation:** Ship with per-user/per-client learning. Do NOT aggregate across clients until n>100.

---

### Category D: Needs LOTS of Internal Data (Statistical Learning)

**DO NOT SHIP these features until data thresholds are met.**

| Feature | Phase | Minimum n | Statistical Requirement | Time to Threshold |
|---------|-------|-----------|------------------------|-------------------|
| Success pattern mining | 88/90 | n>200 outcomes | 80% power for effect size 0.3 | 12-18 months |
| Cross-client benchmarks | 88/90 | n>100 per industry | 95% CI width <10% | 18+ months |
| "73% success rate" claims | 90 | n>385 | 95% CI, 5% margin | 24+ months |
| Outcome prediction | 90 | n>500 | Proper train/test split | 24+ months |
| Time-to-rank estimation | 92 | n>300 | Regression validity | 18+ months |
| ROI projections (actual) | 92 | n>100 | Calibration data | 12+ months |

**V1 Recommendation:** Remove entirely from v1. Add scaffolding for data collection only.

---

## Part 2: Industry Presets - Cold Start Solutions

### The Question

For "E-commerce preset = 30/40/30 BOFU/MOFU/TOFU" - where does this number come from?

### Option Analysis

| Option | Source | Pros | Cons | Intellectual Honesty |
|--------|--------|------|------|---------------------|
| A. Expert Opinion | "Our guess" | Fast, flexible | Unfounded, potentially harmful | LOW |
| B. SEO Research | Published studies | Citable, defensible | May not apply to Lithuanian market | MEDIUM |
| C. Competitor Analysis | Ahrefs/SEMrush defaults | Industry-accepted | Copying, not learning | MEDIUM |
| D. DataForSEO Aggregates | API data | Data-driven | Not industry-specific | MEDIUM-HIGH |
| E. No Presets at v1 | "Default" only | Honest, safe | Worse UX | HIGH |
| F. Configurable Presets | Agency-defined | Flexible, honest | Requires user knowledge | HIGH |

### Recommended Approach: Hybrid F + B

**Implementation:**

1. **Ship with "Suggested" presets from SEO research** (cited)
2. **Allow agencies to define their own presets** (full control)
3. **Label as "Industry Suggestion" not "Our Recommendation"**
4. **Track which presets agencies modify** (passive learning)

### Research Sources for Industry Defaults

| Industry | BOFU/MOFU/TOFU | Source | Confidence |
|----------|----------------|--------|------------|
| E-commerce | 25/45/30 | Backlinko 2024 study | Medium |
| SaaS | 35/40/25 | HubSpot benchmark report | Medium |
| Local Services | 45/35/20 | BrightLocal 2025 survey | High |
| Healthcare (YMYL) | 20/50/30 | Ahrefs case studies | Low |
| B2B | 30/50/20 | Demand Gen Report 2025 | Medium |

**Critical:** These are STARTING POINTS. Mark them as such in the UI.

### UI Implementation

```
Industry Preset: E-commerce
[40%  BOFU] [35%  MOFU] [25%  TOFU]

Info icon: "Based on industry research (Backlinko 2024). 
           Adjust based on your client's specific goals."

[x] Save as agency default for E-commerce
```

---

## Part 3: Learning Features - Statistical Thresholds

### Minimum Sample Sizes by Feature Type

#### A. Pattern Detection ("Keywords with [X] have higher success")

**Statistical requirement:** Binomial proportion confidence interval

| Confidence Level | Margin of Error | Required n |
|-----------------|-----------------|-----------|
| 90% | 10% | 68 |
| 95% | 10% | 97 |
| 95% | 5% | 385 |
| 99% | 5% | 664 |

**For "73% success rate" claim:**
- Need n=385 for 95% CI with 5% margin
- At 10 analyses/month: 38 months
- At 50 analyses/month: 8 months (with outcomes lagging 6 months = 14 months total)

**V1 Recommendation:** Do not show success rates until n>100. Show "Early data" badge until n>385.

---

#### B. Cross-Client Benchmarks ("E-commerce averages 45% BOFU")

**Statistical requirement:** Sample representativeness + central limit theorem

| Criterion | Minimum n | Reasoning |
|-----------|-----------|-----------|
| Central tendency stable | n>30 per segment | CLT applies |
| Outlier-robust | n>50 per segment | Trimmed mean stable |
| Subgroup analysis | n>100 per segment | Stratification viable |
| Production-ready | n>200 per segment | Confidence intervals tight |

**For "E-commerce benchmark":**
- Need 30+ e-commerce clients with completed analyses
- At 20% e-commerce share: need 150+ total clients
- Time estimate: 12-24 months

**V1 Recommendation:** No cross-client benchmarks in v1. Show industry research instead.

---

#### C. Outcome Prediction ("These keywords will rank")

**Statistical requirement:** Proper ML validation

| Criterion | Minimum n | Reasoning |
|-----------|-----------|-----------|
| Train/test split | n>200 | 80/20 split needs 40+ test samples |
| Cross-validation | n>500 | 5-fold needs 100+ per fold |
| Feature significance | n>50 per predictor | Rule of 10 per variable |
| Production deployment | n>1000 | Model stability |

**For "Predict ranking success":**
- Need 500+ keyword outcomes tracked
- 6-month lag for ranking data
- At 100 keywords/month selected: 5 months data + 6 months lag = 11 months minimum
- Add validation time: 14-18 months

**V1 Recommendation:** No predictions. Collect data silently. Ship prediction in v2.

---

#### D. Success Pattern Mining ("Pattern X correlates with success")

**Statistical requirement:** Multiple testing correction

| Analysis Type | Correction Needed | Minimum n per pattern |
|---------------|-------------------|----------------------|
| Single pattern | None | n=30 |
| 10 patterns | Bonferroni (0.005) | n=95 |
| 50 patterns | FDR control | n=150 |
| Automated mining | Strict FDR | n=500 |

**For "Find winning patterns":**
- Testing 50+ keyword attributes
- Need 150+ outcomes minimum
- At 30 outcomes/month (after 6-month lag): 5+ months after first outcomes
- Total: 11+ months from launch

**V1 Recommendation:** No pattern mining. Manual observation only until n>200.

---

### Timeline to Meaningful n

Assuming moderate growth (100 clients by month 12):

```
Month 0-6:   Data collection only (no outcomes yet)
Month 6-12:  First outcomes trickle in (n=30-80)
Month 12-18: Meaningful sample sizes (n=100-200)
Month 18-24: Statistical validity (n=300-500)
Month 24+:   Production ML viable (n>500)
```

**Critical Path:** The 6-month ranking lag is the binding constraint, not customer acquisition.

---

## Part 4: V1 Scope Recommendation

### Features to REMOVE from V1

| Feature | Phase | Reason | Reintroduce When |
|---------|-------|--------|-----------------|
| Success pattern mining | 88/90 | n=0 outcomes | Month 12, n>100 |
| Cross-client benchmarks | 88/90 | n<30 per industry | Month 18, n>50/industry |
| "X% success rate" displays | 90 | Statistically meaningless | Month 24, n>385 |
| Time-to-rank estimation | 92 | No calibration data | Month 18, n>200 |
| ROI projections (actual vs projected) | 92 | No outcome data | Month 12, n>100 |
| Outcome-based keyword scoring | 90 | Requires outcomes | Month 12, n>100 |
| Automated pattern discovery | 88 | Multiple testing risk | Month 18, n>300 |
| Predictive model features | 90 | Insufficient training data | Month 24, n>500 |

---

### Features to MODIFY for V1

| Feature | Original Design | V1 Modification |
|---------|-----------------|-----------------|
| Industry presets | "Learned from data" | "Industry research (cited)" |
| Smart defaults | "Our recommendation" | "Suggested starting point" |
| Benchmarks | "Based on 500 analyses" | "Industry standard (external)" |
| Effort estimates | "Based on our data" | "Industry average (HubSpot)" |
| Success indicators | "73% success rate" | "Common characteristics of successful keywords" (qualitative) |

---

### Features to ADD for V1 (Data Collection Scaffolding)

These features enable future learning without claiming to have learned anything.

| Feature | Purpose | Schema/Implementation |
|---------|---------|----------------------|
| Outcome tracking opt-in | Collect ranking data | `keyword_selection_outcomes` table |
| GSC integration prompt | Automated ranking tracking | OAuth + daily sync job |
| Analysis session logging | Build training dataset | `analysis_audit_log` table |
| Constraint change tracking | Understand user behavior | `constraint_history` table |
| Export tracking | Know which keywords clients pursued | `keyword_exports` table |
| Feedback collection | Supervised labels | `keyword_feedback` table |
| Industry classification | Enable future segmentation | `client_industry` field |

**V1 Must-Have Schema:**

```sql
-- Track what was selected (input to learning)
CREATE TABLE keyword_selection_outcomes (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  client_id UUID NOT NULL,
  keyword TEXT NOT NULL,
  selected_at TIMESTAMPTZ NOT NULL,
  analysis_session_id UUID,
  funnel_stage TEXT,
  relevance_score DECIMAL,
  difficulty INT,
  volume INT,
  
  -- Outcome tracking (populated later)
  ranking_position_30d INT,
  ranking_position_90d INT,
  ranking_position_180d INT,
  ranking_achieved BOOLEAN,
  first_ranked_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track constraint decisions (input to pattern mining)
CREATE TABLE analysis_constraint_history (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL,
  constraint_type TEXT NOT NULL,
  constraint_value JSONB NOT NULL,
  source TEXT NOT NULL, -- 'conversation', 'manual', 'preset'
  confidence DECIMAL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Explicit user feedback (supervised labels)
CREATE TABLE keyword_feedback (
  id UUID PRIMARY KEY,
  keyword_selection_id UUID REFERENCES keyword_selection_outcomes(id),
  feedback_type TEXT NOT NULL, -- 'helpful', 'wrong_funnel', 'irrelevant', 'already_ranking'
  feedback_text TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Part 5: Honest UX for Early Stage

### Principle: Radical Transparency

Users should understand the system's limitations. This builds trust and sets appropriate expectations.

### UX Pattern 1: Sample Size Disclosure

**Bad:**
```
Industry Benchmark: 45% BOFU
```

**Good:**
```
Industry Benchmark: 45% BOFU
Based on: Industry research (Backlinko 2024)
Your data: 3 analyses (building baseline)
```

**Even Better:**
```
Industry Benchmark: 45% BOFU
[i] Based on published research, not our platform data.
    We're collecting data to provide personalized benchmarks.
    Estimated: ~6 months until meaningful comparison.
```

---

### UX Pattern 2: Confidence Badges

| Badge | Meaning | Display When |
|-------|---------|--------------|
| "Experimental" | Feature uses minimal data | n < 30 |
| "Early Data" | Some signal, low confidence | 30 < n < 100 |
| "Building Baseline" | Data collection in progress | n < 50 |
| "Industry Standard" | External research, not our data | Always if external |
| (no badge) | Statistically validated | n > 200 with CI |

**Visual Design:**

```
[Experimental] Success Rate: 71%
               Based on 12 outcomes (low confidence)
               └─ CI: 42% - 92%
```

vs.

```
Success Rate: 73%
Based on 847 outcomes
└─ CI: 70% - 76%
```

---

### UX Pattern 3: Progressive Disclosure

| Data Level | What User Sees |
|------------|----------------|
| n=0 | "No data yet. Run your first analysis!" |
| n=1-9 | "3 analyses completed. Patterns emerging..." |
| n=10-29 | "15 analyses. Early patterns visible (low confidence)" |
| n=30-99 | "52 analyses. Trends forming. [View Early Insights]" |
| n=100-199 | "127 analyses. Insights available. [i] Building confidence" |
| n=200+ | "Full insights available" (no badge) |

---

### UX Pattern 4: Confidence Intervals in Benchmarks

**Never show a point estimate without context.**

| Metric | Display Format |
|--------|---------------|
| Success rate | "73% (95% CI: 68%-78%)" |
| Benchmark | "45% typical (range: 30%-60%)" |
| Prediction | "High likelihood" not "87% chance" |

---

### UX Pattern 5: Honest Comparison

When showing "You vs. Industry":

```
Your Analysis             Industry Research
─────────────────────────────────────────────
BOFU: 38%                 E-commerce avg: 35-45%
                          [Based on Backlinko 2024]

[i] Your data insufficient for personalized benchmark.
    Using industry research as reference.
    After 50+ analyses, we can compare to similar clients.
```

---

## Part 6: Data Collection Strategy

### What to Track NOW

| Data Point | Why | Schema |
|------------|-----|--------|
| Every keyword selected | Training data for models | `keyword_selection_outcomes` |
| Constraints used | Understand user intent | `analysis_constraint_history` |
| Constraint source | Which presets/conversations | `source` field |
| Industry classification | Segment benchmarks | `client_industry` |
| GSC rankings | Outcome variable | `ranking_position_*` |
| Export actions | Which keywords pursued | `keyword_exports` |
| User feedback | Supervised labels | `keyword_feedback` |
| Session duration | UX optimization | `analysis_sessions.duration` |

### Data Collection Timeline

```
Month 0: Deploy tracking schema (v1 launch)
Month 1-6: Collect selection data (no outcomes yet)
Month 3: Prompt for GSC integration (future ranking tracking)
Month 6: First ranking outcomes populate
Month 9: 100+ outcomes available
Month 12: Milestone - enable first learning features
Month 18: Cross-client benchmarks viable
Month 24: Full ML pipeline viable
```

### Opt-In Data Sharing

**Ethical consideration:** Agencies may not want their data aggregated.

**Recommended approach:**

1. **Default:** Per-agency isolation (no cross-client learning)
2. **Opt-in:** "Contribute anonymized data to improve recommendations"
3. **Benefit:** Access to cross-client benchmarks requires contribution
4. **Transparency:** Show what data is shared, with whom

**UI:**

```
Data Sharing Preferences
────────────────────────

[ ] Contribute anonymized analysis patterns
    Help improve recommendations for all users.
    Your client names and specifics are NEVER shared.
    
Benefits of contributing:
- Access to industry benchmarks (when available)
- Priority access to ML-powered features
- Help train better Lithuanian language models
```

### External Data Sources to Integrate

| Source | Data Type | Cost | Priority |
|--------|-----------|------|----------|
| DataForSEO | Volume, difficulty, intent | $0.01/keyword | P0 (already integrated) |
| Google Search Console | Actual rankings | Free (OAuth) | P0 (partially integrated) |
| Published SEO research | Industry benchmarks | Free (manual) | P1 |
| Ahrefs/SEMrush studies | Funnel distributions | Free (public) | P1 |
| BrightLocal surveys | Local SEO patterns | Free (public) | P2 |

---

## Part 7: Dangers of Premature Learning

### 1. Statistical Invalidity

**Problem:** "73% success rate" from n=10 is meaningless.

**Math:** 95% CI for 7/10 successes = 35% to 97%
- Could be 35% success rate
- Could be 97% success rate
- We simply don't know

**Harm:** Agencies make decisions based on fabricated precision.

---

### 2. Survivorship Bias

**Problem:** Only tracked keywords are successful ones.

**Scenario:**
- Agency analyzes 1000 keywords
- Selects 100 for client
- Tracks 20 that ranked
- "Success rate" calculated on survivors only

**Reality:** The 80 that didn't rank aren't tracked because GSC doesn't show position 100+.

**Mitigation:** Track ALL selected keywords, mark "not ranking" explicitly.

---

### 3. Selection Bias

**Problem:** Early adopters are not typical users.

**Early adopters:**
- More sophisticated (self-select into new tool)
- Different client mix (probably tech-forward)
- Higher engagement (willing to learn new system)
- Different industries (early adopters skew tech/SaaS)

**Harm:** Patterns from early adopters may not generalize.

**Mitigation:** Don't generalize until diverse client base (12+ months).

---

### 4. Overfitting

**Problem:** Finding patterns in noise.

**With 10 analyses:**
- Test 50 keyword attributes
- Some will correlate by chance (p < 0.05 = 2.5 false positives expected)
- No validation set possible
- "Pattern" is actually random

**Mitigation:** No automated pattern mining until n>200 with held-out test set.

---

### 5. False Confidence

**Problem:** UI implies authority we don't have.

**Bad UX:**
```
Recommended Keywords (based on advanced machine learning)
[Grid of keywords with confidence scores]
```

**User thinks:** "The AI figured this out"
**Reality:** It's rules + external data + placeholders

**Harm:** Users trust bad recommendations. Client harm. Reputation damage.

**Mitigation:** Honest labeling. "Based on" citations. Confidence badges.

---

### 6. Client Harm

**Problem:** Bad recommendations hurt real businesses.

**Scenario:**
1. System recommends 50 keywords "with 80% success rate"
2. Client invests 6 months of content
3. Nothing ranks (because "80%" was from n=8)
4. Client loses trust, cancels
5. Agency loses client and reputation

**Mitigation:** Never claim predictive accuracy you can't back up.

---

## Part 8: Implementation Roadmap

### V1.0 (Launch)

**Ship:**
- All Category A features (no learning needed)
- Industry presets with citations
- Data collection scaffolding
- Honest UX with badges

**Do NOT ship:**
- Success rates
- Cross-client benchmarks
- Outcome predictions
- Pattern mining

### V1.1 (Month 6)

**Add:**
- "Early Data" insights for agencies with n>30 analyses
- Per-agency patterns (no cross-client)
- GSC integration prompts

**Still hide:**
- Cross-client benchmarks
- Predictive features

### V1.2 (Month 12)

**Add (if thresholds met):**
- Cross-client benchmarks (if n>50/industry)
- Basic outcome tracking display
- "Building baseline" UI

**Evaluate:**
- Are agencies opting in to data sharing?
- Is outcome tracking working?

### V2.0 (Month 18-24)

**Add (if thresholds met):**
- Success pattern mining (n>200)
- Outcome-based scoring (n>500)
- Time-to-rank estimates (n>300)

**Validate:**
- ML models on held-out test set
- Calibration checks
- A/B test against rules-only baseline

---

## Conclusion: Intellectual Honesty Above All

The temptation is to ship features that LOOK like ML/learning but are actually:
- Hard-coded rules
- External data
- Expert guesses

This works short-term but:
1. Erodes trust when users discover the truth
2. Creates technical debt when real learning arrives
3. Potentially harms clients with bad recommendations

**The honest path:**

1. **V1:** Ship excellent deterministic features with honest labeling
2. **Months 1-12:** Collect data, build infrastructure, set expectations
3. **Months 12-24:** Gradually enable learning features as thresholds met
4. **Always:** Show confidence levels, cite sources, avoid false precision

A tool that says "I don't know yet" is more trustworthy than one that confidently lies.

---

## Appendix A: Statistical Formulas

### Sample Size for Proportion (Success Rate)

```
n = (Z^2 * p * (1-p)) / E^2

Where:
  Z = 1.96 (95% confidence)
  p = expected proportion (use 0.5 if unknown)
  E = margin of error

For 5% margin at 95% confidence:
  n = (1.96^2 * 0.5 * 0.5) / 0.05^2 = 385
```

### Confidence Interval for Proportion

```
CI = p +/- Z * sqrt(p(1-p)/n)

Example: 73% success from n=100
  CI = 0.73 +/- 1.96 * sqrt(0.73*0.27/100)
  CI = 0.73 +/- 0.087
  CI = 64% to 82%
```

### Effect Size Detection (Power Analysis)

```
n = 2 * ((Z_alpha + Z_beta) / d)^2

Where:
  Z_alpha = 1.96 (95% significance)
  Z_beta = 0.84 (80% power)
  d = effect size (Cohen's d)

For medium effect (d=0.5) at 80% power:
  n = 2 * ((1.96 + 0.84) / 0.5)^2 = 63 per group
```

---

## Appendix B: Research Citations for Industry Defaults

| Preset | Source | URL | Date | Confidence |
|--------|--------|-----|------|------------|
| E-commerce funnel | Backlinko | backlinko.com/ecommerce-seo | 2024 | Medium |
| SaaS funnel | HubSpot | hubspot.com/saas-marketing-benchmark | 2025 | Medium |
| Local services | BrightLocal | brightlocal.com/research | 2025 | High |
| B2B funnel | Demand Gen Report | demandgenreport.com/benchmark | 2025 | Medium |
| Healthcare | Ahrefs | ahrefs.com/blog/ymyl-seo | 2024 | Low |

**Note:** These should be verified and updated annually.

---

## Appendix C: Feature Gating Implementation

```typescript
// Feature gating based on data thresholds
interface FeatureGate {
  feature: string;
  minSampleSize: number;
  scope: 'agency' | 'industry' | 'global';
  confidenceLevel: number;
}

const FEATURE_GATES: FeatureGate[] = [
  { feature: 'success_rate_display', minSampleSize: 100, scope: 'agency', confidenceLevel: 0.90 },
  { feature: 'industry_benchmark', minSampleSize: 50, scope: 'industry', confidenceLevel: 0.95 },
  { feature: 'pattern_mining', minSampleSize: 200, scope: 'agency', confidenceLevel: 0.95 },
  { feature: 'outcome_prediction', minSampleSize: 500, scope: 'global', confidenceLevel: 0.99 },
  { feature: 'time_to_rank', minSampleSize: 300, scope: 'global', confidenceLevel: 0.95 },
];

function isFeatureEnabled(
  feature: string, 
  scope: string, 
  scopeId: string
): { enabled: boolean; reason: string; currentN: number; requiredN: number } {
  const gate = FEATURE_GATES.find(g => g.feature === feature);
  if (!gate) return { enabled: true, reason: 'No gate defined', currentN: 0, requiredN: 0 };
  
  const currentN = getDataCount(gate.scope, scopeId);
  const enabled = currentN >= gate.minSampleSize;
  
  return {
    enabled,
    reason: enabled 
      ? `Sufficient data (n=${currentN})` 
      : `Insufficient data (n=${currentN}/${gate.minSampleSize})`,
    currentN,
    requiredN: gate.minSampleSize
  };
}
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-05 | Analysis | Initial cold start analysis |
