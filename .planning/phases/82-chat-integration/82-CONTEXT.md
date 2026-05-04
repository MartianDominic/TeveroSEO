# Phase 82: Chat Integration - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning
**Mode:** New feature - World-Class Keyword Intelligence v8.0

<domain>
## Phase Boundary

Conversational keyword analysis via CopilotKit with full analysis pipeline. This is the user-facing interface where they paste conversation + upload keywords and get interactive results.

**The Problem:**
Current keyword analysis is:
1. Go to prospect page
2. Upload keywords (CSV)
3. Wait for enrichment
4. Get flat list sorted by... something
5. Manually scroll through 2000 keywords
6. Copy-paste interesting ones to proposal

**The Solution:**
Chat interface where user:
1. Pastes client conversation
2. Uploads/pastes keywords
3. AI extracts constraints, runs full pipeline
4. Streams progressive results
5. User can ask follow-up questions
6. Export selected + pSEO opportunities directly

</domain>

<decisions>
## Implementation Decisions

### Chat Architecture

```typescript
// CopilotKit integration in apps/web
interface KeywordAnalysisChat {
  // State
  conversation: string;           // Client conversation text
  keywords: string[];             // Uploaded/pasted keywords
  constraints: AnalysisConstraints | null;
  analysisResult: AnalysisResult | null;
  
  // Streaming state
  currentStage: AnalysisStage;
  progressPercent: number;
  partialResults: PartialResult[];
  
  // History
  messages: ChatMessage[];
  previousAnalyses: AnalysisSession[];  // Per-client memory
}

type AnalysisStage = 
  | 'idle'
  | 'extracting_constraints'
  | 'classifying_funnel'
  | 'classifying_geo'
  | 'scoring_relevance'
  | 'filtering'
  | 'selecting'
  | 'discovering_pseo'
  | 'discovering_side_keywords'
  | 'complete';
```

### Analysis Endpoint

```typescript
// POST /api/keyword-chat/analyze
interface AnalyzeRequest {
  clientId: string;
  conversation: string;
  keywords: string[];  // Raw keyword strings
  config?: AnalysisConfig;
}

interface AnalysisConfig {
  targetCount?: number;
  cascadePreset?: 'default' | 'service' | 'ecommerce' | 'content';
  enablePSEODetection?: boolean;
  enableSideKeywords?: boolean;
  enableProductLinkage?: boolean;
}

// Streaming response (Server-Sent Events)
interface AnalysisEvent {
  type: 'progress' | 'partial' | 'complete' | 'error';
  stage?: AnalysisStage;
  progress?: number;  // 0-100
  data?: Partial<AnalysisResult>;
  message?: string;
}
```

### Streaming Implementation

