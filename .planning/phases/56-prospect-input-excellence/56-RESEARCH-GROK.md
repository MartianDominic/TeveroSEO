# Phase 56: xAI Grok API Research for Keyword Classification

**Researched:** 2026-04-30
**Domain:** xAI Grok 4.1 API integration for keyword classification pipeline
**Confidence:** HIGH (verified against official xAI documentation and pricing pages)

---

## Executive Summary

xAI's Grok 4.1 API is a strong candidate for the keyword classification cascade. **Grok 4.1 Fast** at $0.20/M input and $0.50/M output matches our target price tier and offers excellent agentic/tool-calling capabilities with a 2M token context window.

**Key Finding:** Grok 4.1 Fast is OpenAI SDK compatible (just change `base_url`), supports structured JSON output, and offers a 50% discount via Batch API. It's positioned as xAI's agentic model - optimized for tool use and classification tasks.

**Recommendation:** Add Grok 4.1 Fast as a **Tier 2 alternative** to Claude Haiku/Gemini Flash in the cascade. It's not the cheapest (GPT-4.1-nano at $0.10/M is better for Pass 1), but it's excellent value for Pass 2 edge-case classification where reasoning quality matters.

---

## 1. API Access & Authentication

### Getting Started

1. **Sign up:** Visit [console.x.ai](https://console.x.ai)
2. **Add billing:** Credit card required (pay-per-token)
3. **Create API key:** Settings > API Keys > Create API Key
4. **Key format:** Keys start with `xai-`

### Base URL

```
https://api.x.ai/v1
```

### Authentication

HTTP Bearer token in Authorization header:

```bash
curl https://api.x.ai/v1/chat/completions \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "grok-4.1-fast",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### API Key Permissions

By default, API keys have **no permissions**. You must explicitly grant:
- `api-key:endpoint:*` - Access to all endpoints
- `api-key:model:*` - Access to all models
- Or specific: `api-key:model:grok-4.1-fast`

---

## 2. SDK & Integration Options

### Option A: OpenAI SDK (Recommended - Simplest)

The xAI API is **fully OpenAI SDK compatible**. This is the easiest integration path.

```python
from openai import OpenAI

client = OpenAI(
    api_key="xai-your-api-key",
    base_url="https://api.x.ai/v1",
)

response = client.chat.completions.create(
    model="grok-4.1-fast",
    messages=[
        {"role": "system", "content": "You are a keyword classifier."},
        {"role": "user", "content": "Classify these keywords: ..."}
    ],
    response_format={
        "type": "json_schema",
        "json_schema": {
            "name": "classification",
            "strict": True,
            "schema": {
                "type": "object",
                "properties": {
                    "classifications": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "keyword": {"type": "string"},
                                "category": {"type": "string", "enum": ["PURE", "ADJACENT", "COMMERCIAL", "EXCLUDE"]},
                                "confidence": {"type": "number"}
                            },
                            "required": ["keyword", "category", "confidence"]
                        }
                    }
                },
                "required": ["classifications"]
            }
        }
    }
)

print(response.choices[0].message.content)
```

**TypeScript equivalent:**

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
    apiKey: process.env.XAI_API_KEY,
    baseURL: 'https://api.x.ai/v1',
});

const response = await client.chat.completions.create({
    model: 'grok-4.1-fast',
    messages: [
        { role: 'system', content: 'You are a keyword classifier.' },
        { role: 'user', content: 'Classify these keywords: ...' }
    ],
    response_format: {
        type: 'json_schema',
        json_schema: {
            name: 'classification',
            strict: true,
            schema: classificationSchema,
        }
    }
});
```

### Option B: Official xAI SDK

xAI has an official Python SDK built on gRPC (not REST).

```bash
pip install xai-sdk
```

```python
from xai_sdk import Client

client = Client(api_key="xai-your-api-key")

# Structured output with Pydantic
from pydantic import BaseModel

class KeywordClassification(BaseModel):
    keyword: str
    category: str
    confidence: float

class ClassificationResponse(BaseModel):
    classifications: list[KeywordClassification]

response = client.chat.create(
    model="grok-4.1-fast",
    messages=[{"role": "user", "content": "Classify: ..."}],
    response_model=ClassificationResponse,
)
```

**Requirements:** Python 3.10+

**Notes:**
- gRPC-based (different from REST API)
- Supports both sync and async clients
- Native Pydantic support for structured outputs
- Anthropic SDK compatibility is **deprecated** - migrate to xAI SDK

### Option C: Vercel AI SDK (JavaScript/TypeScript)

