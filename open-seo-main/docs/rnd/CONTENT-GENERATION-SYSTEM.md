# Content Generation System

> Complete specification for autonomous content generation with quality scoring, information gain measurement, and UI/UX flows.

## Overview

The content generation system takes an approved keyword and produces publish-ready content that:
1. Covers all topics competitors cover (semantic completeness)
2. Includes unique client knowledge (information gain)
3. Demonstrates E-E-A-T signals (experience, expertise, authority, trust)
4. Reads well and engages users
5. Applies consistent brand voice

**Generation Model:** Gemini 3.1 Pro (2026) only

---

## Content Generation Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CONTENT GENERATION PIPELINE                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐             │
│  │ RESEARCH │──▶│  BRIEF   │──▶│ GENERATE │──▶│  SCORE   │             │
│  │          │   │          │   │          │   │          │             │
│  │ SERP     │   │ Outline  │   │ Gemini   │   │ 5 dims   │             │
│  │ Compete  │   │ Targets  │   │ + RAG    │   │ 75+ each │             │
│  │ PAA      │   │ Inject   │   │ + Voice  │   │          │             │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘             │
│                                                      │                   │
│                                    ┌─────────────────┴─────────────────┐│
│                                    │                                    ││
│                                    ▼                                    ▼│
│                              ┌──────────┐                        ┌──────────┐
│                              │  REVISE  │                        │ PUBLISH  │
│                              │          │                        │          │
│                              │ Fix weak │                        │ To CMS   │
│                              │ sections │                        │ + Track  │
│                              │ Max 3x   │                        │          │
│                              └──────────┘                        └──────────┘
│                                    │                                        
│                                    ▼                                        
│                              ┌──────────┐                                   
│                              │  HUMAN   │ (if 3 revisions fail)            
│                              │  REVIEW  │                                   
│                              └──────────┘                                   
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Stage 1: Research

### What We Gather

| Data | Source | Purpose |
|------|--------|---------|
| Top 10 SERP results | DataForSEO | Understand what ranks |
| Competitor content | Scraping | Topics, depth, structure |
| People Also Ask | DataForSEO | FAQ opportunities |
| Related keywords | DataForSEO | Semantic completeness |
| Search intent | Analysis | Format decision |
| Client knowledge | RAG | Information gain sources |

### Research Implementation

```typescript
interface ContentResearch {
  keyword: string;
  searchIntent: 'informational' | 'commercial' | 'transactional' | 'navigational';
  
  serp: {
    topResults: SERPResult[];
    featuredSnippet: string | null;
    peopleAlsoAsk: string[];
    relatedSearches: string[];
  };
  
  competitors: {
    avgWordCount: number;
    commonTopics: string[];        // Topics all/most cover
    gapTopics: string[];           // Topics few/none cover
    avgHeadingCount: number;
    hasImages: boolean;
    hasVideo: boolean;
    hasTables: boolean;
    hasStatistics: number;         // Avg stats per article
  };
  
  clientKnowledge: {
    relevantTestimonials: Testimonial[];
    relevantCaseStudies: CaseStudy[];
    relevantStatistics: Statistic[];
    brandVoice: BrandVoice;
  };
}

async function conductResearch(
  keyword: string,
  clientId: string,
): Promise<ContentResearch> {
  // 1. Get SERP data
  const serpData = await dataForSEO.getSERP(keyword);
  
  // 2. Scrape top 10 competitor content
  const competitorContent = await Promise.all(
    serpData.topResults.slice(0, 10).map(r => scrapeContent(r.url))
  );
  
  // 3. Analyze competitors
  const competitorAnalysis = analyzeCompetitors(competitorContent);
  
  // 4. Determine search intent
  const searchIntent = classifyIntent(keyword, serpData);
  
  // 5. Retrieve relevant client knowledge via RAG
  const knowledge = await retrieveKnowledge(clientId, keyword, limit: 10);
  
  return {
    keyword,
    searchIntent,
    serp: {
      topResults: serpData.results,
      featuredSnippet: serpData.featuredSnippet,
      peopleAlsoAsk: serpData.peopleAlsoAsk,
      relatedSearches: serpData.relatedSearches,
    },
    competitors: competitorAnalysis,
    clientKnowledge: {
      relevantTestimonials: knowledge.filter(k => k.type === 'testimonial'),
      relevantCaseStudies: knowledge.filter(k => k.type === 'case_study'),
      relevantStatistics: knowledge.filter(k => k.type === 'statistic'),
      brandVoice: await getBrandVoice(clientId),
    },
  };
}
```

### Competitor Analysis

```typescript
function analyzeCompetitors(contents: ScrapedContent[]): CompetitorAnalysis {
  // Extract all headings across competitors
  const allHeadings = contents.flatMap(c => c.headings);
  
  // Find common topics (appear in 60%+ of competitors)
  const headingCounts = countOccurrences(allHeadings.map(normalizeHeading));
  const threshold = contents.length * 0.6;
  const commonTopics = Object.entries(headingCounts)
    .filter(([_, count]) => count >= threshold)
    .map(([topic]) => topic);
  
  // Find gap topics (appear in <30% of competitors)
  const gapTopics = Object.entries(headingCounts)
    .filter(([_, count]) => count > 0 && count < contents.length * 0.3)
    .map(([topic]) => topic);
  
  return {
    avgWordCount: average(contents.map(c => c.wordCount)),
    commonTopics,
    gapTopics,
    avgHeadingCount: average(contents.map(c => c.headings.length)),
    hasImages: contents.filter(c => c.imageCount > 0).length > contents.length * 0.5,
    hasVideo: contents.filter(c => c.hasVideo).length > contents.length * 0.3,
    hasTables: contents.filter(c => c.tableCount > 0).length > contents.length * 0.3,
    avgStatistics: average(contents.map(c => countStatistics(c.content))),
  };
}
```

