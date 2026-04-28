---
phase: 37
plan: 04
subsystem: voice-compliance
tags: [voice, compliance, scoring, ai-writer, tdd]
dependency_graph:
  requires: [37-01-voice-schema, 37-02-voice-analyzer, 37-03-voice-profile]
  provides: [voice-compliance-service, voice-constraint-builder, brief-voice-integration]
  affects: [briefs, ai-writer, content-generation]
tech_stack:
  added: []
  patterns: [5-dimension-scoring, mode-specific-constraints, voice-blending]
key_files:
  created:
    - src/server/features/voice/services/VoiceComplianceService.ts
    - src/server/features/voice/services/VoiceComplianceService.test.ts
    - src/server/features/voice/services/VoiceConstraintBuilder.ts
    - src/server/features/voice/services/VoiceConstraintBuilder.test.ts
  modified:
    - src/server/features/briefs/services/BriefGenerator.ts
    - src/serverFunctions/voice.ts
    - src/server/features/voice/index.ts
decisions:
  - 5 compliance dimensions with configurable weights (tone 25%, vocab 20%, structure 15%, personality 25%, rules 15%)
  - Fallback scoring (70) when AI unavailable
  - Escape special characters in prompts for T-37-09 injection prevention
  - T-37-10 access control on scoreComplianceFn
metrics:
  duration_minutes: 10
  completed_at: 2026-04-23T15:57:00Z
---

# Phase 37 Plan 04: Compliance Scoring + AI-Writer Integration Summary

Voice compliance scoring across 5 dimensions with AI-Writer integration for voice-constrained content generation.

## One-Liner

VoiceComplianceService with 5-dimension scoring (tone, vocabulary, structure, personality, rules) and VoiceConstraintBuilder for mode-specific prompt injection, integrated with BriefGenerator.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | VoiceComplianceService with TDD | 6d1eca1 | VoiceComplianceService.ts, .test.ts |
| 2 | VoiceConstraintBuilder with TDD | 2e156e0 | VoiceConstraintBuilder.ts, .test.ts |
| 3 | BriefGenerator integration | 659f27b | BriefGenerator.ts, voice.ts, index.ts |

## Implementation Details

### VoiceComplianceService

**5-Dimension Scoring:**

| Dimension | Weight | Method |
|-----------|--------|--------|
| tone_match | 25% | AI-assessed tone alignment |
| vocabulary_match | 20% | Forbidden/preferred word detection |
| structure_match | 15% | Sentence/paragraph length analysis |
| personality_match | 25% | AI-assessed personality alignment |
| rule_compliance | 15% | Protection rules compliance |

**ComplianceScore interface:**
- `tone_match`, `vocabulary_match`, `structure_match`, `personality_match`, `rule_compliance`: 0-100 scores
- `overall`: Weighted average of all dimensions
- `violations`: Array of ComplianceViolation with line numbers and suggestions
- `passed`: Boolean (overall >= 75)

**ComplianceViolation interface:**
- `dimension`: tone | vocabulary | structure | personality | rules
- `severity`: high | medium | low
- `line_number`: 1-indexed line number (optional)
- `text`: Offending text
- `suggestion`: How to fix

### VoiceConstraintBuilder

**Three modes:**

| Mode | Description | Output |
|------|-------------|--------|
| preservation | Protect branded content | DO NOT MODIFY instructions |
| application | Full voice constraints | 12-dimension profile injection |
| best_practices | Generic SEO guidelines | Minimal scannable constraints |

**Voice blending:**
- `templateBlend` parameter (0.0 = pure client, 1.0 = pure template)
- Numeric values interpolated by weight
- Categorical values use threshold (< 0.5 = profile, >= 0.5 = template)
- Arrays merged with template items weighted by blend ratio

### BriefGenerator Integration

**Extended input:**
- `clientId`: Client ID for voice profile lookup
- `templateBlend`: Blend ratio with template
- `templateId`: Template ID for blending

**Extended output:**
- `voiceConstraints`: Formatted prompt section for AI injection

**New helper:**
- `scoreContentCompliance(content, clientId)`: Score content against client's voice profile

### Server Functions Added

| Function | Method | Purpose |
|----------|--------|---------|
| scoreComplianceFn | POST | Score content against profile (T-37-10 access control) |
| buildVoiceConstraintsFn | POST | Build voice constraints for AI prompt |

## Security Mitigations

| Threat ID | Mitigation |
|-----------|------------|
| T-37-09 | Escape special characters in signature/forbidden phrases before prompt injection |
| T-37-10 | Verify caller has access to profileId's client before scoring |

## Test Results

```
VoiceComplianceService: 21 tests passing
VoiceConstraintBuilder: 18 tests passing
VoiceAnalyzer: 7 tests passing (existing)
VoiceProfileService: 8 tests passing (existing)
ProtectionRulesService: 12 tests passing (existing)
Total: 66 tests passing
```

## Verification Checklist

- [x] VoiceComplianceService tests pass (21/21)
- [x] VoiceConstraintBuilder tests pass (18/18)
- [x] BriefGenerator compiles with voice integration
- [x] Compliance scoring returns meaningful violations
- [x] TypeScript compiles without voice-related errors

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

All created files exist and commits verified:
- 6d1eca1: feat(37-04): implement VoiceComplianceService with TDD
- 2e156e0: feat(37-04): implement VoiceConstraintBuilder with TDD
- 659f27b: feat(37-04): integrate voice with BriefGenerator and add server functions
