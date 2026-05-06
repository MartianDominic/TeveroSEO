# Phase 86: LLM Architecture

> **Created:** 2026-05-05
> **Status:** Validated
> **Models:** Grok 4.1 (Analysis) + Gemini 3.1 Pro (Writing)

---

## Executive Summary

The Phase 86 Semantic Intelligence Pipeline uses a **dual-model architecture**:

| Layer | Model | Purpose | Cost |
|-------|-------|---------|------|
| **Analysis** | Grok 4.1 Fast/Thinking | Clustering intelligence, labels, recommendations | ~$0.04/analysis |
| **Writing** | Gemini 3.1 Pro | Content generation, brand voice | ~$0.20-0.50/article |

**Key Insight:** Grok 4.1 is 10-24x cheaper than Gemini/Claude/GPT for analysis tasks while maintaining comparable quality for structured extraction and reasoning.

---

## Model Specifications

### Grok 4.1 (xAI) — Analysis Layer

| Variant | Input/1M | Output/1M | Context | Use Case |
|---------|----------|-----------|---------|----------|
| **Grok 4.1 Fast** | $0.20 | $0.50 | 2M tokens | Structured extraction, batch labeling |
| **Grok 4.1 Thinking** | $0.20 + thinking | $0.50 | 2M tokens | Strategic reasoning, narratives |
| Cache hit | $0.05 | — | — | 75% discount on repeated patterns |

**Capabilities:**
- 2M token context window (fits all clusters + SERP + client profile)
- Reasoning mode toggle (enable for complex analysis)
- OpenAI-compatible API
- 115 tokens/sec output speed
- Strong agentic/tool calling performance

**Benchmarks (2026):**
- SWE-bench Verified: 75%
- AIME 2025: 94%
- GPQA Diamond: 88.4%
- Text Arena: #2 (behind Gemini 3 Pro)

### Gemini 3.1 Pro (Google) — Writing Layer

| Tier | Input/1M | Output/1M | Context |
|------|----------|-----------|---------|
| Standard (≤200K) | $2.00 | $12.00 | 2M tokens |
| Long context (>200K) | $4.00 | $18.00 | 2M tokens |
| Batch API | 50% off | 50% off | — |
| Context caching | $0.20 | — | 90% off cached |

**Capabilities:**
- Best-in-class writing quality
- Strong Lithuanian language support
- 2M token context window
- Multimodal (vision, audio, video)
- Structured JSON output

**Benchmarks (2026):**
- ARC-AGI-2: 77.1%
- GPQA Diamond: 94.3%
- SWE-bench Verified: 80.6%

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 86: SEMANTIC INTELLIGENCE PIPELINE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐   ┌──────────┐   ┌──────────────┐   ┌─────────┐ │
│  │Clustering│ → │   SERP   │ → │ Grok 4.1     │ → │Proposal │ │
│  │(no LLM)  │   │Enrichment│   │ Analysis     │   │   UI    │ │
│  │          │   │(no LLM)  │   │              │   │         │ │
│  └──────────┘   └──────────┘   └──────────────┘   └─────────┘ │
│                                        │                        │
│                                        ▼                        │
│                              ┌──────────────────┐              │
│                              │ Grok 4.1 Tasks:  │              │
│                              │ • Cluster labels │              │
│                              │ • Strategic rank │              │
│                              │ • Content recs   │              │
│                              │ • Proposal text  │              │
│                              │ • CopilotKit     │              │
│                              └──────────────────┘              │
│                                                                 │
│  Cost: ~$0.04/analysis                                         │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ AI-WRITER: CONTENT GENERATION                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐   ┌──────────────┐   ┌─────────┐   ┌─────────┐  │
│  │ Keyword  │ → │ Gemini 3.1   │ → │ Quality │ → │ Publish │  │
│  │Selection │   │ Pro Writing  │   │  Gate   │   │         │  │
│  └──────────┘   └──────────────┘   └─────────┘   └─────────┘  │
│                                                                 │
│  Gemini 3.1 Pro Tasks:                                         │
│  • Article generation (long-form)                              │
│  • Brand voice application                                     │
│  • Lithuanian language quality                                 │
│  • Content optimization                                        │
│                                                                 │
│  Cost: ~$0.20-0.50/article                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Grok 4.1 Task Breakdown

### Fast Mode (Structured Extraction)

Used for tasks requiring structured JSON output without deep reasoning.

| Task | Input | Output | Cost |
|------|-------|--------|------|
| Cluster labeling (all clusters) | 30K tokens | 5K tokens | $0.008 |
| Content recommendations | 20K tokens | 8K tokens | $0.008 |
| Competitor gap extraction | 15K tokens | 3K tokens | $0.005 |
| CopilotKit responses | 2K tokens | 500 tokens | $0.001 |

**When to use:**
- Batch processing
- Pattern matching
- Structured JSON extraction
- Real-time chat responses

### Thinking Mode (Reasoning)

Used for tasks requiring step-by-step reasoning before response.

