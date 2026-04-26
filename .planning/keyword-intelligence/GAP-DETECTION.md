# Gap Detection: Finding Category Opportunities

> **Status:** Research Complete  
> **Last Updated:** 2026-04-26  
> **Expected Output:** Actionable recommendations for new categories

---

## Problem Statement

Detect when popular keywords exist but no matching category exists, then:
- Cluster related keywords into potential categories
- Name the category intelligently (LLM refinement)
- Prioritize by volume and opportunity
- Distinguish between "create new category" vs "categorize existing products"

---

## Solution: Clustering + LLM Refinement

### 1. Gap Classification

```python
from enum import Enum

class GapType(Enum):
    TRUE_GAP = "true_gap"           # No category, no products → opportunity
    WEAK_COVERAGE = "weak"          # Category exists but weak match
    SUBCATEGORY_NEEDED = "subcat"   # Fits under existing category as child
    CATEGORIZE_EXISTING = "existing" # Products exist but need category page

# Confidence thresholds
GAP_THRESHOLDS = {
    "true_gap": 0.3,      # < 0.3 = no good match
    "weak": 0.7,          # 0.3-0.7 = weak match
    "subcategory": 0.7    # > 0.7 = good match, might be subcategory
}
```

### 2. Gap Detection Algorithm

```python
from dataclasses import dataclass

@dataclass
class KeywordGap:
    keyword: str
    search_volume: int
    best_category_match: str | None
    match_score: float
    gap_type: GapType
    suggested_action: str
    related_products: list[str]  # Products that could fit this keyword

@dataclass 
class GapCluster:
    keywords: list[KeywordGap]
    total_volume: int
    suggested_category_name: str
    gap_type: GapType
    priority: str  # "HIGH" | "MEDIUM" | "LOW"
    action: str    # "CREATE_CATEGORY" | "CREATE_SUBCATEGORY" | "ORGANIZE_PRODUCTS"

def detect_gaps(
    keywords: list[dict],
    category_matches: dict[str, float],  # keyword -> best match score
    product_matches: dict[str, list[str]]  # keyword -> matching products
) -> list[KeywordGap]:
    """Identify keywords that represent category gaps."""
    gaps = []
    
    for kw in keywords:
        keyword = kw["keyword"]
        volume = kw["search_volume"]
        best_score = category_matches.get(keyword, 0.0)
        products = product_matches.get(keyword, [])
        
        # Determine gap type
        if best_score < GAP_THRESHOLDS["true_gap"]:
            if products:
                gap_type = GapType.CATEGORIZE_EXISTING
                action = f"Create category page for {len(products)} existing products"
            else:
                gap_type = GapType.TRUE_GAP
                action = "Create new category + source products"
        
        elif best_score < GAP_THRESHOLDS["weak"]:
            gap_type = GapType.WEAK_COVERAGE
            action = "Strengthen existing category or create subcategory"
        
        else:
            gap_type = GapType.SUBCATEGORY_NEEDED
            action = "Consider as subcategory of existing category"
        
        gaps.append(KeywordGap(
            keyword=keyword,
            search_volume=volume,
            best_category_match=None,  # Filled by matcher
            match_score=best_score,
            gap_type=gap_type,
            suggested_action=action,
            related_products=products
        ))
    
    return gaps
```

---

## 3. Clustering with HDBSCAN

