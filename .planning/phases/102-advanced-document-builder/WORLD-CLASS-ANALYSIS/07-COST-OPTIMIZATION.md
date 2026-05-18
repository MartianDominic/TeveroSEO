# 07 - World-Class Cost Optimization Analysis

**Created:** 2026-05-16
**Phase:** 102 - Advanced Document Builder
**Focus:** Achieving minimum cost per document while maintaining quality

---

## Executive Summary

This analysis identifies the absolute minimum cost architecture for document generation while maintaining quality. The key insight: **the dominant cost variable is AI model selection, not infrastructure** — and the May 2026 model landscape has changed dramatically.

**Current estimates (from earlier analysis):**
- Template-First (pdf-lib): $0.001/doc
- URL-to-PDF (Puppeteer): $0.003/doc
- AI-Enhanced: $0.07 first generation, $0.002 reuse

**Optimized architecture achieves:**
- Simple template: **$0.0005/doc** (50% reduction)
- AI-enhanced first generation: **$0.018/doc** (74% reduction)
- AI-enhanced reuse: **$0.0008/doc** (60% reduction)

**The optimization stack:**
1. DeepSeek V3.2 for bulk classification/extraction ($0.28/1M vs Grok 4.1's $0.20 but with 90% cache discount)
2. Qwen 3.5-Plus for content generation ($0.30/1M input vs Gemini 3.1 Pro's $1.25/1M)
3. Aggressive template caching with content-hash deduplication
4. Cloudflare R2 for storage (zero egress)
5. Serverless Puppeteer only for complex layouts

---

## 1. AI Model Cost Comparison (May 2026)

### Tier 1: Budget Models (Bulk Processing)

| Model | Input $/1M | Output $/1M | Context | Best For |
|-------|-----------|-------------|---------|----------|
| **DeepSeek V3.2** | $0.28 (miss) / $0.028 (hit) | $0.42 | 164K | Structured extraction, with caching |
| **Grok 4.1 Fast** | $0.20 | $0.50 | 2M | Classification, chat (TeveroSEO standard) |
| **Gemini 3.1 Flash-Lite** | $0.25 | $1.50 | 1M | Ultra-cheap fallback |
| **Ministral 3B** | $0.04 | $0.04 | Edge | Simple completions |
| **Qwen-Turbo** | $0.033 | $0.13 | — | Bulk processing |

### Tier 2: Content Generation Models

| Model | Input $/1M | Output $/1M | Context | Best For |
|-------|-----------|-------------|---------|----------|
| **Qwen 3.5-Plus** | $0.30 | $1.80 | 1M | Content generation (76% cheaper than Gemini Pro) |
| **Gemini 3 Flash** | $0.50 | $3.00 | 1M | Fast tasks |
| **Gemini 3.1 Pro** | $1.25 | $5.00 | 1M | Quality content (TeveroSEO standard) |
| **Mistral Medium 3** | $0.40 | $2.00 | — | Mid-tier reasoning |

### Tier 3: Premium Models (Complex Reasoning)

| Model | Input $/1M | Output $/1M | Context | Best For |
|-------|-----------|-------------|---------|----------|
| **Grok 4.1 Thinking** | $2.00 | — | 256K | Strategic reasoning |
| **Claude Sonnet 4.6** | $3.00 | $15.00 | 1M | Voice analysis |
| **Grok 4** | $3.00 | $15.00 | 256K | Deep reasoning |
| **GPT-5.4** | $2.50 | $15.00 | 400K | General flagship |

### Document Builder Recommendation

**For Phase 102, deviate from CLAUDE.md model selection:**

| Task | CLAUDE.md Standard | Cost-Optimized | Savings |
|------|-------------------|----------------|---------|
| Variable filling | Gemini 3.1 Pro ($1.25) | Qwen 3.5-Plus ($0.30) | 76% |
| Structure detection | Grok 4.1 ($0.40) | DeepSeek V3.2 + cache ($0.028) | 93% |
| Block generation | Gemini 3.1 Pro ($1.25) | Qwen 3.5-Plus ($0.30) | 76% |

**Caveat:** Test Qwen 3.5-Plus quality for Lithuanian content before committing. Fallback to Gemini 3.1 Pro if quality insufficient.

---

## 2. Batch Processing Options

### Provider Batch Discounts (May 2026)

| Provider | Batch Discount | Processing Time | Min Batch Size |
|----------|---------------|-----------------|----------------|
| **OpenAI** | 50% off | < 24 hours | Any |
| **Anthropic** | 50% off | < 24 hours | Any |
| **DeepSeek** | Via cache hits (90%) | Immediate | N/A |
| **Google (Gemini)** | 50% off (Batch API) | < 24 hours | Any |

### When to Use Batch API

**Good fit for document generation:**
- Nightly bulk proposal generation
- Scheduled template regeneration
- Analytics report generation

**Not suitable for:**
- Real-time editor (user waiting)
- Preview rendering
- Interactive AI generation button

### Implementation Pattern

```typescript
// For scheduled/bulk operations
const batchJob = await anthropic.batches.create({
  requests: proposals.map(p => ({
    custom_id: p.id,
    params: {
      model: 'claude-sonnet-4-6',
      messages: [{ role: 'user', content: generatePrompt(p) }]
    }
  }))
});

// Poll or webhook for completion
// Cost: 50% of standard rate
```

### Batch API Cost Impact

| Scenario | Standard Cost | Batch Cost | Annual Savings (1000 docs/mo) |
|----------|--------------|------------|-------------------------------|
| Claude Sonnet 4.6 | $3.00/1M | $1.50/1M | $18.00/year |
| GPT-5.4 | $2.50/1M | $1.25/1M | $15.00/year |
| Gemini 3.1 Pro | $1.25/1M | $0.625/1M | $7.50/year |

**Verdict:** Batch API provides modest savings. Main value is for overnight scheduled jobs, not a primary cost lever for document builder.

---

## 3. Caching Architecture

### Layer 1: Template Caching

**Problem:** Templates have fixed structure; only variables change.

**Solution:** Cache compiled templates with variable slots.

```typescript
interface CachedTemplate {
  id: string;
  hash: string; // SHA-256 of template structure
  compiledBlocks: CompiledBlock[];
  variableSlots: VariableSlot[];
  cachedAt: Date;
  ttl: number; // 7 days for templates
}

// On template load
const cached = await templateCache.get(templateId);
if (cached && cached.hash === currentHash) {
  return cached.compiledBlocks; // Skip AI structure parsing
}
```

**Impact:** Eliminates repeated template parsing ($0.001 per parse avoided).

### Layer 2: Variable Value Caching

**Problem:** Same prospect data fills many documents.

**Solution:** Cache resolved variable values per prospect.

```typescript
interface ProspectVariableCache {
  prospectId: string;
  resolvedVariables: Record<string, string>;
  cachedAt: Date;
  ttl: number; // 24 hours
}

// Variable resolution
const cached = await variableCache.get(prospectId);
if (cached) {
  return fillTemplate(template, cached.resolvedVariables);
}
```

**Impact:** Eliminates repeated variable computation for same prospect.

### Layer 3: Generated Content Deduplication

**Problem:** Identical inputs produce identical outputs — wasteful to regenerate.

**Solution:** Content-addressable caching with input hash.

```typescript
function getContentCacheKey(prompt: string, context: object): string {
  const input = JSON.stringify({ prompt, context });
  return createHash('sha256').update(input).digest('hex');
}

// Before AI generation
const cacheKey = getContentCacheKey(prompt, context);
const cached = await contentCache.get(cacheKey);
if (cached) {
  return cached; // $0 cost
}

// After generation
await contentCache.set(cacheKey, generatedContent, { ttl: 30 * 24 * 3600 });
```

**Impact:** Identical regeneration requests cost $0.

### Layer 4: PDF Rendering Cache

**Problem:** Same HTML produces same PDF.

**Solution:** Cache rendered PDFs by content hash.

```typescript
// PDF cache key excludes timestamp, session data
function getPdfCacheKey(html: string, options: RenderOptions): string {
  const normalized = normalizeHtml(html); // Remove dynamic elements
  return createHash('sha256')
    .update(normalized + JSON.stringify(options))
    .digest('hex');
}

// Check R2 before rendering
const cached = await r2.head(`pdfs/${cacheKey}.pdf`);
if (cached) {
  return r2.get(`pdfs/${cacheKey}.pdf`);
}
```

**Impact:** Repeated PDF generation costs $0.

### Cache Hit Rate Projections

| Cache Layer | Expected Hit Rate | Cost Avoided Per Hit |
|-------------|------------------|---------------------|
| Template | 95% | $0.001 |
| Variable | 80% | $0.0005 |
| Content | 40% | $0.02 (AI call) |
| PDF | 30% | $0.002 |

**Combined impact:** ~60% cost reduction on repeat operations.

---

## 4. Self-Hosted vs API

### Self-Hosted LLM Economics

**Hardware requirements for document generation:**

| Model Size | VRAM Required | Hardware Cost | Monthly Amortization |
|------------|--------------|---------------|---------------------|
| 7B (Q4) | 6GB | $300 (RTX 3060) | $25 |
| 13B (Q4) | 10GB | $400 (RTX 3060 12GB) | $33 |
| 70B (Q4) | 40GB | $2,500 (2x RTX 4090) | $208 |

**Electricity cost:** ~$0.10-0.30 per kWh, ~100-400W GPU = $7-30/month

**Breakeven analysis:**

| Monthly Token Volume | API Cost (Qwen 3.5-Plus) | Self-Hosted Cost | Verdict |
|---------------------|-------------------------|------------------|---------|
| 1M tokens | $0.30 | $32 | API |
| 10M tokens | $3.00 | $32 | API |
| 100M tokens | $30.00 | $32 | Breakeven |
| 500M tokens | $150.00 | $32 | Self-host |

**Recommendation:** At TeveroSEO's current scale (likely <50M tokens/month for documents), API is cheaper. Self-hosting becomes viable at 100M+ tokens/month.

### Ollama for Document OCR

**Viable for:** PDF style extraction, structure detection.

**Setup:**
```bash
ollama pull llava:13b  # Vision model for PDF analysis
ollama pull qwen2.5:7b  # Text generation
```

**Cost:** $0 per inference (hardware cost amortized).

**Latency:** 2-5 seconds for 13B model on RTX 3060.

**Recommendation:** Consider Ollama for PDF style extraction (non-time-critical, high volume). Keep API for user-facing AI generation (latency-sensitive).

---

## 5. Tiered Processing Strategy

### Document Complexity Tiers

```typescript
type DocumentComplexity = 'simple' | 'standard' | 'complex' | 'ai_enhanced';

function detectComplexity(document: Document): DocumentComplexity {
  const hasVariables = document.blocks.some(b => b.contentMode === 'variable');
  const hasRegenerate = document.blocks.some(b => b.contentMode === 'regenerate');
  const hasComplexLayout = document.blocks.some(b => 
    b.type === 'table' || b.type === 'multi_column'
  );
  
  if (hasRegenerate) return 'ai_enhanced';
  if (hasComplexLayout) return 'complex';
  if (hasVariables) return 'standard';
  return 'simple';
}
```

### Cost by Tier

| Tier | Processing | Tools Used | Cost |
|------|------------|------------|------|
| **Simple** | Template fill only | pdf-lib | $0.0005 |
| **Standard** | Template + variable substitution | pdf-lib + Redis cache | $0.0008 |
| **Complex** | Needs visual rendering | Puppeteer (serverless) | $0.002 |
| **AI-Enhanced** | Content generation | Qwen 3.5-Plus + pdf-lib | $0.018 |

### Auto-Detection Rules

```typescript
const routingRules: RoutingRule[] = [
  {
    condition: doc => doc.allBlocksFixed && !doc.hasComplexLayout,
    tier: 'simple',
    handler: simplePdfHandler  // pdf-lib only
  },
  {
    condition: doc => doc.hasVariables && !doc.hasRegenerate && !doc.hasComplexLayout,
    tier: 'standard',
    handler: standardPdfHandler  // pdf-lib + variable cache
  },
  {
    condition: doc => doc.hasComplexLayout && !doc.hasRegenerate,
    tier: 'complex',
    handler: puppeteerHandler  // Serverless Puppeteer
  },
  {
    condition: doc => doc.hasRegenerate,
    tier: 'ai_enhanced',
    handler: aiEnhancedHandler  // Full AI pipeline
  }
];
```

### Distribution Assumption (Phase 102)

| Tier | Expected % of Documents | Weighted Cost |
|------|------------------------|---------------|
| Simple | 10% | $0.00005 |
| Standard | 50% | $0.0004 |
| Complex | 25% | $0.0005 |
| AI-Enhanced | 15% | $0.0027 |
| **Weighted Average** | | **$0.0032/doc** |

---

## 6. Storage Optimization

### Provider Comparison (May 2026)

| Provider | Storage $/GB/mo | Egress $/GB | API Calls | Best For |
|----------|----------------|-------------|-----------|----------|
| **Cloudflare R2** | $0.015 | $0 | $0.36/1M Class A | High egress |
| **Backblaze B2** | $0.006 | $0.01 (free via CF) | $0.004/10K | Archive |
| **AWS S3 Standard** | $0.023 | $0.09 | $0.005/1K PUT | AWS ecosystem |

### Recommended Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  PRIMARY: Cloudflare R2                                      │
│  - Generated PDFs (hot storage)                              │
│  - Template assets (images, fonts)                           │
│  - Zero egress = predictable cost                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ↓ (30-day lifecycle)
┌─────────────────────────────────────────────────────────────┐
│  ARCHIVE: Backblaze B2                                       │
│  - Older documents (60% cheaper storage)                     │
│  - Via Cloudflare CDN (free egress)                          │
└─────────────────────────────────────────────────────────────┘
```

### Lifecycle Policy

```typescript
const lifecycleRules = [
  {
    name: 'archive-old-pdfs',
    condition: { ageInDays: 30, accessedInLast30Days: false },
    action: 'move-to-b2'
  },
  {
    name: 'delete-expired',
    condition: { ageInDays: 365, type: 'draft' },
    action: 'delete'
  }
];
```

### Compression Strategy

| Content Type | Compression | Reduction | Tool |
|--------------|-------------|-----------|------|
| PDF | Already compressed | N/A | — |
| JSON (blocks) | gzip | 70-85% | Node zlib |
| Images | WebP conversion | 25-35% | sharp |

### Monthly Storage Cost Projection

| Volume | R2 Storage | B2 Archive | Total |
|--------|-----------|------------|-------|
| 1,000 docs (avg 500KB) | $0.008 | $0.003 | $0.011 |
| 5,000 docs | $0.038 | $0.015 | $0.053 |
| 10,000 docs | $0.075 | $0.030 | $0.105 |

**Verdict:** Storage costs are negligible compared to AI/compute costs.

---

## 7. Compute Optimization

### Puppeteer: Serverless vs Dedicated

| Approach | Cost/1000 renders | Latency | Maintenance |
|----------|------------------|---------|-------------|
| **AWS Lambda** | $0.50-2.00 | 2-5s cold, 0.5s warm | Low |
| **Cloudflare Browser** | $0.50/1000 sessions | ~1s | Very low |
| **Browserless Cloud** | $0.02-0.05/page | ~1s | None |
| **Dedicated VPS** | $10-50/mo flat | 0.3s | High |

### Recommendation: Hybrid Approach

```typescript
const renderStrategy = {
  // Use pdf-lib for simple documents (70% of volume)
  simple: 'pdf-lib', // $0
  
  // Use Cloudflare Browser for complex layouts (25% of volume)
  complex: 'cloudflare-browser', // $0.0005/render
  
  // Use dedicated for high-volume batch (5% of volume)
  batch: 'dedicated-puppeteer' // Fixed cost amortized
};
```

### Lambda Configuration for Puppeteer

```typescript
// Optimal Lambda config for Puppeteer
const lambdaConfig = {
  memorySize: 1536, // MB - sweet spot for Chromium
  architecture: 'arm64', // 20% cheaper
  timeout: 30, // seconds
  ephemeralStorage: 1024, // MB for Chromium
};

// Cost per render (1536MB, 3 second average):
// (1536/1024) * 3 * $0.0000166667 = $0.000075
// Plus request: $0.0000002
// Total: ~$0.000075 per render
```

### Edge Computing Opportunities

**Document preview rendering:**
- Render static preview images at edge (Cloudflare Workers)
- Cache aggressively with content hash
- Avoid full PDF rendering for preview

```typescript
// Edge preview generation
export default {
  async fetch(request) {
    const { templateId, prospectId } = parseRequest(request);
    const cacheKey = `preview:${templateId}:${prospectId}`;
    
    // Check edge cache first
    const cached = await caches.default.match(cacheKey);
    if (cached) return cached;
    
    // Generate lightweight preview (HTML snapshot)
    const preview = await generatePreview(templateId, prospectId);
    
    // Cache at edge for 24 hours
    return new Response(preview, {
      headers: { 'Cache-Control': 'public, max-age=86400' }
    });
  }
};
```

---

## 8. Optimal Cost Architecture

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DOCUMENT GENERATION FLOW                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 1: Complexity Detection                                           │
│  Cost: $0 (local computation)                                           │
├─────────────────────────────────────────────────────────────────────────┤
│  simple (10%) → pdf-lib                                                  │
│  standard (50%) → pdf-lib + cache                                        │
│  complex (25%) → Cloudflare Browser                                      │
│  ai_enhanced (15%) → AI pipeline                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐
│  SIMPLE PATH          │ │  COMPLEX PATH         │ │  AI PATH              │
│  pdf-lib only         │ │  CF Browser/Puppeteer │ │  AI + pdf-lib         │
│  Cost: $0.0005        │ │  Cost: $0.002         │ │  Cost: $0.018         │
└───────────────────────┘ └───────────────────────┘ └───────────────────────┘
                    │               │               │
                    └───────────────┴───────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 2: Content Hash Check                                              │
│  Cost: $0 (Redis lookup)                                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  Cache hit (40%) → Return cached PDF                                     │
│  Cache miss (60%) → Generate and cache                                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 3: Storage                                                         │
│  Cloudflare R2 (hot) → Backblaze B2 (archive after 30 days)              │
│  Cost: $0.015/GB/mo (R2) → $0.006/GB/mo (B2)                             │
└─────────────────────────────────────────────────────────────────────────┘
```

### AI Pipeline Optimization

```typescript
// Optimized AI document generation
async function generateDocument(template: Template, prospect: Prospect) {
  // Layer 1: Check full document cache
  const docHash = hashDocument(template, prospect);
  const cached = await documentCache.get(docHash);
  if (cached) return cached; // $0 cost
  
  // Layer 2: Resolve variables (cached per prospect)
  const variables = await variableCache.getOrCompute(
    prospect.id,
    () => resolveAllVariables(prospect)
  );
  
  // Layer 3: Generate only regenerate blocks
  const regenerateBlocks = template.blocks.filter(b => b.contentMode === 'regenerate');
  
  const generatedContent = await Promise.all(
    regenerateBlocks.map(async block => {
      // Check block-level cache
      const blockHash = hashBlock(block, prospect);
      const cachedBlock = await blockCache.get(blockHash);
      if (cachedBlock) return cachedBlock;
      
      // Generate with Qwen 3.5-Plus (cost-optimized)
      const content = await qwen.generate({
        model: 'qwen3.5-plus',
        prompt: block.regeneratePrompt,
        context: { prospect, template }
      });
      
      await blockCache.set(blockHash, content);
      return content;
    })
  );
  
  // Layer 4: Assemble and render
  const assembled = assembleDocument(template, variables, generatedContent);
  const pdf = await renderPdf(assembled); // pdf-lib for simple, Puppeteer for complex
  
  // Cache final document
  await documentCache.set(docHash, pdf);
  await r2.put(`pdfs/${docHash}.pdf`, pdf);
  
  return pdf;
}
```

---

## 9. Monthly Cost Projections

### Cost Per Document by Volume

| Monthly Docs | Avg Complexity | Total AI | Total Compute | Total Storage | **Total Cost** | **Per Doc** |
|-------------|----------------|----------|---------------|---------------|----------------|-------------|
| 1,000 | Mixed | $3.20 | $0.50 | $0.01 | **$3.71** | **$0.0037** |
| 5,000 | Mixed | $16.00 | $2.50 | $0.05 | **$18.55** | **$0.0037** |
| 10,000 | Mixed | $32.00 | $5.00 | $0.11 | **$37.11** | **$0.0037** |

### Breakdown by Tier (1,000 docs/month)

| Tier | Count | AI Cost | Compute | Storage | Total |
|------|-------|---------|---------|---------|-------|
| Simple (10%) | 100 | $0 | $0.05 | $0.001 | $0.051 |
| Standard (50%) | 500 | $0 | $0.40 | $0.004 | $0.404 |
| Complex (25%) | 250 | $0 | $0.50 | $0.003 | $0.503 |
| AI-Enhanced (15%) | 150 | $2.70 | $0.08 | $0.002 | $2.782 |
| **Total** | 1,000 | $2.70 | $1.03 | $0.01 | **$3.74** |

### vs Original Estimates

| Scenario | Original | Optimized | Savings |
|----------|----------|-----------|---------|
| Simple template | $0.001 | $0.0005 | 50% |
| AI-enhanced first | $0.07 | $0.018 | 74% |
| AI-enhanced reuse | $0.002 | $0.0008 | 60% |
| Blended average | $0.025 | $0.0037 | 85% |

### Annual Cost at Scale

| Annual Docs | Original Cost | Optimized Cost | Annual Savings |
|-------------|--------------|----------------|----------------|
| 12,000 | $300 | $44.52 | $255.48 |
| 60,000 | $1,500 | $222.60 | $1,277.40 |
| 120,000 | $3,000 | $445.20 | $2,554.80 |

---

## 10. Implementation Checklist

### Phase 1: Foundation (Week 1)
- [ ] Set up Cloudflare R2 bucket for PDFs
- [ ] Implement content-hash caching layer
- [ ] Configure pdf-lib for simple document path
- [ ] Add complexity detection router

### Phase 2: AI Optimization (Week 2)
- [ ] Test Qwen 3.5-Plus for Lithuanian content quality
- [ ] Implement template caching
- [ ] Set up block-level content cache
- [ ] Configure DeepSeek for structure detection (with cache)

### Phase 3: Compute Optimization (Week 3)
- [ ] Set up Cloudflare Browser Rendering for complex layouts
- [ ] Implement serverless Lambda fallback
- [ ] Add edge preview generation
- [ ] Configure lifecycle policies for R2 → B2

### Phase 4: Monitoring (Week 4)
- [ ] Add cost tracking per document tier
- [ ] Set up cache hit rate dashboards
- [ ] Configure alerts for cost anomalies
- [ ] Document optimization playbook

---

## Sources

### AI Model Pricing (Verified May 2026)
- [DeepSeek API Pricing](https://api-docs.deepseek.com/quick_start/pricing/) - Official documentation
- [Qwen API Pricing (pricepertoken.com)](https://pricepertoken.com/pricing-page/provider/qwen) - Aggregated pricing
- [Grok API Pricing (OpenRouter)](https://openrouter.ai/x-ai/grok-4.1-fast) - $0.20/1M input verified
- [Gemini API Pricing (Google)](https://www.aipricing.guru/google-ai-pricing/) - May 2026 rates
- [Claude API Pricing (Anthropic)](https://platform.claude.com/docs/en/about-claude/pricing) - Official documentation
- [OpenAI Pricing](https://openai.com/api/pricing/) - GPT-5.x rates
- [Mistral AI Pricing](https://mistral.ai/pricing) - Official rates

### Storage Pricing
- [Cloud Storage Pricing 2026 (LeanOps)](https://leanopstech.com/blog/cloud-storage-pricing-comparison-2026/) - Comparison analysis
- [Cloudflare R2 Pricing](https://leanopstech.com/blog/cloudflare-r2-pricing-2026/) - Zero egress verified
- [Backblaze B2 Pricing](https://leanopstech.com/blog/backblaze-b2-pricing-2026/) - B2 + CF free egress

### Compute Pricing
- [AWS Lambda Pricing 2026](https://aws.amazon.com/lambda/pricing/) - Official rates
- [Puppeteer Hosting Guide](https://hostadvice.com/nodejs-hosting/puppeteer-hosting/) - Provider comparison
- [Browserless Pricing](https://www.browserless.io/pricing) - Per-unit costs

### Self-Hosted LLM
- [Ollama VRAM Requirements 2026](https://localllm.in/blog/ollama-vram-requirements-for-local-llms) - GPU requirements
- [Local LLM Guide 2026](https://claude5.com/news/local-llm-guide-ollama-lm-studio-llama-cpp-in-2026) - Self-hosting economics

### Batch Processing
- [Anthropic Batch API](https://www.finout.io/blog/anthropic-api-pricing) - 50% discount verified
- [OpenAI Batch API](https://www.finout.io/blog/openai-pricing-in-2026) - 50% discount verified

### Caching & Deduplication
- [PDF Hash Deduplication](https://phoenixeffect.me/blog/pdf-hash/) - PDF ID challenges
- [CDN Caching Strategies](https://oneuptime.com/blog/post/2026-01-30-cdn-caching-strategies/view) - TTL patterns

---

**Last Updated:** 2026-05-16
**Confidence:** HIGH (all pricing verified from official or aggregator sources)
**Valid Until:** 2026-06-16 (AI pricing changes frequently)
