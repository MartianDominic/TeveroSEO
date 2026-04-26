# User Focus: Business Priority Integration

> **Status:** Research Complete  
> **Last Updated:** 2026-04-26  
> **Focus Weight:** 40% of final keyword score

---

## Problem Statement

Incorporate business priorities ("this quarter we're focusing on professional hair coloring") into keyword scoring so that:
- Relevant keywords are boosted to the top
- Irrelevant/competitor keywords are suppressed
- Changes are temporary (quarterly) or permanent
- Decisions are transparent and explainable

---

## Solution: Layered Focus + Weighted Scoring

### 1. Focus Extraction (NLU)

Convert natural language input into structured directives:

```python
FOCUS_EXTRACTION_PROMPT = """
Extract structured focus directives from the user's natural language input.

## Output Schema
{
  "focusCategories": string[],       # Product categories to prioritize
  "focusAttributes": string[],       # Descriptive terms ("professional", "organic")
  "priorityBrands": string[],        # Specific brands to boost
  "excludeAttributes": string[],     # Terms to suppress ("home", "DIY")
  "excludeBrands": string[],         # Competitor brands to filter out
  "intentFilter": "commercial" | "informational" | "transactional" | "all",
  "temporality": "quarterly" | "permanent" | "seasonal",
  "volumePreference": "high" | "low" | "balanced",
  "confidenceNote": string           # Parsing confidence note
}

## Example

INPUT: "This quarter we're focusing on professional hair coloring products. 
We just got L'Oreal Professionnel as a new brand and want to rank for it. 
Ignore home care products for now."

OUTPUT:
{
  "focusCategories": ["Hair Coloring", "Hair Dyes", "Color Treatment"],
  "focusAttributes": ["professional", "salon", "profesionalūs"],
  "priorityBrands": ["L'Oreal Professionnel"],
  "excludeAttributes": ["home", "namams", "DIY", "namuose"],
  "excludeBrands": [],
  "intentFilter": "commercial",
  "temporality": "quarterly",
  "volumePreference": "balanced",
  "confidenceNote": "Clear quarterly focus on professional coloring with new brand priority"
}
"""
```

---

## 2. Focus Data Structures

```python
from dataclasses import dataclass
from enum import Enum
from datetime import date

@dataclass
class FocusDirective:
    focus_categories: list[str]
    focus_attributes: list[str]
    priority_brands: list[str]
    exclude_attributes: list[str]
    exclude_brands: list[str]
    intent_filter: str  # "commercial" | "informational" | "transactional" | "all"
    temporality: str    # "quarterly" | "permanent" | "seasonal"
    volume_preference: str  # "high" | "low" | "balanced"
    confidence_note: str

@dataclass
class LayeredFocus:
    """Combines multiple focus layers."""
    permanent: FocusDirective | None      # Always-on priorities
    temporary: FocusDirective | None      # Quarterly/seasonal overrides
    negative: NegativeFocus | None        # Always-exclude rules
    effective_from: date
    effective_until: date | None          # None = permanent

@dataclass
class NegativeFocus:
    """Permanent exclusions."""
    never_show_brands: list[str]
    never_show_categories: list[str]
    never_show_keywords_containing: list[str]
```

---

## 3. Focus Propagation Algorithm