---

## Stage 2: Content Brief

### Brief Structure

```typescript
interface ContentBrief {
  keyword: string;
  
  targets: {
    wordCount: number;           // Competitor avg + 20%
    headingCount: number;
    readingLevel: 'easy' | 'medium' | 'advanced';
    format: 'guide' | 'listicle' | 'comparison' | 'how-to' | 'review';
  };
  
  outline: OutlineSection[];
  
  knowledgeInjectionPoints: {
    sectionIndex: number;
    knowledgeType: 'testimonial' | 'case_study' | 'statistic';
    knowledgeId: string;
    injectionNote: string;
  }[];
  
  requirements: {
    mustCoverTopics: string[];    // From competitor analysis
    shouldCoverTopics: string[];  // Gap opportunities
    faqQuestions: string[];       // From PAA
    internalLinks: string[];      // Pages to link to
  };
  
  brandVoice: BrandVoiceDirective;
}

interface OutlineSection {
  heading: string;
  type: 'h2' | 'h3';
  targetWordCount: number;
  notes: string;
  includeTable?: boolean;
  includeImage?: boolean;
}
```

### Brief Generation

```typescript
async function generateBrief(research: ContentResearch): Promise<ContentBrief> {
  const prompt = `
    Create a content brief for: "${research.keyword}"
    
    SEARCH INTENT: ${research.searchIntent}
    
    COMPETITOR ANALYSIS:
    - Average word count: ${research.competitors.avgWordCount}
    - Common topics covered: ${research.competitors.commonTopics.join(', ')}
    - Gap topics (opportunity): ${research.competitors.gapTopics.join(', ')}
    - Average headings: ${research.competitors.avgHeadingCount}
    
    PEOPLE ALSO ASK:
    ${research.serp.peopleAlsoAsk.map(q => `- ${q}`).join('\n')}
    
    AVAILABLE CLIENT KNOWLEDGE:
    Testimonials: ${research.clientKnowledge.relevantTestimonials.length}
    Case Studies: ${research.clientKnowledge.relevantCaseStudies.length}
    Statistics: ${research.clientKnowledge.relevantStatistics.length}
    
    Create a detailed outline that:
    1. Covers ALL common topics competitors cover
    2. Includes 2-3 gap topics for differentiation
    3. Has a FAQ section using PAA questions
    4. Targets ${Math.round(research.competitors.avgWordCount * 1.2)} words (20% above competitor avg)
    5. Identifies WHERE to inject testimonials/case studies/statistics
    
    Return JSON matching ContentBrief schema.
  `;
  
  const result = await gemini.generateContent(prompt);
  return JSON.parse(result.response.text());
}
```

### Knowledge Injection Points

The brief specifies WHERE unique knowledge should be injected:

```typescript
// Example injection points
const injectionPoints = [
  {
    sectionIndex: 3,  // "Pricing" section
    knowledgeType: 'case_study',
    knowledgeId: 'cs-financeapp',
    injectionNote: 'Mention how FinanceApp saved 40% on software costs',
  },
  {
    sectionIndex: 5,  // "How to Choose" section
    knowledgeType: 'testimonial',
    knowledgeId: 'test-techcorp-ceo',
    injectionNote: 'Quote about switching difficulty being overblown',
  },
  {
    sectionIndex: 2,  // "Comparison Table" section
    knowledgeType: 'statistic',
    knowledgeId: 'stat-switch-rate',
    injectionNote: 'Use "78% of SMBs switch software within 2 years"',
  },
];
```

---

## Stage 3: Content Generation

### Generation Prompt Structure

```typescript
async function generateContent(brief: ContentBrief, research: ContentResearch): Promise<string> {
  // Build the knowledge injection context
  const knowledgeContext = brief.knowledgeInjectionPoints.map(point => {
    const knowledge = getKnowledgeById(point.knowledgeId);
    return `
      INJECT IN SECTION "${brief.outline[point.sectionIndex].heading}":
      Type: ${point.knowledgeType}
      Content: ${JSON.stringify(knowledge.data)}
      How to use: ${point.injectionNote}
    `;
  }).join('\n\n');
  
  const prompt = `
    Write SEO-optimized content for: "${brief.keyword}"
    
    CONTENT BRIEF:
    - Target word count: ${brief.targets.wordCount}
    - Format: ${brief.targets.format}
    - Reading level: ${brief.targets.readingLevel}
    
    OUTLINE TO FOLLOW:
    ${brief.outline.map((s, i) => `
      ${i + 1}. ${s.type === 'h2' ? '##' : '###'} ${s.heading}
         Target: ${s.targetWordCount} words
         ${s.notes}
         ${s.includeTable ? '- Include comparison table' : ''}
    `).join('\n')}
    
    KNOWLEDGE TO INTEGRATE (your information advantage):
    ${knowledgeContext}
    
    BRAND VOICE:
    ${brief.brandVoice}
    
    REQUIREMENTS:
    - Cover these topics thoroughly: ${brief.requirements.mustCoverTopics.join(', ')}
    - Also touch on: ${brief.requirements.shouldCoverTopics.join(', ')}
    - Include FAQ section with these questions: ${brief.requirements.faqQuestions.join('; ')}
    - Link to these internal pages where relevant: ${brief.requirements.internalLinks.join(', ')}
    
    RULES:
    1. Integrate testimonials and statistics NATURALLY, not as block quotes
    2. Use specific numbers from case studies (not vague claims)
    3. Write as a practitioner, not an observer ("We've seen..." not "Experts say...")
    4. Front-load value in every section - no filler intros
    5. Never start with "In today's digital world" or similar clichés
    6. Every paragraph must add value a competitor doesn't offer
    7. Use the brand voice consistently throughout
    
    Write the complete article in markdown format.
  `;
  
  return await gemini.generateContent(prompt);
}
```

