# Phase 98: SEO Chat Technical Architecture

> **Purpose:** Comprehensive technical specification for the SEO Chat system that powers prospect to client conversion.
>
> **Model Architecture (per CLAUDE.md):**
> - Grok 4.1-fast: Intent classification, structured extraction ($0.20/1M)
> - Grok 4.1-thinking: Complex reasoning when needed ($2.00/1M)
> - Gemini 3.1 Pro: Content generation, proposal narratives ($1.25/1M)
>
> **Updated:** 2026-05-12

---

## Table of Contents

1. [Intent Router Design](#1-intent-router-design)
2. [Analysis Pipeline](#2-analysis-pipeline)
3. [Scraping Integration](#3-scraping-integration)
4. [Keyword Intelligence Integration](#4-keyword-intelligence-integration)
5. [Proposal Generation Pipeline](#5-proposal-generation-pipeline)
6. [State Management](#6-state-management)
7. [API Design](#7-api-design)
8. [Database Schema](#8-database-schema)

---

## 1. Intent Router Design

### 1.1 Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         INTENT ROUTER                                     │
│                                                                          │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────────────┐ │
│  │ Pattern Matcher │───▶│ Entity Extractor│───▶│ Confidence Evaluator │ │
│  │ (Regex, O(1))   │    │ (Regex + NER)   │    │ (Threshold Check)    │ │
│  └─────────────────┘    └─────────────────┘    └──────────────────────┘ │
│           │                                              │               │
│           │ confidence < 0.7                             │ confidence >= 0.7
│           ▼                                              ▼               │
│  ┌─────────────────┐                          ┌──────────────────────┐  │
│  │ Grok 4.1-fast   │─────────────────────────▶│   Intent Response    │  │
│  │ LLM Fallback    │                          │   + Entities         │  │
│  └─────────────────┘                          └──────────────────────┘  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Intent Types & Pattern Matching

```typescript
// apps/web/src/lib/seo-chat/router/patterns.ts

export type Intent =
  | 'domain_analysis'
  | 'keyword_feasibility'
  | 'keyword_discovery'
  | 'competitor_analysis'
  | 'technical_diagnosis'
  | 'content_recommendations'
  | 'quick_wins'
  | 'generate_proposal'
  | 'general_qa';

export interface IntentPattern {
  intent: Intent;
  patterns: RegExp[];
  requiredEntities: ('domain' | 'keywords' | 'competitor')[];
  priority: number; // Higher = check first
}

export const INTENT_PATTERNS: IntentPattern[] = [
  // Generate Proposal - highest priority, explicit action
  {
    intent: 'generate_proposal',
    patterns: [
      /generate\s+proposal/i,
      /create\s+proposal/i,
      /send\s+(proposal|quote)/i,
      /pasiulyma\s+(generuoti|sukurti)/i, // Lithuanian
    ],
    requiredEntities: ['domain'], // From context
    priority: 100,
  },
  
  // Keyword Feasibility - "can X rank for Y"
  {
    intent: 'keyword_feasibility',
    patterns: [
      /can\s+[\w.-]+\.(com|lt|io|net|org|eu|co\.uk)\s+rank/i,
      /ranking\s+potential/i,
      /feasib(le|ility)/i,
      /ar\s+gali\s+.+\s+rankinoti/i, // Lithuanian: "ar gali X rankinoti"
      /galimyb[eė]/i, // Lithuanian: "galimybe"
    ],
    requiredEntities: ['domain', 'keywords'],
    priority: 90,
  },
  
  // Domain Analysis - new domain mentioned
  {
    intent: 'domain_analysis',
    patterns: [
      /^(look\s+at|check|analyze|show\s+me|patikrink)\s+[\w.-]+\.(com|lt|io|net|org|eu|co\.uk)/i,
      /what\s+does\s+[\w.-]+\.(com|lt|io|net|org|eu|co\.uk)\s+look\s+like/i,
      /kaip\s+atrodo\s+[\w.-]+\.(com|lt|io|net|org|eu|co\.uk)/i, // Lithuanian
    ],
    requiredEntities: ['domain'],
    priority: 85,
  },
  
  // Competitor Analysis
  {
    intent: 'competitor_analysis',
    patterns: [
      /competitor/i,
      /what\s+is\s+[\w.-]+\s+doing/i,
      /compare\s+to\s+[\w.-]+/i,
      /vs\.?\s+[\w.-]+/i,
      /konkurent/i, // Lithuanian
    ],
    requiredEntities: ['competitor'],
    priority: 80,
  },
  
  // Technical Diagnosis
  {
    intent: 'technical_diagnosis',
    patterns: [
      /what'?s\s+wrong/i,
      /technical\s+issues?/i,
      /rankings?\s+(drop|fell|decreased)/i,
      /kodėl\s+(sumažėjo|nukrito)/i, // Lithuanian: "why dropped"
      /techninės?\s+problemos?/i, // Lithuanian
    ],
    requiredEntities: ['domain'],
    priority: 75,
  },
  
  // Keyword Discovery
  {
    intent: 'keyword_discovery',
    patterns: [
      /what\s+keywords?\s+should/i,
      /should\s+target/i,
      /keyword\s+(ideas?|opportunities)/i,
      /kokie\s+raktažodžiai/i, // Lithuanian
    ],
    requiredEntities: ['domain'],
    priority: 70,
  },
  
  // Content Recommendations
  {
    intent: 'content_recommendations',
    patterns: [
      /what\s+(content|should\s+I\s+write)/i,
      /content\s+(ideas?|gaps?|plan)/i,
      /kokį\s+turinį/i, // Lithuanian
    ],
    requiredEntities: ['domain'],
    priority: 65,
  },
  
  // Quick Wins
  {
    intent: 'quick_wins',
    patterns: [
      /quick\s+wins?/i,
      /easy\s+wins?/i,
      /fix\s+first/i,
      /low\s+hanging/i,
      /priorit(y|ize)/i,
      /greit(i|os)\s+(laimėjimai|rezultatai)/i, // Lithuanian
    ],
    requiredEntities: ['domain'],
    priority: 60,
  },
  
  // General Q&A - lowest priority (fallback)
  {
    intent: 'general_qa',
    patterns: [], // No patterns - this is the fallback
    requiredEntities: [],
    priority: 0,
  },
];
```

### 1.3 Entity Extraction

```typescript
// apps/web/src/lib/seo-chat/router/entity-extractor.ts

export interface ExtractedEntities {
  domains: string[];
  keywords: string[];
  competitors: string[];
  timeframe?: { start: Date; end: Date };
  locale?: string;
}

// TLD pattern for domain extraction
const DOMAIN_PATTERN = /[\w-]+\.(com|lt|io|net|org|eu|co\.uk|de|pl|lv|ee)/gi;

// Keywords in quotes or after specific phrases
const QUOTED_PATTERN = /"([^"]+)"/g;
const KEYWORD_PHRASES = [
  /(?:for|rank\s+for|target|dėl)\s+([^,?.!]+)/gi,
  /keywords?:\s*([^,?.!]+(?:,\s*[^,?.!]+)*)/gi,
];

export function extractEntities(
  query: string,
  conversationHistory: Message[]
): ExtractedEntities {
  const result: ExtractedEntities = {
    domains: [],
    keywords: [],
    competitors: [],
  };

  // 1. Extract domains from current query
  const domainMatches = query.match(DOMAIN_PATTERN) || [];
  result.domains = [...new Set(domainMatches.map(d => d.toLowerCase()))];

  // 2. Extract keywords (quoted strings)
  const quotedMatches = [...query.matchAll(QUOTED_PATTERN)];
  for (const match of quotedMatches) {
    result.keywords.push(match[1].trim());
  }

  // 3. Extract keywords after phrases
  for (const pattern of KEYWORD_PHRASES) {
    const matches = [...query.matchAll(pattern)];
    for (const match of matches) {
      // Split by comma for multiple keywords
      const kws = match[1].split(/[,;]/).map(k => k.trim()).filter(Boolean);
      result.keywords.push(...kws);
    }
  }

  // 4. Extract competitors (domains after "vs", "competitor", "compare to")
  const competitorPatterns = [
    /(?:vs\.?|versus|compared?\s+to|competitor)\s+([\w.-]+\.\w+)/gi,
  ];
  for (const pattern of competitorPatterns) {
    const matches = [...query.matchAll(pattern)];
    for (const match of matches) {
      result.competitors.push(match[1].toLowerCase());
    }
  }

  // 5. Inherit from conversation history if current query lacks context
  if (result.domains.length === 0) {
    const historyDomain = findDomainInHistory(conversationHistory);
    if (historyDomain) {
      result.domains = [historyDomain];
    }
  }

  // 6. Detect locale from query language
  result.locale = detectLocale(query);

  return result;
}

function findDomainInHistory(messages: Message[]): string | null {
  // Search backwards for most recent domain mention
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const domains = msg.content.match(DOMAIN_PATTERN);
    if (domains && domains.length > 0) {
      return domains[0].toLowerCase();
    }
  }
  return null;
}

function detectLocale(text: string): string {
  // Simple Lithuanian detection
  const lithuanianPatterns = [
    /[ąčęėįšųūž]/i,
    /\b(ir|ar|kad|kas|kaip|kodėl|kur|kokį|kokie)\b/i,
  ];
  
  for (const pattern of lithuanianPatterns) {
    if (pattern.test(text)) {
      return 'lt';
    }
  }
  return 'en';
}
```

### 1.4 Grok 4.1-fast Fallback Classifier

```typescript
// apps/web/src/lib/seo-chat/router/llm-classifier.ts

import { grokFast } from '@/lib/llm/grok';

export interface LLMClassificationResult {
  intent: Intent;
  confidence: number;
  reasoning: string;
  suggestedEntities: {
    domains?: string[];
    keywords?: string[];
    competitors?: string[];
  };
  clarificationSuggestions?: string[];
}

const CLASSIFICATION_PROMPT = `You are an intent classifier for an SEO agency chat system.

<intents>
- domain_analysis: User wants to analyze a website's SEO health
- keyword_feasibility: User asks if a domain can rank for specific keywords
- keyword_discovery: User wants keyword suggestions/opportunities for a domain
- competitor_analysis: User wants to compare with or analyze competitors
- technical_diagnosis: User reports ranking drops or technical issues
- content_recommendations: User asks what content to create
- quick_wins: User asks for easy/quick improvements
- generate_proposal: User explicitly requests a proposal/quote
- general_qa: General SEO questions, not about a specific domain
</intents>

<query>
{query}
</query>

<conversation_context>
Domain in context: {domain}
Previous intent: {previousIntent}
</conversation_context>

Classify the intent. Return JSON:
{
  "intent": "intent_name",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "suggestedEntities": {
    "domains": ["extracted domains"],
    "keywords": ["extracted keywords"],
    "competitors": ["extracted competitors"]
  }
}`;

export async function classifyWithLLM(
  query: string,
  context: { domain?: string; previousIntent?: Intent }
): Promise<LLMClassificationResult> {
  const prompt = CLASSIFICATION_PROMPT
    .replace('{query}', query)
    .replace('{domain}', context.domain || 'none')
    .replace('{previousIntent}', context.previousIntent || 'none');

  const response = await grokFast.generate({
    prompt,
    maxTokens: 500,
    temperature: 0.1, // Low temperature for consistent classification
  });

  try {
    const result = JSON.parse(response.text);
    return {
      intent: result.intent as Intent,
      confidence: result.confidence,
      reasoning: result.reasoning,
      suggestedEntities: result.suggestedEntities || {},
    };
  } catch (error) {
    // Fallback if JSON parsing fails
    return {
      intent: 'general_qa',
      confidence: 0.5,
      reasoning: 'Failed to parse LLM response',
      suggestedEntities: {},
    };
  }
}
```

### 1.5 Main Intent Router

```typescript
// apps/web/src/lib/seo-chat/router/intent-router.ts

export interface DetectedIntent {
  intent: Intent;
  confidence: number;
  entities: ExtractedEntities;
  source: 'pattern' | 'llm';
  missingRequired?: ('domain' | 'keywords' | 'competitor')[];
}

const CONFIDENCE_THRESHOLD = 0.7;

export async function detectIntent(
  query: string,
  conversationHistory: Message[],
  previousIntent?: Intent
): Promise<DetectedIntent> {
  // Step 1: Extract entities first
  const entities = extractEntities(query, conversationHistory);

  // Step 2: Try pattern matching (sorted by priority)
  const sortedPatterns = [...INTENT_PATTERNS].sort((a, b) => b.priority - a.priority);

  for (const { intent, patterns, requiredEntities } of sortedPatterns) {
    for (const pattern of patterns) {
      if (pattern.test(query)) {
        // Check if we have required entities
        const missingRequired = checkMissingEntities(entities, requiredEntities);
        
        return {
          intent,
          confidence: missingRequired.length > 0 ? 0.7 : 0.9,
          entities,
          source: 'pattern',
          missingRequired: missingRequired.length > 0 ? missingRequired : undefined,
        };
      }
    }
  }

  // Step 3: No pattern match - use LLM fallback
  const llmResult = await classifyWithLLM(query, {
    domain: entities.domains[0],
    previousIntent,
  });

  // Merge LLM-suggested entities with extracted ones
  const mergedEntities: ExtractedEntities = {
    domains: [...new Set([...entities.domains, ...(llmResult.suggestedEntities.domains || [])])],
    keywords: [...new Set([...entities.keywords, ...(llmResult.suggestedEntities.keywords || [])])],
    competitors: [...new Set([...entities.competitors, ...(llmResult.suggestedEntities.competitors || [])])],
    locale: entities.locale,
  };

  // Step 4: If confidence too low, return with clarification needed
  if (llmResult.confidence < CONFIDENCE_THRESHOLD) {
    return {
      intent: 'general_qa', // Safe fallback
      confidence: llmResult.confidence,
      entities: mergedEntities,
      source: 'llm',
    };
  }

  return {
    intent: llmResult.intent,
    confidence: llmResult.confidence,
    entities: mergedEntities,
    source: 'llm',
  };
}

function checkMissingEntities(
  entities: ExtractedEntities,
  required: ('domain' | 'keywords' | 'competitor')[]
): ('domain' | 'keywords' | 'competitor')[] {
  const missing: ('domain' | 'keywords' | 'competitor')[] = [];

  if (required.includes('domain') && entities.domains.length === 0) {
    missing.push('domain');
  }
  if (required.includes('keywords') && entities.keywords.length === 0) {
    missing.push('keywords');
  }
  if (required.includes('competitor') && entities.competitors.length === 0) {
    missing.push('competitor');
  }

  return missing;
}
```

---

## 2. Analysis Pipeline

### 2.1 DAG Executor Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DAG ANALYSIS EXECUTOR                               │
│                                                                             │
│  Level 0 (no deps)      Level 1                Level 2                      │
│  ┌───────────────┐      ┌───────────────┐      ┌───────────────┐           │
│  │ domain_health │─────▶│ kw_feasibility│─────▶│  quick_wins   │           │
│  └───────────────┘      └───────────────┘      └───────────────┘           │
│         │                      │                                            │
│         │               ┌───────────────┐      ┌───────────────┐           │
│         └──────────────▶│ competitor    │─────▶│ content_gaps  │           │
│                         └───────────────┘      └───────────────┘           │
│  ┌───────────────┐      ┌───────────────┐                                  │
│  │ kw_universe   │─────▶│ topical_map   │                                  │
│  └───────────────┘      └───────────────┘                                  │
│                                                                             │
│  ┌───────────────┐                                                         │
│  │technical_audit│ (independent)                                           │
│  └───────────────┘                                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Analysis Registry

```typescript
// apps/web/src/lib/seo-chat/analyses/registry.ts

export interface Analysis<TInput = unknown, TOutput = unknown> {
  id: string;
  name: string;
  description: string;
  dependencies: string[];
  requiredContext: ('domain' | 'keywords' | 'competitor')[];
  estimatedCostMicros: number; // Cost in microdollars ($0.01 = 10000)
  estimatedTimeMs: number;
  cacheTTLSeconds: number; // How long to cache results
  execute(input: TInput, context: AnalysisContext): Promise<TOutput>;
}

export interface AnalysisContext {
  workspaceId: string;
  sessionId: string;
  domain?: string;
  keywords?: string[];
  competitor?: string;
  previousResults: Map<string, unknown>;
  settings: WorkspaceSettings;
}

export const analysisRegistry = new Map<string, Analysis>();

// Domain Health Analysis
analysisRegistry.set('domain_health', {
  id: 'domain_health',
  name: 'Domain Health Check',
  description: 'Site authority, traffic, technical issues',
  dependencies: [],
  requiredContext: ['domain'],
  estimatedCostMicros: 10000, // $0.01
  estimatedTimeMs: 3000,
  cacheTTLSeconds: 3600, // 1 hour
  execute: async (input, context) => {
    // Implementation uses DataForSEO Domain Analytics
    // See Section 4.1 for DataForSEO integration
    return executeDomainHealth(context.domain!, context);
  },
});

// Keyword Feasibility Analysis
analysisRegistry.set('keyword_feasibility', {
  id: 'keyword_feasibility',
  name: 'Keyword Feasibility',
  description: 'Can we rank? Timeline and effort estimation',
  dependencies: [], // Can run independently, uses domain_health if available
  requiredContext: ['domain', 'keywords'],
  estimatedCostMicros: 20000, // $0.02
  estimatedTimeMs: 4000,
  cacheTTLSeconds: 86400, // 24 hours
  execute: async (input, context) => {
    return executeKeywordFeasibility(
      context.domain!,
      context.keywords!,
      context.previousResults.get('domain_health'),
      context.settings.feasibility
    );
  },
});

// Keyword Universe Expansion
analysisRegistry.set('keyword_universe', {
  id: 'keyword_universe',
  name: 'Keyword Universe',
  description: 'Expand seeds to full keyword list',
  dependencies: [],
  requiredContext: ['domain'],
  estimatedCostMicros: 30000, // $0.03
  estimatedTimeMs: 5000,
  cacheTTLSeconds: 86400,
  execute: async (input, context) => {
    // Delegates to KeywordUniverseBuilder
    return executeKeywordUniverse(context.domain!, context.keywords || [], context);
  },
});

// Topical Map Generation
analysisRegistry.set('topical_map', {
  id: 'topical_map',
  name: 'Topical Map',
  description: 'Cluster keywords into pillar/subtopic hierarchy',
  dependencies: ['keyword_universe'],
  requiredContext: ['domain'],
  estimatedCostMicros: 10000, // $0.01 (local computation)
  estimatedTimeMs: 2000,
  cacheTTLSeconds: 86400,
  execute: async (input, context) => {
    const universe = context.previousResults.get('keyword_universe') as KeywordUniverseResult;
    return executeTopicalMap(universe, context);
  },
});

// Competitor Discovery
analysisRegistry.set('competitor_discovery', {
  id: 'competitor_discovery',
  name: 'Competitor Discovery',
  description: 'Find and analyze competitors',
  dependencies: ['domain_health'],
  requiredContext: ['domain'],
  estimatedCostMicros: 20000, // $0.02
  estimatedTimeMs: 4000,
  cacheTTLSeconds: 86400,
  execute: async (input, context) => {
    const health = context.previousResults.get('domain_health') as DomainHealthResult;
    return executeCompetitorDiscovery(context.domain!, health, context);
  },
});

// Content Gaps Analysis
analysisRegistry.set('content_gaps', {
  id: 'content_gaps',
  name: 'Content Gaps',
  description: 'Missing content opportunities vs competitors',
  dependencies: ['keyword_universe'],
  requiredContext: ['domain'],
  estimatedCostMicros: 20000, // $0.02
  estimatedTimeMs: 4000,
  cacheTTLSeconds: 86400,
  execute: async (input, context) => {
    const universe = context.previousResults.get('keyword_universe') as KeywordUniverseResult;
    return executeContentGaps(context.domain!, universe, context);
  },
});

// Technical Audit
analysisRegistry.set('technical_audit', {
  id: 'technical_audit',
  name: 'Technical Audit',
  description: 'Full technical SEO check',
  dependencies: [],
  requiredContext: ['domain'],
  estimatedCostMicros: 50000, // $0.05
  estimatedTimeMs: 8000,
  cacheTTLSeconds: 3600,
  execute: async (input, context) => {
    return executeTechnicalAudit(context.domain!, context);
  },
});

// Quick Wins Analysis
analysisRegistry.set('quick_wins', {
  id: 'quick_wins',
  name: 'Quick Wins',
  description: 'Low-effort, high-impact fixes',
  dependencies: ['domain_health'],
  requiredContext: ['domain'],
  estimatedCostMicros: 10000, // $0.01 (computed from existing data)
  estimatedTimeMs: 1000,
  cacheTTLSeconds: 3600,
  execute: async (input, context) => {
    const health = context.previousResults.get('domain_health') as DomainHealthResult;
    const feasibility = context.previousResults.get('keyword_feasibility') as KeywordFeasibilityResult | undefined;
    return executeQuickWins(health, feasibility, context);
  },
});
```

### 2.3 DAG Builder & Executor

```typescript
// apps/web/src/lib/seo-chat/analyses/dag-executor.ts

export interface DAGLevel {
  level: number;
  analysisIds: string[];
}

export interface ExecutionPlan {
  levels: DAGLevel[];
  totalEstimatedCostMicros: number;
  totalEstimatedTimeMs: number;
}

/**
 * Build dependency graph and create execution levels.
 * Analyses at the same level can run in parallel.
 */
export function buildExecutionPlan(
  requestedAnalyses: string[],
  registry: Map<string, Analysis>
): ExecutionPlan {
  // Expand dependencies (transitive closure)
  const allRequired = new Set<string>();
  const queue = [...requestedAnalyses];

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (allRequired.has(id)) continue;
    
    const analysis = registry.get(id);
    if (!analysis) {
      throw new Error(`Unknown analysis: ${id}`);
    }
    
    allRequired.add(id);
    queue.push(...analysis.dependencies);
  }

  // Topological sort into levels
  const levels: DAGLevel[] = [];
  const completed = new Set<string>();
  const remaining = new Set(allRequired);

  while (remaining.size > 0) {
    const currentLevel: string[] = [];

    for (const id of remaining) {
      const analysis = registry.get(id)!;
      const depsCompleted = analysis.dependencies.every(d => completed.has(d));
      
      if (depsCompleted) {
        currentLevel.push(id);
      }
    }

    if (currentLevel.length === 0) {
      throw new Error('Circular dependency detected in analysis DAG');
    }

    // Sort by estimated time (longest first for better parallelization)
    currentLevel.sort((a, b) => {
      const timeA = registry.get(a)!.estimatedTimeMs;
      const timeB = registry.get(b)!.estimatedTimeMs;
      return timeB - timeA;
    });

    levels.push({
      level: levels.length,
      analysisIds: currentLevel,
    });

    for (const id of currentLevel) {
      completed.add(id);
      remaining.delete(id);
    }
  }

  // Calculate totals
  let totalCost = 0;
  let maxTimePerLevel = 0;

  for (const level of levels) {
    let levelMaxTime = 0;
    for (const id of level.analysisIds) {
      const analysis = registry.get(id)!;
      totalCost += analysis.estimatedCostMicros;
      levelMaxTime = Math.max(levelMaxTime, analysis.estimatedTimeMs);
    }
    maxTimePerLevel += levelMaxTime; // Sequential levels, parallel within
  }

  return {
    levels,
    totalEstimatedCostMicros: totalCost,
    totalEstimatedTimeMs: maxTimePerLevel,
  };
}

/**
 * Execute analysis plan with SSE streaming.
 */
export async function executeAnalysisPlan(
  plan: ExecutionPlan,
  context: AnalysisContext,
  emitter: SSEEmitter
): Promise<Map<string, unknown>> {
  const results = new Map<string, unknown>();
  const startTime = Date.now();
  let totalCostMicros = 0;

  for (const level of plan.levels) {
    // Emit level start
    await emitter.emit({
      type: 'level_start',
      level: level.level,
      analyses: level.analysisIds,
    });

    // Execute all analyses at this level in parallel
    const levelPromises = level.analysisIds.map(async (id) => {
      const analysis = analysisRegistry.get(id)!;
      
      // Emit analysis start
      await emitter.emit({
        type: 'analysis_start',
        analysisId: id,
        name: analysis.name,
      });

      try {
        // Check cache first
        const cached = await checkCache(id, context);
        if (cached) {
          results.set(id, cached);
          await emitter.emit({
            type: 'analysis_complete',
            analysisId: id,
            cached: true,
          });
          return { id, result: cached, cached: true, cost: 0 };
        }

        // Execute with context including previous results
        const execContext: AnalysisContext = {
          ...context,
          previousResults: results,
        };

        const result = await analysis.execute(undefined, execContext);
        results.set(id, result);

        // Cache result
        await cacheResult(id, context, result, analysis.cacheTTLSeconds);

        // Emit completion
        await emitter.emit({
          type: 'analysis_complete',
          analysisId: id,
          result: summarizeResult(result), // Send summary, not full data
        });

        return { id, result, cached: false, cost: analysis.estimatedCostMicros };
      } catch (error) {
        await emitter.emit({
          type: 'analysis_error',
          analysisId: id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    });

    const levelResults = await Promise.allSettled(levelPromises);

    // Track cost
    for (const result of levelResults) {
      if (result.status === 'fulfilled' && !result.value.cached) {
        totalCostMicros += result.value.cost;
      }
    }
  }

  // Emit final stats
  await emitter.emit({
    type: 'pipeline_complete',
    totalTimeMs: Date.now() - startTime,
    totalCostMicros,
    analysisCount: results.size,
  });

  return results;
}
```

### 2.4 Intent to Pipeline Mapping

```typescript
// apps/web/src/lib/seo-chat/router/pipeline-mapper.ts

/**
 * Maps intents to required analyses.
 * Chat orchestrator uses this to build execution plans.
 */
export const INTENT_PIPELINES: Record<Intent, string[]> = {
  domain_analysis: ['domain_health'],
  
  keyword_feasibility: [
    'domain_health',      // Optional but useful for context
    'keyword_feasibility',
  ],
  
  keyword_discovery: [
    'domain_health',
    'keyword_universe',
    'topical_map',
  ],
  
  competitor_analysis: [
    'domain_health',
    'competitor_discovery',
    'content_gaps',
  ],
  
  technical_diagnosis: [
    'domain_health',
    'technical_audit',
  ],
  
  content_recommendations: [
    'domain_health',
    'keyword_universe',
    'content_gaps',
  ],
  
  quick_wins: [
    'domain_health',
    'keyword_feasibility', // If keywords in context
    'quick_wins',
  ],
  
  generate_proposal: [
    // Uses accumulated results, doesn't run new analyses
  ],
  
  general_qa: [
    // No analyses, just LLM response
  ],
};
```

---

## 3. Scraping Integration

### 3.1 TieredFetcher Integration

The SEO Chat leverages the Phase 100 Scrapling-first architecture.

```typescript
// apps/web/src/lib/seo-chat/scraping/fetcher-client.ts

import { z } from 'zod';

const SEODataSchema = z.object({
  url: z.string(),
  final_url: z.string(),
  status_code: z.number(),
  tier_used: z.string(),
  title: z.string().nullable(),
  meta_description: z.string().nullable(),
  h1_text: z.string().nullable(),
  body_text: z.string(),
  word_count: z.number(),
  internal_links: z.array(z.object({
    href: z.string(),
    text: z.string(),
    is_nofollow: z.boolean(),
  })),
  external_links: z.array(z.object({
    href: z.string(),
    text: z.string(),
    is_nofollow: z.boolean(),
  })),
  schemas: z.array(z.object({
    type: z.string(),
    raw: z.record(z.unknown()),
  })),
  // ... additional fields per schema.py
});

export type SEOExtractionResult = z.infer<typeof SEODataSchema>;

export interface FetcherConfig {
  baseUrl: string; // scrapling-engine FastAPI URL
  timeout: number;
}

export class ScraplingFetcherClient {
  private baseUrl: string;
  private timeout: number;

  constructor(config: FetcherConfig) {
    this.baseUrl = config.baseUrl;
    this.timeout = config.timeout;
  }

  /**
   * Fetch single page with SEO data extraction.
   * Returns JSON - no HTML parsing needed in TypeScript.
   */
  async fetchPage(url: string, keyword?: string): Promise<SEOExtractionResult> {
    const response = await fetch(`${this.baseUrl}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        tier: 'residential', // T0: Scrapling + Geonode
        keyword,
        timeout_ms: this.timeout,
      }),
      signal: AbortSignal.timeout(this.timeout + 5000),
    });

    if (!response.ok) {
      throw new Error(`Scraping failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return SEODataSchema.parse(data);
  }

  /**
   * Batch fetch with streaming progress.
   * Used for domain-wide content extraction.
   */
  async fetchBatch(
    urls: string[],
    options: {
      keyword?: string;
      concurrency?: number;
      onProgress?: (completed: number, total: number) => void;
    } = {}
  ): Promise<Map<string, SEOExtractionResult>> {
    const response = await fetch(`${this.baseUrl}/extract/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        urls,
        tier: 'residential',
        keyword: options.keyword,
        timeout_ms: this.timeout,
        concurrency: options.concurrency || 50,
        chunk_size: 100,
      }),
    });

    const results = new Map<string, SEOExtractionResult>();
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) throw new Error('No response body');

    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = JSON.parse(line.slice(6));

        if (data.type === 'progress' && options.onProgress) {
          options.onProgress(data.completed, data.total);
        } else if (data.type === 'result') {
          results.set(data.url, SEODataSchema.parse(data.data));
        }
      }
    }

    return results;
  }
}