```python
@dataclass
class KeywordFocusWeight:
    keyword_id: str
    keyword: str
    
    # Component scores (0.0 - 1.0)
    category_alignment: float     # Does keyword match focus categories?
    attribute_alignment: float    # Does keyword contain focus attributes?
    brand_alignment: float        # Does keyword mention priority brands?
    
    # Penalties (-1.0 to 0.0)
    exclude_penalty: float        # Penalty for excluded attributes/brands
    
    # Final focus score
    focus_score: float            # Composite score after all adjustments
    
    # Explanation for transparency
    reasons: list[FocusReason]

class FocusPropagator:
    """Computes focus alignment scores for keywords."""
    
    def __init__(
        self,
        focus: LayeredFocus,
        category_graph: dict[str, list[str]],  # parent -> children
        product_graph: dict[str, list[str]]    # category -> products
    ):
        self.focus = focus
        self.category_graph = category_graph
        self.product_graph = product_graph
    
    def compute_focus_weight(
        self,
        keyword: str,
        keyword_category: str | None,
        keyword_brand: str | None
    ) -> KeywordFocusWeight:
        reasons = []
        keyword_lower = keyword.lower()
        
        # Get effective focus (temporary overrides permanent)
        effective = self._get_effective_focus()
        
        # 1. Category alignment (0.0 - 1.0)
        category_alignment = 0.0
        if keyword_category:
            match = self._find_category_match(keyword_category, effective.focus_categories)
            if match["is_direct"]:
                category_alignment = 1.0
                reasons.append(FocusReason(
                    type="boost",
                    source="category",
                    detail=f"Direct match: {keyword_category}",
                    weight=1.0
                ))
            elif match["is_subcategory"]:
                category_alignment = 0.7
                reasons.append(FocusReason(
                    type="boost",
                    source="category",
                    detail=f"Subcategory of {match['parent']}",
                    weight=0.7
                ))
        
        # 2. Attribute alignment (0.0 - 1.0)
        attribute_alignment = 0.0
        matched_attrs = [
            attr for attr in effective.focus_attributes
            if attr.lower() in keyword_lower
        ]
        if matched_attrs:
            attribute_alignment = min(1.0, len(matched_attrs) * 0.4)
            reasons.append(FocusReason(
                type="boost",
                source="attribute",
                detail=f"Contains: {', '.join(matched_attrs)}",
                weight=attribute_alignment
            ))
        
        # 3. Brand alignment (0.0 - 1.0)
        brand_alignment = 0.0
        matched_brand = next(
            (b for b in effective.priority_brands if b.lower() in keyword_lower),
            None
        )
        if matched_brand:
            brand_alignment = 1.0
            reasons.append(FocusReason(
                type="boost",
                source="brand",
                detail=f"Priority brand: {matched_brand}",
                weight=1.0
            ))
        
        # 4. Exclude penalty (-1.0 to 0.0)
        exclude_penalty = 0.0
        
        excluded_attr = next(
            (a for a in effective.exclude_attributes if a.lower() in keyword_lower),
            None
        )
        if excluded_attr:
            exclude_penalty = -1.0
            reasons.append(FocusReason(
                type="suppress",
                source="exclude",
                detail=f"Excluded attribute: {excluded_attr}",
                weight=-1.0
            ))
        
        excluded_brand = next(
            (b for b in effective.exclude_brands if b.lower() in keyword_lower),
            None
        )
        if excluded_brand:
            exclude_penalty = -1.0
            reasons.append(FocusReason(
                type="suppress",
                source="exclude",
                detail=f"Excluded brand: {excluded_brand}",
                weight=-1.0
            ))
        
        # 5. Compute final focus score
        weights = {"category": 0.35, "attribute": 0.25, "brand": 0.40}
        
        focus_score = (
            category_alignment * weights["category"] +
            attribute_alignment * weights["attribute"] +
            brand_alignment * weights["brand"]
        )
        
        # Apply exclusion penalty (hard suppress)
        if exclude_penalty < 0:
            focus_score = exclude_penalty
        
        # Neutral keywords get small positive score
        if not reasons:
            focus_score = 0.1
            reasons.append(FocusReason(
                type="neutral",
                source="category",
                detail="No specific focus alignment",
                weight=0.1
            ))
        
        return KeywordFocusWeight(
            keyword_id=hash(keyword),
            keyword=keyword,
            category_alignment=category_alignment,
            attribute_alignment=attribute_alignment,
            brand_alignment=brand_alignment,
            exclude_penalty=exclude_penalty,
            focus_score=focus_score,
            reasons=reasons
        )
```

---

## 4. Composite Scoring Formula

```python
class KeywordScorer:
    """Computes final scores combining all factors."""
    
    # Focus has highest weight - drives business decisions
    weights = {
        "relevance": 0.25,      # Does it match our products?
        "volume": 0.20,         # Search volume importance
        "competition": 0.15,    # Achievability (inverse)
        "focus": 0.40           # Business priority alignment (HIGHEST)
    }
    
    def score_keyword(
        self,
        keyword: RawKeyword,
        focus_weight: KeywordFocusWeight,
        focus_directive: FocusDirective
    ) -> ScoredKeyword:
        # 1. Relevance score (classification-based)
        relevance_scores = {
            "RELEVANT": 1.0,
            "TANGENTIAL": 0.6,
            "IRRELEVANT": 0.1,
            "COMPETITOR": 0.0
        }
        relevance_score = relevance_scores[keyword.classification]
        
        # 2. Volume score (log-normalized, preference-adjusted)
        volume_score = self._compute_volume_score(
            keyword.search_volume,
            focus_directive.volume_preference
        )
        
        # 3. Competition score (inverse - easier = higher)
        competition_score = 1 - keyword.competition
        
        # 4. Focus score (from propagator)
        focus_score = focus_weight.focus_score
        
        # 5. Composite score
        if focus_score < 0:
            # Hard suppressed keywords get negative composite
            composite_score = focus_score
        else:
            composite_score = (
                relevance_score * self.weights["relevance"] +
                volume_score * self.weights["volume"] +
                competition_score * self.weights["competition"] +
                focus_score * self.weights["focus"]
            )
        
        return ScoredKeyword(
            keyword=keyword.keyword,
            search_volume=keyword.search_volume,
            composite_score=composite_score,
            focus_score=focus_score,
            focus_reasons=focus_weight.reasons,
            action=self._determine_action(keyword, composite_score)
        )
    
    def _compute_volume_score(
        self,
        volume: int,
        preference: str
    ) -> float:
        # Normalize to 0-1 using log scale
        import math
        normalized = math.log10(max(volume, 1)) / math.log10(10000)
        clamped = min(1.0, max(0.0, normalized))
        
        if preference == "high":
            return clamped * clamped  # Exponential for high volume
        elif preference == "low":
            return 1 - (clamped * 0.5)  # Slight preference for long-tail
        else:
            return clamped
```