### Section-by-Section Generation (for long content)

For articles over 2,500 words, generate section by section:

```typescript
async function generateLongContent(brief: ContentBrief): Promise<string> {
  const sections: string[] = [];
  
  for (let i = 0; i < brief.outline.length; i++) {
    const section = brief.outline[i];
    const injection = brief.knowledgeInjectionPoints.find(p => p.sectionIndex === i);
    
    const sectionPrompt = `
      Write section ${i + 1} of an article about "${brief.keyword}".
      
      SECTION: ${section.heading}
      Target: ${section.targetWordCount} words
      Notes: ${section.notes}
      
      ${injection ? `
        INJECT THIS KNOWLEDGE:
        ${JSON.stringify(getKnowledgeById(injection.knowledgeId))}
        How: ${injection.injectionNote}
      ` : ''}
      
      PREVIOUS SECTIONS (for context):
      ${sections.slice(-2).join('\n\n')}
      
      BRAND VOICE: ${brief.brandVoice}
      
      Write this section only. Use markdown formatting.
    `;
    
    const sectionContent = await gemini.generateContent(sectionPrompt);
    sections.push(`## ${section.heading}\n\n${sectionContent}`);
  }
  
  return sections.join('\n\n');
}
```

---

## Stage 4: Quality Scoring

### The 5 Quality Dimensions

| Dimension | Weight | What It Measures |
|-----------|--------|------------------|
| **Semantic Coverage** | 20% | All required topics covered, proper depth |
| **E-E-A-T Signals** | 25% | Experience, expertise, authority, trust markers |
| **Readability** | 15% | Appropriate complexity, formatting, structure |
| **Engagement** | 20% | Hook strength, value density, scanability |
| **Information Gain** | 20% | Unique data points competitors don't have |

**Threshold:** ALL dimensions must score 75+ to pass.

### Scoring Implementation

```typescript
interface QualityScore {
  overall: number;
  dimensions: {
    semanticCoverage: DimensionScore;
    eeat: DimensionScore;
    readability: DimensionScore;
    engagement: DimensionScore;
    informationGain: DimensionScore;
  };
  passed: boolean;
  weakestDimension: string;
  improvementSuggestions: string[];
}

interface DimensionScore {
  score: number;          // 0-100
  passed: boolean;        // >= 75
  details: string;
  issues: string[];
}

async function scoreContent(
  content: string,
  brief: ContentBrief,
  competitors: string[],
): Promise<QualityScore> {
  // Score each dimension
  const [semantic, eeat, readability, engagement, infoGain] = await Promise.all([
    scoreSemanticCoverage(content, brief),
    scoreEEAT(content),
    scoreReadability(content),
    scoreEngagement(content),
    scoreInformationGain(content, competitors),
  ]);
  
  const dimensions = {
    semanticCoverage: semantic,
    eeat: eeat,
    readability: readability,
    engagement: engagement,
    informationGain: infoGain,
  };
  
  // Weighted average
  const overall = (
    semantic.score * 0.20 +
    eeat.score * 0.25 +
    readability.score * 0.15 +
    engagement.score * 0.20 +
    infoGain.score * 0.20
  );
  
  // Find weakest
  const scores = Object.entries(dimensions);
  const weakest = scores.reduce((min, [name, dim]) => 
    dim.score < min.score ? { name, score: dim.score } : min,
    { name: '', score: 100 }
  );
  
  return {
    overall,
    dimensions,
    passed: Object.values(dimensions).every(d => d.passed),
    weakestDimension: weakest.name,
    improvementSuggestions: generateImprovementSuggestions(dimensions),
  };
}
```

### Dimension 1: Semantic Coverage (20%)

Does the content cover all required topics with appropriate depth?

```typescript
async function scoreSemanticCoverage(
  content: string,
  brief: ContentBrief,
): Promise<DimensionScore> {
  const prompt = `
    Evaluate semantic coverage of this content.
    
    REQUIRED TOPICS (must cover):
    ${brief.requirements.mustCoverTopics.map(t => `- ${t}`).join('\n')}
    
    SHOULD COVER (bonus):
    ${brief.requirements.shouldCoverTopics.map(t => `- ${t}`).join('\n')}
    
    TARGET OUTLINE:
    ${brief.outline.map(s => `- ${s.heading} (~${s.targetWordCount} words)`).join('\n')}
    
    CONTENT:
    ${content}
    
    Score 0-100 based on:
    - Are ALL required topics covered? (-20 per missing topic)
    - Is each topic covered with sufficient depth? (-10 per shallow section)
    - Are bonus topics included? (+5 per bonus topic, max +15)
    - Does structure follow the outline? (-5 per major deviation)
    
    Return JSON:
    {
      "score": 85,
      "passed": true,
      "details": "Covers 8/8 required topics, 2/3 bonus topics",
      "issues": ["Section on pricing is thin (150 words vs 300 target)"]
    }
  `;
  
  return await gemini.generateContent(prompt);
}
```

### Dimension 2: E-E-A-T Signals (25%)

Does the content demonstrate experience, expertise, authority, and trust?

```typescript
async function scoreEEAT(content: string): Promise<DimensionScore> {
  const prompt = `
    Evaluate E-E-A-T signals in this content.
    
    CONTENT:
    ${content}
    
    EXPERIENCE indicators (first-hand knowledge):
    - Personal anecdotes or "we've seen" statements
    - Specific examples from actual work
    - Details only someone with experience would know
    
    EXPERTISE indicators:
    - Technical accuracy
    - Industry terminology used correctly
    - Nuanced understanding (not surface-level)
    
    AUTHORITY indicators:
    - Citations to reputable sources
    - References to known entities/brands
    - Statistics with sources
    
    TRUST indicators:
    - Balanced perspective (acknowledges limitations)
    - Transparent about who wrote it
    - No exaggerated claims
    
    Score 0-100:
    - 25 points max per E-E-A-T component
    - Deduct for missing signals
    - Deduct heavily for inaccuracies or exaggerations
    
    Return JSON:
    {
      "score": 88,
      "passed": true,
      "details": "Strong experience signals (testimonials), good expertise, authority could improve",
      "issues": ["Only 2 external citations", "No author attribution mentioned"],
      "breakdown": {
        "experience": 24,
        "expertise": 22,
        "authority": 18,
        "trust": 24
      }
    }
  `;
  
  return await gemini.generateContent(prompt);
}
```

### Dimension 3: Readability (15%)

Is the content easy to read and well-structured?

```typescript
async function scoreReadability(content: string): Promise<DimensionScore> {
  // Calculate Flesch-Kincaid
  const fleschScore = calculateFleschKincaid(content);
  
  // Analyze structure
  const structure = analyzeStructure(content);
  
  const prompt = `
    Evaluate readability of this content.
    
    METRICS:
    - Flesch-Kincaid Grade Level: ${fleschScore.gradeLevel}
    - Flesch Reading Ease: ${fleschScore.readingEase}
    - Average sentence length: ${structure.avgSentenceLength} words
    - Average paragraph length: ${structure.avgParagraphLength} sentences
    - Heading frequency: 1 per ${structure.wordsPerHeading} words
    
    CONTENT SAMPLE:
    ${content.slice(0, 3000)}
    
    Score 0-100 based on:
    - Reading ease appropriate for audience (target: 60-70 Flesch)
    - Sentences not too long (target: 15-20 words avg)
    - Paragraphs not too dense (target: 3-4 sentences)
    - Good use of headings (target: every 200-300 words)
    - Use of lists, tables, formatting for scanability
    - Logical flow between sections
    
    Return JSON:
    {
      "score": 82,
      "passed": true,
      "details": "Good readability, could use more subheadings",
      "issues": ["Paragraph in section 3 is 8 sentences long", "No bullet lists used"]
    }
  `;
  
  return await gemini.generateContent(prompt);
}