```typescript
// Backend streaming endpoint
export async function POST(req: NextRequest) {
  const body = await req.json() as AnalyzeRequest;
  
  // Create SSE stream
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();
  
  // Run analysis pipeline with progress callbacks
  const pipeline = new AnalysisPipeline({
    onProgress: async (stage, percent) => {
      await writer.write(encoder.encode(
        `data: ${JSON.stringify({ type: 'progress', stage, progress: percent })}\n\n`
      ));
    },
    onPartial: async (data) => {
      await writer.write(encoder.encode(
        `data: ${JSON.stringify({ type: 'partial', data })}\n\n`
      ));
    },
  });
  
  // Execute stages
  try {
    // Stage 1: Extract constraints (Phase 75)
    pipeline.emit('progress', 'extracting_constraints', 5);
    const constraints = await conversationIntelligence.extract(body.conversation);
    pipeline.emit('partial', { constraints });
    
    // Stage 2: Enrich keywords (existing)
    pipeline.emit('progress', 'enriching', 15);
    const enriched = await keywordEnrichment.enrich(body.keywords);
    
    // Stage 3: Funnel classification (Phase 76)
    pipeline.emit('progress', 'classifying_funnel', 25);
    const funnelClassified = await funnelClassifier.classify(enriched, constraints);
    pipeline.emit('partial', { funnelBreakdown: summarizeFunnel(funnelClassified) });
    
    // Stage 4: Geo classification (Phase 77)
    pipeline.emit('progress', 'classifying_geo', 35);
    const geoClassified = await geoClassifier.classify(funnelClassified, constraints);
    pipeline.emit('partial', { geoBreakdown: summarizeGeo(geoClassified) });
    
    // Stage 5: Relevance scoring (Phase 78)
    pipeline.emit('progress', 'scoring_relevance', 50);
    const scored = await relevanceScorer.score(geoClassified, constraints);
    
    // Stage 6: Constraint filtering (Phase 79)
    pipeline.emit('progress', 'filtering', 65);
    const filtered = await constraintFilter.filter(scored, constraints);
    pipeline.emit('partial', { 
      filterBreakdown: summarizeFiltering(filtered),
      excludedCount: filtered.excluded.length,
    });
    
    // Stage 7: Cascade selection (Phase 80)
    pipeline.emit('progress', 'selecting', 75);
    const selection = await cascadeSelector.select(filtered.passed, constraints);
    pipeline.emit('partial', { 
      selectionBreakdown: selection.breakdown,
      topKeywords: selection.selected.slice(0, 10),
    });
    
    // Stage 8: pSEO detection (Phase 81)
    if (body.config?.enablePSEODetection !== false) {
      pipeline.emit('progress', 'discovering_pseo', 85);
      const pseo = await pseoDetector.detect(selection.selected);
      pipeline.emit('partial', { pseoOpportunities: pseo });
    }
    
    // Stage 9: Side keyword discovery (Phase 81)
    if (body.config?.enableSideKeywords !== false) {
      pipeline.emit('progress', 'discovering_side_keywords', 95);
      const sideKW = await sideKeywordExpander.expand(constraints);
      pipeline.emit('partial', { sideKeywords: sideKW });
    }
    
    // Complete
    pipeline.emit('progress', 'complete', 100);
    await writer.write(encoder.encode(
      `data: ${JSON.stringify({ type: 'complete', data: fullResult })}\n\n`
    ));
    
  } catch (error) {
    await writer.write(encoder.encode(
      `data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`
    ));
  } finally {
    await writer.close();
  }
  
  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

### CopilotKit Tool Definition

```typescript
// apps/web/src/lib/copilot/tools/keyword-analysis.ts
export const analyzeKeywordsTool = {
  name: 'analyze_keywords',
  description: 'Analyze keywords based on client conversation and constraints',
  parameters: {
    type: 'object',
    properties: {
      conversation: {
        type: 'string',
        description: 'Client conversation text describing their business and needs',
      },
      keywords: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of keywords to analyze',
      },
      targetCount: {
        type: 'number',
        description: 'Target number of keywords to select (default: 100)',
      },
    },
    required: ['conversation', 'keywords'],
  },
  handler: async (params) => {
    // Call streaming endpoint
    const response = await fetch('/api/keyword-chat/analyze', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    
    // Process SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    let result = null;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const text = decoder.decode(value);
      const events = text.split('\n\n').filter(Boolean);
      
      for (const event of events) {
        const data = JSON.parse(event.replace('data: ', ''));
        if (data.type === 'complete') {
          result = data.data;
        }
      }
    }
    
    return result;
  },
};
```

### React Component

```tsx
// apps/web/src/components/keyword-analysis/KeywordAnalysisChat.tsx
export function KeywordAnalysisChat({ clientId }: Props) {
  const [stage, setStage] = useState<AnalysisStage>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [partials, setPartials] = useState<PartialResult[]>([]);
  
  const { messages, append } = useCopilotChat();
  
  const handleAnalyze = async (conversation: string, keywords: string[]) => {
    setStage('extracting_constraints');
    
    const eventSource = new EventSource(
      `/api/keyword-chat/analyze?${new URLSearchParams({
        clientId,
        conversation,
        keywords: JSON.stringify(keywords),
      })}`
    );
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'progress') {
        setStage(data.stage);
        setProgress(data.progress);
      } else if (data.type === 'partial') {
        setPartials(prev => [...prev, data.data]);
      } else if (data.type === 'complete') {
        setResult(data.data);
        setStage('complete');
        eventSource.close();
      }
    };
  };
  
  return (
    <div className="flex flex-col h-full">
      {/* Progress indicator */}
      {stage !== 'idle' && stage !== 'complete' && (
        <AnalysisProgress stage={stage} percent={progress} partials={partials} />
      )}
      
      {/* Results */}
      {result && (
        <AnalysisResults 
          result={result}
          onExport={handleExport}
          onRefine={handleRefine}
        />
      )}
      
      {/* Chat interface */}
      <CopilotChat
        messages={messages}
        onSend={append}
        placeholder="Paste client conversation here..."
      />
    </div>
  );
}
```

### Export Actions

```typescript
// Export selected keywords
async function exportSelected(result: AnalysisResult): Promise<Blob> {
  const rows = result.selection.selected.map(kw => ({
    keyword: kw.keyword,
    funnel_stage: kw.funnelStage,
    volume: kw.metrics.volume,
    difficulty: kw.metrics.difficulty,
    composite_score: kw.compositeScore,
    cascade_position: kw.cascadePosition,
  }));
  
  return new Blob([Papa.unparse(rows)], { type: 'text/csv' });
}

// Export excluded with reasons
async function exportExcluded(result: AnalysisResult): Promise<Blob> {
  const rows = result.filtering.excluded.map(kw => ({
    keyword: kw.keyword,
    exclusion_reason: kw.exclusionReason,
    exclusion_stage: kw.exclusionStage,
    human_readable: kw.humanReadable,
  }));
  
  return new Blob([Papa.unparse(rows)], { type: 'text/csv' });
}