```typescript
import { generateObject } from 'ai';
import { createXai } from '@ai-sdk/xai';

const xai = createXai({
    apiKey: process.env.XAI_API_KEY,
});

const { object } = await generateObject({
    model: xai('grok-4.1-fast'),
    schema: z.object({
        classifications: z.array(z.object({
            keyword: z.string(),
            category: z.enum(['PURE', 'ADJACENT', 'COMMERCIAL', 'EXCLUDE']),
            confidence: z.number(),
        })),
    }),
    prompt: 'Classify these keywords: ...',
});
```

### Option D: LiteLLM (Multi-Provider)

```python
import litellm

response = litellm.completion(
    model="xai/grok-4.1-fast",
    messages=[{"role": "user", "content": "Classify: ..."}],
    response_format={"type": "json_object"},
)
```

---

## 3. Structured Output Support

### JSON Mode

Grok 4.1 models support structured JSON output via `response_format`:

```python
response_format = {
    "type": "json_schema",
    "json_schema": {
        "name": "classification_response",
        "strict": True,  # Enforces exact schema compliance
        "schema": {
            "type": "object",
            "properties": {
                "keyword": {"type": "string"},
                "category": {
                    "type": "string",
                    "enum": ["PURE", "ADJACENT", "COMMERCIAL", "EXCLUDE"]
                },
                "confidence": {"type": "number", "minimum": 0, "maximum": 1}
            },
            "required": ["keyword", "category", "confidence"],
            "additionalProperties": False
        }
    }
}
```

### Tool/Function Calling

Grok 4.1 Fast is **specifically optimized for tool calling**. Use tools for classification:

```python
tools = [{
    "type": "function",
    "function": {
        "name": "classify_keywords",
        "description": "Classify keywords into relevance categories",
        "parameters": {
            "type": "object",
            "properties": {
                "classifications": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "keyword": {"type": "string"},
                            "category": {"type": "string"},
                            "confidence": {"type": "number"}
                        }
                    }
                }
            },
            "required": ["classifications"]
        }
    }
}]

response = client.chat.completions.create(
    model="grok-4.1-fast",
    messages=[{"role": "user", "content": "Classify: ..."}],
    tools=tools,
    tool_choice={"type": "function", "function": {"name": "classify_keywords"}}
)
```

### Reasoning Mode

Grok 4.1 Fast has two modes:
- **Non-reasoning:** Instant replies, lower latency
- **Reasoning:** Multi-step reasoning for complex tasks

Enable reasoning via API parameter:

```python
response = client.chat.completions.create(
    model="grok-4.1-fast",
    messages=[...],
    reasoning_enabled=True,  # Enable extended reasoning
)
```

**Note:** Reasoning mode consumes additional tokens but improves accuracy for edge cases.

---

## 4. Model Variants Comparison

| Model | Input ($/1M) | Output ($/1M) | Context | Batch Discount | Best For |
|-------|--------------|---------------|---------|----------------|----------|
| **Grok 4.1 Fast** | $0.20 | $0.50 | 2M | 50% | Agentic tasks, tool calling, classification |
| Grok 4.1 | Higher | Higher | Standard | 50% | Creative, collaborative chat |
| Grok 4.20 | $3.00 | $15.00 | 2M | 50% | Premium reasoning, complex tasks |
| Grok 4 | $3.00 | $15.00 | 2M | 50% | General flagship model |

### Grok 4.1 Fast Highlights

- **Speed:** 133.4 tokens/sec (above average)
- **Time to First Token:** 0.56s (very competitive)
- **Intelligence Index:** 24 (above median of 15 for non-reasoning models)
- **Hallucination Rate:** 50% lower than Grok 4 Fast
- **Tool Calling:** State-of-the-art on agentic benchmarks

### Recommendation for Classification

**Use Grok 4.1 Fast for:**
- Pass 2 edge-case classification (confidence < 0.85)
- Complex keyword disambiguation
- When reasoning matters more than cost

**Do NOT use for:**
- Pass 1 bulk filtering (GPT-4.1-nano is 2x cheaper)
- Simple binary classification

---

## 5. Pricing Comparison Table

### vs Other Models (Per 1M Tokens)

| Model | Input | Output | Context | Batch? | Notes |
|-------|-------|--------|---------|--------|-------|
| **Grok 4.1 Fast** | $0.20 | $0.50 | 2M | 50% off | Tool-calling optimized |
| GPT-4.1-nano | $0.10 | $0.40 | 1M | 50% off | Classification optimized |
| Gemini 2.5 Flash-Lite | $0.10 | $0.40 | 1M | 50% off | Good multilingual |
| GPT-4o-mini | $0.15 | $0.60 | 128K | 50% off | Proven, reliable |
| Claude Haiku 4.5 | $1.00 | $5.00 | 200K | 50% off | Premium quality |
| Claude Sonnet 4.6 | $3.00 | $15.00 | 200K | 50% off | Our current baseline |
| Grok 4.20 | $3.00 | $15.00 | 2M | 50% off | Premium reasoning |