function calculateFleschKincaid(content: string): { gradeLevel: number; readingEase: number } {
  const sentences = content.split(/[.!?]+/).filter(s => s.trim());
  const words = content.split(/\s+/).filter(w => w.trim());
  const syllables = words.reduce((sum, word) => sum + countSyllables(word), 0);
  
  const avgSentenceLength = words.length / sentences.length;
  const avgSyllablesPerWord = syllables / words.length;
  
  const readingEase = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);
  const gradeLevel = (0.39 * avgSentenceLength) + (11.8 * avgSyllablesPerWord) - 15.59;
  
  return { gradeLevel, readingEase };
}
```

### Dimension 4: Engagement (20%)

Will readers stay engaged and find value?

```typescript
async function scoreEngagement(content: string): Promise<DimensionScore> {
  const prompt = `
    Evaluate engagement potential of this content.
    
    CONTENT:
    ${content}
    
    HOOK STRENGTH (opening):
    - Does the first paragraph grab attention?
    - Is there a clear value proposition immediately?
    - Would you keep reading after the first 100 words?
    
    VALUE DENSITY:
    - Every paragraph should add value
    - No filler content or repetition
    - Actionable insights throughout
    
    SCANABILITY:
    - Can readers skim and get value?
    - Are key points highlighted?
    - Do headings tell a story?
    
    CALL TO ACTION:
    - Clear next steps for reader
    - Internal links to related content
    - Engagement hooks throughout
    
    Score 0-100:
    - 30 points for hook strength
    - 30 points for value density
    - 20 points for scanability
    - 20 points for CTAs/engagement hooks
    
    Return JSON:
    {
      "score": 79,
      "passed": true,
      "details": "Good hook, high value density, needs better CTAs",
      "issues": ["No clear CTA at end", "Section 4 feels repetitive"],
      "breakdown": {
        "hookStrength": 28,
        "valueDensity": 26,
        "scanability": 18,
        "ctaEngagement": 7
      }
    }
  `;
  
  return await gemini.generateContent(prompt);
}
```

### Dimension 5: Information Gain (20%)

Does the content offer unique value competitors don't have?

```typescript
async function scoreInformationGain(
  content: string,
  competitorContents: string[],
): Promise<DimensionScore> {
  const prompt = `
    Evaluate INFORMATION GAIN - unique value this content provides.
    
    OUR CONTENT:
    ${content}
    
    COMPETITOR CONTENT (what already ranks):
    ${competitorContents.slice(0, 5).map((c, i) => `
      --- COMPETITOR ${i + 1} ---
      ${c.slice(0, 2000)}
    `).join('\n')}
    
    Find UNIQUE elements in our content that competitors DON'T have:
    
    1. TESTIMONIALS/QUOTES
       - Real customer quotes with names
       - First-hand experience statements
    
    2. PROPRIETARY STATISTICS
       - Data from internal research
       - Specific numbers with context
    
    3. CASE STUDIES
       - Named client examples
       - Specific results with numbers
    
    4. UNIQUE ANGLES
       - Topics competitors don't cover
       - Perspectives they miss
    
    5. ORIGINAL INSIGHTS
       - Analysis competitors don't offer
       - Connections they don't make
    
    Score 0-100:
    - 0-40: Generic content, nothing unique
    - 41-60: Some unique points, but mostly commodity
    - 61-75: Good differentiation, several unique elements
    - 76-90: Strong differentiation, clear information advantage
    - 91-100: Exceptional, multiple unique value sources
    
    Return JSON:
    {
      "score": 85,
      "passed": true,
      "details": "3 testimonials (competitors: 0), 2 case studies, 5 unique statistics",
      "issues": ["Could add more internal data"],
      "uniqueElements": [
        "Testimonial from TechCorp CEO about 40hr/month savings",
        "Case study: FinanceApp 312% traffic increase",
        "Statistic: 78% SMB switch rate (proprietary data)",
        "Unique section on migration difficulty (no competitor covers)"
      ],
      "uniqueCount": 8,
      "competitorOverlap": "65%"
    }
  `;
  
  return await gemini.generateContent(prompt);
}
```

### Score Examples

**Score 60 (FAIL) - Generic AI Content:**
```
Issues:
- Semantic Coverage: 72 (missing 2 topics)
- E-E-A-T: 55 (no experience signals, generic advice)
- Readability: 78 (OK)
- Engagement: 58 (weak hook, no CTAs)
- Information Gain: 45 (nothing unique vs competitors)