// Singleton instance
let fetcherClient: ScraplingFetcherClient | null = null;

export function getFetcherClient(): ScraplingFetcherClient {
  if (!fetcherClient) {
    fetcherClient = new ScraplingFetcherClient({
      baseUrl: process.env.SCRAPLING_ENGINE_URL || 'http://localhost:8100',
      timeout: 30000,
    });
  }
  return fetcherClient;
}
```

### 3.2 Domain Learning & Pre-warming

```typescript
// apps/web/src/lib/seo-chat/scraping/domain-learning.ts

import { db } from '@/db';
import { domainLearning } from '@/db/scraping-schema';
import { eq } from 'drizzle-orm';

export interface DomainProfile {
  domain: string;
  preferredTier: 'residential' | 'camoufox' | 'dataforseo';
  hasCloudflare: boolean;
  avgResponseMs: number;
  lastSuccessAt: Date | null;
  consecutiveFailures: number;
}

/**
 * Get optimal tier for a domain based on historical success.
 */
export async function getOptimalTier(domain: string): Promise<string> {
  const [profile] = await db
    .select()
    .from(domainLearning)
    .where(eq(domainLearning.domain, domain))
    .limit(1);

  if (!profile) {
    return 'residential'; // Default T0
  }

  // If Cloudflare detected and residential failing, use Camoufox
  if (profile.hasCloudflare && profile.consecutiveFailures >= 2) {
    return 'camoufox'; // T1
  }

  // If both failing, fallback to DataForSEO
  if (profile.consecutiveFailures >= 5) {
    return 'dataforseo'; // T2
  }

  return profile.preferredTier;
}

