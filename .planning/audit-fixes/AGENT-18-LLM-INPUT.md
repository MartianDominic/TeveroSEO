# Agent 18: LLM Input Sanitization

## Summary

Implemented comprehensive LLM safety utilities to prevent prompt injection attacks, DoS via excessive input, and XSS in LLM output. Created both Python and TypeScript implementations with consistent APIs.

## Issues Fixed

- [x] CRITICAL: Created Python LLM safety utilities (`AI-Writer/backend/utils/llm_safety.py`)
- [x] CRITICAL: Created TypeScript LLM safety utilities (`open-seo-main/src/lib/llm/safety.ts`)
- [x] CRITICAL: Implemented injection pattern detection (35+ patterns)
- [x] CRITICAL: Added token limit enforcement per model
- [x] CRITICAL: Updated strategy_copilot_service.py to use safety utilities
- [x] CRITICAL: Updated gemini.ts (proposals) to use safety utilities

## Files Created

| File | Purpose |
|------|---------|
| `AI-Writer/backend/utils/llm_safety.py` | Python LLM safety utilities |
| `open-seo-main/src/lib/llm/safety.ts` | TypeScript LLM safety utilities |

## Files Modified

| File | Changes |
|------|---------|
| `AI-Writer/backend/services/strategy_copilot_service.py` | Added input sanitization to all prompt builders, output validation to all response parsers |
| `open-seo-main/src/server/lib/proposals/gemini.ts` | Added input sanitization for domain, company name, keywords, inclusions; output validation |

## Protection Measures Implemented

### 1. Injection Pattern Detection (35+ patterns)

Categories of detected patterns:
- **Instruction override**: "ignore previous instructions", "disregard all", "forget everything"
- **New instruction injection**: "new instructions:", "actual instructions:", "real instructions:"
- **Role manipulation**: "system:", "<|system|>", "[INST]", "###instruction"
- **Identity manipulation**: "you are now", "pretend you", "act as if", "roleplay as"
- **Jailbreak attempts**: "DAN mode", "developer mode", "sudo mode", "god mode"
- **Output manipulation**: "do not follow", "ignore safety", "ignore guidelines"

### 2. Input Length Limits

| Input Type | Limit |
|------------|-------|
| User input | 50,000 chars |
| System prompt | 10,000 chars |
| Context | 100,000 chars |
| Output | 200,000 chars |

### 3. Token Limit Enforcement Per Model

```python
MODEL_TOKEN_LIMITS = {
    "gemini-pro": 30000,
    "gemini-2.0-flash-lite": 30000,
    "gemini-2.5-flash": 100000,
    "gemini-2.5-pro": 100000,
    "gpt-4": 8000,
    "gpt-4-turbo": 128000,
    "gpt-4o": 128000,
    "claude-3-sonnet": 200000,
    "claude-3-opus": 200000,
    "claude-3-haiku": 200000,
}
```

### 4. Control Character Stripping

- ASCII control characters (except newline, tab, CR)
- Unicode control characters (zero-width spaces, etc.)
- Prevents terminal manipulation attacks

### 5. Clear Prompt Boundaries

```
System prompt here...

--- CONTEXT ---
Sanitized context here...

--- USER REQUEST ---
Sanitized user input here...
--- END REQUEST ---
```

### 6. Output Validation

- Script tag removal
- Event handler removal (onclick, onload, etc.)
- JavaScript URL removal
- CSS injection prevention
- HTML tag filtering (allowlist support)

## API Reference

### Python (`utils.llm_safety`)

```python
from utils.llm_safety import (
    sanitize_user_input,
    validate_output,
    build_safe_prompt,
    enforce_token_limit,
    check_prompt_safety,
    sanitize_for_logging,
)

# Sanitize user input
result = sanitize_user_input(user_input, check_injection=True)
if result.blocked:
    raise SecurityError(result.block_reason)
if result.injection_detected:
    log.warning(f"Injection detected: {result.matched_patterns}")

# Build safe prompt
prompt = build_safe_prompt(
    system_prompt="You are a helpful assistant.",
    user_input=user_question,
    context=additional_context
)

# Validate LLM output
output_result = validate_output(llm_response, allowed_tags=['p', 'b', 'i'])

# Enforce token limits
safe_prompt = enforce_token_limit(prompt, max_tokens=8000, model="gpt-4")
```

### TypeScript (`@/lib/llm/safety`)

```typescript
import {
  sanitizeUserInput,
  validateOutput,
  buildSafePrompt,
  enforceTokenLimit,
  checkPromptSafety,
  sanitizeForLogging,
} from '@/lib/llm/safety';

// Sanitize user input
const result = sanitizeUserInput(userInput, { checkInjection: true });
if (result.blocked) {
  throw new Error(result.blockReason);
}

// Build safe prompt
const prompt = buildSafePrompt(systemPrompt, userInput, context);

// Validate output
const validated = validateOutput(llmResponse, { allowedTags: ['p', 'b', 'i'] });
```

## Usage Guidelines

### When to Use

1. **ALWAYS** sanitize user-provided text before including in prompts
2. **ALWAYS** validate LLM output before rendering in web contexts
3. **ALWAYS** enforce token limits before sending to LLM APIs
4. **ALWAYS** use clear delimiters between system and user content

### Example: Safe Prompt Building

```python
# BEFORE (vulnerable)
prompt = f"Write an article about {user_topic} in the style of {user_style}"

# AFTER (safe)
from utils.llm_safety import sanitize_user_input, build_safe_prompt

topic_result = sanitize_user_input(user_topic)
style_result = sanitize_user_input(user_style)

if topic_result.injection_detected or style_result.injection_detected:
    logger.warning("Potential injection attempt detected")

prompt = build_safe_prompt(
    system_prompt="You are a helpful writing assistant.",
    user_input=f"Write an article about {topic_result.text} in the style of {style_result.text}"
)
```

## Remaining Work

The following files also build prompts and should be updated in future iterations:

1. `AI-Writer/backend/services/ai_quality_analysis_service.py` - Multiple prompt builders
2. `AI-Writer/backend/services/persona_replication_engine.py` - Persona generation prompts
3. `AI-Writer/backend/services/content_gap_analyzer/competitor_analyzer.py` - Competitor analysis prompts
4. `AI-Writer/backend/services/intelligence/agents/trend_surfer_agent.py` - Trend analysis prompts
5. `open-seo-main/src/server/features/keywords/services/ResilientClassifier.ts` - Keyword classification

These files use internal data that is less likely to contain injection attacks, but should still be hardened for defense in depth.

## Testing Recommendations

1. Test with known injection patterns to verify detection
2. Test with extremely long inputs to verify truncation
3. Test with control characters to verify stripping
4. Test output validation with malicious HTML/JS
5. Verify token limit enforcement with various models

## Security Checklist

- [x] Injection pattern detection implemented
- [x] Input length limits enforced
- [x] Control character stripping enabled
- [x] Clear prompt boundaries used
- [x] Output validation for XSS prevention
- [x] Token limit enforcement per model
- [x] Logging for security events (sanitized)
- [ ] Rate limiting (handled separately)
- [ ] Input blocklist for severe violations (optional)