Why it fails: Reads like every other article on the topic.
No testimonials, no case studies, no original insights.
```

**Score 80 (PASS) - Good Content:**
```
Scores:
- Semantic Coverage: 85 (covers all topics)
- E-E-A-T: 82 (has testimonials, good expertise)
- Readability: 88 (well-structured)
- Engagement: 75 (decent hook, some CTAs)
- Information Gain: 78 (3 unique elements)

Why it passes: Has unique value, demonstrates experience.
Could improve: Stronger hook, more internal data.
```

**Score 95 (EXCELLENT) - World-Class Content:**
```
Scores:
- Semantic Coverage: 95 (comprehensive, deep)
- E-E-A-T: 96 (multiple testimonials, expert tone, citations)
- Readability: 92 (scannable, well-paced)
- Engagement: 94 (compelling hook, high value density)
- Information Gain: 96 (8 unique elements, clear differentiation)

Why it's excellent: Competitors can't replicate this.
Unique data, real experiences, actionable insights.
```

---

## Stage 5: Revision

### When to Revise

If ANY dimension scores < 75, the content enters the revision loop.

```typescript
async function reviseContent(
  content: string,
  score: QualityScore,
  brief: ContentBrief,
  attempt: number,
): Promise<{ content: string; score: QualityScore }> {
  if (attempt > 3) {
    return { content, score, status: 'needs_human_review' };
  }
  
  // Identify what needs fixing
  const failingDimensions = Object.entries(score.dimensions)
    .filter(([_, dim]) => !dim.passed)
    .map(([name, dim]) => ({ name, ...dim }));
  
  const revisionPrompt = `
    Revise this content to improve these weak areas:
    
    ${failingDimensions.map(d => `
      ${d.name.toUpperCase()} (Score: ${d.score}/100, Need: 75+)
      Issues: ${d.issues.join('; ')}
    `).join('\n\n')}
    
    CURRENT CONTENT:
    ${content}
    
    IMPROVEMENT SUGGESTIONS:
    ${score.improvementSuggestions.join('\n')}
    
    Rewrite the content addressing these specific issues.
    Maintain everything that was working well.
    Focus your changes on the failing dimensions.
  `;
  
  const revisedContent = await gemini.generateContent(revisionPrompt);
  const newScore = await scoreContent(revisedContent, brief, competitors);
  
  if (newScore.passed) {
    return { content: revisedContent, score: newScore };
  }
  
  return reviseContent(revisedContent, newScore, brief, attempt + 1);
}
```

### Dimension-Specific Revision Strategies

| Dimension | Revision Strategy |
|-----------|-------------------|
| **Semantic Coverage** | Add missing sections, expand thin sections |
| **E-E-A-T** | Inject more testimonials, add citations, include author expertise |
| **Readability** | Break up long paragraphs, add subheadings, simplify sentences |
| **Engagement** | Rewrite intro with stronger hook, add CTAs, remove filler |
| **Information Gain** | Add more client knowledge, find unique angles, include proprietary data |

---

## Stage 6: Publishing

### Publish Flow

```typescript
interface PublishResult {
  status: 'published' | 'scheduled' | 'failed';
  url?: string;
  publishedAt?: Date;
  cmsPostId?: string;
}