---

## 5. Explanation Generation

```python
class FocusExplainer:
    """Generates human-readable explanations."""
    
    def explain(self, scored: ScoredKeyword, focus: FocusDirective) -> dict:
        impact = self._determine_impact(scored)
        
        score_breakdown = [
            {"factor": "Relevance", "score": scored.relevance_score, "weight": 0.25},
            {"factor": "Search Volume", "score": scored.volume_score, "weight": 0.20},
            {"factor": "Competition", "score": scored.competition_score, "weight": 0.15},
            {"factor": "Business Focus", "score": scored.focus_score, "weight": 0.40},
        ]
        
        return {
            "keyword": scored.keyword,
            "summary": self._generate_summary(scored, impact),
            "score_breakdown": score_breakdown,
            "focus_impact": impact,  # "boosted" | "suppressed" | "neutral"
            "focus_reasons": [self._format_reason(r) for r in scored.focus_reasons],
            "action_recommendation": self._get_action(scored)
        }
    
    def _format_reason(self, reason: FocusReason) -> str:
        icon = {"boost": "+", "suppress": "-", "neutral": "="}[reason.type]
        return f"[{icon}{abs(reason.weight):.2f}] {reason.detail}"
    
    def _generate_summary(self, scored, impact) -> str:
        score_pct = int(scored.composite_score * 100)
        
        if impact == "suppressed":
            exclude_reason = next(
                (r for r in scored.focus_reasons if r.type == "suppress"),
                None
            )
            return f'"{scored.keyword}" was suppressed ({exclude_reason.detail if exclude_reason else "excluded by focus"})'
        
        if impact == "boosted":
            boost_sources = set(r.source for r in scored.focus_reasons if r.type == "boost")
            return f'"{scored.keyword}" boosted to {score_pct}% by {", ".join(boost_sources)} alignment'
        
        return f'"{scored.keyword}" scored {score_pct}% (no specific focus alignment)'
```

---

## 6. Layered Focus Merging

```python
def get_effective_focus(layered: LayeredFocus) -> FocusDirective:
    """Merge permanent and temporary focus. Temporary takes precedence."""
    perm = layered.permanent
    temp = layered.temporary
    
    if not temp:
        return perm or get_default_focus()
    if not perm:
        return temp
    
    # Merge: temporary overrides permanent for non-empty fields
    return FocusDirective(
        focus_categories=(
            temp.focus_categories if temp.focus_categories else perm.focus_categories
        ),
        focus_attributes=list(set(temp.focus_attributes + perm.focus_attributes)),
        priority_brands=list(set(temp.priority_brands + perm.priority_brands)),
        exclude_attributes=list(set(temp.exclude_attributes + perm.exclude_attributes)),
        exclude_brands=list(set(temp.exclude_brands + perm.exclude_brands)),
        intent_filter=(
            temp.intent_filter if temp.intent_filter != "all" else perm.intent_filter
        ),
        temporality=temp.temporality,
        volume_preference=temp.volume_preference,
        confidence_note=f"Merged: {temp.confidence_note} + {perm.confidence_note}"
    )
```

---

## Test Cases

| Input | Focus Effect | Expected Behavior |
|-------|--------------|-------------------|
| "Focus on professional coloring" | Boost: "profesionalūs", "salon", "color" | Professional color keywords rank higher |
| "Ignore home care" | Suppress: "home", "namams", "DIY" | Home care keywords get negative scores |
| "Prioritize L'Oreal" | Brand boost: L'Oreal keywords +40% | L'Oreal keywords dominate rankings |
| "High volume only" | Volume preference: high | Long-tail keywords deprioritized |

---

## Summary

| Component | Purpose |
|-----------|---------|
| **Focus Extraction** | LLM prompt converts natural language to structured FocusDirective |
| **Layered Focus** | Permanent + temporary + negative layers coexist |
| **Focus Propagation** | Computes category/attribute/brand alignment (0.0-1.0) |
| **Composite Scoring** | 40% focus + 25% relevance + 20% volume + 15% competition |
| **Explanation** | Human-readable reasons for every boost/suppression |

**Key Design Decisions:**
1. **40% focus weight** - Business priorities dominate final ranking
2. **Hard suppression** - Excluded keywords get negative scores, not just zero
3. **Transparency** - Every keyword has `focus_reasons` explaining why
4. **Lithuanian support** - Focus attributes include Lithuanian variants