/**
 * Record scraping result for domain learning.
 */
export async function recordScrapingResult(
  domain: string,
  tier: string,
  success: boolean,
  responseMs: number,
  cloudflareDetected: boolean
): Promise<void> {
  const [existing] = await db
    .select()
    .from(domainLearning)
    .where(eq(domainLearning.domain, domain))
    .limit(1);

  if (existing) {
    await db.update(domainLearning)
      .set({
        preferredTier: success ? tier : existing.preferredTier,
        hasCloudflare: cloudflareDetected || existing.hasCloudflare,
        avgResponseMs: (existing.avgResponseMs + responseMs) / 2,
        lastSuccessAt: success ? new Date() : existing.lastSuccessAt,
        consecutiveFailures: success ? 0 : existing.consecutiveFailures + 1,
        updatedAt: new Date(),
      })
      .where(eq(domainLearning.domain, domain));
  } else {
    await db.insert(domainLearning).values({
      id: crypto.randomUUID(),
      domain,
      preferredTier: tier,
      hasCloudflare: cloudflareDetected,
      avgResponseMs: responseMs,
      lastSuccessAt: success ? new Date() : null,
      consecutiveFailures: success ? 0 : 1,
    });
  }
}
```

### 3.3 RAG Content Ingestion

```typescript
// apps/web/src/lib/seo-chat/scraping/rag-ingestion.ts

import { getFetcherClient, type SEOExtractionResult } from './fetcher-client';
import { recordScrapingResult } from './domain-learning';

export interface RAGChunk {
  content: string;
  url: string;
  title: string;
  headings: string[];
  wordCount: number;
  embedding?: Float32Array;
}

/**
 * Scrape and ingest domain content for RAG.
 * Called during prospect stage to enable keyword intelligence.
 */
export async function ingestDomainForRAG(
  domain: string,
  options: {
    maxPages?: number;
    onProgress?: (stage: string, progress: number) => void;
  } = {}
): Promise<{ chunks: RAGChunk[]; stats: IngestStats }> {
  const fetcher = getFetcherClient();
  const maxPages = options.maxPages || 5000;

  // Step 1: Discover URLs (sitemap or crawl)
  options.onProgress?.('discovering', 0);
  const urls = await discoverUrls(domain, maxPages);
  
  // Step 2: Batch fetch with streaming
  options.onProgress?.('scraping', 0);
  const results = await fetcher.fetchBatch(urls, {
    concurrency: 100,
    onProgress: (completed, total) => {
      options.onProgress?.('scraping', (completed / total) * 100);
    },
  });

  // Step 3: Convert to RAG chunks
  options.onProgress?.('chunking', 0);
  const chunks: RAGChunk[] = [];
  let i = 0;

  for (const [url, data] of results) {
    // Record for domain learning
    await recordScrapingResult(
      domain,
      data.tier_used,
      data.status_code === 200,
      0, // TODO: track response time
      data.tier_used === 'camoufox'
    );

    if (data.status_code === 200 && data.body_text.length > 100) {
      chunks.push({
        content: data.body_text,
        url: data.final_url,
        title: data.title || '',
        headings: [data.h1_text || '', ...(data.headings?.map(h => h.text) || [])].filter(Boolean),
        wordCount: data.word_count,
      });
    }

    i++;
    options.onProgress?.('chunking', (i / results.size) * 100);
  }

  return {
    chunks,
    stats: {
      urlsDiscovered: urls.length,
      urlsScraped: results.size,
      chunksCreated: chunks.length,
      totalWords: chunks.reduce((sum, c) => sum + c.wordCount, 0),
    },
  };
}