async function publishContent(
  content: string,
  brief: ContentBrief,
  score: QualityScore,
  targetPage: Page | null,  // null = new page
): Promise<PublishResult> {
  // Generate meta description
  const metaDescription = await generateMetaDescription(content, brief.keyword);
  
  // Generate schema markup
  const schemaMarkup = await generateSchema(content, brief);
  
  // Publish to WordPress
  const result = await wordpressClient.publish({
    title: extractTitle(content),
    content: content,
    metaDescription,
    schemaMarkup,
    status: 'publish',
    categories: brief.categories,
    tags: brief.tags,
  });
  
  // Track in our database
  await db.insert(publishedContent).values({
    id: generateId(),
    projectId: brief.projectId,
    keyword: brief.keyword,
    url: result.url,
    cmsPostId: result.postId,
    qualityScore: score.overall,
    qualityDetails: score,
    publishedAt: new Date(),
  });
  
  // Submit to GSC for indexing
  await gscClient.requestIndexing(result.url);
  
  return {
    status: 'published',
    url: result.url,
    publishedAt: new Date(),
    cmsPostId: result.postId,
  };
}
```

---

## UI/UX Specification

### Content Dashboard

```
┌─────────────────────────────────────────────────────────────────────────┐
│ CONTENT GENERATION                                      [+ New Content] │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│ ┌───────────────────────────────────────────────────────────────────┐   │
│ │ GENERATING (2)                                                     │   │
│ ├───────────────────────────────────────────────────────────────────┤   │
│ │ ◉ "best accounting software"                                       │   │
│ │   Stage: Generating content ████████████░░░░ 75%                   │   │
│ │   Started: 2 min ago                                               │   │
│ │                                                                    │   │
│ │ ◉ "cloud invoicing solutions"                                      │   │
│ │   Stage: Research ████░░░░░░░░░░░░ 25%                             │   │
│ │   Started: 30 sec ago                                              │   │
│ └───────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│ ┌───────────────────────────────────────────────────────────────────┐   │
│ │ READY FOR REVIEW (3)                                               │   │
│ ├───────────────────────────────────────────────────────────────────┤   │
│ │                                                                    │   │
│ │ ✓ "accounting software comparison"          Score: 87             │   │
│ │   2,450 words • 3 testimonials • 5 statistics                     │   │
│ │   [Review] [Publish]                                               │   │
│ │                                                                    │   │
│ │ ✓ "small business accounting tips"          Score: 82             │   │
│ │   1,850 words • 2 testimonials • 3 statistics                     │   │
│ │   [Review] [Publish]                                               │   │
│ │                                                                    │   │
│ │ ⚠ "enterprise accounting solutions"         Score: 71             │   │
│ │   Info Gain: 68 (below threshold)                                 │   │
│ │   [Review] [Revise] [Add Knowledge]                                │   │
│ │                                                                    │   │
│ └───────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│ ┌───────────────────────────────────────────────────────────────────┐   │
│ │ PUBLISHED (28)                                          [View All] │   │
│ ├───────────────────────────────────────────────────────────────────┤   │
│ │                                                                    │   │
│ │ ✓ "payroll software guide"         Published 2d ago               │   │
│ │   Position: 8 → 5 (+3) ↑           Traffic: +45%                  │   │
│ │                                                                    │   │
│ │ ✓ "invoice templates"              Published 5d ago               │   │
│ │   Position: 12 → 9 (+3) ↑          Traffic: +28%                  │   │
│ │                                                                    │   │
│ │ → "tax software comparison"        Published 7d ago               │   │
│ │   Position: 15 → 14 (+1)           Traffic: +12%                  │   │
│ │                                                                    │   │
│ └───────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Content Review Screen

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ← Back to Dashboard                                                      │
│                                                                          │
│ CONTENT REVIEW                                                           │
│ "accounting software comparison"                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│ ┌─────────────────────────────────────┬─────────────────────────────┐   │
│ │ QUALITY SCORES                      │ KNOWLEDGE USED              │   │
│ ├─────────────────────────────────────┼─────────────────────────────┤   │
│ │                                     │                             │   │
│ │ Semantic Coverage                   │ TESTIMONIALS (3)            │   │
│ │ ████████████████████░░░░ 82  ✓     │ • "Saved 40 hrs/month"      │   │
│ │                                     │   — Sarah Chen, TechCorp    │   │
│ │ E-E-A-T Signals                     │ • "Migration was painless"  │   │
│ │ █████████████████████░░░ 88  ✓     │   — Mike Ross, FinanceApp   │   │
│ │                                     │ • "ROI within 3 months"     │   │
│ │ Readability                         │   — Lisa Park, StartupCo    │   │
│ │ ████████████████████████ 95  ✓     │                             │   │
│ │                                     │ CASE STUDIES (1)            │   │
│ │ Engagement                          │ • FinanceApp: 312% traffic  │   │
│ │ ███████████████████░░░░░ 79  ✓     │   increase in 8 months      │   │
│ │                                     │                             │   │
│ │ Information Gain                    │ STATISTICS (5)              │   │
│ │ █████████████████████░░░ 85  ✓     │ • 78% SMB switch rate       │   │
│ │                                     │ • $4,200 avg annual savings │   │
│ │ ─────────────────────────           │ • 67% cite UX as factor     │   │
│ │ OVERALL: 87  ✓ READY                │ • 89% want cloud-based      │   │
│ │                                     │ • 3.2 months avg migration  │   │
│ └─────────────────────────────────────┴─────────────────────────────┘   │
│                                                                          │
│ ┌───────────────────────────────────────────────────────────────────┐   │
│ │ COMPETITOR COMPARISON                                              │   │
│ ├───────────────────────────────────────────────────────────────────┤   │
│ │                                                                    │   │
│ │ Word Count       Ours: 2,450    Avg: 2,100    ✓ +17%              │   │
│ │ Testimonials     Ours: 3        Avg: 0        ✓ Unique            │   │
│ │ Statistics       Ours: 8        Avg: 3        ✓ +167%             │   │
│ │ Unique Sections  4 topics competitors don't cover                  │   │
│ │                                                                    │   │
│ └───────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│ ┌───────────────────────────────────────────────────────────────────┐   │
│ │ CONTENT PREVIEW                                        [Full View] │   │
│ ├───────────────────────────────────────────────────────────────────┤   │
│ │                                                                    │   │
│ │ # Best Accounting Software Comparison (2026)                       │   │
│ │                                                                    │   │
│ │ Choosing accounting software isn't about features—it's about      │   │
│ │ finding a system that matches how your business actually works.   │   │
│ │ After helping 200+ companies migrate their accounting systems,    │   │
│ │ we've seen what separates software that scales from software      │   │
│ │ that becomes a bottleneck.                                         │   │
│ │                                                                    │   │
│ │ "We switched from QuickBooks to FreshBooks and saved 40 hours     │   │
│ │ per month on invoicing alone," says Sarah Chen, CFO at TechCorp.  │   │
│ │ That's the kind of impact the right choice makes...               │   │
│ │                                                                    │   │
│ │ [Continue reading...]                                              │   │
│ │                                                                    │   │
│ └───────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│ ┌───────────────────────────────────────────────────────────────────┐   │
│ │ META PREVIEW                                                       │   │
│ ├───────────────────────────────────────────────────────────────────┤   │
│ │                                                                    │   │
│ │ Title: Best Accounting Software Comparison (2026) | [Brand]       │   │
│ │ URL: /blog/accounting-software-comparison                          │   │
│ │ Description: Compare top accounting software for small business.  │   │
│ │ See real user testimonials, pricing breakdowns, and migration     │   │
│ │ tips from 200+ implementations. Updated for 2026.                 │   │
│ │                                                                    │   │
│ │                                                         [Edit Meta]│   │
│ └───────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│         [Request Changes]    [Edit Content]    [Publish to WordPress]   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### New Content Generation Flow

