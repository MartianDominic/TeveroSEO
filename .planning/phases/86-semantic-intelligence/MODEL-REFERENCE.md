# LLM Model Reference (May 2026)

> **Authoritative reference for all LLM model usage in TeveroSEO.**  
> **Last Updated**: 2026-05-05

---

## Core Models (USE THESE)

### 1. Grok 4.1 (xAI) — Primary Analysis Engine

| Variant | Model ID | Use For | Cost |
|---------|----------|---------|------|
| **Grok 4.1 Fast** | `grok-4.1-fast` | Bulk classification, structured extraction, cheap batch tasks | $0.20/1M input |
| **Grok 4.1** | `grok-4.1` | Moderate reasoning, funnel classification | $0.40/1M input |
| **Grok 4.1 Thinking** | `grok-4.1-thinking` | Complex reasoning, strategic analysis, proposal narratives | $2.00/1M input |

**Why Grok 4.1:**
- Cheapest high-quality structured output
- Excellent for classification tasks
- Native JSON mode support
- Large context window (128K+)

### 2. Gemini 3.1 (Google) — Primary Writing Engine

| Variant | Model ID | Use For | Cost |
|---------|----------|---------|------|
| **Gemini 3.1 Pro** | `gemini-3.1-pro` | Article generation, voice analysis, quality content | $1.25/1M input, $5.00/1M output |
| **Gemini 3.1 Flash** | `gemini-3.1-flash` | Fast tasks, audio transcription, cheap generation | $0.075/1M input |
| **Gemini 3.1 Flash Lite** | `gemini-3.1-flash-lite` | Ultra-cheap fallback, simple tasks | $0.02/1M input |

**Why Gemini 3.1 Pro:**
- Best content quality for articles
- Excellent Lithuanian language support
- Native grounding with Google Search
- 1M+ context window

### 3. Gemini 3.1 Image — Image Generation

| Model ID | Use For | Cost |
|----------|---------|------|
| **gemini-3.1-flash-image-preview** | All image generation | ~$0.02/image |

**Why Gemini 3.1 Image:**
- Replaces Imagen 4.x (deprecated)
- Faster generation
- Better quality/cost ratio

### 4. Claude Sonnet 4.6 (Anthropic) — Voice Analysis Only

| Model ID | Use For | Cost |
|----------|---------|------|
| **claude-sonnet-4-6** | Voice extraction, tone analysis (12 dimensions) | $3.00/1M input |

**Why Claude for Voice:**
- Best nuanced tone understanding
- Superior at capturing brand voice subtleties
- Consider testing Gemini 3.1 Pro as replacement

### 5. Kimi 2.6 (Moonshot AI) — Alternative/Backup

| Model ID | Use For | Cost |
|----------|---------|------|
| **kimi-2.6** | Alternative to Claude for complex reasoning | Competitive |

**Why Kimi 2.6:**
- Comparable to Claude Opus in benchmarks
- Alternative provider for redundancy
- Good for long-context tasks (200K+ window)

---

## Model Selection Matrix

| Task Type | Primary Model | Fallback | Batch Size |
|-----------|---------------|----------|------------|
| Keyword classification (bulk) | grok-4.1-fast | gemini-3.1-flash-lite | 200 |
| Funnel classification | grok-4.1 | grok-4.1-fast | 250 |
| Quality refinement (uncertain) | grok-4.1-thinking | - | 20 |
| Article generation | gemini-3.1-pro | - | 1 |
| Voice extraction | claude-sonnet-4-6 (or gemini-3.1-pro) | - | 1 |
| Voice compliance | gemini-3.1-pro | - | 1 |
| Translation (Lithuanian) | gemini-3.1-pro | - | 50 |
| Proposal narrative | grok-4.1-thinking | - | 1 |
| Structured extraction | grok-4.1-fast | - | 100+ |
| Image generation | gemini-3.1-flash-image-preview | - | 1 |
| Audio transcription | gemini-3.1-flash | - | 1 |
| CopilotKit chat | grok-4.1-fast | - | 1 |

---

## OUTDATED Models (DO NOT USE)

### Claude (Anthropic)
| Outdated | Replace With |
|----------|--------------|
| `claude-3-5-sonnet-20241022` | `claude-sonnet-4-6` |
| `claude-3-5-sonnet-*` | `claude-sonnet-4-6` |
| `claude-3-sonnet-*` | `claude-sonnet-4-6` |
| `claude-3-opus-*` | `claude-opus-4-6` (or grok-4.1-thinking) |
| `claude-3-haiku-*` | `grok-4.1-fast` |
| `claude-sonnet-4-20250514` | `claude-sonnet-4-6` |

### Gemini (Google)
| Outdated | Replace With |
|----------|--------------|
| `gemini-pro` | `gemini-3.1-pro` |
| `gemini-1.5-pro` | `gemini-3.1-pro` |
| `gemini-1.5-flash` | `gemini-3.1-flash` |
| `gemini-2.0-flash-001` | `gemini-3.1-flash` |
| `gemini-2.0-flash-lite` | `gemini-3.1-flash-lite` |
| `gemini-2.5-pro` | `gemini-3.1-pro` |
| `gemini-2.5-flash` | `gemini-3.1-flash` |
| `gemini-2.5-flash-lite` | `gemini-3.1-flash-lite` |

### Grok (xAI)
| Outdated | Replace With |
|----------|--------------|
| `grok-2-mini` | `grok-4.1-fast` |
| `grok-2` | `grok-4.1` |