async function discoverUrls(domain: string, maxPages: number): Promise<string[]> {
  // Try sitemap first
  const sitemapUrls = await fetchSitemapUrls(`https://${domain}/sitemap.xml`);
  if (sitemapUrls.length > 0) {
    return sitemapUrls.slice(0, maxPages);
  }

  // Fallback to crawl (implemented in scrapling-engine)
  const fetcher = getFetcherClient();
  // ... crawl implementation
  return [];
}

interface IngestStats {
  urlsDiscovered: number;
  urlsScraped: number;
  chunksCreated: number;
  totalWords: number;
}
```

---

## 4. Keyword Intelligence Integration

### 4.1 KeywordUniverseBuilder Integration

```typescript
// apps/web/src/lib/seo-chat/analyses/keyword-universe.ts

import { createKeywordUniverseBuilder } from '@/server/features/keywords/universe/KeywordUniverseBuilder';
import { dataforseoClient } from '@/server/lib/dataforseo';

export interface KeywordUniverseResult {
  keywords: KeywordWithMetrics[];
  totalVolume: number;
  clusterCount: number;
  expansionStats: {
    seedCount: number;
    expandedCount: number;
    deduplicatedCount: number;
  };
}

export interface KeywordWithMetrics {
  keyword: string;
  volume: number;
  difficulty: number;
  cpc: number;
  intent?: 'informational' | 'navigational' | 'commercial' | 'transactional';
}

export async function executeKeywordUniverse(
  domain: string,
  seeds: string[],
  context: AnalysisContext
): Promise<KeywordUniverseResult> {
  // Create builder with DataForSEO client
  const builder = createKeywordUniverseBuilder(dataforseoClient, {
    maxKeywordsPerSeed: 30,
    locationCode: getLocationCode(context.settings.locale),
    concurrency: 3,
  });

  // Expand seeds
  const expandedKeywords = await builder.expand(seeds, domain);

  // Enrich with metrics from DataForSEO Keyword Data API
  const enrichedKeywords = await enrichWithMetrics(expandedKeywords, context);

  return {
    keywords: enrichedKeywords,
    totalVolume: enrichedKeywords.reduce((sum, k) => sum + k.volume, 0),
    clusterCount: 0, // Set after clustering
    expansionStats: {
      seedCount: seeds.length,
      expandedCount: expandedKeywords.length,
      deduplicatedCount: enrichedKeywords.length,
    },
  };
}

async function enrichWithMetrics(
  keywords: string[],
  context: AnalysisContext
): Promise<KeywordWithMetrics[]> {
  // Batch request to DataForSEO Keyword Data
  const response = await dataforseoClient.keywordsData({
    keywords,
    location_code: getLocationCode(context.settings.locale),
    language_code: context.settings.locale === 'lt' ? 'lt' : 'en',
  });

  return response.keywords.map(kw => ({
    keyword: kw.keyword,
    volume: kw.search_volume || 0,
    difficulty: kw.keyword_difficulty || 0,
    cpc: kw.cpc || 0,
    intent: mapIntent(kw.search_intent),
  }));
}

function getLocationCode(locale?: string): number {
  const codes: Record<string, number> = {
    lt: 2440, // Lithuania
    lv: 2428, // Latvia
    ee: 2233, // Estonia
    pl: 2616, // Poland
    de: 2276, // Germany
    en: 2840, // USA
  };
  return codes[locale || 'lt'] || 2440;
}

function mapIntent(intent?: string): KeywordWithMetrics['intent'] {
  const mapping: Record<string, KeywordWithMetrics['intent']> = {
    informational: 'informational',
    navigational: 'navigational',
    commercial: 'commercial',
    transactional: 'transactional',
  };
  return intent ? mapping[intent.toLowerCase()] : undefined;
}
```

### 4.2 HierarchyBuilder Integration (Topical Maps)

```typescript
// apps/web/src/lib/seo-chat/analyses/topical-map.ts

import { HierarchyBuilder, buildHierarchy } from '@/server/features/keywords/clustering/HierarchyBuilder';
import { HDBSCANClusterer } from '@/server/features/keywords/clustering/HDBSCANClusterer';
import { ClusterLabeler } from '@/server/features/keywords/clustering/ClusterLabeler';
import { EmbeddingService } from '@/server/features/keywords/services/EmbeddingService';

export interface TopicalMapResult {
  pillars: PillarCluster[];
  stats: {
    pillarCount: number;
    subtopicCount: number;
    longtailCount: number;
    avgChildrenPerPillar: number;
    totalKeywords: number;
  };
  visualization: TopicalMapVisualization;
}

export interface PillarCluster {
  id: string;
  label: string;
  totalVolume: number;
  keywords: string[];
  children: SubtopicCluster[];
}

export interface SubtopicCluster {
  id: string;
  label: string;
  totalVolume: number;
  keywords: string[];
  tier: 'subtopic' | 'longtail';
}

export async function executeTopicalMap(
  universe: KeywordUniverseResult,
  context: AnalysisContext
): Promise<TopicalMapResult> {
  const embeddingService = new EmbeddingService();

  // Step 1: Generate embeddings for all keywords
  const keywordTexts = universe.keywords.map(k => k.keyword);
  const embeddings = await embeddingService.embedBatch(keywordTexts);

  // Step 2: Cluster with HDBSCAN
  const clusterer = new HDBSCANClusterer({
    minClusterSize: 3,
    minSamples: 2,
  });
  const clusters = await clusterer.cluster(
    keywordTexts,
    embeddings,
    universe.keywords.map(k => ({ volume: k.volume, difficulty: k.difficulty }))
  );

  // Step 3: Label clusters with AI
  const labeler = new ClusterLabeler();
  const labeledClusters = await labeler.labelClusters(clusters);

  // Step 4: Build hierarchy (pillar/subtopic/longtail)
  const hierarchy = buildHierarchy(labeledClusters, {
    pillarMinVolume: 10000,      // >10K volume = pillar
    subtopicMinVolume: 2000,     // 2K-10K = subtopic
    parentSimilarityThreshold: 0.7,
  });

  // Step 5: Transform to response format
  const pillars = hierarchy.pillars.map(p => ({
    id: p.clusterId,
    label: p.label,
    totalVolume: p.totalVolume,
    keywords: p.keywords,
    children: p.childIds.map(childId => {
      const child = hierarchy.clusters.find(c => c.clusterId === childId)!;
      return {
        id: child.clusterId,
        label: child.label,
        totalVolume: child.totalVolume,
        keywords: child.keywords,
        tier: child.tier as 'subtopic' | 'longtail',
      };
    }),
  }));

  return {
    pillars,
    stats: {
      pillarCount: hierarchy.stats.pillarCount,
      subtopicCount: hierarchy.stats.subtopicCount,
      longtailCount: hierarchy.stats.longtailCount,
      avgChildrenPerPillar: hierarchy.stats.avgChildrenPerPillar,
      totalKeywords: universe.keywords.length,
    },
    visualization: generateVisualization(pillars),
  };
}

interface TopicalMapVisualization {
  nodes: Array<{ id: string; label: string; volume: number; tier: string }>;
  edges: Array<{ source: string; target: string }>;
}

function generateVisualization(pillars: PillarCluster[]): TopicalMapVisualization {
  const nodes: TopicalMapVisualization['nodes'] = [];
  const edges: TopicalMapVisualization['edges'] = [];

  for (const pillar of pillars) {
    nodes.push({
      id: pillar.id,
      label: pillar.label,
      volume: pillar.totalVolume,
      tier: 'pillar',
    });

    for (const child of pillar.children) {
      nodes.push({
        id: child.id,
        label: child.label,
        volume: child.totalVolume,
        tier: child.tier,
      });
      edges.push({ source: pillar.id, target: child.id });
    }
  }

  return { nodes, edges };
}
```

### 4.3 Feasibility Calculation

```typescript
// apps/web/src/lib/seo-chat/analyses/keyword-feasibility.ts

export interface FeasibilitySettings {
  maxFeasibleKD: number;        // Default: 85
  easyKDThreshold: number;      // Default: 30
  mediumKDThreshold: number;    // Default: 50
  hardKDThreshold: number;      // Default: 70
  linksPerMonth: number;        // Agency capacity
  contentPagesPerMonth: number;
  technicalHoursPerMonth: number;
  baselineMonths: number;       // Default: 3
  monthsPerKDPoint: number;     // Default: 0.1
  maxTimelineMonths: number;    // Default: 18
  ymylPenalty: number;          // Default: 20
  localBonus: number;           // Default: -10
}

export interface FeasibilityResult {
  keyword: string;
  isFeasible: boolean;
  confidence: 'high' | 'medium' | 'low';
  difficulty: 'easy' | 'medium' | 'hard' | 'very_hard';
  timelineMonths: number;
  estimatedEffort: {
    links: number;
    contentPages: number;
    technicalHours: number;
  };
  trafficValue: number; // Monthly traffic value in EUR
  rationale: string;
}

/**
 * THE FEASIBILITY FORMULA
 * 
 * effectiveKD = KD + (isYMYL ? ymylPenalty : 0) - (isLocal ? localBonus : 0)
 * timeline = baselineMonths + (effectiveKD * monthsPerKDPoint)
 * 
 * Feasibility tiers:
 * - effectiveKD <= 30: EASY (2-3 months)
 * - effectiveKD <= 50: MEDIUM (3-5 months)
 * - effectiveKD <= 70: HARD (5-9 months)
 * - effectiveKD <= 85: VERY HARD (9-12 months)
 * - effectiveKD > 85: NOT FEASIBLE
 */
export function calculateFeasibility(
  keyword: string,
  metrics: {
    volume: number;
    difficulty: number;
    cpc: number;
  },
  domainHealth: DomainHealthResult | undefined,
  settings: FeasibilitySettings
): FeasibilityResult {
  // Step 1: Calculate effective KD with modifiers
  let effectiveKD = metrics.difficulty;

  // YMYL penalty (health, finance, legal topics)
  const ymylPatterns = [
    /health|medical|doctor|lawyer|legal|finance|insurance|bank|credit/i,
    /sveikata|gydytojas|teisininkas|finansai|draudimas/i, // Lithuanian
  ];
  const isYMYL = ymylPatterns.some(p => p.test(keyword));
  if (isYMYL) {
    effectiveKD += settings.ymylPenalty;
  }

  // Local bonus (easier to rank for local queries)
  const localPatterns = [
    /\b(vilnius|kaunas|klaipeda|siauliai|panevezys)\b/i,
    /near\s+me|nearby|local/i,
  ];
  const isLocal = localPatterns.some(p => p.test(keyword));
  if (isLocal) {
    effectiveKD += settings.localBonus; // Negative = bonus
  }

  // Domain authority adjustment
  if (domainHealth?.domainAuthority) {
    // Strong domain = easier to rank
    const daBonus = Math.floor((domainHealth.domainAuthority - 20) / 10) * -2;
    effectiveKD += daBonus;
  }

  effectiveKD = Math.max(0, Math.min(100, effectiveKD));

  // Step 2: Determine feasibility
  const isFeasible = effectiveKD <= settings.maxFeasibleKD;

  // Step 3: Determine difficulty tier
  let difficulty: FeasibilityResult['difficulty'];
  if (effectiveKD <= settings.easyKDThreshold) {
    difficulty = 'easy';
  } else if (effectiveKD <= settings.mediumKDThreshold) {
    difficulty = 'medium';
  } else if (effectiveKD <= settings.hardKDThreshold) {
    difficulty = 'hard';
  } else {
    difficulty = 'very_hard';
  }

  // Step 4: Calculate timeline
  const timelineMonths = Math.min(
    settings.maxTimelineMonths,
    settings.baselineMonths + (effectiveKD * settings.monthsPerKDPoint)
  );

  // Step 5: Estimate effort
  const estimatedEffort = calculateEffort(effectiveKD, settings);

  // Step 6: Calculate traffic value
  const estimatedCTR = 0.1; // Conservative 10% CTR for page 1
  const monthlyVisitors = metrics.volume * estimatedCTR;
  const trafficValue = monthlyVisitors * metrics.cpc;

  // Step 7: Determine confidence
  let confidence: FeasibilityResult['confidence'];
  if (domainHealth && metrics.volume > 100) {
    confidence = 'high';
  } else if (domainHealth || metrics.volume > 50) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  // Step 8: Generate rationale
  const rationale = generateRationale(
    keyword,
    effectiveKD,
    timelineMonths,
    difficulty,
    isYMYL,
    isLocal,
    domainHealth
  );

  return {
    keyword,
    isFeasible,
    confidence,
    difficulty,
    timelineMonths: Math.round(timelineMonths),
    estimatedEffort,
    trafficValue: Math.round(trafficValue),
    rationale,
  };
}