**Step 1: Select Keyword**
```
┌─────────────────────────────────────────────────────────────────────────┐
│ NEW CONTENT                                               Step 1 of 4   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│ SELECT TARGET KEYWORD                                                    │
│                                                                          │
│ From your approved keywords:                              [Search...]   │
│                                                                          │
│ ┌───────────────────────────────────────────────────────────────────┐   │
│ │ Quick Wins (Position 5-20)                                         │   │
│ │                                                                    │   │
│ │ ○ "accounting software for startups"                               │   │
│ │   Vol: 2,400 • Pos: 8 • No content yet                            │   │
│ │                                                                    │   │
│ │ ○ "cloud bookkeeping services"                                     │   │
│ │   Vol: 1,800 • Pos: 12 • Existing page (optimize)                 │   │
│ │                                                                    │   │
│ │ ● "accounting software comparison"                    ← Selected   │   │
│ │   Vol: 3,200 • Pos: 15 • No content yet                           │   │
│ └───────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│ ┌───────────────────────────────────────────────────────────────────┐   │
│ │ High Volume                                                        │   │
│ │                                                                    │   │
│ │ ○ "best accounting software"                                       │   │
│ │   Vol: 8,100 • Pos: 22 • No content yet                           │   │
│ │                                                                    │   │
│ │ ○ "small business accounting"                                      │   │
│ │   Vol: 5,400 • Pos: 28 • No content yet                           │   │
│ └───────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│ Or enter custom keyword:                                                 │
│ ┌───────────────────────────────────────────────────────────────────┐   │
│ │                                                                    │   │
│ └───────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│                                                [Cancel]  [Next: Research]│
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Step 2: Research Preview**
```
┌─────────────────────────────────────────────────────────────────────────┐
│ NEW CONTENT                                               Step 2 of 4   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│ RESEARCH: "accounting software comparison"                               │
│                                                                          │
│ ┌─────────────────────────────────────┬─────────────────────────────┐   │
│ │ SERP ANALYSIS                       │ AVAILABLE KNOWLEDGE         │   │
│ ├─────────────────────────────────────┼─────────────────────────────┤   │
│ │                                     │                             │   │
│ │ Top 10 Average:                     │ Testimonials: 5 relevant    │   │
│ │ • Word count: 2,100                 │ Case Studies: 2 relevant    │   │
│ │ • Headings: 12                      │ Statistics: 8 relevant      │   │
│ │ • Statistics: 3                     │                             │   │
│ │ • Testimonials: 0  ← opportunity    │ Brand voice: ✓ Configured   │   │
│ │                                     │                             │   │
│ │ Common Topics:                      │                             │   │
│ │ ✓ Feature comparison                │                             │   │
│ │ ✓ Pricing tables                    │                             │   │
│ │ ✓ Pros/cons lists                   │                             │   │
│ │ ✓ Integration options               │                             │   │
│ │                                     │                             │   │
│ │ Gap Topics (our opportunity):       │                             │   │
│ │ ★ Migration difficulty              │                             │   │
│ │ ★ Hidden costs                      │                             │   │
│ │ ★ Real user experiences             │                             │   │
│ └─────────────────────────────────────┴─────────────────────────────┘   │
│                                                                          │
│ ┌───────────────────────────────────────────────────────────────────┐   │
│ │ PEOPLE ALSO ASK                                                    │   │
│ ├───────────────────────────────────────────────────────────────────┤   │
│ │ • What is the easiest accounting software to use?                  │   │
│ │ • How much does accounting software cost per month?                │   │
│ │ • Can I switch accounting software mid-year?                       │   │
│ │ • What's the best free accounting software?                        │   │
│ └───────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│                                          [Back]  [Next: Content Brief]  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Step 3: Content Brief**
```
┌─────────────────────────────────────────────────────────────────────────┐
│ NEW CONTENT                                               Step 3 of 4   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│ CONTENT BRIEF                                              [Edit Brief] │
│                                                                          │
│ ┌─────────────────────────────────────┬─────────────────────────────┐   │
│ │ TARGETS                             │ OUTLINE                     │   │
│ ├─────────────────────────────────────┼─────────────────────────────┤   │
│ │                                     │                             │   │
│ │ Word Count: 2,500                   │ 1. Introduction             │   │
│ │ (20% above competitor avg)          │    ~200 words               │   │
│ │                                     │                             │   │
│ │ Format: Comparison Guide            │ 2. Quick Comparison Table   │   │
│ │                                     │    ~300 words + table       │   │
│ │ Reading Level: Medium               │    📊 Inject: stat-switch   │   │
│ │                                     │                             │   │
│ │ Headings: 14                        │ 3. Detailed Reviews         │   │
│ │                                     │    ~800 words               │   │
│ │                                     │                             │   │
│ │                                     │ 4. Pricing Breakdown        │   │
│ │                                     │    ~400 words               │   │
│ │                                     │    📋 Inject: case-finance  │   │
│ │                                     │                             │   │
│ │                                     │ 5. How to Choose            │   │
│ │                                     │    ~350 words               │   │
│ │                                     │    💬 Inject: test-techcorp │   │
│ │                                     │                             │   │
│ │                                     │ 6. Migration Tips ★         │   │
│ │                                     │    ~250 words (gap topic)   │   │
│ │                                     │                             │   │
│ │                                     │ 7. FAQ                      │   │
│ │                                     │    ~200 words (from PAA)    │   │
│ └─────────────────────────────────────┴─────────────────────────────┘   │
│                                                                          │
│ ┌───────────────────────────────────────────────────────────────────┐   │
│ │ KNOWLEDGE TO INJECT                                    [Edit]      │   │
│ ├───────────────────────────────────────────────────────────────────┤   │
│ │                                                                    │   │
│ │ ☑ 💬 "Saved 40 hrs/month on invoicing" — Sarah Chen, TechCorp     │   │
│ │      → Section 5: How to Choose                                   │   │
│ │                                                                    │   │
│ │ ☑ 📋 FinanceApp case study: 312% traffic, $45K saved              │   │
│ │      → Section 4: Pricing Breakdown                               │   │
│ │                                                                    │   │
│ │ ☑ 📊 "78% of SMBs switch software within 2 years"                 │   │
│ │      → Section 2: Quick Comparison                                │   │
│ │                                                                    │   │
│ │ ☐ 💬 "Support responded in 2 hours" — Mike Ross                   │   │
│ │ ☐ 📊 "Average migration takes 3.2 months"                         │   │
│ │                                                                    │   │
│ └───────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│                                          [Back]  [Generate Content →]   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Step 4: Generation Progress**
```
┌─────────────────────────────────────────────────────────────────────────┐
│ NEW CONTENT                                               Step 4 of 4   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│ GENERATING: "accounting software comparison"                             │
│                                                                          │
│ ████████████████████████████████████░░░░░░ 78%                          │
│                                                                          │
│ ┌───────────────────────────────────────────────────────────────────┐   │
│ │                                                                    │   │
│ │ ✓ Research complete                               12 sec          │   │
│ │ ✓ Brief generated                                  8 sec          │   │
│ │ ✓ Section 1: Introduction                         15 sec          │   │
│ │ ✓ Section 2: Quick Comparison Table               22 sec          │   │
│ │ ✓ Section 3: Detailed Reviews                     35 sec          │   │
│ │ ✓ Section 4: Pricing Breakdown                    18 sec          │   │
│ │ ● Section 5: How to Choose                        generating...   │   │
│ │ ○ Section 6: Migration Tips                                       │   │
│ │ ○ Section 7: FAQ                                                  │   │
│ │ ○ Quality scoring                                                 │   │
│ │ ○ Revision (if needed)                                            │   │
│ │                                                                    │   │
│ └───────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│ Estimated time remaining: 45 seconds                                     │
│                                                                          │
│                                        [Cancel]  [Run in Background →]  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

