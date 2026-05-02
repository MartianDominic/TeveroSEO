# Phase 63: Keyword Intelligence - Context

**Gathered:** 2026-05-02
**Status:** Ready for execution
**Mode:** Auto-generated from Phase 56 audit findings

<domain>
## Phase Boundary

Generate 100-200 ON-POINT keywords per prospect using Grok 4.1 classification cascade, autocomplete APIs, and adaptive intent detection. This replaces the current fixed pipeline with intelligent routing.

**Core Capabilities:**
- Multi-tier classification cascade: Grok 4.1 (Pass 1) → Claude Sonnet (Pass 2) → Human Review
- Negative association extraction (filter adjacent verticals)
- Business model detection (B2B/B2C/ecommerce routing)
- Human confirmation toggle for AI understanding verification
- Adaptive intent detection (quick_check vs full_analysis)

**Key Constraint:** Must use Grok 4.1 ($0.20/1M input) for Pass 1, NOT GPT-4.1-nano.

</domain>

<decisions>
## Implementation Decisions

### Model Selection
- **Pass 1:** Grok 4.1 via xAI (`https://api.x.ai/v1`, OpenAI SDK compatible)
- **Pass 1 Fallback:** Gemini 2.5 Flash Lite
- **Pass 2:** Claude Sonnet 4.6 for nuance classification

### Classification Thresholds
- High confidence include: ≥0.85 confidence → direct to output
- High confidence exclude: ≥0.85 confidence → mark excluded
- Uncertain: <0.85 → Pass 2 review

### Human-in-the-Loop
- Default mode: "confirm" (pause before expensive operations)
- Autonomous mode: proceed without confirmation
- Toggle persists in localStorage

</decisions>

<references>
## Reference Documents

- `56-AUDIT-SYNTHESIS.md` — Master audit synthesis with all gaps
- `56-AUDIT-MODEL-CASCADE.md` — Classification model research
- `56-AUDIT-PROSPECT-FLOW.md` — Current system rated 5/10 (fixed pipeline)
- `56-RESEARCH-GROK.md` — Grok 4.1 API research
- `56-CASCADE-ARCHITECTURE.md` — Multi-tier classification design

</references>

<success_criteria>
## Success Criteria

1. 100-200 classified keywords per prospect (not 1000s of irrelevant ones)
2. Pass 1 (Grok 4.1) filters 80% of keywords
3. Pass 2 (Claude Sonnet) handles remaining 20% uncertain
4. Adjacent verticals excluded via negative associations
5. Confirmation toggle works in both modes
6. Intent detection routes correctly (quick_check completes <30s)

</success_criteria>
