# Prospect Input Flow Audit

## End-to-End Flow Diagram

```
[User Input]                    [Step 1: UI Modal]                [Step 2: Server Action]
     |                               |                                  |
     v                               v                                  v
AddProspectModal.tsx:72-139    extractFromConversation         postOpenSeo("/api/prospects/extract")
  - 3 input modes:               Action.ts:483-518                     |
    website, website_with_context, conversation                        v
  - Validates domain/content     [Step 3: Backend Extraction]
  - Triggers handleAnalyze()     ConversationExtractor.ts:79-186
                                   - Claude API call (claude-sonnet-4)
                                   - Fixed prompt EXTRACTION_PROMPT:47-74
                                   - Returns: businessName, industry, services,
                                     targetAudience, keywords, location, confidence
                                        |
                                        v
                              [Step 4: Platform Detection]
                              ConversationExtractor.ts:162-175
                                   - detectPlatform() for website modes
                                   - Non-blocking, optional enrichment
                                        |
                                        v
                              [Step 5: User Confirmation]
                              ExtractionConfirmation component
                                   - User reviews/edits extracted data
                                   - Can trigger re-analysis with corrections
                                        |
                                        v
                              [Step 6: Prospect Creation]
                              confirmAndCreateProspectAction:545-575
                              postOpenSeo("/api/prospects/confirm")
                                        |
                                        v
                              [Step 7: Analysis Trigger]
                              triggerAnalysisAction:318-363
                                   - analysisType: quick_scan | deep_dive | opportunity_discovery
                                   - targetRegion, targetLanguage
                                        |
                                        v
                              [Step 8: DataForSEO Analysis]
                              ProspectAnalysisService.ts
                                   - discoverCompetitors()
                                   - analyzeKeywordGaps()
                                        |
                                        v
                              [Step 9: Keyword Storage]
                              KeywordInputService.ts:76-128
                                   - 6 entry points mapped to sources
                                   - Normalize, deduplicate, optionally enrich
```

## Intelligence Assessment

### What Decisions Are Made Dynamically?

1. **Input Mode Selection** (User-driven)
   - `AddProspectModal.tsx:214-237` - User picks website/website_with_context/conversation
   - This affects what data is sent to extraction

2. **Confidence Scoring** (AI-driven)
   - `ConversationExtractor.ts:65-66` - Claude assigns 0-100 confidence
   - `"Confidence score: 90+ = very clear info, 70-89 = most info present..."`

3. **Platform Detection** (Conditional)
   - `ConversationExtractor.ts:162-165`
   ```typescript
   if (input.domain && (input.inputMode === "website" || input.inputMode === "website_with_context")) {
     result.platform = await detectPlatform(`https://${input.domain}`);
   }
   ```

4. **Auto-Qualification** (Score-based)
   - `PipelineService.ts:157-167`
   ```typescript
   if (priorityScore !== null && priorityScore >= 70) {
     await this.transitionStage(prospectId, "qualified", "auto_qualify_high_score");
   }
   ```

5. **Keyword Enrichment** (Optional flag)
   - `KeywordInputService.ts:116-125`
   ```typescript
   if (input.autoEnrich === true) {
     // Enrich via DataForSEO
   }
   ```

### What's Hardcoded/Fixed?

| Fixed Behavior | Location | Assessment |
|----------------|----------|------------|
| Extraction prompt | `ConversationExtractor.ts:47-74` | LIMITING - Same prompt for all industries/contexts |
| Claude model | `ConversationExtractor.ts:19` `claude-sonnet-4` | APPROPRIATE - Good model choice |
| Keyword count | Prompt says "5-10 keywords" | LIMITING - Should adapt to business complexity |
| Analysis types | 3 fixed types only | LIMITING - No adaptive depth selection |
| Stage transitions | `PipelineService.ts:22-30` | APPROPRIATE - Valid workflow states |
| Region default | `actions.ts:349` US/en defaults | APPROPRIATE - With override option |

## Comparison to "Claude Code" Pattern

### Claude Code Pattern Characteristics:
1. **Sees user intent** - Understands what user is trying to accomplish
2. **Selects appropriate tools** - Chooses from available capabilities
3. **Adapts depth based on need** - Simple tasks get simple handling, complex get deep analysis

### Does This System Match?

| Characteristic | Evidence | Verdict |
|----------------|----------|---------|
| Sees user intent | **Partial** - 3 input modes, but no adaptive interpretation | 5/10 |
| Selects appropriate tools | **No** - Fixed pipeline regardless of input | 2/10 |
| Adapts depth | **Minimal** - 3 analysis types, but user must choose | 3/10 |

**Key Gap:** The extraction prompt is identical regardless of:
- Industry (plumber vs SaaS vs ecommerce)
- Input richness (500 chars vs 10,000 chars of context)
- User's stated goals (lead gen vs competitive analysis vs content gap)

**Evidence of Fixed Pipeline:**
```typescript
// ConversationExtractor.ts:47-74 - SAME PROMPT ALWAYS
const EXTRACTION_PROMPT = `You are an expert business analyst...`

