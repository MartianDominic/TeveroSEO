# Category Matching: Keyword-to-Category Assignment

> **Status:** Research Complete  
> **Last Updated:** 2026-04-26  
> **Expected Accuracy:** 85-90% auto-assignment, <5% error rate

---

## Problem Statement

Match keywords like "profesionalūs plaukų dažai" to the correct category "Plaukų dažai" while handling:
- Lithuanian morphological variations
- Semantic vs lexical matching
- Multi-category keywords
- Confidence scoring

---

## Solution: Hybrid Multi-Signal Matching

### Signal Weights

| Signal | Weight | Purpose |
|--------|--------|---------|
| **Embeddings** | 35% | Handles semantic variations ("keratin treatment" ↔ "keratino procedūra") |
| **BM25** | 25% | Fast exact matches, handles exact product names |
| **Rules** | 15% | Domain knowledge (trigger words → category) |
| **Catalog** | 20% | Real product evidence (keyword appears in products) |
| **Name Match** | 5% | Bonus for direct substring match |

### Confidence Thresholds

| Score | Action |
|-------|--------|
| **> 0.75** | Auto-assign to category |
| **0.50-0.75** | Assign but flag for review |
| **< 0.50** | Don't assign, requires manual review |

---

## Lithuanian Morphology Handling

### Challenge

Lithuanian has complex declension:
- "plaukų dažai" (hair dye - genitive + nominative)
- "plaukų dažymas" (hair dyeing - verbal noun)
- "dažyti plaukus" (to dye hair - infinitive + accusative)

All should match category "Plaukų dažai".

### Solution: Domain-Specific Stemming + Stanza

```python
LITHUANIAN_PATTERNS = {
    # Noun declension normalization
    r'plaukų|plaukai|plaukus|plaukams': 'plauk',  # hair
    r'dažų|dažai|dažus|dažams|dažymas|dažyti': 'daz',  # dye
    r'šampūnų|šampūnai|šampūnus|šampūnams|šampūnas': 'sampun',  # shampoo
    r'kaukių|kaukės|kaukę|kaukėms|kaukė': 'kauk',  # mask
    r'kondicionierių|kondicionieriai|kondicionierius': 'kondicion',  # conditioner
    r'keratino|keratinas|keratinu': 'keratin',  # keratin
    r'pleiskanų|pleiskanos|pleiskanas': 'pleiskan',  # dandruff
}

def lemmatize_lithuanian(text: str, stanza_nlp) -> LemmatizedKeyword:
    """Multi-layer lemmatization for Lithuanian keywords."""
    # Layer 1: Stanza lemmatization
    doc = stanza_nlp(text)
    lemmas = [word.lemma for sent in doc.sentences for word in sent.words]
    
    # Layer 2: Domain-specific stemming fallback
    stems = []
    for token in text.lower().split():
        stem = token
        for pattern, replacement in LITHUANIAN_PATTERNS.items():
            if re.match(pattern, token):
                stem = replacement
                break
        stems.append(stem)
    
    return LemmatizedKeyword(
        original=text,
        lemmas=lemmas,
        stems=stems,
        normalized=' '.join(sorted(set(lemmas + stems)))
    )
```

---

## Multi-Category Resolution

### Decision Tree

```
Keyword Analysis
│
├── Contains "rinkinys", "komplektas", "set" 
│   └── Assign to "Rinkiniai" (Sets) meta-category
│
├── Contains specific product type indicator?
│   ├── "šampūnas/šampūn" → Šampūnai
│   ├── "dažai/dažym" → Plaukų dažai
│   └── "kaukė/kauk" → Plaukų kaukės
│
├── Generic modifier only? ("profesionalus", "natūralus")
│   └── Flag for manual review
│
└── Multiple product types mentioned?
    └── Assign primary + list secondary categories
```

### Implementation

