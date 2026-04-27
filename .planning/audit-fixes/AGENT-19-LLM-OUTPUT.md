# Agent 19: LLM Output Validation

## Issues Fixed

- [x] CRITICAL: Created output validation utilities (Python)
- [x] CRITICAL: Created SafeAIOutput React component with DOMPurify
- [x] CRITICAL: Implemented PII detection and redaction
- [x] CRITICAL: Implemented credential detection and redaction
- [x] CRITICAL: Implemented harmful content blocking
- [x] CRITICAL: Implemented XSS pattern removal
- [x] CRITICAL: Ensured system prompts remain server-side only
- [x] Created client-side validation hook (useValidatedAIOutput)
- [x] Added comprehensive test coverage (35 tests)

## Files Created

### Python Backend (AI-Writer)

- `AI-Writer/backend/utils/output_validator.py` - Core validation utilities
  - `validate_llm_output()` - Main validation function
  - `validate_json_output()` - JSON extraction and validation
  - `sanitize_html_output()` - HTML sanitization
  - `OutputValidator` class - Reusable validator with configuration
  - `ContentRisk` enum - Risk level classification
  - `ValidationResult` dataclass - Structured validation results

- `AI-Writer/backend/utils/output_validator_test.py` - Test suite (35 tests)

### React Frontend (apps/web)

- `apps/web/src/components/ai/SafeAIOutput.tsx` - Safe rendering components
  - `SafeAIOutput` - Main component for AI content rendering
  - `SafeMarkdown` - Markdown-to-HTML with sanitization
  - `stripHtml()` - Utility to strip all HTML
  - `isContentSafe()` - Quick safety check

- `apps/web/src/components/ai/index.ts` - Barrel export

- `apps/web/src/hooks/useValidatedAIOutput.ts` - Client-side validation hook
  - `useValidatedAIOutput()` - React hook for content validation
  - `isAIOutputSafe()` - Synchronous safety check
  - `sanitizeAIOutput()` - Synchronous sanitization

## Protection Measures

### Server-Side (Python)

| Protection | Implementation |
|------------|----------------|
| PII Detection | Email, phone, SSN, credit card, IP address patterns |
| Credential Detection | API keys, tokens (OpenAI, GitHub, AWS, Google) |
| Harmful Content | Pattern matching with complete blocking |
| XSS Prevention | Script tags, event handlers, javascript: URLs, iframes |
| Length Limits | Configurable max_length with truncation |
| JSON Validation | Extraction, parsing, depth limits, required keys |

### Client-Side (React)

| Protection | Implementation |
|------------|----------------|
| HTML Sanitization | DOMPurify with allowlisted tags/attributes |
| XSS Prevention | Script/iframe/event handler removal |
| URL Validation | Only http/https/mailto/tel schemes allowed |
| Plain Text Mode | Default mode strips all HTML |
| Length Limits | Configurable truncation |
| Validation Hook | React hook for real-time validation |

## System Prompts Security

Verified that all system prompts remain server-side only:

- All `system_prompt` definitions are in Python backend files
- Settings page only references that brand voice is "injected into AI system prompts"
- No actual system prompt content is exposed to the client
- System prompts are used in:
  - `AI-Writer/backend/services/strategy_copilot_service.py`
  - `AI-Writer/backend/services/agent_framework.py`
  - `AI-Writer/backend/services/persona/facebook/facebook_persona_service.py`
  - `AI-Writer/backend/services/llm_providers/wavespeed_provider.py`

## Existing Sanitization (Already Present)

The codebase already had some defense-in-depth measures:

1. `apps/web/src/app/(shell)/clients/[clientId]/articles/new/page.tsx`
   - `sanitizeAiHtml()` function removes script/iframe/event handlers
   - Comment notes this is defense-in-depth as backend already sanitizes

2. `apps/web/src/app/(shell)/clients/[clientId]/articles/[articleId]/page.tsx`
   - Similar `sanitizeHtml()` function
   - Security comments document the approach

3. `apps/web/src/components/reports/ReportFooter.tsx`
   - Notes that branding.footerText is "pre-sanitized by the API layer"
   - References Plan 16-03 for DOMPurify sanitization before storage

## Usage Examples

### Python Backend

```python
from utils.output_validator import validate_llm_output, OutputValidator

# Simple validation
result = validate_llm_output(llm_response)
if result.is_safe():
    return result.content
else:
    log_warning(result.issues)
    return result.content  # Still usable for medium risk

# Reusable validator
validator = OutputValidator(
    strip_pii=True,
    strip_credentials=True,
    max_length=50000
)
result = validator.validate(llm_response)
```

### React Frontend

```tsx
import { SafeAIOutput, SafeMarkdown } from '@/components/ai';
import { useValidatedAIOutput } from '@/hooks/useValidatedAIOutput';

// Plain text (safest)
<SafeAIOutput content={aiResponse} />

// HTML with sanitization
<SafeAIOutput content={aiHtml} allowHtml />

// Markdown rendering
<SafeMarkdown content={aiMarkdown} />

// With validation hook
function AIDisplay({ response }) {
  const { content, isValid, warnings } = useValidatedAIOutput(response);
  return (
    <>
      {!isValid && <Alert>{warnings.join(', ')}</Alert>}
      <SafeAIOutput content={content} />
    </>
  );
}
```

## Dependencies Added

- `dompurify@^3.4.1` - HTML sanitization library
- `@types/dompurify@^3.2.0` - TypeScript definitions (stub - dompurify has its own types)

## Test Coverage

Python tests: 35 tests covering:
- Empty/clean content handling
- Length truncation
- PII detection (email, phone, SSN)
- Credential detection (API keys, tokens)
- Harmful content blocking
- XSS pattern removal
- JSON extraction and validation
- HTML sanitization
- Validator class configuration
- ValidationResult methods

## Risk Levels

| Level | Description | Action |
|-------|-------------|--------|
| NONE | Clean content | Use as-is |
| LOW | Minor issues (removed XSS patterns) | Safe to use |
| MEDIUM | PII detected (redacted) | Safe to use, monitor |
| HIGH | Credentials detected (redacted) | Review, rotate if real |
| BLOCKED | Harmful content | Content replaced with warning |