| Task | Input | Output | Cost |
|------|-------|--------|------|
| Strategic ranking (per cluster) | 40K tokens | 10K tokens | $0.013 |
| Proposal narrative | 50K tokens | 5K tokens | $0.012 |
| "Why this cluster?" explanations | 10K tokens | 2K tokens | $0.004 |

**When to use:**
- Business context interpretation
- Multi-factor trade-off analysis
- Persuasive narrative generation
- Complex "why" questions

---

## Implementation

### Grok 4.1 Integration (AI-Writer)

```python
# AI-Writer/ai_writer/services/grok_analysis_service.py

from openai import OpenAI
import os
import json

# xAI uses OpenAI-compatible API
client = OpenAI(
    api_key=os.environ["XAI_API_KEY"],
    base_url="https://api.x.ai/v1",
)


async def label_clusters(clusters: list, client_profile: dict) -> dict:
    """Grok 4.1 Fast: Extract cluster labels."""
    response = client.chat.completions.create(
        model="grok-4.1-fast",
        messages=[{
            "role": "user",
            "content": f"""Label each cluster for business proposal.

Client: {client_profile['business_name']} ({client_profile['industry']})
Target: {client_profile['target_audience']}

Clusters:
{json.dumps(clusters, indent=2)}

Return JSON:
{{
  "labels": [
    {{
      "cluster_id": 1,
      "label_lt": "Lithuanian label",
      "label_en": "English label", 
      "business_label": "Client-focused growth area name"
    }}
  ]
}}"""
        }],
        response_format={"type": "json_object"},
    )
    return json.loads(response.choices[0].message.content)


async def rank_strategic_fit(clusters: list, client_profile: dict) -> dict:
    """Grok 4.1 Thinking: Reason about strategic fit."""
    response = client.chat.completions.create(
        model="grok-4.1-fast",
        messages=[{
            "role": "user",
            "content": f"""Analyze strategic fit of each cluster for this client.

Client Profile:
- Business: {client_profile['business_name']}
- Industry: {client_profile['industry']}
- Positioning: {client_profile.get('positioning', 'neutral')}
- Target: {client_profile['target_audience']}

Clusters with keywords and metrics:
{json.dumps(clusters, indent=2)}

For each cluster, reason through:
1. Business model fit
2. Target audience alignment
3. Competitive opportunity
4. Resource requirements

Return JSON:
{{
  "rankings": [
    {{
      "cluster_id": 1,
      "fit_score": 8,
      "reasoning": "Why this fits...",
      "opportunity": "Key opportunity...",
      "risk": "Main risk..."
    }}
  ]
}}"""
        }],
        reasoning={"effort": "high"},  # Enable thinking mode
        response_format={"type": "json_object"},
    )
    return json.loads(response.choices[0].message.content)


async def generate_content_recommendations(clusters: list) -> dict:
    """Grok 4.1 Fast: Structured content recs."""
    response = client.chat.completions.create(
        model="grok-4.1-fast",
        messages=[{
            "role": "user",
            "content": f"""Recommend content strategy for each cluster.

Clusters:
{json.dumps(clusters, indent=2)}

Return JSON:
{{
  "recommendations": [
    {{
      "cluster_id": 1,
      "content_type": "pillar|comparison|how-to|list|product",
      "pillar_topic": "Main article topic",
      "supporting_topics": ["Topic 1", "Topic 2", "Topic 3"],
      "estimated_articles": 4,
      "priority": "high|medium|low"
    }}
  ]
}}"""
        }],
        response_format={"type": "json_object"},
    )
    return json.loads(response.choices[0].message.content)


async def generate_proposal_narrative(
    analysis: dict,
    client_profile: dict,
    quick_wins: list
) -> str:
    """Grok 4.1 Thinking: Persuasive proposal narrative."""
    response = client.chat.completions.create(
        model="grok-4.1-fast",
        messages=[{
            "role": "user",
            "content": f"""Write a 2-3 paragraph executive summary for this SEO proposal.

Client: {client_profile['business_name']}
Industry: {client_profile['industry']}
Target: {client_profile['target_audience']}

Top Growth Areas (ranked by strategic fit):
{json.dumps(analysis['top_clusters'][:5], indent=2)}

Quick Wins (keywords where client ranks 11-50):
{json.dumps(quick_wins[:10], indent=2)}

Write persuasively in business language, not SEO jargon.
Focus on:
- Why these specific growth areas match their business
- Concrete opportunities (mention specific keywords/positions)
- Expected impact with realistic timeframes
- What makes this strategy custom for them

Do NOT use generic phrases like "comprehensive strategy" or "maximize potential"."""
        }],
        reasoning={"effort": "medium"},
    )
    return response.choices[0].message.content
```

### FastAPI Endpoints

