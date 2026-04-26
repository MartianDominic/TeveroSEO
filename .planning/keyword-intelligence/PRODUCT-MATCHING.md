# Product Matching: Keyword-to-Product Assignment

> **Status:** Research Complete  
> **Last Updated:** 2026-04-26  
> **Expected Accuracy:** 85%+ for branded keywords, 70%+ for generic

---

## Problem Statement

Match keywords like "loreal shampoo for colored hair" to specific products like "L'Oreal Professionnel Serie Expert Vitamino Color Shampoo 300ml" while handling:
- Brand name variations and aliases
- Product line identification
- Size/color code extraction
- Generic vs specific keyword intent
- 1:1 assignment (Kyle Roof rule)

---

## Solution: Structured Parsing + Scoring

### 1. Product Name Parsing

```python
@dataclass
class ParsedProduct:
    brand: str                      # "loreal"
    product_line: str | None        # "Serie Expert Vitamino Color"
    product_type: str               # "shampoo"
    specs: ProductSpecs
    raw_name: str
    url: str

@dataclass
class ProductSpecs:
    size: str | None                # "300ml"
    color_code: str | None          # "6/0" for color products
    variant: str | None             # "Dark Blonde"
```

### Brand Alias Dictionary

```python
BRAND_ALIASES = {
    "loreal": ["l'oreal", "l'oréal", "loreal professionnel", "loreal professional"],
    "schwarzkopf": ["schwarzkopf professional", "schwarzkopf bc", "bc bonacure"],
    "wella": ["wella professionals", "wella professional"],
    "kerastase": ["kérastase", "kerastase paris"],
    "redken": ["redken nyc", "redken professional"],
    "olaplex": ["olaplex professional"],
    "moroccanoil": ["moroccan oil", "morrocan oil"],
    "matrix": ["matrix professional", "matrix biolage"],
}

PRODUCT_LINE_PATTERNS = {
    "loreal": r"serie\s+expert|absolut\s+repair|vitamino\s+color|silver",
    "schwarzkopf": r"bc\s+bonacure|keratin\s+smooth|color\s+freeze|igora",
    "wella": r"color\s+touch|koleston|illumina|blondor|eimi|fusion",
    "kerastase": r"genesis|nutritive|resistance|specifique|chronologiste",
}
```

### Spec Extraction Patterns

```python
SPEC_PATTERNS = {
    "size": r"(\d+(?:\.\d+)?)\s*(ml|g|oz|l|fl\.?\s*oz)",
    "color_code": r"\b(\d{1,2}[\/\.][\d]+[a-z]?)\b",  # 6/0, 7.0, 6/45N
    "variant": r"(blonde?|brunette|auburn|red|silver|platinum|copper|ash|golden)",
}
```

---

## 2. Keyword Parsing

```python
@dataclass
class ParsedKeyword:
    raw: str
    brand: str | None
    product_type: str | None
    attributes: list[str]           # ["colored hair", "damaged"]
    specs: dict
    intent: Literal["product", "brand", "generic", "comparison"]
    specificity: int                # 0-100
```

### Specificity Calculation

| Component | Points |
|-----------|--------|
| Brand present | +30 |
| Product type | +20 |
| Each attribute | +10 (max 30) |
| Color code | +20 |
| Size | +10 |

**Specificity thresholds:**
- **>= 70:** Highly specific → exact product match required
- **40-69:** Moderate → line/type match acceptable
- **< 40:** Generic → consider category page

---

## 3. Matching Algorithm

### Score Breakdown (100 points max)

| Signal | Weight | Description |
|--------|--------|-------------|
| Brand match | 35 | Canonical brand comparison via aliases |
| Product line | 25 | Line name in keyword or fuzzy match |
| Product type | 15 | shampoo/conditioner/mask/etc |
| Spec match | 15 | Color code STRICT, size flexible |
| Attributes | 10 | "for colored hair" in product name |

### Critical: Color Code Handling

```python
# Color codes are STRICT - wrong code = PENALTY
if keyword.specs.color_code:
    if keyword.specs.color_code == product.specs.color_code:
        spec_score = 15  # Full points
    elif product.specs.color_code:
        spec_score = -15  # PENALTY: wrong color code!
```