### OpenAI
| Outdated | Replace With |
|----------|--------------|
| `gpt-4-vision-preview` | `grok-4.1` (or gemini-3.1-pro) |
| `gpt-4o-mini` | `grok-4.1-fast` |
| `gpt-4o` | `grok-4.1` |
| `gpt-4-turbo` | `grok-4.1` |
| `gpt-4` | `grok-4.1` |

### Imagen (Google)
| Outdated | Replace With |
|----------|--------------|
| `imagen-3.0-*` | `gemini-3.1-flash-image-preview` |
| `imagen-4.0-*` | `gemini-3.1-flash-image-preview` |

---

## Files Requiring Updates

### Priority 1: Core Services (CRITICAL)

| File | Current Model | Change To |
|------|---------------|-----------|
| `open-seo-main/.../VoiceAnalyzer.ts:16` | `claude-3-5-sonnet-20241022` | `claude-sonnet-4-6` |
| `open-seo-main/.../VoiceComplianceService.ts:27` | `claude-3-5-sonnet-20241022` | `claude-sonnet-4-6` |
| `open-seo-main/.../VoiceAnalysisService.ts:198` | `claude-3-5-sonnet-20241022` | `claude-sonnet-4-6` |
| `open-seo-main/.../TranslationService.ts:35` | `gemini-1.5-pro` | `gemini-3.1-pro` |
| `open-seo-main/.../gemini.ts:529` | `gemini-1.5-pro` | `gemini-3.1-pro` |
| `open-seo-main/.../model-router.ts:57` | `grok-2-mini` | `grok-4.1-fast` |
| `open-seo-main/.../provider-config.ts:49` | `grok-2-mini` | `grok-4.1-fast` |
| `open-seo-main/.../ResilientClassifier.ts:334` | `gpt-4o-mini` | `grok-4.1-fast` |

### Priority 2: AI-Writer Services

| File | Current Model | Change To |
|------|---------------|-----------|
| `AI-Writer/.../main_text_generation.py:76` | `gemini-2.0-flash-001` | `gemini-3.1-flash` |
| `AI-Writer/.../client_context.py:21` | `gemini-2.5-pro` | `gemini-3.1-pro` |
| `AI-Writer/.../hallucination_detector.py:215` | `gemini-1.5-flash` | `gemini-3.1-flash` |
| `AI-Writer/.../gemini_audio_text.py:134` | `gemini-1.5-flash` | `gemini-3.1-flash` |
| `AI-Writer/.../user_workspace_manager.py:287` | `gemini-pro` | `gemini-3.1-pro` |
| `AI-Writer/.../progressive_setup_service.py:103` | `gemini-pro` | `gemini-3.1-pro` |

### Priority 3: UI Model Selection

| File | Current Models | Change To |
|------|----------------|-----------|
| `apps/web/.../settings/page.tsx:57-68` | gemini-2.x, imagen-4.x | gemini-3.1-x, gemini-3.1-flash-image |
| `apps/web/.../ImageGenerationPanel.tsx:32-34` | imagen-4.x | gemini-3.1-flash-image-preview |

### Priority 4: Config & Safety

| File | Action |
|------|--------|
| `open-seo-main/src/lib/llm/safety.ts:20-29` | Update token limits for new models |
| `AI-Writer/backend/utils/llm_safety.py:47-56` | Update token limits for new models |
| `AI-Writer/.../pricing_service.py` | Update pricing for new model IDs |

---

## Environment Variables

```bash
# Primary Models (REQUIRED)
XAI_API_KEY=           # Grok 4.1 access
GOOGLE_AI_API_KEY=     # Gemini 3.1 access

# Voice Analysis (if using Claude)
ANTHROPIC_API_KEY=     # Claude Sonnet 4.6

# Optional / Backup
MOONSHOT_API_KEY=      # Kimi 2.6 (if needed)

# Model Overrides (optional)
VOICE_ANALYZER_MODEL=claude-sonnet-4-6
CONTENT_GENERATION_MODEL=gemini-3.1-pro
CLASSIFICATION_MODEL=grok-4.1-fast
IMAGE_MODEL=gemini-3.1-flash-image-preview
```

---

## Cost Estimates (Per 1000 Operations)

| Operation | Model | Input Tokens | Output Tokens | Cost |
|-----------|-------|--------------|---------------|------|
| Classify 1000 keywords | grok-4.1-fast | 15K | 50K | $0.028 |
| Generate 10 articles | gemini-3.1-pro | 20K | 80K | $0.425 |
| Voice analysis (10 pages) | claude-sonnet-4-6 | 30K | 20K | $0.150 |
| Translate 100 strings | gemini-3.1-pro | 5K | 5K | $0.031 |
| Generate 20 images | gemini-3.1-flash-image | - | - | $0.400 |

---

## Migration Checklist

- [ ] Update VoiceAnalyzer.ts to claude-sonnet-4-6
- [ ] Update VoiceComplianceService.ts to claude-sonnet-4-6
- [ ] Update VoiceAnalysisService.ts to claude-sonnet-4-6
- [ ] Update TranslationService.ts to gemini-3.1-pro
- [ ] Update gemini.ts to gemini-3.1-pro
- [ ] Update model-router.ts to grok-4.1-fast
- [ ] Update provider-config.ts to grok-4.1-fast
- [ ] Update ResilientClassifier.ts to grok-4.1-fast
- [ ] Update AI-Writer text generation to gemini-3.1-flash
- [ ] Update AI-Writer client context to gemini-3.1-pro
- [ ] Update UI model selection dropdowns
- [ ] Update image generation to gemini-3.1-flash-image-preview
- [ ] Update pricing service with new model costs
- [ ] Test all updated services