### Cost Per 500 Keywords (Classification Task)

| Model | Input (~150K) | Output (~50K) | Total | vs Sonnet |
|-------|---------------|---------------|-------|-----------|
| Grok 4.1 Fast | $0.030 | $0.025 | **$0.055** | -86% |
| GPT-4.1-nano | $0.015 | $0.020 | **$0.035** | -91% |
| Gemini 2.5 Flash-Lite | $0.015 | $0.020 | **$0.035** | -91% |
| Claude Haiku 4.5 | $0.150 | $0.250 | **$0.400** | -0% |
| Claude Sonnet 4.6 | $0.450 | $0.750 | **$1.200** | baseline |

**With Batch API (50% off):**

| Model | Batch Cost | vs Sonnet Real-time |
|-------|------------|---------------------|
| Grok 4.1 Fast | $0.0275 | -93% |
| GPT-4.1-nano | $0.0175 | -96% |

---

## 6. Rate Limits

Rate limits vary by model and are viewable in the [xAI Console](https://console.x.ai).

### General Guidelines

- **Error 429:** Rate limit exceeded
- **Batch API:** Separate rate limit pool (does not count against real-time limits)
- **Prompt Caching:** Reduces cost for repeated prompts (prefix matching)

### Batch API Details

- **Discount:** 50% off standard pricing
- **Max File Size:** 25MB per request
- **Turnaround:** Most complete within 24 hours
- **Use Cases:** Bulk translations, embeddings, classification pipelines

```python
# Batch API example
from openai import OpenAI

client = OpenAI(
    api_key="xai-your-api-key",
    base_url="https://api.x.ai/v1",
)

# 1. Create JSONL file
import json
requests = []
for i, keyword in enumerate(keywords):
    requests.append({
        "custom_id": f"kw-{i}",
        "method": "POST",
        "url": "/v1/chat/completions",
        "body": {
            "model": "grok-4.1-fast",
            "messages": [
                {"role": "user", "content": f"Classify keyword: {keyword}"}
            ],
            "response_format": {"type": "json_schema", "json_schema": schema}
        }
    })

jsonl_content = "\n".join(json.dumps(r) for r in requests)

# 2. Upload file
file = client.files.create(
    file=("batch.jsonl", jsonl_content),
    purpose="batch"
)

# 3. Create batch
batch = client.batches.create(
    input_file_id=file.id,
    endpoint="/v1/chat/completions",
    completion_window="24h"
)

# 4. Check status / retrieve results
status = client.batches.retrieve(batch.id)
if status.status == "completed":
    results = client.files.content(status.output_file_id)
```

---

## 7. Limitations & Caveats

### Known Limitations

1. **Knowledge Cutoff:** November 2024 (may not know about recent events)
2. **Lithuanian Language:** No specific quality data available - needs testing
3. **Anthropic SDK Compatibility:** Deprecated - use OpenAI SDK or native xAI SDK
4. **Model Deprecation:** Monitor release notes for EOL announcements

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Lithuanian quality issues | MEDIUM | HIGH | Test with 100-keyword sample |
| API availability | LOW | MEDIUM | Fallback to OpenAI/Anthropic |
| Pricing changes | MEDIUM | LOW | Budget 20% margin |
| Model deprecation | LOW | MEDIUM | Use model abstraction layer |

### Comparison vs Alternatives

**Grok 4.1 Fast vs GPT-4o-mini:**
- Grok: 2M context (better for batching), $0.20/$0.50
- GPT-4o-mini: 128K context, $0.15/$0.60
- Winner: Grok for large batches, GPT-4o-mini for proven reliability

**Grok 4.1 Fast vs Gemini 2.5 Flash:**
- Grok: Better tool calling, 2M context
- Gemini: Cheaper ($0.30/$2.50), good multilingual
- Winner: Grok for classification, Gemini for cost

**Grok 4.1 Fast vs Claude Haiku 4.5:**
- Grok: 5x cheaper ($0.20 vs $1.00 input)
- Haiku: Higher quality, proven
- Winner: Grok for budget, Haiku for quality

---

## 8. Integration Recommendation

### For Keyword Classification Pipeline

```
Pass 1 (Bulk Filter): GPT-4.1-nano @ $0.10/M
                      └─ Binary: INCLUDE/EXCLUDE
                      └─ Batch API (50% off)
                      └─ 24h turnaround OK

Pass 2 (Edge Cases): Grok 4.1 Fast @ $0.20/M  ← NEW OPTION
                     OR Claude Sonnet @ $3.00/M (existing)
                     └─ 4-tier classification
                     └─ Real-time (confidence < 0.85)
                     └─ Reasoning enabled
```

### Why Grok 4.1 Fast for Pass 2?

1. **10x cheaper than Claude Sonnet** ($0.20 vs $3.00 input)
2. **Tool-calling optimized** - designed for structured output
3. **2M context window** - can batch more edge cases
4. **OpenAI SDK compatible** - minimal integration effort
5. **Batch API available** - 50% additional savings for non-urgent

### Integration Effort

| Task | Effort | Notes |
|------|--------|-------|
| Add xAI provider config | 1 hour | Just change base_url |
| Update LiteLLM config | 30 min | Add `xai/grok-4.1-fast` |
| Test structured output | 2 hours | Verify JSON schema compliance |
| Test Lithuanian quality | 2 hours | 100-keyword sample |
| **Total** | **~5 hours** | |

---

## 9. Code Example: Full Integration

```typescript
// src/lib/ai/providers/xai.ts
import OpenAI from 'openai';
import { z } from 'zod';

const xaiClient = new OpenAI({
    apiKey: process.env.XAI_API_KEY,
    baseURL: 'https://api.x.ai/v1',
});

const ClassificationSchema = z.object({
    classifications: z.array(z.object({
        keyword: z.string(),
        category: z.enum(['PURE', 'ADJACENT', 'COMMERCIAL', 'EXCLUDE']),
        confidence: z.number().min(0).max(1),
        reasoning: z.string().optional(),
    })),
});

export async function classifyWithGrok(
    keywords: string[],
    context: { industry: string; vertical: string }
): Promise<z.infer<typeof ClassificationSchema>> {
    const response = await xaiClient.chat.completions.create({
        model: 'grok-4.1-fast',
        messages: [
            {
                role: 'system',
                content: `You are a keyword relevance classifier for ${context.industry} businesses in the ${context.vertical} vertical.`,
            },
            {
                role: 'user',
                content: `Classify these keywords:\n${keywords.join('\n')}`,
            },
        ],
        response_format: {
            type: 'json_schema',
            json_schema: {
                name: 'classification_response',
                strict: true,
                schema: {
                    type: 'object',
                    properties: {
                        classifications: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    keyword: { type: 'string' },
                                    category: {
                                        type: 'string',
                                        enum: ['PURE', 'ADJACENT', 'COMMERCIAL', 'EXCLUDE'],
                                    },
                                    confidence: { type: 'number' },
                                    reasoning: { type: 'string' },
                                },
                                required: ['keyword', 'category', 'confidence'],
                            },
                        },
                    },
                    required: ['classifications'],
                },
            },
        },
    });

    const content = response.choices[0].message.content;
    return ClassificationSchema.parse(JSON.parse(content!));
}
```

---

## 10. Sources

### Official Documentation
- [xAI API Overview](https://x.ai/api)
- [xAI Docs](https://docs.x.ai/overview)
- [Models and Pricing](https://docs.x.ai/developers/models)
- [Getting Started](https://docs.x.ai/developers/quickstart)
- [Structured Outputs](https://docs.x.ai/developers/model-capabilities/text/structured-outputs)
- [Batch API](https://docs.x.ai/developers/advanced-api-usage/batch-api)
- [Rate Limits](https://docs.x.ai/docs/key-information/consumption-and-rate-limits)

### SDKs
- [xai-sdk-python (Official)](https://github.com/xai-org/xai-sdk-python)
- [xai-sdk on PyPI](https://pypi.org/project/xai-sdk/)
- [Vercel AI SDK - xAI Provider](https://ai-sdk.dev/providers/ai-sdk-providers/xai)

### Third-Party Analysis
- [AI API Pricing Comparison 2026 - IntuitionLabs](https://intuitionlabs.ai/articles/ai-api-pricing-comparison-grok-gemini-openai-claude)
- [Grok 4.1 Fast Analysis - Artificial Analysis](https://artificialanalysis.ai/models/grok-4-1-fast)
- [Grok 4 vs Grok 4.1 Fast Comparison - pricepertoken.com](https://pricepertoken.com/compare/xai-grok-4-vs-xai-grok-4.1-fast)
- [Instructor xAI Integration](https://python.useinstructor.com/integrations/xai/)

---

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (pricing subject to change; verify before implementation)