```python
from enum import Enum
from dataclasses import dataclass

class CategoryAssignmentType(Enum):
    SINGLE = "single"           # Clear single category
    PRIMARY_WITH_SECONDARY = "primary_secondary"  # Has related categories
    AMBIGUOUS = "ambiguous"     # Needs manual review
    META_CATEGORY = "meta"      # Belongs to sets/kits

@dataclass
class CategoryAssignment:
    keyword: str
    primary_category: str
    secondary_categories: list[str]
    assignment_type: CategoryAssignmentType
    confidence: float
    signals: dict[str, float]

def resolve_multi_category(
    keyword: str,
    category_scores: dict[str, float],
    threshold_gap: float = 0.15
) -> CategoryAssignment:
    """Resolve which category a keyword belongs to."""
    sorted_cats = sorted(category_scores.items(), key=lambda x: -x[1])
    
    if not sorted_cats:
        return CategoryAssignment(
            keyword=keyword,
            primary_category="Uncategorized",
            secondary_categories=[],
            assignment_type=CategoryAssignmentType.AMBIGUOUS,
            confidence=0.0,
            signals={}
        )
    
    top_category, top_score = sorted_cats[0]
    
    # Check for set/kit keywords
    set_indicators = ['rinkinys', 'komplektas', 'set', 'kit']
    if any(ind in keyword.lower() for ind in set_indicators):
        return CategoryAssignment(
            keyword=keyword,
            primary_category="Rinkiniai",
            secondary_categories=[c for c, _ in sorted_cats[:3]],
            assignment_type=CategoryAssignmentType.META_CATEGORY,
            confidence=0.9,
            signals=category_scores
        )
    
    # Clear winner
    if len(sorted_cats) == 1 or (sorted_cats[0][1] - sorted_cats[1][1]) > threshold_gap:
        return CategoryAssignment(
            keyword=keyword,
            primary_category=top_category,
            secondary_categories=[],
            assignment_type=CategoryAssignmentType.SINGLE,
            confidence=top_score,
            signals=category_scores
        )
    
    # Close competition
    secondary = [c for c, s in sorted_cats[1:] if s > top_score - threshold_gap]
    
    if top_score < 0.5:
        return CategoryAssignment(
            keyword=keyword,
            primary_category=top_category,
            secondary_categories=secondary,
            assignment_type=CategoryAssignmentType.AMBIGUOUS,
            confidence=top_score,
            signals=category_scores
        )
    
    return CategoryAssignment(
        keyword=keyword,
        primary_category=top_category,
        secondary_categories=secondary,
        assignment_type=CategoryAssignmentType.PRIMARY_WITH_SECONDARY,
        confidence=top_score,
        signals=category_scores
    )
```

---

## Confidence Scoring Formula

```python
import numpy as np
from dataclasses import dataclass

@dataclass
class MatchSignals:
    bm25_score: float          # 0-1 normalized
    embedding_similarity: float # 0-1
    rule_match: float          # 0 or 1
    catalog_evidence: float    # 0-1
    keyword_in_category_name: float  # 0 or 1

def compute_confidence(signals: MatchSignals) -> float:
    """Compute calibrated confidence score."""
    weights = {
        'bm25': 0.25,
        'embedding': 0.35,
        'rule': 0.15,
        'catalog': 0.20,
        'name_match': 0.05
    }
    
    raw_score = (
        weights['bm25'] * signals.bm25_score +
        weights['embedding'] * signals.embedding_similarity +
        weights['rule'] * signals.rule_match +
        weights['catalog'] * signals.catalog_evidence +
        weights['name_match'] * signals.keyword_in_category_name
    )
    
    # Calibration: sigmoid to spread scores
    calibrated = 1 / (1 + np.exp(-10 * (raw_score - 0.5)))
    
    return round(calibrated, 3)
```

---

## Domain Rules (Hair Care)

