/**
 * Persuasion Block Definitions
 * Phase 102-01: Foundation schema and types
 *
 * Defines all 11 persuasion block types with metadata,
 * templates, and framework configurations.
 */

import type { PersuasionBlockType } from './types';

/**
 * Block type definition with metadata for UI rendering.
 */
export interface BlockTypeDefinition {
  /** Block type identifier */
  type: PersuasionBlockType;
  /** Human-readable label */
  label: string;
  /** Tooltip description */
  description: string;
  /** Lucide icon name */
  icon: string;
  /** Semantic color tokens per UI-SPEC */
  color: {
    bg: string;
    text: string;
  };
  /** Placeholder content for new blocks */
  placeholder: string;
  /** AI prompt hint for content generation */
  aiPromptHint: string;
}

/**
 * All 11 persuasion block types with full metadata.
 * Order matches recommended proposal flow.
 */
export const PERSUASION_BLOCK_TYPES: readonly BlockTypeDefinition[] = [
  {
    type: 'pain_amplifier',
    label: 'Pain Amplifier',
    description: 'Highlight the cost of their current situation',
    icon: 'AlertTriangle',
    color: { bg: 'error-soft', text: 'error' },
    placeholder: 'Your current SEO is costing you {{estimated_loss}} per month in missed traffic...',
    aiPromptHint: "Quantify the prospect's pain with specific numbers",
  },
  {
    type: 'villain_story',
    label: 'Villain Story',
    description: 'Position competitors or status quo as the problem',
    icon: 'Skull',
    color: { bg: 'warning-soft', text: 'warning' },
    placeholder: 'Most agencies will tell you that rankings take 6-12 months...',
    aiPromptHint: 'Create contrast between the old way and your approach',
  },
  {
    type: 'credibility',
    label: 'Credibility',
    description: 'Establish your authority and experience',
    icon: 'Award',
    color: { bg: 'accent-soft', text: 'accent-ink' },
    placeholder: 'We have helped {{client_count}} businesses achieve...',
    aiPromptHint: 'Include specific numbers, years of experience, notable clients',
  },
  {
    type: 'social_proof',
    label: 'Social Proof',
    description: 'Show testimonials, case studies, or client logos',
    icon: 'Users',
    color: { bg: 'info-soft', text: 'info' },
    placeholder: '"Working with [Agency] increased our organic traffic by 340%..." - Client Name',
    aiPromptHint: 'Use direct quotes with specific results and client names',
  },
  {
    type: 'process_reveal',
    label: 'Process Reveal',
    description: 'Explain your methodology or how you work',
    icon: 'GitBranch',
    color: { bg: 'surface-2', text: 'text-2' },
    placeholder: 'Our proven 4-step process:\n1. Discovery\n2. Strategy\n3. Execution\n4. Optimization',
    aiPromptHint: 'Show a clear, numbered process that builds confidence',
  },
  {
    type: 'offer_stack',
    label: 'Offer Stack',
    description: 'Present packages with value anchoring',
    icon: 'Layers',
    color: { bg: 'accent-soft', text: 'accent-ink' },
    placeholder: 'What you get:\n- Item 1 (value: {{price_1}})\n- Item 2 (value: {{price_2}})\nTotal value: {{total_value}}\nYour investment: {{price}}',
    aiPromptHint: 'Stack value with individual prices, then show total discount',
  },
  {
    type: 'risk_reversal',
    label: 'Risk Reversal',
    description: 'Remove purchase risk with guarantees',
    icon: 'Shield',
    color: { bg: 'success-soft', text: 'success' },
    placeholder: 'Our 90-Day ROI Guarantee: If you do not see measurable results...',
    aiPromptHint: 'Make the guarantee specific and easy to understand',
  },
  {
    type: 'objection_handler',
    label: 'Objection Handler',
    description: 'Address common concerns upfront',
    icon: 'HelpCircle',
    color: { bg: 'surface-2', text: 'text-2' },
    placeholder: 'You might be wondering: "What if this does not work for my industry?"...',
    aiPromptHint: 'Acknowledge the objection, then provide evidence-based answer',
  },
  {
    type: 'urgency',
    label: 'Urgency',
    description: 'Create time pressure or scarcity',
    icon: 'Clock',
    color: { bg: 'warning-soft', text: 'warning' },
    placeholder: 'This offer is only available until {{deadline}} because...',
    aiPromptHint: 'Give a legitimate reason for the deadline, not fake scarcity',
  },
  {
    type: 'cta',
    label: 'Call to Action',
    description: 'Clear next step for the prospect',
    icon: 'ArrowRight',
    color: { bg: 'accent-soft', text: 'accent-ink' },
    placeholder: 'Ready to start? Book your free strategy call today.',
    aiPromptHint: 'Single clear action, remove friction, restate main benefit',
  },
  {
    type: 'custom',
    label: 'Custom Block',
    description: 'Free-form content block',
    icon: 'Square',
    color: { bg: 'surface-3', text: 'text-3' },
    placeholder: 'Add your custom content here...',
    aiPromptHint: 'Generate content based on the block title and context',
  },
] as const;