```python
# AI-Writer/ai_writer/api/cluster_analysis.py

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ai_writer.services.grok_analysis_service import (
    label_clusters,
    rank_strategic_fit,
    generate_content_recommendations,
    generate_proposal_narrative,
)

router = APIRouter(prefix="/analysis", tags=["analysis"])


class AnalysisRequest(BaseModel):
    clusters: list[dict]
    serp_data: list[dict]
    client_profile: dict
    quick_wins: list[dict] = []


class AnalysisResponse(BaseModel):
    labels: list[dict]
    strategic_ranking: list[dict]
    content_recommendations: list[dict]
    proposal_narrative: str
    cost_estimate: float


@router.post("/clusters", response_model=AnalysisResponse)
async def analyze_clusters(request: AnalysisRequest):
    """Full cluster analysis using Grok 4.1."""
    try:
        # Run Fast mode tasks in parallel
        labels = await label_clusters(request.clusters, request.client_profile)
        content_recs = await generate_content_recommendations(request.clusters)
        
        # Run Thinking mode tasks
        ranking = await rank_strategic_fit(request.clusters, request.client_profile)
        
        # Prepare analysis for narrative
        analysis = {
            "top_clusters": sorted(
                ranking["rankings"],
                key=lambda x: x["fit_score"],
                reverse=True
            )
        }
        
        # Generate narrative with Thinking mode
        narrative = await generate_proposal_narrative(
            analysis,
            request.client_profile,
            request.quick_wins
        )
        
        return AnalysisResponse(
            labels=labels["labels"],
            strategic_ranking=ranking["rankings"],
            content_recommendations=content_recs["recommendations"],
            proposal_narrative=narrative,
            cost_estimate=0.04,  # Approximate
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### TypeScript Client (open-seo-main)

```typescript
// open-seo-main/src/server/features/keywords/clustering/GrokAnalysis.ts

interface AnalysisRequest {
  clusters: ScoredCluster[];
  serpData: SerpEnrichedKeyword[];
  clientProfile: ClientProfile;
  quickWins: QuickWin[];
}

interface AnalysisResponse {
  labels: ClusterLabel[];
  strategicRanking: StrategicRank[];
  contentRecommendations: ContentRec[];
  proposalNarrative: string;
  costEstimate: number;
}

export async function analyzeWithGrok(
  request: AnalysisRequest
): Promise<AnalysisResponse> {
  const aiWriterUrl = process.env.AI_WRITER_URL || 'http://localhost:8000';
  
  const response = await fetch(`${aiWriterUrl}/api/analysis/clusters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clusters: request.clusters,
      serp_data: request.serpData,
      client_profile: request.clientProfile,
      quick_wins: request.quickWins,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Grok analysis failed: ${response.status}`);
  }
  
  return response.json();
}
```

---

## Cost Summary

### Per Analysis (100 keywords → proposal)

| Component | Model | Cost |
|-----------|-------|------|
| Cluster labeling | Grok 4.1 Fast | $0.008 |
| Strategic ranking | Grok 4.1 Thinking | $0.013 |
| Content recommendations | Grok 4.1 Fast | $0.008 |
| Proposal narrative | Grok 4.1 Thinking | $0.012 |
| **Analysis Total** | | **$0.04** |

### Per Article (content generation)

| Length | Model | Cost |
|--------|-------|------|
| Short (500 words) | Gemini 3.1 Pro | ~$0.15 |
| Medium (1500 words) | Gemini 3.1 Pro | ~$0.30 |
| Long (3000 words) | Gemini 3.1 Pro | ~$0.50 |

### Monthly at Scale

| Volume | Analysis Cost | Note |
|--------|---------------|------|
| 100 prospects | $4 | Negligible |
| 500 prospects | $20 | Still negligible |
| 1000 prospects | $40 | Very affordable |

---

## Quality Assurance

### NO FALLBACKS Policy

**Critical:** Quality must remain constant. Never degrade to cheaper/faster alternatives.

If Grok API fails:
1. Retry with exponential backoff (3 attempts)
2. If still failing, queue for later processing
3. **Never** fall back to pattern matching or simpler heuristics
4. Alert operations team if persistent failures

### Model Selection Rules

| Condition | Model | Reasoning |
|-----------|-------|-----------|
| Structured extraction needed | Grok 4.1 Fast | Speed + cost |
| Complex reasoning needed | Grok 4.1 Thinking | Quality |
| Content writing | Gemini 3.1 Pro | Prose quality |
| Real-time chat | Grok 4.1 Fast | Latency |
| Batch processing | Either + async | Cost optimization |

---

## Environment Variables

```bash
# AI-Writer .env
XAI_API_KEY=xai-xxxxxxxxxxxx
GOOGLE_AI_API_KEY=AIzaxxxxxxxxxxxxxxxx

# Model configuration
GROK_MODEL_FAST=grok-4.1-fast
GROK_MODEL_THINKING=grok-4.1-fast  # Same model, reasoning param differs
GEMINI_MODEL_WRITING=gemini-3.1-pro
```

---

## References

- [xAI Grok API Documentation](https://docs.x.ai/developers/models)
- [Grok 4.1 Fast Pricing](https://pricepertoken.com/pricing-page/model/xai-grok-4.1-fast)
- [Gemini 3.1 Pro Guide](https://almcorp.com/blog/gemini-3-1-pro-complete-guide/)
- [AI API Pricing Comparison 2026](https://intuitionlabs.ai/articles/ai-api-pricing-comparison-grok-gemini-openai-claude)

---

*Document created: 2026-05-05*