// Export pSEO opportunities
async function exportPSEO(result: AnalysisResult): Promise<Blob> {
  const rows = result.pseoOpportunities.flatMap(cluster => 
    cluster.keywords.map(kw => ({
      pattern: cluster.pattern,
      template: cluster.template,
      keyword: kw,
      estimated_pages: cluster.estimatedPages,
      total_volume: cluster.totalVolume,
      opportunity_score: cluster.opportunityScore,
    }))
  );
  
  return new Blob([Papa.unparse(rows)], { type: 'text/csv' });
}
```

### Conversation Memory

```typescript
// Per-client analysis history
interface AnalysisSession {
  id: string;
  clientId: string;
  timestamp: Date;
  conversation: string;
  constraintsHash: string;
  keywordCount: number;
  selectedCount: number;
  breakdown: SelectionBreakdown;
}

// Store in database
CREATE TABLE analysis_sessions (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  conversation TEXT NOT NULL,
  constraints_hash TEXT NOT NULL,
  keyword_count INTEGER NOT NULL,
  selected_count INTEGER NOT NULL,
  breakdown JSONB NOT NULL,
  result JSONB  -- Full result for retrieval
);

// Retrieval
async function getPreviousAnalyses(clientId: string): Promise<AnalysisSession[]> {
  return db.query.analysisSessions.findMany({
    where: eq(analysisSessions.clientId, clientId),
    orderBy: desc(analysisSessions.createdAt),
    limit: 10,
  });
}
```

</decisions>

<references>
## Reference Documents

- `.planning/keyword-intelligence/WORLD-CLASS-ARCHITECTURE.md` — Full system design
- `apps/web/src/components/copilot/` — Existing CopilotKit integration
- `apps/web/src/app/api/` — Next.js API routes
- `AI-Writer/frontend/src/components/Chat/` — Chat UI patterns

</references>

<existing_code>
## Existing Infrastructure

### CopilotKit Integration
- apps/web has CopilotKit set up
- Custom tools defined in `src/lib/copilot/tools/`
- **Gap:** No keyword analysis tool

### Streaming API
- SSE patterns exist in open-seo-main for audit progress
- **Gap:** Need to apply to keyword analysis

### CSV Export
- Basic CSV export exists for keyword lists
- **Gap:** No structured exports with metadata

</existing_code>

<success_criteria>
## Success Criteria

1. Paste conversation + upload keywords + get analysis in chat
2. Results stream progressively (not all-at-once after 30s)
3. Progress indicator shows current stage and percent
4. Partial results visible while processing (funnel breakdown, geo breakdown)
5. Export actions work from chat UI (selected, excluded, pSEO)
6. Previous analyses retrievable per client
7. Full analysis completes in <60 seconds for 3000 keywords
8. Follow-up questions refine constraints without re-uploading

</success_criteria>

<test_cases>
## Key Test Cases

### Full Analysis Flow

```
1. User opens keyword analysis chat for "AutoPlus" client
2. User pastes: "Mes automobilių plovykla Šiauliuose. Norime pritraukti 
   verslo klientų su automobilių parkais."
3. User uploads/pastes 2000 keywords from DataForSEO
4. AI starts streaming analysis:
   - "Extracting constraints..." (5%)
   - "Found: car wash in Šiauliai, B2B focus" (partial)
   - "Classifying funnel stages..." (25%)
   - "BOFU: 450, MOFU: 890, TOFU: 660" (partial)
   - ... continues through all stages
5. Final result shows:
   - 100 selected keywords (cascade selection)
   - Breakdown: 60% BOFU, 30% MOFU, 10% TOFU
   - 3 pSEO opportunities
   - 25 side keywords from problem expansion
6. User clicks "Export Selected" → downloads CSV
```

### Follow-up Refinement

```
After initial analysis:

User: "Actually, also include keywords for Panevėžys"

AI: 
- Updates geoConstraints.includeCities: ["šiauliai", "panevėžys"]
- Re-runs geo filter
- Streams updated results
- "Added 35 new keywords for Panevėžys"
```

### Previous Analysis Retrieval

```
User: "Show me the analysis we did last week"

AI:
- Queries analysis_sessions for clientId
- Returns: "Found 3 previous analyses"
  - 2024-03-01: 2500 keywords → 100 selected
  - 2024-02-15: 1800 keywords → 150 selected
  - 2024-02-01: 3000 keywords → 100 selected
- User: "Load the first one"
- AI displays cached result
```

### Error Handling

```
User uploads 10,000 keywords (over limit)

AI:
- "Processing 10,000 keywords..."
- At enrichment stage: "Warning: Large dataset. Estimated time: 5 minutes."
- Progress continues with periodic updates
- If timeout: "Analysis taking longer than expected. Processing in background. 
  I'll notify you when complete."
```

</test_cases>