function calculateEffort(
  effectiveKD: number,
  settings: FeasibilitySettings
): FeasibilityResult['estimatedEffort'] {
  // Links needed scales with difficulty
  const linkMultiplier = effectiveKD / 30;
  const links = Math.ceil(5 * linkMultiplier);

  // Content pages (1 pillar + supporting)
  const contentPages = effectiveKD <= 30 ? 1 : effectiveKD <= 50 ? 3 : 5;

  // Technical hours (on-page optimization)
  const technicalHours = effectiveKD <= 30 ? 2 : effectiveKD <= 50 ? 5 : 10;

  return { links, contentPages, technicalHours };
}

function generateRationale(
  keyword: string,
  effectiveKD: number,
  timelineMonths: number,
  difficulty: FeasibilityResult['difficulty'],
  isYMYL: boolean,
  isLocal: boolean,
  domainHealth?: DomainHealthResult
): string {
  const parts: string[] = [];

  if (difficulty === 'easy') {
    parts.push(`"${keyword}" is a low-competition keyword with good potential.`);
  } else if (difficulty === 'medium') {
    parts.push(`"${keyword}" has moderate competition but is achievable.`);
  } else if (difficulty === 'hard') {
    parts.push(`"${keyword}" is competitive and will require sustained effort.`);
  } else {
    parts.push(`"${keyword}" is highly competitive - expect a long campaign.`);
  }

  if (isLocal) {
    parts.push('Local intent gives you an advantage.');
  }

  if (isYMYL) {
    parts.push('YMYL topic requires extra trust signals.');
  }

  if (domainHealth?.domainAuthority && domainHealth.domainAuthority > 30) {
    parts.push(`Your DA ${domainHealth.domainAuthority} provides a solid foundation.`);
  }

  parts.push(`Estimated ${timelineMonths} months to page 1.`);

  return parts.join(' ');
}
```

### 4.4 Cache Strategy for Repeated Domains

```typescript
// apps/web/src/lib/seo-chat/cache/analysis-cache.ts

import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL!);

interface CacheKey {
  analysisId: string;
  domain?: string;
  keywords?: string[];
  workspaceId: string;
}

function buildCacheKey(key: CacheKey): string {
  const parts = [
    'seo-chat',
    key.workspaceId,
    key.analysisId,
    key.domain || 'no-domain',
  ];

  if (key.keywords && key.keywords.length > 0) {
    // Hash keywords for consistent key
    const sortedKeywords = [...key.keywords].sort().join('|');
    const keywordHash = createHash('sha256').update(sortedKeywords).digest('hex').slice(0, 16);
    parts.push(keywordHash);
  }

  return parts.join(':');
}

export async function checkCache<T>(
  analysisId: string,
  context: AnalysisContext
): Promise<T | null> {
  const key = buildCacheKey({
    analysisId,
    domain: context.domain,
    keywords: context.keywords,
    workspaceId: context.workspaceId,
  });

  const cached = await redis.get(key);
  if (!cached) return null;

  try {
    return JSON.parse(cached) as T;
  } catch {
    return null;
  }
}

export async function cacheResult(
  analysisId: string,
  context: AnalysisContext,
  result: unknown,
  ttlSeconds: number
): Promise<void> {
  const key = buildCacheKey({
    analysisId,
    domain: context.domain,
    keywords: context.keywords,
    workspaceId: context.workspaceId,
  });

  await redis.setex(key, ttlSeconds, JSON.stringify(result));
}

