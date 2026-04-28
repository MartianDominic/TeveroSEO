# Content Quality Scoring Research

> **Status:** Research documentation for future reference. NOT V1 scope.
> 
> V1 focuses on SEO management pipeline for agencies. This document captures research for potential V2+ content generation features.

---

## The Problem with AI Scoring

AI scoring is inconsistent. Same content, different runs = different scores.

**Solution:** Make everything countable/measurable. No "rate this 0-100" prompts.

---

## Prerequisite: Calibration Research

Before building ANY scoring system:

1. Pick 50 keywords across intents
2. Score top 10 SERP results for each (500 pages)
3. Run regression: which metrics correlate with position?
4. Derive weights from data, not assumptions

**Without calibration, the scoring system is guesswork.**

---

## Objective Scoring Framework

### Principle

Every metric must be:
- **Countable** (number of X)
- **Measurable** (word count, reading level)
- **Binary** (present or not)

No subjective AI judgment.

---

### Dimension 1: Semantic Coverage

| Metric | Type | Measurement |
|--------|------|-------------|
| Required topics covered | Count | Heading similarity > 0.75 threshold |
| Word count vs target | Ratio | actual / target |
| Section depth | Ratio | section words / target words |
| FAQ questions answered | Count | PAA questions found in content |

```typescript
function scoreSemanticCoverage(content: string, brief: ContentBrief): number {
  let score = 100;
  
  // -15 per missing required topic
  for (const topic of brief.requirements.mustCoverTopics) {
    const covered = contentHeadings.some(h => 
      cosineSimilarity(embed(h), embed(topic)) > 0.75
    );
    if (!covered) score -= 15;
  }
  
  // -20 if under 80% of target word count
  const wordRatio = countWords(content) / brief.targets.wordCount;
  if (wordRatio < 0.8) score -= 20;
  
  return Math.max(0, score);
}
```

---

### Dimension 2: E-E-A-T Signals

| Metric | Type | Points | Cap |
|--------|------|--------|-----|
| Testimonials | Count regex | 3 each | 10 |
| "We" statements | Count regex | 2 each | 8 |
| External citations | Count regex | 3 each | 12 |
| Sourced statistics | Count regex | 2 each | 8 |
| Balanced statements | Count regex | 2 each | 10 |
| No exaggeration | Binary | 5 | 5 |

```typescript
function scoreEEAT(content: string): number {
  let score = 0;
  
  // Experience (25 pts max)
  score += Math.min(10, countPattern(content, /"[^"]{20,}".*said/gi) * 3);
  score += Math.min(8, countPattern(content, /\bwe've seen|we found\b/gi) * 2);
  
  // Expertise (25 pts max)  
  score += Math.min(10, countIndustryTerms(content) * 0.5);
  
  // Authority (25 pts max)
  score += Math.min(12, countPattern(content, /according to [A-Z]/gi) * 3);
  
  // Trust (25 pts max)
  score += Math.min(10, countPattern(content, /\bhowever|although\b/gi) * 2);
  score += !hasPattern(content, /\bbest ever|guaranteed\b/gi) ? 5 : 0;
  
  return score;
}
```

---

### Dimension 3: Readability (100% Mathematical)

| Metric | Formula | Target |
|--------|---------|--------|
| Flesch score | 206.835 - 1.015×ASL - 84.6×ASW | 60-70 |
| Avg sentence length | words / sentences | 15-20 |
| Avg paragraph length | sentences / paragraphs | 3-5 |
| Words per heading | words / headings | 200-300 |
| Formatting types | count lists + tables + bold | 2+ |

```typescript
function scoreReadability(content: string): number {
  let score = 100;
  
  const flesch = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);
  if (flesch < 50) score -= 15;
  
  if (avgSentenceLength > 25) score -= 15;
  if (avgParagraphLength > 6) score -= 15;
  if (wordsPerHeading > 400) score -= 15;
  
  return Math.max(0, score);
}
```

---

### Dimension 4: Engagement

| Metric | Type | Points |
|--------|------|--------|
| Hook has question | Binary | 8 |
| Hook has statistic | Binary | 8 |
| No weak opener | Binary | 5 |
| Filler phrases | Count | -4 each (max -20) |
| Bullet points | Count | 0.5 each (max 8) |
| Has CTA | Binary | 5 |

```typescript
function scoreEngagement(content: string): number {
  let score = 0;
  
  // Hook (30 pts)
  const firstPara = content.split(/\n\n/)[0];
  score += /\?/.test(firstPara) ? 8 : 0;
  score += /\d+%/.test(firstPara) ? 8 : 0;
  score += !/^In today's/.test(firstPara) ? 5 : 0;
  
  // Value density (30 pts)
  const fillerCount = countFillerPhrases(content);
  score += 30 - Math.min(20, fillerCount * 4);
  
  // Scanability (20 pts)
  score += Math.min(8, countBullets(content) * 0.5);
  
  // CTA (20 pts)
  score += /\b(try|start|get|contact)\b/i.test(content) ? 10 : 0;
  
  return score;
}
```

---

### Dimension 5: Information Gain

| Metric | Type | Points | Comparison |
|--------|------|--------|------------|
| Testimonials | Count diff | 8 per extra | vs competitor avg |
| Unique statistics | Count | 5 each | not in competitor set |
| Unique sections | Count | 5 each | heading similarity < 0.7 |
| Case studies | Count diff | 8 per extra | vs competitor avg |

```typescript
function scoreInformationGain(content: string, competitors: string[]): number {
  let score = 0;
  
  // Testimonials (competitors usually have 0)
  const ourTestimonials = countTestimonials(content);
  const competitorAvg = avg(competitors.map(countTestimonials));
  score += Math.min(25, (ourTestimonials - competitorAvg) * 8);
  
  // Unique stats
  const ourStats = extractStatistics(content);
  const competitorStats = new Set(competitors.flatMap(extractStatistics));
  const uniqueStats = ourStats.filter(s => !competitorStats.has(s));
  score += Math.min(25, uniqueStats.length * 5);
  
  // Unique sections
  const uniqueSections = findUniqueSections(content, competitors);
  score += Math.min(25, uniqueSections.length * 5);
  
  return Math.min(100, score);
}
```

---

## Calibration Process

### Before Building

1. **Sample:** 50 keywords × 10 SERP results = 500 pages
2. **Score:** Apply all metrics to each page
3. **Correlate:** Regression analysis vs actual position
4. **Derive:** Weights based on predictive power

### After Launching

1. **Track:** Score at publish + position over time
2. **Analyze:** Monthly correlation analysis
3. **Adjust:** Update weights based on real performance

---

## Implementation Complexity

| Component | Effort | V1? |
|-----------|--------|-----|
| Readability scoring | Low (math formulas) | Maybe |
| Regex-based counting | Low | Maybe |
| Embedding similarity | Medium | No |
| Competitor scraping | Medium | No |
| Calibration research | High | No |
| Full pipeline | High | No |

---

## V1 vs V2+ Scope

**V1 (Agency SEO Management):**
- GSC integration
- Keyword tracking
- Site audits
- Client/prospect management
- Basic reporting

**V2+ (Content Generation):**
- Full content generation pipeline
- Quality scoring with calibrated weights
- Information gain measurement
- Automated publishing

---

## References

- Flesch-Kincaid formula: https://en.wikipedia.org/wiki/Flesch%E2%80%93Kincaid_readability_tests
- E-E-A-T guidelines: https://developers.google.com/search/docs/fundamentals/creating-helpful-content