```python
CATEGORY_RULES = {
    "Plaukų dažai": [
        "dažai", "dažymas", "spalva", "oksidantas", "šviesinimas",
        "color", "toner", "bleach"
    ],
    "Šampūnai": [
        "šampūnas", "šampūn", "shampoo", "plovimas", "valymas"
    ],
    "Kondicionieriai": [
        "kondicionierius", "kondicion", "conditioner", "balzamas"
    ],
    "Plaukų kaukės": [
        "kaukė", "kauk", "mask", "intensyvi", "atstatymas"
    ],
    "Plaukų aliejai": [
        "aliejus", "aliej", "oil", "serumas", "serum"
    ],
    "Formavimo priemonės": [
        "lakavimas", "lakas", "putos", "gelis", "vaškas",
        "spray", "mousse", "gel", "wax", "styling"
    ],
}
```

---

## Core Matcher Class

```python
class KeywordCategoryMatcher:
    """Hybrid keyword-to-category matcher for Lithuanian hair care."""
    
    def __init__(
        self,
        categories: list[Category],
        embedding_model: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    ):
        self.categories = {c.id: c for c in categories}
        self.category_list = categories
        self.embedder = SentenceTransformer(embedding_model)
        
        self._compute_category_embeddings()
        self._build_bm25_index()
        self.category_rules = CATEGORY_RULES
    
    def match_keyword(
        self, 
        keyword: str,
        catalog_evidence: Optional[dict[str, float]] = None
    ) -> MatchResult:
        """Match a single keyword to categories."""
        
        # Compute all signals
        bm25_scores = self._compute_bm25_score(keyword)
        embedding_scores = self._compute_embedding_similarity(keyword)
        rule_scores = self._check_rule_matches(keyword)
        name_scores = self._check_name_match(keyword)
        
        if catalog_evidence is None:
            catalog_evidence = {cat.id: 0.0 for cat in self.category_list}
        
        # Aggregate scores per category
        category_scores = {}
        for cat in self.category_list:
            signals = MatchSignals(
                bm25_score=bm25_scores.get(cat.id, 0),
                embedding_similarity=embedding_scores.get(cat.id, 0),
                rule_match=rule_scores.get(cat.id, 0),
                catalog_evidence=catalog_evidence.get(cat.id, 0),
                keyword_in_category_name=name_scores.get(cat.id, 0)
            )
            category_scores[cat.id] = compute_confidence(signals)
        
        # Resolve to assignment
        assignment = resolve_multi_category(keyword, category_scores)
        
        # Determine if review needed
        needs_review = (
            assignment.assignment_type == CategoryAssignmentType.AMBIGUOUS or
            assignment.confidence < 0.50
        )
        
        return MatchResult(
            keyword=keyword,
            assignments=[assignment],
            best_match=assignment,
            needs_review=needs_review
        )
```

---

## Test Cases

| Keyword | Expected Category | Expected Confidence |
|---------|-------------------|---------------------|
| "profesionalūs plaukų dažai" | Plaukų dažai | > 0.85 |
| "šampūnas nuo pleiskanų" | Šampūnai | > 0.85 |
| "plaukų kaukė su keratinu" | Plaukų kaukės | > 0.80 |
| "L'Oreal Professionnel rinkinys" | Rinkiniai (meta) | > 0.90 |
| "plaukų priežiūra" | Ambiguous | < 0.50 |

---

## Summary

| Aspect | Recommendation |
|--------|----------------|
| **Lithuanian NLP** | Stanza + domain-specific stemming fallback |
| **Matching Algorithm** | Hybrid: BM25 (25%) + Embeddings (35%) + Rules (15%) + Catalog (20%) + Name (5%) |
| **Embedding Model** | `paraphrase-multilingual-MiniLM-L12-v2` |
| **Multi-Category** | Primary + secondary list; "Rinkiniai" meta-category for sets |
| **Confidence Thresholds** | >0.75 auto, 0.50-0.75 review, <0.50 manual |
| **Expected Accuracy** | 85-90% auto-assignment, <5% error rate |