export async function invalidateCache(
  domain: string,
  workspaceId: string
): Promise<void> {
  const pattern = `seo-chat:${workspaceId}:*:${domain}:*`;
  const keys = await redis.keys(pattern);
  
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
```

---

## 5. Proposal Generation Pipeline

### 5.1 Context Accumulation

```typescript
// apps/web/src/lib/seo-chat/proposal/context-accumulator.ts

export interface AccumulatedProposalContext {
  domain: string;
  prospectId?: string;
  
  // From domain_health
  domainHealth?: {
    domainAuthority: number;
    organicTraffic: number;
    organicKeywords: number;
    issues: Array<{ type: string; severity: string; count: number }>;
  };

  // From keyword_feasibility
  feasibleKeywords?: Array<{
    keyword: string;
    isFeasible: boolean;
    difficulty: string;
    timelineMonths: number;
    trafficValue: number;
  }>;

  // From topical_map
  topicalMap?: {
    pillars: Array<{
      label: string;
      totalVolume: number;
      keywordCount: number;
    }>;
    totalKeywords: number;
    totalVolume: number;
  };

  // From quick_wins
  quickWins?: Array<{
    title: string;
    effort: string;
    impact: string;
  }>;

  // From content_gaps
  contentGaps?: Array<{
    topic: string;
    competitorDomain: string;
    opportunity: string;
  }>;

  // Conversation insights
  conversationInsights?: {
    preferredTone?: 'professional' | 'friendly' | 'technical';
    budget?: { min: number; max: number };
    timeline?: string;
    priorities?: string[];
  };

  // Accumulated from conversation turns
  turnsUsed: number;
  lastUpdated: Date;
}

export function accumulateContext(
  existing: AccumulatedProposalContext | undefined,
  analysisResults: Map<string, unknown>,
  conversationTurn: Message
): AccumulatedProposalContext {
  const context: AccumulatedProposalContext = existing || {
    domain: '',
    turnsUsed: 0,
    lastUpdated: new Date(),
  };

  // Update from domain_health
  const domainHealth = analysisResults.get('domain_health') as DomainHealthResult | undefined;
  if (domainHealth) {
    context.domainHealth = {
      domainAuthority: domainHealth.domainAuthority,
      organicTraffic: domainHealth.organicTraffic,
      organicKeywords: domainHealth.organicKeywords,
      issues: domainHealth.issues,
    };
    context.domain = domainHealth.domain;
  }

  // Update from keyword_feasibility
  const feasibility = analysisResults.get('keyword_feasibility') as FeasibilityResult[] | undefined;
  if (feasibility) {
    context.feasibleKeywords = feasibility.map(f => ({
      keyword: f.keyword,
      isFeasible: f.isFeasible,
      difficulty: f.difficulty,
      timelineMonths: f.timelineMonths,
      trafficValue: f.trafficValue,
    }));
  }

  // Update from topical_map
  const topicalMap = analysisResults.get('topical_map') as TopicalMapResult | undefined;
  if (topicalMap) {
    context.topicalMap = {
      pillars: topicalMap.pillars.map(p => ({
        label: p.label,
        totalVolume: p.totalVolume,
        keywordCount: p.keywords.length,
      })),
      totalKeywords: topicalMap.stats.totalKeywords,
      totalVolume: topicalMap.pillars.reduce((sum, p) => sum + p.totalVolume, 0),
    };
  }

  // Update from quick_wins
  const quickWins = analysisResults.get('quick_wins') as QuickWinsResult | undefined;
  if (quickWins) {
    context.quickWins = quickWins.wins;
  }

  // Update from content_gaps
  const contentGaps = analysisResults.get('content_gaps') as ContentGapsResult | undefined;
  if (contentGaps) {
    context.contentGaps = contentGaps.gaps;
  }

  // Extract conversation insights
  context.conversationInsights = extractConversationInsights(conversationTurn);

  context.turnsUsed++;
  context.lastUpdated = new Date();

  return context;
}

function extractConversationInsights(turn: Message): AccumulatedProposalContext['conversationInsights'] {
  const text = turn.content.toLowerCase();

  // Budget extraction
  const budgetMatch = text.match(/(\d+)\s*(?:eur|€|\$|per\s+month)/i);
  const budget = budgetMatch ? { min: parseInt(budgetMatch[1]) * 0.8, max: parseInt(budgetMatch[1]) * 1.2 } : undefined;

  // Timeline extraction
  const timelinePatterns = [
    { pattern: /asap|urgent|immediately/i, value: '1-2 months' },
    { pattern: /3\s*months?/i, value: '3 months' },
    { pattern: /6\s*months?/i, value: '6 months' },
    { pattern: /year|12\s*months?/i, value: '12 months' },
  ];
  const timeline = timelinePatterns.find(p => p.pattern.test(text))?.value;

  // Priorities extraction
  const priorities: string[] = [];
  if (/traffic|visitors/i.test(text)) priorities.push('increase_traffic');
  if (/ranking|position/i.test(text)) priorities.push('improve_rankings');
  if (/leads?|conversion/i.test(text)) priorities.push('generate_leads');
  if (/brand|awareness/i.test(text)) priorities.push('brand_visibility');

  return {
    budget,
    timeline,
    priorities: priorities.length > 0 ? priorities : undefined,
  };
}
```

### 5.2 Keyword to Package Assignment

```typescript
// apps/web/src/lib/seo-chat/proposal/keyword-assigner.ts

export interface Package {
  id: string;
  name: string;
  monthlyPriceCents: number;
  keywordLimit: number | 'unlimited';
  services: {
    onPage: boolean;
    technical: boolean;
    content: boolean;
    linkBuilding: boolean;
    localSeo: boolean;
  };
}

export type AssignmentStrategy = 'first_n' | 'by_priority' | 'by_feasibility' | 'manual';

export interface KeywordAssignment {
  packageId: string;
  keywords: Array<{
    keyword: string;
    reason: string;
  }>;
  totalVolume: number;
  totalTrafficValue: number;
}

/**
 * Assign keywords to packages based on strategy.
 */
export function assignKeywordsToPackages(
  keywords: FeasibilityResult[],
  packages: Package[],
  strategy: AssignmentStrategy
): Map<string, KeywordAssignment> {
  // Sort packages by keyword limit (ascending)
  const sortedPackages = [...packages].sort((a, b) => {
    const limitA = a.keywordLimit === 'unlimited' ? Infinity : a.keywordLimit;
    const limitB = b.keywordLimit === 'unlimited' ? Infinity : b.keywordLimit;
    return limitA - limitB;
  });

  // Sort keywords by strategy
  let sortedKeywords: FeasibilityResult[];
  switch (strategy) {
    case 'by_priority':
      // Prioritize by traffic value (ROI)
      sortedKeywords = [...keywords].sort((a, b) => b.trafficValue - a.trafficValue);
      break;

    case 'by_feasibility':
      // Prioritize easier keywords (faster wins)
      sortedKeywords = [...keywords].sort((a, b) => a.timelineMonths - b.timelineMonths);
      break;

    case 'first_n':
    default:
      sortedKeywords = keywords;
  }

  // Assign to each package
  const assignments = new Map<string, KeywordAssignment>();

  for (const pkg of sortedPackages) {
    const limit = pkg.keywordLimit === 'unlimited' 
      ? sortedKeywords.length 
      : pkg.keywordLimit;

    const assignedKeywords = sortedKeywords.slice(0, limit);
    
    assignments.set(pkg.id, {
      packageId: pkg.id,
      keywords: assignedKeywords.map(kw => ({
        keyword: kw.keyword,
        reason: `${kw.difficulty} difficulty, ${kw.timelineMonths}mo timeline`,
      })),
      totalVolume: assignedKeywords.reduce((sum, k) => sum + k.metrics.volume, 0),
      totalTrafficValue: assignedKeywords.reduce((sum, k) => sum + k.trafficValue, 0),
    });
  }

  return assignments;
}

/**
 * Calculate optimal package recommendation based on keyword analysis.
 */
export function recommendPackage(
  assignments: Map<string, KeywordAssignment>,
  packages: Package[],
  budget?: { min: number; max: number }
): { recommended: string; reason: string } {
  // If budget specified, find package that fits
  if (budget) {
    const affordable = packages
      .filter(p => p.monthlyPriceCents <= budget.max * 100)
      .sort((a, b) => b.monthlyPriceCents - a.monthlyPriceCents);

    if (affordable.length > 0) {
      const best = affordable[0];
      return {
        recommended: best.id,
        reason: `Best value within your budget of EUR ${budget.max}/mo`,
      };
    }
  }

  // Default: recommend middle tier
  const middleIndex = Math.floor(packages.length / 2);
  const recommended = packages[middleIndex];

  return {
    recommended: recommended.id,
    reason: 'Balanced coverage of your keyword opportunities',
  };
}
```

### 5.3 ProposalAIGenerationService Integration

```typescript
// apps/web/src/lib/seo-chat/proposal/generator.ts

import { ProposalService, type CreateProposalInput } from '@/server/features/proposals/services/ProposalService';
import { ProposalAIGenerationService } from '@/server/features/proposals/services/ProposalAIGenerationService';
import { ProspectService } from '@/server/features/prospects/services/ProspectService';
import { nanoid } from 'nanoid';

export interface GenerateProposalInput {
  workspaceId: string;
  context: AccumulatedProposalContext;
  packages: Package[];
  strategy: AssignmentStrategy;
  language: 'en' | 'lt';
  tone: 'professional' | 'friendly' | 'technical' | 'urgent';
}

export interface GeneratedProposal {
  proposalId: string;
  token: string;
  magicLink: string;
  packages: Array<{
    id: string;
    name: string;
    price: number;
    keywords: string[];
    isRecommended: boolean;
  }>;
  summary: {
    totalKeywords: number;
    totalVolume: number;
    totalTrafficValue: number;
    projectedTimeline: string;
  };
}

export async function generateProposal(
  input: GenerateProposalInput
): Promise<GeneratedProposal> {
  const { workspaceId, context, packages, strategy, language, tone } = input;

  // Step 1: Find or create prospect
  let prospectId: string;
  if (context.prospectId) {
    prospectId = context.prospectId;
  } else {
    const prospect = await ProspectService.findOrCreate({
      workspaceId,
      domain: context.domain,
      status: 'new',
    });
    prospectId = prospect.id;
  }

  // Step 2: Assign keywords to packages
  const assignments = assignKeywordsToPackages(
    context.feasibleKeywords || [],
    packages,
    strategy
  );

  // Step 3: Determine recommended package
  const recommendation = recommendPackage(
    assignments,
    packages,
    context.conversationInsights?.budget
  );

  // Step 4: Create proposal record
  const proposalContent = buildProposalContent(context, assignments, recommendation);
  
  const proposal = await ProposalService.create({
    prospectId,
    workspaceId,
    content: proposalContent,
    setupFeeCents: packages.find(p => p.id === recommendation.recommended)?.setupFeeCents || 0,
    monthlyFeeCents: packages.find(p => p.id === recommendation.recommended)?.monthlyPriceCents || 0,
  });

  // Step 5: Generate AI content for proposal sections
  const aiService = new ProposalAIGenerationService();
  await aiService.generateContent({
    proposalId: proposal.id,
    sections: ['hero', 'opportunities', 'roi'],
    context: ['prospect', 'keywords'],
    tone,
    language,
  });

  // Step 6: Build response
  const magicLink = `${process.env.NEXT_PUBLIC_APP_URL}/p/${proposal.token}`;

  return {
    proposalId: proposal.id,
    token: proposal.token,
    magicLink,
    packages: packages.map(pkg => {
      const assignment = assignments.get(pkg.id);
      return {
        id: pkg.id,
        name: pkg.name,
        price: pkg.monthlyPriceCents / 100,
        keywords: assignment?.keywords.map(k => k.keyword) || [],
        isRecommended: pkg.id === recommendation.recommended,
      };
    }),
    summary: {
      totalKeywords: context.feasibleKeywords?.length || 0,
      totalVolume: context.topicalMap?.totalVolume || 0,
      totalTrafficValue: context.feasibleKeywords?.reduce((sum, k) => sum + k.trafficValue, 0) || 0,
      projectedTimeline: calculateProjectedTimeline(context.feasibleKeywords || []),
    },
  };
}

function buildProposalContent(
  context: AccumulatedProposalContext,
  assignments: Map<string, KeywordAssignment>,
  recommendation: { recommended: string; reason: string }
): ProposalContent {
  // Build content structure per proposal-schema.ts
  return {
    hero: {
      headline: `Grow ${context.domain}'s Online Presence`,
      subheadline: 'SEO strategy tailored for your business goals',
      trafficValue: context.feasibleKeywords?.reduce((sum, k) => sum + k.trafficValue, 0) || 0,
    },
    currentState: {
      traffic: context.domainHealth?.organicTraffic || 0,
      keywords: context.domainHealth?.organicKeywords || 0,
      value: 0, // Calculated from traffic
      chartData: [],
    },
    opportunities: context.feasibleKeywords?.slice(0, 10).map(k => ({
      keyword: k.keyword,
      volume: k.metrics?.volume || 0,
      difficulty: k.difficulty as 'easy' | 'medium' | 'hard',
      potential: k.trafficValue,
    })) || [],
    roi: {
      projectedTrafficGain: 0,
      trafficValue: 0,
      defaultConversionRate: 0.02,
      defaultAov: 150,
    },
    investment: {
      setupFee: 0,
      monthlyFee: 0,
      inclusions: [],
    },
    nextSteps: [
      'Review and approve this proposal',
      'Sign the service agreement',
      'Complete the onboarding call',
      'Receive your initial audit report',
    ],
  };
}

function calculateProjectedTimeline(keywords: FeasibilityResult[]): string {
  if (keywords.length === 0) return 'TBD';

  const avgTimeline = keywords.reduce((sum, k) => sum + k.timelineMonths, 0) / keywords.length;
  
  if (avgTimeline <= 3) return '2-3 months for initial results';
  if (avgTimeline <= 6) return '4-6 months for significant impact';
  return '6-12 months for full potential';
}
```

### 5.4 Magic Link Token Generation

```typescript
// apps/web/src/lib/seo-chat/proposal/magic-link.ts

import { db } from '@/db';
import { proposals } from '@/db/proposal-schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://tevero.lt';

/**
 * Generate a secure magic link token.
 * 32 characters using nanoid (URL-safe).
 */
export function generateToken(): string {
  return nanoid(32);
}

/**
 * Create magic link for a proposal.
 */
export function createMagicLink(token: string): string {
  return `${BASE_URL}/p/${token}`;
}

/**
 * Regenerate magic link token for a proposal.
 */
export async function regenerateToken(proposalId: string): Promise<string> {
  const newToken = generateToken();

  await db.update(proposals)
    .set({
      token: newToken,
      updatedAt: new Date(),
    })
    .where(eq(proposals.id, proposalId));

  return createMagicLink(newToken);
}

/**
 * Validate and retrieve proposal by token.
 */
export async function validateToken(token: string): Promise<{
  valid: boolean;
  proposalId?: string;
  reason?: string;
}> {
  const [proposal] = await db
    .select({
      id: proposals.id,
      status: proposals.status,
      expiresAt: proposals.expiresAt,
    })
    .from(proposals)
    .where(eq(proposals.token, token))
    .limit(1);

  if (!proposal) {
    return { valid: false, reason: 'Token not found' };
  }

  if (proposal.expiresAt && proposal.expiresAt < new Date()) {
    return { valid: false, reason: 'Proposal has expired' };
  }

  if (proposal.status === 'declined') {
    return { valid: false, reason: 'Proposal was declined' };
  }

  return { valid: true, proposalId: proposal.id };
}
```

---

## 6. State Management

### 6.1 ConversationContext Schema

```typescript
// apps/web/src/lib/seo-chat/state/types.ts

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    intent?: Intent;
    analysesRun?: string[];
    costMicros?: number;
  };
}

export interface ConversationContext {
  // Session identifiers
  sessionId: string;
  workspaceId: string;
  userId: string;
  startedAt: Date;
  lastActivityAt: Date;

  // Prospect context (created on first domain mention)
  prospectId?: string;
  prospectDomain?: string;

  // Accumulated analysis results (persisted across turns)
  analysisResults: Map<string, unknown>;

  // Keywords collected from conversation
  keywords: Array<{
    keyword: string;
    source: 'user_input' | 'expansion' | 'gap_analysis';
    addedAt: Date;
    feasibility?: FeasibilityResult;
    inTopicalMap?: boolean;
    inProposal?: boolean;
  }>;

  // Competitor domains mentioned
  competitors: string[];

  // Proposal draft state
  proposalDraft?: {
    started: boolean;
    packageSelections: Map<string, string[]>;
    customizations: Record<string, unknown>;
    aiContentGenerated: boolean;
  };

  // Settings for this session
  settings: WorkspaceSettings;

  // Message history
  messages: Message[];

  // Token budget tracking
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
    analysisTokens: number;
  };
}

export interface WorkspaceSettings {
  locale: string;
  feasibility: FeasibilitySettings;
  packages: Package[];
  proposalDefaults: {
    expiryDays: number;
    minimumContractMonths: number;
    brandColor: string;
    logoUrl?: string;
  };
  responseSettings: {
    tone: 'professional' | 'casual' | 'technical';
    showCompetitorNames: boolean;
    autoSuggestProposal: boolean;
  };
}
```

### 6.2 Session Persistence (Redis + PostgreSQL)

```typescript
// apps/web/src/lib/seo-chat/state/session-store.ts

import Redis from 'ioredis';
import { db } from '@/db';
import { seoChatSessions, seoChatMessages } from '@/db/seo-chat-schema';
import { eq } from 'drizzle-orm';

const redis = new Redis(process.env.REDIS_URL!);

// Session TTL: 24 hours in Redis, then archived to PostgreSQL
const SESSION_TTL_SECONDS = 86400;

/**
 * Hybrid storage: Redis for active sessions, PostgreSQL for persistence.
 */
