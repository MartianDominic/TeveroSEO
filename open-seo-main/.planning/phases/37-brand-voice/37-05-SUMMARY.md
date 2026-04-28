---
phase: 37
plan: 05
subsystem: voice-ui
tags: [voice-settings, ui, wizard, preview, protection-rules]
dependency_graph:
  requires: [37-02-voice-analyzer, 37-03-voice-profile-service, 37-04-compliance-scoring]
  provides: [voice-settings-page, voice-wizard, voice-preview-suite, protection-rules-editor]
  affects: [client-management, content-generation]
tech_stack:
  added: [date-fns, "@radix-ui/react-slider"]
  patterns: [tabbed-interface, decision-tree-wizard, tag-input, csv-import]
key_files:
  created:
    - src/routes/_app/clients/$clientId/voice/route.tsx
    - src/routes/_app/clients/$clientId/voice/index.tsx
    - src/client/components/voice/VoiceProfileSummary.tsx
    - src/client/components/voice/VoiceSettingsTabs.tsx
    - src/client/components/voice/VoiceWizard.tsx
    - src/client/components/voice/ToneTab.tsx
    - src/client/components/voice/VocabularyTab.tsx
    - src/client/components/voice/WritingTab.tsx
    - src/client/components/voice/ProtectionTab.tsx
    - src/client/components/voice/VoicePreviewSuite.tsx
    - src/client/components/voice/ProtectionRulesEditor.tsx
    - src/client/components/voice/index.ts
    - src/client/components/ui/slider.tsx
  modified:
    - src/serverFunctions/voice.ts
    - src/client/components/ui/dialog.tsx
decisions:
  - Tabbed interface with 5 tabs (Tone, Vocabulary, Writing, Protection, Preview)
  - Decision tree wizard for new profile mode selection
  - Live preview for writing style settings (heading case, contraction examples)
  - Protection rules displayed as text content (not HTML) for XSS safety
metrics:
  duration_minutes: 8
  completed_at: 2026-04-23T16:09:00Z
---

# Phase 37 Plan 05: Voice Settings UI Summary

Agency-grade voice settings UI with tabbed interface, decision tree wizard, and preview suite.

## One-Liner

Complete voice settings page at /clients/{clientId}/voice with 5-tab interface, guided setup wizard, sample preview with compliance scoring, and visual protection rules editor with CSV import.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Route and main page structure | 15f1969 | route.tsx, index.tsx |
| 2 | Core components - Summary, Tabs, Wizard | a94a5e0 | VoiceProfileSummary, VoiceSettingsTabs, VoiceWizard, index.ts |
| 3 | Tab components and preview suite | 617cb9f | ToneTab, VocabularyTab, WritingTab, ProtectionTab, ProtectionRulesEditor, VoicePreviewSuite, generateVoicePreviewFn |

## Implementation Details

### Voice Settings Page (`/clients/{clientId}/voice`)

- **No profile**: Shows VoiceWizard for guided setup
- **Has profile**: Shows tabbed interface with sidebar summary
- Grid layout: 1/4 sidebar + 3/4 main content on large screens

### VoiceWizard Decision Tree

| Step | Question | Next Step |
|------|----------|-----------|
| intro | Welcome | has_content |
| has_content | Has existing content? | preserve_sections (yes) / select_mode (no -> best_practices) |
| preserve_sections | Want to protect sections? | select_mode (yes -> preservation, no -> application) |
| select_mode | Confirm recommended mode | select_template |
| select_template | Choose industry template | creating |

### Tab Components

| Tab | Controls | Features |
|-----|----------|----------|
| Tone | Mode radio, tone inputs, formality slider (1-10), archetype select, personality trait badges | Learn Voice button with simulated progress |
| Vocabulary | Preferred/avoided word tag inputs, signature/forbidden phrase textareas | Add/remove tags with Enter key |
| Writing | Sentence/paragraph length sliders, contraction usage radio, heading style select | Live preview examples |
| Protection | ProtectionRulesEditor component | Mode-aware info alert |
| Preview | Generate samples button | Compliance scores with violation details |

### ProtectionRulesEditor

- Table view with type badge, target, reason, expires columns
- Add rule dialog with type-specific hints
- Test rule button shows match preview
- Delete with confirmation dialog
- CSV import with error reporting

### VoicePreviewSuite

- Generates headline, paragraph, CTA samples
- Mock generation based on archetype and settings
- Compliance scoring with 5 dimension scores
- Violation list with severity badges and suggestions

### Server Function Added

```typescript
generateVoicePreviewFn({ profileId }) -> { samples, compliance }
```

## Security Mitigations

| Threat ID | Mitigation |
|-----------|------------|
| T-37-11 | All tab form updates use updateVoiceProfileFn with Zod validation |
| T-37-12 | generateVoicePreviewFn protected by profile access verification |
| T-37-13 | Protection rule targets rendered as text content, not innerHTML |

## Dependencies Added

- `date-fns` - For relative time formatting in profile summary
- `@radix-ui/react-slider` - For formality and length sliders

## UI Components Added

- `src/client/components/ui/slider.tsx` - Radix Slider wrapper
- Added `DialogTrigger` export to dialog.tsx

## Deviations from Plan

**Rule 3 - Auto-fix blocking issues:**
1. Added missing `DialogTrigger` export to dialog.tsx (required by ProtectionRulesEditor)
2. Installed `date-fns` package (required for formatDistanceToNow)
3. Installed `@radix-ui/react-slider` package (required for Slider component)
4. Created slider.tsx UI component (not in original UI library)

## Checkpoint Status

**Task 4 (checkpoint:human-verify)** is awaiting user verification.

### What Was Built

- Complete voice settings UI at `/clients/{clientId}/voice`
- Tabbed interface: Tone, Vocabulary, Writing, Protection, Preview
- Always-visible profile summary sidebar
- Guided wizard for new profiles with decision tree
- Preview suite with sample generation and compliance scoring
- Protection rules editor with CSV import and test functionality

### How to Verify

1. Navigate to `/clients/{clientId}/voice` for a client without a voice profile
2. Verify wizard appears with decision tree flow
3. Complete wizard selecting "Application" mode and a template
4. Verify tabbed interface appears with profile summary sidebar
5. Test each tab:
   - Tone: Change formality slider, save
   - Vocabulary: Add preferred/avoided words
   - Writing: Adjust sentence length
   - Protection: Add a page rule, test it
   - Preview: Generate samples, verify compliance scores appear
6. Test "Learn Voice" button shows progress during analysis
7. Verify mobile responsiveness (sidebar collapses appropriately)

## Self-Check: PASSED

- [x] route.tsx exists at src/routes/_app/clients/$clientId/voice/route.tsx
- [x] index.tsx exists at src/routes/_app/clients/$clientId/voice/index.tsx
- [x] VoiceProfileSummary.tsx exists
- [x] VoiceSettingsTabs.tsx exists
- [x] VoiceWizard.tsx exists
- [x] ToneTab.tsx exists
- [x] VocabularyTab.tsx exists
- [x] WritingTab.tsx exists
- [x] ProtectionTab.tsx exists
- [x] ProtectionRulesEditor.tsx exists
- [x] VoicePreviewSuite.tsx exists
- [x] index.ts barrel export exists
- [x] generateVoicePreviewFn added to voice.ts
- [x] Commits verified: 15f1969, a94a5e0, 617cb9f