### Match Types

| Type | Score Range | Criteria |
|------|-------------|----------|
| **exact** | >= 80 | High score + spec match |
| **line** | >= 60 | Product line identified |
| **type** | >= 40 | Same product type |
| **partial** | < 40 | Weak signals only |

---

## 4. 1:1 Assignment (Kyle Roof Rule)

When multiple products match a keyword, select ONE primary target:

### Priority Order

1. **Already ranking** - Check GSC data for existing rankings
2. **Business metrics** - Revenue, conversion rate
3. **Match score** - Highest relevance wins

### Decision Logic

```python
def assign_keyword_to_target(
    keyword: ParsedKeyword,
    matches: list[ProductMatch],
    category_pages: list[CategoryPage]
) -> KeywordAssignment:
    
    # Case 1: High specificity (>= 70) - Single product
    if keyword.specificity >= 70:
        exact_matches = [m for m in matches if m.match_type == "exact"]
        if len(exact_matches) == 1:
            return assign_to_product(exact_matches[0])
        elif len(exact_matches) > 1:
            return resolve_conflict_by_metrics(exact_matches)
    
    # Case 2: Generic (< 40) with 3+ matches - Category page
    if keyword.specificity < 40 and len(matches) >= 3:
        category = find_matching_category(keyword, category_pages)
        if category:
            return assign_to_category(category, matches)
    
    # Case 3: Default - Best product wins
    return assign_to_product(matches[0])
```

---

## 5. Implementation

```python
class ProductMatcherService:
    """Matches keywords to products for e-commerce SEO."""
    
    def __init__(self, products: list[dict]):
        self.products = [parse_product(p["name"], p["url"]) for p in products]
        self.products_by_brand = self._index_by_brand()
    
    def match_keyword(self, keyword_text: str) -> KeywordAssignment:
        keyword = parse_keyword(keyword_text)
        
        # Get candidates (brand-filtered if applicable)
        if keyword.brand:
            candidates = self.products_by_brand.get(keyword.brand, [])
        else:
            candidates = self.products
        
        # Score all candidates
        matches = [
            match_keyword_to_product(keyword, p)
            for p in candidates
        ]
        matches = sorted(
            [m for m in matches if m.score > 20],
            key=lambda m: -m.score
        )
        
        if not matches:
            return KeywordAssignment(
                keyword=keyword_text,
                target_url=None,
                target_type="new_content",
                score=0,
                reason="No matching product - content gap opportunity"
            )
        
        # Apply 1:1 rule
        return self._apply_assignment_rules(keyword, matches)
```

---

## 6. Related Product Types

```python
RELATED_TYPES = [
    ["shampoo", "conditioner", "mask"],
    ["treatment", "serum", "oil"],
    ["color", "developer", "bleach"],
    ["spray", "styling"],
]

def are_related_types(a: str, b: str) -> bool:
    return any(
        a in group and b in group
        for group in RELATED_TYPES
    )
```

---

## Test Cases

| Keyword | Expected Product | Match Type |
|---------|------------------|------------|
| "loreal vitamino color shampoo 300ml" | L'Oreal Serie Expert Vitamino Color Shampoo 300ml | exact |
| "loreal professional shampoo" | Best-selling L'Oreal shampoo | line |
| "shampoo for colored hair" | Category page (generic) | category |
| "wella koleston 6/0" | Wella Koleston Perfect 6/0 | exact |
| "wella koleston 7/0" | NOT 6/0 product (penalty!) | exact (different) |

---

## Summary

| Aspect | Recommendation |
|--------|----------------|
| **Parsing** | Regex-based with domain dictionary (better than NER at this scale) |
| **Brand matching** | Canonical aliases + normalization |
| **Color codes** | STRICT matching with penalty for mismatches |
| **Specificity** | 0-100 score drives assignment strategy |
| **1:1 Assignment** | Kyle Roof rule: one keyword → one page |
| **Generic keywords** | Route to category pages when 3+ products match |
