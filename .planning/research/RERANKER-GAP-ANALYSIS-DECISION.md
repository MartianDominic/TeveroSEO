# Reranker Decision for Keyword-to-Content Gap Analysis

**Date:** 2026-05-16  
**Context:** Deep analysis of GTE vs BGE rerankers for TeveroSEO's core use case  
**Critical Insight:** We're analyzing SCRAPED PROSPECT CONTENT, not our own content

---

## Table of Contents

1. [The Corrected Mental Model](#1-the-corrected-mental-model)
2. [Why This Changes Everything](#2-why-this-changes-everything)
3. [The Error Asymmetry Problem](#3-the-error-asymmetry-problem)
4. [Value-Weighted Analysis](#4-value-weighted-analysis)
5. [Scale Analysis](#5-scale-analysis)
6. [Routing Layer Decision](#6-routing-layer-decision)
7. [Testing Strategy](#7-testing-strategy)
8. [Final Recommendations](#8-final-recommendations)

---

## 1. The Corrected Mental Model

### What We're Actually Doing

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    KEYWORD-TO-CONTENT GAP ANALYSIS                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  INPUT: Scraped prospect website (1000 pages from THEIR site)               │
│         + Keywords (extracted or target keywords)                           │
│                                                                             │
│  TASK:  For each keyword, rank all 1000 pages by relevance                 │
│         "Which of THEIR pages best covers THIS keyword?"                    │
│                                                                             │
│  OUTPUT: Gap analysis                                                       │
│          - Keywords with strong coverage (top match > 0.8)                 │
│          - Keywords with weak coverage (top match 0.4-0.8)                 │
│          - Keywords with NO coverage (top match < 0.4) ← CONTENT GAPS      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### The Critical Distinction

| What I Initially Assumed | What We're Actually Doing |
|--------------------------|---------------------------|
| Reranking our own content | Reranking SCRAPED PROSPECT content |
| Controlled content types | UNKNOWN content types |
| Predictable content lengths | WILDLY VARIABLE lengths |
| Optimizing for our domain | Building a UNIVERSAL tool |

### Why This Matters

**We have NO CONTROL over the content we're analyzing.**

The reranker must work for:
- Hair salon with 30 product pages (short content)
- Law firm with 500 legal articles (long, dense content)
- E-commerce store with 5000 product listings (short)
- Media company with 1000 long-form articles (long)
- SaaS company with mixed blog and docs (variable)

**We must build a UNIVERSAL tool that handles ALL prospect content types.**

---

## 2. Why This Changes Everything

### The Variance Problem

| Prospect Type | Typical Content | Token Ranges |
|---------------|-----------------|--------------|
| Small e-commerce | Product listings, thin descriptions | 50-300 tokens |
| Medium business | Service pages, some blog content | 200-1500 tokens |
| Content-heavy site | Blog posts, guides, resources | 500-5000 tokens |
| Legal/Financial | Dense technical content | 2000-10000+ tokens |
| News/Media | Long-form articles | 1500-8000 tokens |
| SaaS/Tech | Documentation, tutorials | 1000-6000 tokens |

### We Can't Assume Content Distribution

**Previous assumption (WRONG):**
- "Most content is short e-commerce descriptions"
- "p_long ≈ 10%"
- "BGE's short-content strength is more valuable"

**Corrected understanding:**
- Content distribution is UNKNOWN per prospect
- Some prospects have 90% long content
- Others have 90% short content
- We must handle ALL scenarios robustly

### The Benchmark Transfer Question

| Benchmark | What It Measures | Relevance to Gap Analysis |
|-----------|------------------|---------------------------|
| MIRACL | Short query → paragraph retrieval | **Moderate** - similar query length |
| BEIR | Mixed retrieval tasks | **Moderate** - diverse content |
| MLDR | Long document retrieval (10K+ tokens) | **HIGH** - pillar content matching |

**Gap analysis is closer to MLDR than MIRACL** because:
- Query (keyword) is SHORT (2-10 tokens)
- Documents (scraped pages) are VARIABLE (50-10000+ tokens)
- The DOCUMENTS are the variable/long part

---

## 3. The Error Asymmetry Problem

### Two Types of Errors

**Error Type A: Missing Long-Form Content (BGE's Weakness)**

```
Scenario: Prospect has a 4000-word comprehensive guide on "SEO for e-commerce"
Keyword:  "SEO strategija e-parduotuvėms" (SEO strategy for e-shops)

BGE behavior (truncates/degrades on long content):
  → Ranks the guide at position 15 instead of position 1
  → Gap analysis output: "No strong content on this keyword"
  → Our recommendation: "Create pillar content on e-commerce SEO"
  
Client reaction: "I already HAVE a 4000-word guide on this! 
                  Did you even look at my site?"

CONSEQUENCE: 
  - Embarrassing
  - Undermines trust
  - Looks incompetent
  - Client questions entire analysis
```

**Error Type B: Slight Inaccuracy on Short Content (GTE's Weakness)**

```
Scenario: Prospect has a product page with 200-word description
Keyword:  "plaukų dažai profesionalams" (hair dye for professionals)

GTE behavior (slightly weaker on short multilingual):
  → Ranks product page at position 3 instead of position 2
  → Or scores at 0.72 instead of 0.78
  
Gap analysis output: "Moderate coverage, could strengthen"
Our recommendation: "Consider expanding product descriptions"

Client reaction: "Okay, that seems like reasonable feedback"

CONSEQUENCE:
  - Minor inaccuracy
  - Recommendation is still reasonable
  - Client doesn't notice the error
```

### The Asymmetry is Severe

| Error Type | Severity | Impact | Acceptable? |
|------------|----------|--------|-------------|
| Miss pillar content (BGE) | **CATASTROPHIC** | Wrong recommendations, lost trust | **NO** |
| Slightly off on short (GTE) | Minor | Marginal calibration difference | Yes |

### Quantified from Benchmarks

| Model | Long-Context Degradation | Short-Content Degradation |
|-------|-------------------------|---------------------------|
| BGE | **-11.9 nDCG** (MLDR vs baseline) | 0 (baseline) |
| GTE | 0 (baseline) | **-0.82 nDCG** (MIRACL vs BGE) |

**BGE's failure mode is 14.5x worse than GTE's failure mode.**

---

## 4. Value-Weighted Analysis

### Not All Content Is Equal

For keyword-to-content gap analysis, long-form content is disproportionately valuable:

| Content Type | % of Pages | % of VALUE for Analysis |
|--------------|------------|------------------------|
| Short product/service pages | 60% | 30% |
| Medium descriptions/blogs | 25% | 30% |
| **Long-form pillar content** | **15%** | **40%** |

**Why long content is more valuable:**
1. It's where prospects invested in SEO intentionally
2. It targets competitive, valuable keywords
3. Missing it = recommending they create what exists
4. It's the difference between "insightful" and "didn't read my site"

### Original Expected Value (WRONG)

```
Assumed p_long = 10% (page-count weighted)

EV(routing) = 0.10 × 11.9 - 0.90 × 0.82 - cost_routing
            = 1.19 - 0.74 - cost_routing
            = 0.45 nDCG points - cost_routing

Conclusion: Marginal gain, not worth routing complexity
```

### Corrected Expected Value (VALUE-WEIGHTED)

```
Value-weighted p_long = 40% (importance weighted)

EV(routing) = 0.40 × 11.9 - 0.60 × 0.82 - cost_routing
            = 4.76 - 0.49 - cost_routing
            = 4.27 nDCG points - cost_routing

Conclusion: SIGNIFICANT gain, routing may be worth it
```

### Single-Model Comparison (No Routing)

If we must pick ONE model, which loses less?

**GTE as single model:**
```
Expected loss = 0.60 × 0.82 = -0.49 nDCG from optimal
```

**BGE as single model:**
```
Expected loss = 0.40 × 11.9 = -4.76 nDCG from optimal
```

**GTE loses 9.7x less than BGE when handling all content types.**

---

## 5. Scale Analysis

### 100 Prospects/Hour × 1000 Pages

#### Throughput Math

```
100 prospects/hour × 1000 pages = 100,000 pages/hour

Reranking pairs (assuming 20 keywords × 50 candidates):
= 100 prospects × 20 keywords × 50 candidates
= 100,000 reranking pairs/hour
= 28 pairs/second
```

#### Model Capacity

| Model | Throughput | Utilization at 28/sec |
|-------|------------|----------------------|
| BGE | 625 pairs/sec | 4.5% |
| GTE | 1000 pairs/sec | 2.8% |

**Both models have 20x+ capacity headroom. Throughput is NOT a constraint.**

#### What Actually Matters at This Scale

If 15% of 100,000 pages are long-form = 15,000 long pages/hour

**BGE scenario (10% miss rate on long content):**
- 1,500 pillar pages incorrectly ranked per hour
- Across 100 prospects = 15 wrong recommendations per prospect
- 15 instances of "you missed my content" per prospect

**GTE scenario (5% slight inaccuracy on short):**
- 3,000 minor ranking variations per hour
- Across 100 prospects = 30 marginal differences per prospect
- Differences are within noise, not noticeable

**Catastrophic failures compound faster than minor inaccuracies.**

#### Scale Recommendation

At 100 prospects/hour × 1000 pages:
- **Quality per decision matters** (100× amplification)
- **Pillar content errors are unacceptable** (visible to clients)
- **GTE's robustness is more valuable** than BGE's slight edge on short

### 10 Prospects/Hour × 30 Pages

#### What 30-Page Sites Look Like

| Site Type | Typical Composition |
|-----------|---------------------|
| Small local business | 20 service pages + 5 blogs + 5 info pages |
| New startup | 10 product pages + 15 docs + 5 blogs |
| Professional service | 10 service pages + 10 case studies + 10 resources |

Even 30-page sites can have 3-5 pillar pages (10-15% long content).

#### The Math Still Applies

If a 30-page site has 5 pillar pages:
- BGE misses 1 (10% miss rate) = client notices
- GTE slightly off on 15 short pages = client doesn't notice

**Error asymmetry applies regardless of scale.**

#### Scale Recommendation

At 10 prospects/hour × 30 pages:
- **Each prospect matters more** (10× concentration)
- **Even 3-5 pillar pages matter** for gap analysis
- **Same principle applies**: Robustness > average performance

---

## 6. Routing Layer Decision

### When Routing Makes Sense

Routing (using BGE for short, GTE for long) is valuable when:
1. **Clear specialization exists** (confirmed by testing)
2. **Value-weighted gain > complexity cost**
3. **Operational capacity allows** two models

### Expected Value of Routing

```
With value-weighted p_long = 40%:

EV(routing) = p_long × Δ_GTE_advantage + p_short × Δ_BGE_advantage - cost
            = 0.40 × 11.9 + 0.60 × 0.82 - cost
            = 4.76 + 0.49 - cost
            = 5.25 nDCG - cost

vs. GTE-only:
EV(GTE) = 0.40 × 11.9 + 0.60 × 0 = 4.76 nDCG

vs. BGE-only:
EV(BGE) = 0.40 × 0 + 0.60 × 0.82 = 0.49 nDCG

Routing gain over GTE-only: +0.49 nDCG
Routing gain over BGE-only: +4.76 nDCG
```

**Routing gains only 0.49 nDCG over GTE-only, but gains 4.76 over BGE-only.**

### Routing Implementation

```python
def smart_rerank(query: str, documents: List[Document]) -> List[RankedResult]:
    """
    Route based on document length distribution.
    Prioritize not missing long-form content.
    """
    lengths = [len(tokenize(d.content)) for d in documents]
    max_length = max(lengths)
    avg_length = mean(lengths)
    
    # If ANY document is long, use GTE (can't afford to miss it)
    if max_length > 2000:
        return gte_model.rerank(query, documents)
    
    # If content is uniformly short, BGE is marginally better
    if avg_length < 500 and max_length < 1000:
        return bge_model.rerank(query, documents)
    
    # Mixed or uncertain: default to GTE for robustness
    return gte_model.rerank(query, documents)
```

### Routing Costs

| Cost | Impact |
|------|--------|
| Memory | +3.4GB (both models loaded) |
| Complexity | Two codepaths, two test suites |
| Token counting | ~1-5ms overhead per batch |
| Debugging | "Which model caused this bug?" |
| Model updates | Two upgrade cycles |

### Routing Recommendation

**Routing is NOT recommended initially.**

Rationale:
1. **Gain over GTE-only is small** (+0.49 nDCG)
2. **Complexity cost is real**
3. **We lack Lithuanian validation data**
4. **GTE-only provides robustness** with acceptable short-content tradeoff

**Revisit routing if:**
- Testing shows BGE is significantly better on Lithuanian short content (> 5% difference)
- Memory constraints are resolved
- Operational maturity allows two-model complexity

---

## 7. Testing Strategy

### Why Testing is Essential

We're making decisions based on:
- BEIR, MIRACL, MLDR benchmarks (not Lithuanian)
- Assumptions about content distribution
- Theoretical error asymmetry

**Without Lithuanian-specific testing, we're guessing.**

### The Right Metrics

**DON'T measure:** Overall nDCG (hides error distribution)

**DO measure:** `missed_pillar` rate (the catastrophic failure mode)

```python
def evaluate_for_gap_analysis(model, test_set):
    """
    Evaluate what actually matters: Can we find pillar content?
    """
    results = {
        "found_pillar": 0,      # Correctly ranked long-form content
        "missed_pillar": 0,     # CRITICAL: Failed to find pillar content
        "short_accuracy": [],   # Rank correlation on short content
        "overall_ndcg": []      # For completeness
    }
    
    for keyword, pages, human_labels in test_set:
        model_ranking = model.rerank(keyword, pages)
        
        # CRITICAL TEST: Pillar content detection
        pillar_pages = [p for p in pages if p.word_count > 2000]
        
        for pillar in pillar_pages:
            human_rank = human_labels[pillar.id]  # Human says "this is rank X"
            model_rank = get_rank(model_ranking, pillar.id)
            
            # If human says top-3, model should find it in top-5
            if human_rank <= 3:
                if model_rank <= 5:
                    results["found_pillar"] += 1
                else:
                    results["missed_pillar"] += 1  # CRITICAL FAILURE
        
        # Secondary: Short content accuracy
        short_pages = [p for p in pages if p.word_count < 500]
        short_correlation = spearman_correlation(
            [human_labels[p.id] for p in short_pages],
            [get_rank(model_ranking, p.id) for p in short_pages]
        )
        results["short_accuracy"].append(short_correlation)
    
    # Compute rates
    total_pillars = results["found_pillar"] + results["missed_pillar"]
    results["pillar_miss_rate"] = results["missed_pillar"] / total_pillars
    results["short_accuracy_mean"] = mean(results["short_accuracy"])
    
    return results
```

### Test Set Construction

**Required:**
- 50 real keywords from prospect extractions
- 100 pages per keyword from scraped prospect data
- Stratified by content length:
  - 30% short (< 500 tokens)
  - 40% medium (500-2000 tokens)
  - 30% long (> 2000 tokens)
- Human labels for top-5 relevant pages per keyword
- Lithuanian speaker for labeling

**Effort estimate:** 8-16 hours for labeling

### Decision Rules from Testing

| Test Result | Decision |
|-------------|----------|
| BGE `pillar_miss_rate` > 10% | **Switch to GTE immediately** |
| BGE `pillar_miss_rate` < 5% | Keep BGE (MLDR benchmark didn't transfer) |
| GTE `short_accuracy` < BGE by > 5% | Consider routing |
| Both similar on all metrics | Keep BGE for stability |
| GTE wins both metrics | Switch to GTE |

---

## 8. Final Recommendations

### Summary Table

| Question | Answer |
|----------|--------|
| **Is BGE still best?** | **Uncertain** - error asymmetry favors GTE for gap analysis |
| **Should we add routing?** | **Not initially** - complexity outweighs 0.49 nDCG gain over GTE |
| **What matters at 100/hr × 1000?** | **Not missing pillar content** - GTE's robustness wins |
| **What matters at 10/hr × 30?** | **Same principle** - even 3-5 pillar pages matter |
| **How to test?** | **Measure `pillar_miss_rate`**, not overall nDCG |

### The World-Class Decision Framework

**Principle: Optimize for the worst acceptable outcome, not the average outcome.**

For a universal tool analyzing unknown external content:
- **Robustness > Average performance**
- **Catastrophic failure prevention > Marginal accuracy gains**
- **Missing pillar content = unacceptable**
- **Slight short-content inaccuracy = acceptable**

### Action Plan

#### Immediate (Before Testing)

**Option A: Stay on BGE (Conservative)**
- Lower risk, known behavior
- Accept theoretical pillar miss risk
- Revisit after testing

**Option B: Switch to GTE (Recommended)**
- Better worst-case behavior
- Smaller memory footprint (1.8GB savings)
- Slightly faster inference (~37%)
- Accept slight short-content degradation

#### With Testing (Required for Certainty)

1. **Build Lithuanian test set** (8-16 hours)
   - 50 keywords from real prospect data
   - 100 pages per keyword, stratified by length
   - Human labels for top-5 relevance

2. **Run parallel evaluation**
   - Measure `pillar_miss_rate` for both models
   - Measure `short_accuracy` for both models
   - Stratify results by content length

3. **Apply decision rules**
   - See decision matrix above

4. **Document findings**
   - Update this document with empirical results
   - Make final model selection

### Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| BGE misses pillar content | **High** (per MLDR) | **Critical** | Test or switch to GTE |
| GTE degrades on Lithuanian | Medium | Moderate | Test before full switch |
| Routing complexity | Low | Low | Avoid routing initially |
| Testing takes too long | Medium | Delays decision | Start with 20 keywords |

### Final Verdict

**Without testing:** Switch to GTE (better worst-case, error asymmetry favors it)

**With testing:** Follow decision rules based on `pillar_miss_rate`

**Routing:** Not worth complexity for 0.49 nDCG gain; GTE-only is robust enough

---

## Appendix: Key Insights

### Insight 1: We're Analyzing External Content

The reranker must handle ANY prospect's content, not just our content. This shifts the optimization target from "best average" to "most robust."

### Insight 2: Error Asymmetry is Severe

- BGE's worst case: -11.9 nDCG (missing pillar content)
- GTE's worst case: -0.82 nDCG (slight short-content inaccuracy)
- **BGE's failure is 14.5x worse**

### Insight 3: Value Weighting Changes the Math

- Page-count weighted: 15% long content → routing gains 0.45 nDCG
- Value-weighted: 40% importance → routing gains 4.27 nDCG
- **How we weight changes the optimal decision**

### Insight 4: Catastrophic Failures Compound

At scale:
- 100 prospects × 10% miss rate × 15 pillar pages = 150 visible errors/hour
- Errors that clients NOTICE and REMEMBER
- Undermines trust in entire analysis

### Insight 5: Throughput is Irrelevant

Both models have 20x+ capacity headroom. Neither throughput nor latency constrains the decision. **Quality and robustness are all that matter.**

---

## Related Documents

- [GTE vs BGE Reranker Analysis](./GTE-VS-BGE-RERANKER-ANALYSIS.md) - Initial comparison
- [Jina Keyword Matching Analysis](./JINA-KEYWORD-MATCHING-ANALYSIS.md) - Embedding model analysis
- [Keyword Intelligence System](../.planning/keyword-intelligence/AI-KEYWORD-INTELLIGENCE-SYSTEM.md) - Pipeline architecture
- [Cost Optimization Masterplan](../.planning/phases/92-on-page-seo-mastery/COST-OPTIMIZATION-MASTERPLAN.md) - Cost constraints

---

*Document created 2026-05-16 based on deep analysis of keyword-to-content gap analysis requirements*