```python
import numpy as np
from hdbscan import HDBSCAN
from sentence_transformers import SentenceTransformer

class GapClusterer:
    """Clusters gap keywords into potential categories."""
    
    def __init__(self, embedding_model: str = "paraphrase-multilingual-MiniLM-L12-v2"):
        self.embedder = SentenceTransformer(embedding_model)
        self.clusterer = HDBSCAN(
            min_cluster_size=3,
            min_samples=2,
            metric="cosine",
            cluster_selection_method="leaf"
        )
    
    def cluster_gaps(self, gaps: list[KeywordGap]) -> list[GapCluster]:
        """Group related gap keywords into clusters."""
        if len(gaps) < 3:
            # Not enough for clustering, return as individual opportunities
            return [self._single_gap_cluster(g) for g in gaps]
        
        # Embed keywords
        keywords = [g.keyword for g in gaps]
        embeddings = self.embedder.encode(keywords)
        
        # Cluster
        labels = self.clusterer.fit_predict(embeddings)
        
        # Group by cluster
        clusters = {}
        for gap, label in zip(gaps, labels):
            if label == -1:
                # Noise point - standalone opportunity
                continue
            if label not in clusters:
                clusters[label] = []
            clusters[label].append(gap)
        
        # Convert to GapCluster objects
        result = []
        for label, cluster_gaps in clusters.items():
            result.append(self._create_cluster(cluster_gaps))
        
        # Add noise points as individual opportunities if high volume
        for gap, label in zip(gaps, labels):
            if label == -1 and gap.search_volume >= 500:
                result.append(self._single_gap_cluster(gap))
        
        return sorted(result, key=lambda c: -c.total_volume)
    
    def _create_cluster(self, gaps: list[KeywordGap]) -> GapCluster:
        total_volume = sum(g.search_volume for g in gaps)
        
        # Determine dominant gap type
        gap_types = [g.gap_type for g in gaps]
        if GapType.TRUE_GAP in gap_types:
            gap_type = GapType.TRUE_GAP
            action = "CREATE_CATEGORY"
        elif GapType.CATEGORIZE_EXISTING in gap_types:
            gap_type = GapType.CATEGORIZE_EXISTING
            action = "ORGANIZE_PRODUCTS"
        else:
            gap_type = GapType.SUBCATEGORY_NEEDED
            action = "CREATE_SUBCATEGORY"
        
        # Priority based on volume
        priority = self._calculate_priority(total_volume)
        
        return GapCluster(
            keywords=gaps,
            total_volume=total_volume,
            suggested_category_name="",  # Filled by LLM
            gap_type=gap_type,
            priority=priority,
            action=action
        )
    
    def _calculate_priority(self, volume: int) -> str:
        if volume >= 500:
            return "HIGH"
        elif volume >= 100:
            return "MEDIUM"
        else:
            return "LOW"
    
    def _single_gap_cluster(self, gap: KeywordGap) -> GapCluster:
        return GapCluster(
            keywords=[gap],
            total_volume=gap.search_volume,
            suggested_category_name=gap.keyword.title(),
            gap_type=gap.gap_type,
            priority=self._calculate_priority(gap.search_volume),
            action="CREATE_CATEGORY" if gap.gap_type == GapType.TRUE_GAP else "ORGANIZE_PRODUCTS"
        )
```

---

## 4. LLM Category Naming

```python
CATEGORY_NAMING_PROMPT = """
You are naming e-commerce categories for a hair care store.

Given these related keywords, suggest a category name that:
1. Is concise (2-4 words)
2. Matches existing store style (see examples)
3. Is in Lithuanian if keywords are Lithuanian
4. Avoids brand names
5. Is search-friendly (what customers would type)

## Existing Categories (for style reference)
{existing_categories}

## Keywords to Name
{keywords}

## Total Monthly Search Volume
{volume}

Respond with JSON:
{{
  "suggested_name": "Category Name",
  "alternative_names": ["Alt 1", "Alt 2"],
  "reasoning": "Why this name fits",
  "parent_category": "If this should be a subcategory, name the parent"
}}
"""

async def name_category(
    cluster: GapCluster,
    existing_categories: list[str]
) -> dict:
    """Use LLM to suggest category name for a gap cluster."""
    keywords_text = "\n".join([
        f"- {g.keyword} ({g.search_volume} searches/mo)"
        for g in cluster.keywords[:10]  # Limit to top 10
    ])
    
    prompt = CATEGORY_NAMING_PROMPT.format(
        existing_categories=", ".join(existing_categories[:20]),
        keywords=keywords_text,
        volume=cluster.total_volume
    )
    
    # Use fast model for naming (Grok or GPT-4.1-mini)
    response = await llm_call(prompt, model="grok-4.1-fast")
    
    return json.loads(response)
```

---

## 5. Product Cross-Reference

```python
def cross_reference_products(
    cluster: GapCluster,
    all_products: list[dict]
) -> dict:
    """Find products that could populate a new category."""
    
    matching_products = []
    partial_matches = []
    
    for keyword_gap in cluster.keywords:
        for product in all_products:
            # Check if product matches keyword
            score = compute_product_keyword_match(
                product["name"],
                keyword_gap.keyword
            )
            
            if score > 0.8:
                matching_products.append({
                    "product": product,
                    "matched_keyword": keyword_gap.keyword,
                    "score": score
                })
            elif score > 0.5:
                partial_matches.append({
                    "product": product,
                    "matched_keyword": keyword_gap.keyword,
                    "score": score
                })
    
    # Determine action based on product coverage
    if len(matching_products) >= 5:
        action = "CATEGORIZE_EXISTING"
        note = f"Found {len(matching_products)} products to populate category"
    elif len(matching_products) > 0:
        action = "PARTIAL_COVERAGE"
        note = f"Found {len(matching_products)} products, may need to source more"
    else:
        action = "OPPORTUNITY"
        note = "No matching products - sourcing opportunity"
    
    return {
        "action": action,
        "note": note,
        "exact_matches": matching_products[:20],
        "partial_matches": partial_matches[:10],
        "product_gap": len(matching_products) < 5
    }
```