```sql
-- Content generation records
CREATE TABLE content_generations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  
  -- Research
  research_data JSONB NOT NULL,
  
  -- Brief
  brief JSONB NOT NULL,
  
  -- Generated content
  content TEXT,
  meta_description TEXT,
  
  -- Quality scoring
  quality_score JSONB,
  overall_score INTEGER,
  passed BOOLEAN,
  
  -- Revision tracking
  revision_count INTEGER DEFAULT 0,
  revision_history JSONB DEFAULT '[]',
  
  -- Status
  status TEXT NOT NULL DEFAULT 'researching',
  -- 'researching' | 'briefing' | 'generating' | 'scoring' | 'revising' | 
  -- 'ready' | 'published' | 'failed' | 'needs_review'
  
  -- Publishing
  published_url TEXT,
  cms_post_id TEXT,
  published_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Knowledge usage tracking
CREATE TABLE content_knowledge_usage (
  id TEXT PRIMARY KEY,
  content_generation_id TEXT NOT NULL REFERENCES content_generations(id),
  knowledge_id TEXT NOT NULL REFERENCES client_knowledge(id),
  section_index INTEGER NOT NULL,
  injection_note TEXT,
  actually_used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_generations_project ON content_generations(project_id);
CREATE INDEX idx_generations_status ON content_generations(status);
CREATE INDEX idx_generations_keyword ON content_generations(keyword);
```

---

## Summary

| Stage | What Happens | Output |
|-------|--------------|--------|
| **Research** | SERP analysis, competitor scraping, knowledge retrieval | ContentResearch |
| **Brief** | Outline, targets, knowledge injection points | ContentBrief |
| **Generate** | Gemini 3.1 Pro + RAG + brand voice | Raw content |
| **Score** | 5 dimensions, 75+ threshold | QualityScore |
| **Revise** | Fix failing dimensions, max 3 attempts | Improved content |
| **Publish** | To WordPress + GSC indexing request | Live URL |

**V1 includes information gain because:**
1. It's just one Gemini comparison prompt
2. We already collect testimonials + case studies
3. Without it, we're just another AI content tool
4. It's THE differentiator for ranking