export const sessionStore = {
  /**
   * Get or create session context.
   */
  async getOrCreate(
    sessionId: string,
    workspaceId: string,
    userId: string
  ): Promise<ConversationContext> {
    // Try Redis first
    const redisKey = `seo-chat:session:${sessionId}`;
    const cached = await redis.get(redisKey);

    if (cached) {
      const context = deserializeContext(JSON.parse(cached));
      context.lastActivityAt = new Date();
      return context;
    }

    // Try PostgreSQL
    const [dbSession] = await db
      .select()
      .from(seoChatSessions)
      .where(eq(seoChatSessions.id, sessionId))
      .limit(1);

    if (dbSession) {
      const context = deserializeContext(dbSession.context as SerializedContext);
      
      // Restore to Redis
      await redis.setex(redisKey, SESSION_TTL_SECONDS, JSON.stringify(serializeContext(context)));
      
      return context;
    }

    // Create new session
    const newContext: ConversationContext = {
      sessionId,
      workspaceId,
      userId,
      startedAt: new Date(),
      lastActivityAt: new Date(),
      analysisResults: new Map(),
      keywords: [],
      competitors: [],
      settings: await loadWorkspaceSettings(workspaceId),
      messages: [],
      tokenUsage: {
        inputTokens: 0,
        outputTokens: 0,
        analysisTokens: 0,
      },
    };

    // Save to Redis
    await redis.setex(redisKey, SESSION_TTL_SECONDS, JSON.stringify(serializeContext(newContext)));

    // Save to PostgreSQL
    await db.insert(seoChatSessions).values({
      id: sessionId,
      workspaceId,
      userId,
      context: serializeContext(newContext),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return newContext;
  },

  /**
   * Save session context.
   */
  async save(context: ConversationContext): Promise<void> {
    context.lastActivityAt = new Date();
    const serialized = serializeContext(context);

    // Update Redis
    const redisKey = `seo-chat:session:${context.sessionId}`;
    await redis.setex(redisKey, SESSION_TTL_SECONDS, JSON.stringify(serialized));

    // Update PostgreSQL (debounced - every 10 messages or on important events)
    if (context.messages.length % 10 === 0 || context.proposalDraft?.started) {
      await db.update(seoChatSessions)
        .set({
          context: serialized,
          updatedAt: new Date(),
        })
        .where(eq(seoChatSessions.id, context.sessionId));
    }
  },

  /**
   * Archive session (called after 24h inactivity).
   */
  async archive(sessionId: string): Promise<void> {
    const redisKey = `seo-chat:session:${sessionId}`;
    const cached = await redis.get(redisKey);

    if (cached) {
      // Ensure PostgreSQL has latest
      await db.update(seoChatSessions)
        .set({
          context: JSON.parse(cached),
          status: 'archived',
          updatedAt: new Date(),
        })
        .where(eq(seoChatSessions.id, sessionId));

      // Delete from Redis
      await redis.del(redisKey);
    }
  },
};

// Serialization helpers (Maps don't serialize to JSON)
interface SerializedContext {
  sessionId: string;
  workspaceId: string;
  userId: string;
  startedAt: string;
  lastActivityAt: string;
  prospectId?: string;
  prospectDomain?: string;
  analysisResults: Array<[string, unknown]>;
  keywords: ConversationContext['keywords'];
  competitors: string[];
  proposalDraft?: ConversationContext['proposalDraft'];
  settings: WorkspaceSettings;
  messages: Message[];
  tokenUsage: ConversationContext['tokenUsage'];
}

function serializeContext(context: ConversationContext): SerializedContext {
  return {
    ...context,
    startedAt: context.startedAt.toISOString(),
    lastActivityAt: context.lastActivityAt.toISOString(),
    analysisResults: Array.from(context.analysisResults.entries()),
  };
}

function deserializeContext(serialized: SerializedContext): ConversationContext {
  return {
    ...serialized,
    startedAt: new Date(serialized.startedAt),
    lastActivityAt: new Date(serialized.lastActivityAt),
    analysisResults: new Map(serialized.analysisResults),
    messages: serialized.messages.map(m => ({
      ...m,
      timestamp: new Date(m.timestamp),
    })),
  };
}
```

### 6.3 Token Budget Management

```typescript
// apps/web/src/lib/seo-chat/state/token-budget.ts

const MAX_CONTEXT_TOKENS = 128000; // Claude 3.5 Sonnet context
const RESERVE_TOKENS = 4000; // Reserve for response

export interface TokenBudget {
  used: number;
  remaining: number;
  shouldCompact: boolean;
}

export function calculateTokenBudget(context: ConversationContext): TokenBudget {
  const used = context.tokenUsage.inputTokens + context.tokenUsage.outputTokens;
  const remaining = MAX_CONTEXT_TOKENS - RESERVE_TOKENS - used;
  const shouldCompact = remaining < 10000; // Compact when < 10K tokens left

  return { used, remaining, shouldCompact };
}

/**
 * Compact conversation history when approaching token limit.
 * Preserves: first message, last 5 messages, and key analysis summaries.
 */
export function compactHistory(context: ConversationContext): Message[] {
  const { messages } = context;

  if (messages.length <= 10) {
    return messages; // No need to compact
  }

  const compacted: Message[] = [];

  // Always keep first message (establishes context)
  compacted.push(messages[0]);

  // Add summary of dropped messages
  const dropped = messages.slice(1, -5);
  if (dropped.length > 0) {
    const summary = summarizeDroppedMessages(dropped);
    compacted.push({
      id: `summary-${Date.now()}`,
      role: 'system',
      content: summary,
      timestamp: new Date(),
    });
  }

  // Keep last 5 messages
  compacted.push(...messages.slice(-5));

  return compacted;
}

function summarizeDroppedMessages(messages: Message[]): string {
  const intents = new Set<string>();
  const analyses = new Set<string>();
  const keywords: string[] = [];

  for (const msg of messages) {
    if (msg.metadata?.intent) {
      intents.add(msg.metadata.intent);
    }
    if (msg.metadata?.analysesRun) {
      for (const a of msg.metadata.analysesRun) {
        analyses.add(a);
      }
    }
  }

  return `[Conversation summary: Discussed ${intents.size} topics, ran ${analyses.size} analyses including ${[...analyses].slice(0, 3).join(', ')}]`;
}
```

---

## 7. API Design

### 7.1 SSE Streaming Endpoint

```typescript
// apps/web/src/app/api/seo-chat/stream/route.ts

import { NextRequest } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { sessionStore } from '@/lib/seo-chat/state/session-store';
import { detectIntent } from '@/lib/seo-chat/router/intent-router';
import { buildExecutionPlan, executeAnalysisPlan } from '@/lib/seo-chat/analyses/dag-executor';
import { analysisRegistry } from '@/lib/seo-chat/analyses/registry';
import { INTENT_PIPELINES } from '@/lib/seo-chat/router/pipeline-mapper';
import { generateChatResponse } from '@/lib/seo-chat/response/generator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const { userId, orgId } = getAuth(request);
  if (!userId || !orgId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = await request.json();
  const { sessionId, message } = body;

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = async (event: SSEEvent) => {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      try {
        // Step 1: Load/create session
        const context = await sessionStore.getOrCreate(sessionId, orgId, userId);

        // Step 2: Add user message
        const userMessage = {
          id: crypto.randomUUID(),
          role: 'user' as const,
          content: message,
          timestamp: new Date(),
        };
        context.messages.push(userMessage);

        // Step 3: Detect intent
        await emit({ type: 'intent_detecting' });
        const detectedIntent = await detectIntent(
          message,
          context.messages,
          context.messages[context.messages.length - 2]?.metadata?.intent
        );

        await emit({
          type: 'intent_detected',
          intent: detectedIntent.intent,
          confidence: detectedIntent.confidence,
          entities: detectedIntent.entities,
        });

        // Step 4: Check for missing required context
        if (detectedIntent.missingRequired && detectedIntent.missingRequired.length > 0) {
          const clarification = generateClarificationRequest(detectedIntent.missingRequired);
          await emit({
            type: 'clarification_needed',
            missing: detectedIntent.missingRequired,
            prompt: clarification,
          });
          
          // Save and close
          await sessionStore.save(context);
          controller.close();
          return;
        }

        // Step 5: Build and execute analysis pipeline
        const pipelineAnalyses = INTENT_PIPELINES[detectedIntent.intent];
        
        if (pipelineAnalyses.length > 0) {
          const plan = buildExecutionPlan(pipelineAnalyses, analysisRegistry);

          await emit({
            type: 'pipeline_start',
            totalAnalyses: plan.levels.flatMap(l => l.analysisIds).length,
            estimatedCostMicros: plan.totalEstimatedCostMicros,
            estimatedTimeMs: plan.totalEstimatedTimeMs,
          });

          // Create emitter that sends to SSE
          const emitter = {
            emit: async (event: unknown) => {
              await emit(event as SSEEvent);
            },
          };

          const results = await executeAnalysisPlan(plan, {
            workspaceId: orgId,
            sessionId,
            domain: detectedIntent.entities.domains[0],
            keywords: detectedIntent.entities.keywords,
            competitor: detectedIntent.entities.competitors[0],
            previousResults: context.analysisResults,
            settings: context.settings,
          }, emitter as SSEEmitter);

          // Merge results into context
          for (const [key, value] of results) {
            context.analysisResults.set(key, value);
          }
        }

        // Step 6: Generate response
        await emit({ type: 'generating_response' });
        
        const response = await generateChatResponse(
          detectedIntent.intent,
          context,
          detectedIntent.entities
        );

        // Step 7: Add assistant message
        const assistantMessage = {
          id: crypto.randomUUID(),
          role: 'assistant' as const,
          content: response.text,
          timestamp: new Date(),
          metadata: {
            intent: detectedIntent.intent,
            analysesRun: pipelineAnalyses,
          },
        };
        context.messages.push(assistantMessage);

        await emit({
          type: 'response',
          content: response.text,
          suggestedActions: response.suggestedActions,
          visualizations: response.visualizations,
        });

        // Step 8: Save context
        await sessionStore.save(context);

        await emit({ type: 'complete' });
        controller.close();

      } catch (error) {
        await emit({
          type: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

interface SSEEvent {
  type: string;
  [key: string]: unknown;
}

interface SSEEmitter {
  emit: (event: SSEEvent) => Promise<void>;
}

function generateClarificationRequest(missing: string[]): string {
  const prompts: Record<string, string> = {
    domain: 'Which website would you like me to analyze?',
    keywords: 'What keywords are you interested in ranking for?',
    competitor: 'Which competitor would you like me to compare with?',
  };

  return missing.map(m => prompts[m]).join(' ');
}
```

### 7.2 REST Endpoints

```typescript
// apps/web/src/app/api/seo-chat/sessions/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { seoChatSessions } from '@/db/seo-chat-schema';
import { eq, and, desc } from 'drizzle-orm';

// GET /api/seo-chat/sessions - List sessions for workspace
export async function GET(request: NextRequest) {
  const { orgId } = getAuth(request);
  if (!orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

  const sessions = await db
    .select({
      id: seoChatSessions.id,
      prospectDomain: seoChatSessions.prospectDomain,
      status: seoChatSessions.status,
      messageCount: seoChatSessions.messageCount,
      lastActivityAt: seoChatSessions.lastActivityAt,
      createdAt: seoChatSessions.createdAt,
    })
    .from(seoChatSessions)
    .where(eq(seoChatSessions.workspaceId, orgId))
    .orderBy(desc(seoChatSessions.lastActivityAt))
    .limit(limit)
    .offset((page - 1) * limit);

  return NextResponse.json({ sessions, page, limit });
}

// POST /api/seo-chat/sessions - Create new session
export async function POST(request: NextRequest) {
  const { userId, orgId } = getAuth(request);
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sessionId = crypto.randomUUID();
  const context = await sessionStore.getOrCreate(sessionId, orgId, userId);

  return NextResponse.json({
    sessionId: context.sessionId,
    workspaceId: context.workspaceId,
  });
}
```

```typescript
// apps/web/src/app/api/seo-chat/sessions/[sessionId]/route.ts

// GET /api/seo-chat/sessions/[sessionId] - Get session details
export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const { orgId } = getAuth(request);
  if (!orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [session] = await db
    .select()
    .from(seoChatSessions)
    .where(
      and(
        eq(seoChatSessions.id, params.sessionId),
        eq(seoChatSessions.workspaceId, orgId)
      )
    )
    .limit(1);

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json(session);
}

// DELETE /api/seo-chat/sessions/[sessionId] - Archive session
export async function DELETE(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const { orgId } = getAuth(request);
  if (!orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await sessionStore.archive(params.sessionId);

  return NextResponse.json({ success: true });
}
```

### 7.3 Rate Limiting

```typescript
// apps/web/src/lib/seo-chat/middleware/rate-limiter.ts

import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL!);

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}

const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
  // Per workspace limits
  workspace: {
    windowMs: 60000, // 1 minute
    maxRequests: 100, // 100 requests/minute
    keyPrefix: 'ratelimit:workspace',
  },
  // Per session limits
  session: {
    windowMs: 1000, // 1 second
    maxRequests: 5, // 5 requests/second
    keyPrefix: 'ratelimit:session',
  },
  // Analysis limits (more expensive)
  analysis: {
    windowMs: 60000, // 1 minute
    maxRequests: 20, // 20 analyses/minute
    keyPrefix: 'ratelimit:analysis',
  },
  // Proposal generation limits
  proposal: {
    windowMs: 300000, // 5 minutes
    maxRequests: 10, // 10 proposals/5min
    keyPrefix: 'ratelimit:proposal',
  },
};

export async function checkRateLimit(
  type: keyof typeof DEFAULT_LIMITS,
  identifier: string
): Promise<{ allowed: boolean; remaining: number; resetMs: number }> {
  const config = DEFAULT_LIMITS[type];
  const key = `${config.keyPrefix}:${identifier}`;
  
  const now = Date.now();
  const windowStart = now - config.windowMs;

  // Remove expired entries and count
  await redis.zremrangebyscore(key, 0, windowStart);
  const count = await redis.zcard(key);

  if (count >= config.maxRequests) {
    const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
    const resetMs = oldest.length >= 2 
      ? parseInt(oldest[1]) + config.windowMs - now
      : config.windowMs;

    return {
      allowed: false,
      remaining: 0,
      resetMs,
    };
  }

  // Add this request
  await redis.zadd(key, now, `${now}:${Math.random()}`);
  await redis.expire(key, Math.ceil(config.windowMs / 1000));

  return {
    allowed: true,
    remaining: config.maxRequests - count - 1,
    resetMs: config.windowMs,
  };
}
```

---

## 8. Database Schema

### 8.1 SEO Chat Sessions Table

```sql
-- Migration: 0100_create_seo_chat_tables.sql

-- SEO Chat Sessions
CREATE TABLE seo_chat_sessions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  
  -- Prospect context
  prospect_id TEXT REFERENCES prospects(id) ON DELETE SET NULL,
  prospect_domain TEXT,
  
  -- Session state
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  context JSONB NOT NULL DEFAULT '{}',
  
  -- Stats
  message_count INTEGER NOT NULL DEFAULT 0,
  analysis_count INTEGER NOT NULL DEFAULT 0,
  total_cost_micros INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_seo_chat_sessions_workspace ON seo_chat_sessions(workspace_id);
CREATE INDEX ix_seo_chat_sessions_user ON seo_chat_sessions(user_id);
CREATE INDEX ix_seo_chat_sessions_prospect ON seo_chat_sessions(prospect_id);
CREATE INDEX ix_seo_chat_sessions_last_activity ON seo_chat_sessions(last_activity_at);
```

### 8.2 SEO Chat Messages Table

```sql
-- SEO Chat Messages (for detailed history)
CREATE TABLE seo_chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES seo_chat_sessions(id) ON DELETE CASCADE,
  
  -- Message content
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  
  -- Metadata
  intent TEXT,
  entities JSONB,
  analyses_run TEXT[],
  cost_micros INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_seo_chat_messages_session ON seo_chat_messages(session_id);
CREATE INDEX ix_seo_chat_messages_created ON seo_chat_messages(created_at);
```

### 8.3 SEO Chat Analyses Table

```sql
-- SEO Chat Analyses (cached analysis results)
CREATE TABLE seo_chat_analyses (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES seo_chat_sessions(id) ON DELETE CASCADE,
  
  -- Analysis details
  analysis_type TEXT NOT NULL,
  domain TEXT,
  input_hash TEXT NOT NULL, -- For deduplication
  
  -- Results
  result JSONB NOT NULL,
  cost_micros INTEGER NOT NULL DEFAULT 0,
  execution_ms INTEGER NOT NULL DEFAULT 0,
  
  -- Cache control
  cached BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_seo_chat_analyses_session ON seo_chat_analyses(session_id);
CREATE INDEX ix_seo_chat_analyses_type ON seo_chat_analyses(analysis_type);
CREATE INDEX ix_seo_chat_analyses_domain ON seo_chat_analyses(domain);
CREATE UNIQUE INDEX ix_seo_chat_analyses_dedupe ON seo_chat_analyses(session_id, analysis_type, input_hash);
```

### 8.4 Workspace Settings JSONB Columns

```sql
-- Add SEO Chat settings to workspace_settings table
ALTER TABLE workspace_settings 
ADD COLUMN IF NOT EXISTS seo_chat_settings JSONB DEFAULT '{
  "feasibility": {
    "maxFeasibleKD": 85,
    "easyKDThreshold": 30,
    "mediumKDThreshold": 50,
    "hardKDThreshold": 70,
    "linksPerMonth": 10,
    "contentPagesPerMonth": 12,
    "technicalHoursPerMonth": 20,
    "baselineMonths": 3,
    "monthsPerKDPoint": 0.1,
    "maxTimelineMonths": 18,
    "ymylPenalty": 20,
    "localBonus": -10
  },
  "response": {
    "tone": "professional",
    "language": "en",
    "showCompetitorNames": false,
    "autoSuggestProposal": true,
    "autoSuggestExpand": true
  },
  "proposal": {
    "expiryDays": 14,
    "minimumContractMonths": 3,
    "brandColor": "#2563eb"
  }
}'::JSONB;

CREATE INDEX ix_workspace_settings_seo_chat ON workspace_settings USING GIN (seo_chat_settings);
```

### 8.5 Domain Learning Table

```sql
-- Domain learning for scraping tier optimization
CREATE TABLE domain_learning (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  
  -- Scraping profile
  preferred_tier TEXT NOT NULL DEFAULT 'residential',
  has_cloudflare BOOLEAN NOT NULL DEFAULT FALSE,
  avg_response_ms INTEGER NOT NULL DEFAULT 0,
  
  -- Success tracking
  last_success_at TIMESTAMPTZ,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  total_requests INTEGER NOT NULL DEFAULT 0,
  total_successes INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_domain_learning_domain ON domain_learning(domain);
CREATE INDEX ix_domain_learning_tier ON domain_learning(preferred_tier);
```

### 8.6 Drizzle Schema Definition

```typescript
// apps/web/src/db/seo-chat-schema.ts

import {
  pgTable,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organization } from './user-schema';
import { prospects } from './prospect-schema';

export const seoChatSessions = pgTable(
  'seo_chat_sessions',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    prospectId: text('prospect_id').references(() => prospects.id, { onDelete: 'set null' }),
    prospectDomain: text('prospect_domain'),
    status: text('status').notNull().default('active'),
    context: jsonb('context').notNull().default({}),
    messageCount: integer('message_count').notNull().default(0),
    analysisCount: integer('analysis_count').notNull().default(0),
    totalCostMicros: integer('total_cost_micros').notNull().default(0),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('ix_seo_chat_sessions_workspace').on(table.workspaceId),
    index('ix_seo_chat_sessions_user').on(table.userId),
    index('ix_seo_chat_sessions_prospect').on(table.prospectId),
    index('ix_seo_chat_sessions_last_activity').on(table.lastActivityAt),
  ]
);

export const seoChatMessages = pgTable(
  'seo_chat_messages',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => seoChatSessions.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    content: text('content').notNull(),
    intent: text('intent'),
    entities: jsonb('entities'),
    analysesRun: text('analyses_run').array(),
    costMicros: integer('cost_micros').default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('ix_seo_chat_messages_session').on(table.sessionId),
    index('ix_seo_chat_messages_created').on(table.createdAt),
  ]
);

export const seoChatAnalyses = pgTable(
  'seo_chat_analyses',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => seoChatSessions.id, { onDelete: 'cascade' }),
    analysisType: text('analysis_type').notNull(),
    domain: text('domain'),
    inputHash: text('input_hash').notNull(),
    result: jsonb('result').notNull(),
    costMicros: integer('cost_micros').notNull().default(0),
    executionMs: integer('execution_ms').notNull().default(0),
    cached: boolean('cached').notNull().default(false),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('ix_seo_chat_analyses_session').on(table.sessionId),
    index('ix_seo_chat_analyses_type').on(table.analysisType),
    index('ix_seo_chat_analyses_domain').on(table.domain),
    uniqueIndex('ix_seo_chat_analyses_dedupe').on(table.sessionId, table.analysisType, table.inputHash),
  ]
);

export const domainLearning = pgTable(
  'domain_learning',
  {
    id: text('id').primaryKey(),
    domain: text('domain').notNull().unique(),
    preferredTier: text('preferred_tier').notNull().default('residential'),
    hasCloudflare: boolean('has_cloudflare').notNull().default(false),
    avgResponseMs: integer('avg_response_ms').notNull().default(0),
    lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
    consecutiveFailures: integer('consecutive_failures').notNull().default(0),
    totalRequests: integer('total_requests').notNull().default(0),
    totalSuccesses: integer('total_successes').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('ix_domain_learning_domain').on(table.domain),
    index('ix_domain_learning_tier').on(table.preferredTier),
  ]
);

// Relations
export const seoChatSessionsRelations = relations(seoChatSessions, ({ one, many }) => ({
  workspace: one(organization, {
    fields: [seoChatSessions.workspaceId],
    references: [organization.id],
  }),
  prospect: one(prospects, {
    fields: [seoChatSessions.prospectId],
    references: [prospects.id],
  }),
  messages: many(seoChatMessages),
  analyses: many(seoChatAnalyses),
}));

export const seoChatMessagesRelations = relations(seoChatMessages, ({ one }) => ({
  session: one(seoChatSessions, {
    fields: [seoChatMessages.sessionId],
    references: [seoChatSessions.id],
  }),
}));

export const seoChatAnalysesRelations = relations(seoChatAnalyses, ({ one }) => ({
  session: one(seoChatSessions, {
    fields: [seoChatAnalyses.sessionId],
    references: [seoChatSessions.id],
  }),
}));

// Types
export type SeoChatSessionSelect = typeof seoChatSessions.$inferSelect;
export type SeoChatSessionInsert = typeof seoChatSessions.$inferInsert;
export type SeoChatMessageSelect = typeof seoChatMessages.$inferSelect;
export type SeoChatMessageInsert = typeof seoChatMessages.$inferInsert;
export type SeoChatAnalysisSelect = typeof seoChatAnalyses.$inferSelect;
export type SeoChatAnalysisInsert = typeof seoChatAnalyses.$inferInsert;
export type DomainLearningSelect = typeof domainLearning.$inferSelect;
export type DomainLearningInsert = typeof domainLearning.$inferInsert;
```

---

## Summary

This architecture provides:

1. **Intent Router** - Pattern-first with Grok 4.1-fast fallback, entity extraction, confidence thresholds
2. **Analysis Pipeline** - DAG executor with parallel execution, SSE streaming, cost tracking
3. **Scraping Integration** - Scrapling-first 3-tier with domain learning and RAG ingestion
4. **Keyword Intelligence** - Full integration with KeywordUniverseBuilder, HierarchyBuilder, and feasibility formula
5. **Proposal Generation** - Context accumulation, keyword assignment strategies, magic links
6. **State Management** - Redis for active sessions, PostgreSQL for persistence, token budget management
7. **API Design** - SSE streaming endpoint, REST CRUD, rate limiting per workspace/session
8. **Database Schema** - 4 tables with proper indexes and relations

Total estimated effort: **5-6 weeks** as outlined in Phase 98 spec.