---

## 6. Output Schema

```python
@dataclass
class GapRecommendation:
    """Actionable recommendation for a category gap."""
    
    # Identification
    id: str
    suggested_category_name: str
    alternative_names: list[str]
    
    # Classification
    gap_type: GapType
    priority: str  # "HIGH" | "MEDIUM" | "LOW"
    
    # Volume metrics
    total_search_volume: int
    keyword_count: int
    top_keywords: list[str]
    
    # Product analysis
    matching_product_count: int
    product_gap: bool
    action: str  # "CREATE_CATEGORY" | "CREATE_SUBCATEGORY" | "ORGANIZE_PRODUCTS" | "SOURCE_PRODUCTS"
    
    # Hierarchy
    parent_category: str | None
    
    # Reasoning
    reasoning: str

def to_json(rec: GapRecommendation) -> dict:
    return {
        "id": rec.id,
        "category": {
            "suggested_name": rec.suggested_category_name,
            "alternatives": rec.alternative_names,
            "parent": rec.parent_category
        },
        "metrics": {
            "total_volume": rec.total_search_volume,
            "keyword_count": rec.keyword_count,
            "top_keywords": rec.top_keywords,
            "priority": rec.priority
        },
        "products": {
            "existing_count": rec.matching_product_count,
            "needs_sourcing": rec.product_gap
        },
        "action": {
            "type": rec.action,
            "reasoning": rec.reasoning
        }
    }
```

---

## 7. Priority Scoring

```python
PRIORITY_WEIGHTS = {
    "volume": 0.40,          # Total search volume
    "product_coverage": 0.25, # Do we have products?
    "competition": 0.20,      # Is it achievable?
    "alignment": 0.15         # Does it fit our focus?
}

VOLUME_THRESHOLDS = {
    "HIGH": 500,    # >= 500 total monthly searches
    "MEDIUM": 100,  # >= 100 monthly searches
    "LOW": 0        # < 100 monthly searches
}

def calculate_gap_priority(
    cluster: GapCluster,
    product_coverage: float,  # 0-1
    competition: float,        # 0-1 (lower = easier)
    focus_alignment: float     # 0-1
) -> tuple[str, float]:
    """Calculate priority score for a gap cluster."""
    
    # Normalize volume (0-1)
    volume_score = min(1.0, cluster.total_volume / 1000)
    
    # Compute weighted score
    priority_score = (
        volume_score * PRIORITY_WEIGHTS["volume"] +
        product_coverage * PRIORITY_WEIGHTS["product_coverage"] +
        (1 - competition) * PRIORITY_WEIGHTS["competition"] +
        focus_alignment * PRIORITY_WEIGHTS["alignment"]
    )
    
    # Determine tier
    if cluster.total_volume >= VOLUME_THRESHOLDS["HIGH"]:
        tier = "HIGH"
    elif cluster.total_volume >= VOLUME_THRESHOLDS["MEDIUM"]:
        tier = "MEDIUM"
    else:
        tier = "LOW"
    
    return tier, priority_score
```

---

## Test Cases

| Keywords | Gap Type | Action |
|----------|----------|--------|
| "keratino tiesinimas", "keratin treatment" | TRUE_GAP | Create "Keratino procedūros" category |
| "profesionalūs plaukų dažai" (has products) | CATEGORIZE_EXISTING | Create category page for 15 existing products |
| "plaukų botoksas" (popular, no products) | TRUE_GAP | Create category + source products |
| "L'Oreal vitamino color" | SUBCATEGORY_NEEDED | Subcategory under "Plaukų dažai" |

---

## Summary

| Aspect | Recommendation |
|--------|----------------|
| **Gap Threshold** | < 0.3 = TRUE_GAP, 0.3-0.7 = WEAK, > 0.7 = SUBCATEGORY |
| **Clustering** | HDBSCAN with min_cluster_size=3, cosine metric |
| **Category Naming** | LLM with existing category style reference |
| **Volume Tiers** | HIGH >= 500, MEDIUM >= 100, LOW < 100 |
| **Product Logic** | Cross-reference to distinguish CATEGORIZE_EXISTING vs OPPORTUNITY |
| **Output** | JSON recommendations with action type and reasoning |