// No branching based on:
// - Industry detected
// - Input length/complexity
// - User's downstream goals
```

## Human-in-the-Loop Points

### Where User CAN Intervene:

| Point | Location | Intervention |
|-------|----------|--------------|
| Input mode selection | `AddProspectModal.tsx:214-237` | Choose website/context/conversation |
| Review extraction | `ExtractionConfirmation` component | Edit extracted fields |
| Re-analyze with corrections | `AddProspectModal.tsx:169-176` | Feed corrections back |
| Analysis type selection | `triggerAnalysisAction` options | quick_scan/deep_dive/opportunity |
| Region/language | `triggerAnalysisAction` options | Override defaults |

### Where User SHOULD Be Able To But Cannot:

1. **Keyword Priority Input** - No way to say "focus on commercial keywords" or "we care most about X service"
2. **Competitor Hints** - Can't suggest known competitors before analysis
3. **Industry Selection** - System guesses, user can't override to improve extraction
4. **Depth Control Pre-Extraction** - Can't say "this is a complex business, go deeper"
5. **Goal Specification** - Can't indicate if this is for lead gen, content planning, or competitive intel

## World-Class Rating

### Rating: 5/10

**What's Good (gets it to 5):**
- Clean 3-mode input (website/context/conversation)
- Human review step before committing
- Re-analyze with corrections capability
- Platform detection enrichment
- Confidence scoring from AI

**What's Missing (prevents 10):**

| Gap | Impact | World-Class Solution |
|-----|--------|---------------------|
| No adaptive prompting | Same extraction for plumber vs SaaS | Industry-aware prompt templates |
| No goal-driven analysis | Can't tell system what user wants | Intent classification first |
| No iterative refinement | One-shot extraction | Multi-turn extraction dialog |
| Fixed keyword count | "5-10 keywords" regardless | Adaptive based on business complexity |
| No competitor hints | Discovers blindly | Allow user to seed competitors |
| No priority signals | All keywords equal | Let user weight service importance |
| No context carryover | Each prospect fresh | Learn from user's previous prospects |

### What Would Make It 10/10:

1. **Intent Classification Layer** - Before extraction, classify what user wants to achieve
2. **Industry-Adaptive Prompts** - Different extraction for different business types
3. **Iterative Extraction** - Multi-turn refinement with clarifying questions
4. **Priority Weighting UI** - Let user rank which services/products matter most
5. **Competitor Seeding** - Accept known competitors to improve gap analysis
6. **Cross-Prospect Learning** - Use patterns from user's previous prospects
7. **Goal-Driven Pipeline Selection** - Auto-select analysis depth based on stated goals

## Summary

This system is a **FIXED PIPELINE** with human review gates, not an **INTELLIGENT AGENT** like Claude Code. The AI is used for extraction but doesn't adapt its approach based on context. Every prospect goes through the same steps regardless of:
- Business complexity
- User's goals
- Available context richness
- Industry vertical

The human-in-the-loop design is solid (review, edit, re-analyze), but the system doesn't learn or adapt its behavior based on user feedback or prospect characteristics.