/**
 * Framework template definition.
 */
export interface FrameworkTemplate {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description of the framework */
  description: string;
  /** Required block types in order */
  requiredBlocks: PersuasionBlockType[];
  /** Recommended block sequence (superset of required) */
  recommendedSequence: PersuasionBlockType[];
}

/**
 * Pre-built framework templates.
 */
export const FRAMEWORK_TEMPLATES: readonly FrameworkTemplate[] = [
  {
    id: 'russell_brunson',
    name: 'Perfect Webinar',
    description: 'Russell Brunson\'s proven proposal structure for high-ticket offers',
    requiredBlocks: [
      'pain_amplifier',
      'villain_story',
      'credibility',
      'offer_stack',
      'risk_reversal',
      'cta',
    ],
    recommendedSequence: [
      'pain_amplifier',
      'villain_story',
      'credibility',
      'social_proof',
      'process_reveal',
      'offer_stack',
      'risk_reversal',
      'objection_handler',
      'urgency',
      'cta',
    ],
  },
  {
    id: 'storybrand',
    name: 'StoryBrand',
    description: 'Donald Miller\'s 7-part storytelling framework',
    requiredBlocks: [
      'pain_amplifier',
      'villain_story',
      'credibility',
      'process_reveal',
      'cta',
    ],
    recommendedSequence: [
      'pain_amplifier',
      'villain_story',
      'credibility',
      'process_reveal',
      'risk_reversal',
      'urgency',
      'cta',
    ],
  },
  {
    id: 'pas',
    name: 'Problem-Agitate-Solution',
    description: 'Classic copywriting framework for quick proposals',
    requiredBlocks: [
      'pain_amplifier',
      'offer_stack',
      'cta',
    ],
    recommendedSequence: [
      'pain_amplifier',
      'credibility',
      'offer_stack',
      'cta',
    ],
  },
] as const;

/**
 * Get block type definition by type.
 */
export function getBlockMetadata(type: PersuasionBlockType): BlockTypeDefinition | undefined {
  return PERSUASION_BLOCK_TYPES.find((b) => b.type === type);
}

/**
 * Get a TipTap-compatible template for a block type.
 * Returns a basic paragraph structure with placeholder text.
 */
export function getBlockTemplate(type: PersuasionBlockType): unknown {
  const metadata = getBlockMetadata(type);
  const placeholder = metadata?.placeholder ?? '';

  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: placeholder,
          },
        ],
      },
    ],
  };
}

/**
 * Get framework template by ID.
 */
export function getFrameworkTemplate(id: string): FrameworkTemplate | undefined {
  return FRAMEWORK_TEMPLATES.find((f) => f.id === id);
}

/**
 * Validate if a block sequence satisfies a framework's requirements.
 */
export function validateFrameworkCompliance(
  blockTypes: PersuasionBlockType[],
  frameworkId: string
): { isValid: boolean; missingBlocks: PersuasionBlockType[] } {
  const framework = getFrameworkTemplate(frameworkId);
  if (!framework) {
    return { isValid: true, missingBlocks: [] };
  }

  const missingBlocks = framework.requiredBlocks.filter(
    (required) => !blockTypes.includes(required)
  );

  return {
    isValid: missingBlocks.length === 0,
    missingBlocks,
  };
}
