/**
 * Persuasion Block Definitions
 * Phase 102-01: Foundation Schema and Types
 *
 * Defines metadata, templates, and framework configurations
 * for all persuasion block types.
 */

import type {
  PersuasionBlockType,
  TipTapContent,
  FrameworkTemplate,
} from "./types";

// =====================================
// Block Type Colors (UI-SPEC compliant)
// =====================================

/**
 * Semantic colors for block type badges.
 * Maps to CSS custom properties from Design System v6.
 */
export interface BlockTypeColor {
  bg: string;
  text: string;
}

const BLOCK_COLORS: Record<PersuasionBlockType, BlockTypeColor> = {
  pain_amplifier: { bg: "error-soft", text: "error" },
  villain_story: { bg: "warning-soft", text: "warning" },
  credibility: { bg: "accent-soft", text: "accent-ink" },
  social_proof: { bg: "info-soft", text: "info" },
  process_reveal: { bg: "surface-2", text: "text-2" },
  offer_stack: { bg: "accent-soft", text: "accent-ink" },
  risk_reversal: { bg: "success-soft", text: "success" },
  objection_handler: { bg: "surface-2", text: "text-2" },
  urgency: { bg: "warning-soft", text: "warning" },
  cta: { bg: "accent-soft", text: "accent-ink" },
  custom: { bg: "surface-3", text: "text-3" },
};

// =====================================
// Block Type Metadata
// =====================================

/**
 * Complete metadata for a persuasion block type.
 */
export interface PersuasionBlockMetadata {
  type: PersuasionBlockType;
  label: string;
  description: string;
  icon: string; // lucide-react icon name
  color: BlockTypeColor;
  placeholder: string;
  aiPromptHint: string;
}

/**
 * All 11 persuasion block types with full metadata.
 * Labels and descriptions from UI-SPEC copywriting contract.
 */
export const PERSUASION_BLOCK_TYPES: readonly PersuasionBlockMetadata[] = [
  {
    type: "pain_amplifier",
    label: "Pain Amplifier",
    description: "Highlight the cost of their current situation",
    icon: "AlertTriangle",
    color: BLOCK_COLORS.pain_amplifier,
    placeholder: "Your current SEO is costing you {{estimated_loss}} per month in missed traffic...",
    aiPromptHint: "Quantify the prospect's pain with specific numbers. Reference their actual metrics if available. Make the cost of inaction concrete and urgent.",
  },
  {
    type: "villain_story",
    label: "Villain Story",
    description: "Position competitors or status quo as the problem",
    icon: "Skull",
    color: BLOCK_COLORS.villain_story,
    placeholder: "Most agencies promise rankings but deliver excuses. They take your money and...",
    aiPromptHint: "Create contrast by naming what's wrong with typical approaches. Don't attack specific competitors - attack the common failures in the industry.",
  },
  {
    type: "credibility",
    label: "Credibility",
    description: "Establish your authority and experience",
    icon: "Award",
    color: BLOCK_COLORS.credibility,
    placeholder: "Over the past 5 years, we've helped {{client_count}} businesses achieve...",
    aiPromptHint: "Lead with specific numbers, years of experience, and relevant credentials. Mention any certifications, awards, or notable clients.",
  },
  {
    type: "social_proof",
    label: "Social Proof",
    description: "Show testimonials, case studies, or client logos",
    icon: "Users",
    color: BLOCK_COLORS.social_proof,
    placeholder: '"After working with TeveroSEO, our organic traffic increased by 340%..." - {{client_name}}, {{client_company}}',
    aiPromptHint: "Use direct quotes when possible. Include specific metrics and results. Match testimonials to the prospect's industry or pain points.",
  },
  {
    type: "process_reveal",
    label: "Process Reveal",
    description: "Explain your methodology or how you work",
    icon: "GitBranch",
    color: BLOCK_COLORS.process_reveal,
    placeholder: "Our 4-step SEO transformation process: 1. Audit & Analysis, 2. Strategy Development, 3. Implementation, 4. Monitoring & Optimization",
    aiPromptHint: "Break down your process into clear, numbered steps. Explain what happens at each stage and what the client can expect. Keep it simple but comprehensive.",
  },
  {
    type: "offer_stack",
    label: "Offer Stack",
    description: "Present packages with value anchoring",
    icon: "Layers",
    color: BLOCK_COLORS.offer_stack,
    placeholder: "The {{package_name}} package includes: Keyword research (valued at {{keyword_value}}), On-page optimization ({{onpage_value}}), Monthly reporting...",
    aiPromptHint: "List each component with its individual value. Stack benefits to show total value exceeds price. Use specific numbers and anchor high before revealing actual price.",
  },
  {
    type: "risk_reversal",
    label: "Risk Reversal",
    description: "Remove purchase risk with guarantees",
    icon: "Shield",
    color: BLOCK_COLORS.risk_reversal,
    placeholder: "We're so confident in our results that we offer a {{guarantee_type}} guarantee. If you don't see {{metric}} in {{timeframe}}, we'll...",
    aiPromptHint: "Be specific about what you guarantee and under what conditions. Make the guarantee bold but believable. Address the main objection directly.",
  },
  {
    type: "objection_handler",
    label: "Objection Handler",
    description: "Address common concerns upfront",
    icon: "HelpCircle",
    color: BLOCK_COLORS.objection_handler,
    placeholder: "You might be wondering: 'How is this different from what we've tried before?' Great question. Here's why...",
    aiPromptHint: "Anticipate the prospect's specific concerns. Address them directly without being defensive. Turn objections into reasons to buy.",
  },
  {
    type: "urgency",
    label: "Urgency",
    description: "Create time pressure or scarcity",
    icon: "Clock",
    color: BLOCK_COLORS.urgency,
    placeholder: "This proposal is valid until {{expiration_date}}. We can only take on {{capacity_remaining}} new clients this quarter due to...",
    aiPromptHint: "Create genuine urgency based on real constraints (capacity, timing, market conditions). Never fabricate scarcity. Explain why acting now matters.",
  },
  {
    type: "cta",
    label: "Call to Action",
    description: "Clear next step for the prospect",
    icon: "ArrowRight",
    color: BLOCK_COLORS.cta,
    placeholder: "Ready to transform your SEO? Schedule a call with our team: {{calendar_link}}. Or reply to this proposal with any questions.",
    aiPromptHint: "Make the next step crystal clear and easy. Remove friction. Offer alternatives (call, email, form). Create a sense of momentum.",
  },
  {
    type: "custom",
    label: "Custom Block",
    description: "Freeform content section",
    icon: "Square",
    color: BLOCK_COLORS.custom,
    placeholder: "Add your custom content here...",
    aiPromptHint: "This is a freeform section. Generate content that fits the context and maintains the document's tone and flow.",
  },
] as const;

// =====================================
// Block Template Functions
// =====================================

/**
 * Creates an empty TipTap document with optional placeholder text.
 */
function createTipTapDoc(text?: string): TipTapContent {
  if (!text) {
    return { type: "doc", content: [] };
  }

  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text,
          },
        ],
      },
    ],
  };
}

/**
 * Get the TipTap template for a block type.
 * Returns placeholder content that can be filled in or regenerated by AI.
 */
export function getBlockTemplate(type: PersuasionBlockType): TipTapContent {
  const metadata = PERSUASION_BLOCK_TYPES.find((b) => b.type === type);
  if (!metadata) {
    return createTipTapDoc();
  }

  return createTipTapDoc(metadata.placeholder);
}

/**
 * Get metadata for a specific block type.
 */
export function getBlockMetadata(
  type: PersuasionBlockType
): PersuasionBlockMetadata | undefined {
  return PERSUASION_BLOCK_TYPES.find((b) => b.type === type);
}

/**
 * Get display info for a block type (label, description, icon, color).
 */
export function getBlockDisplayInfo(type: PersuasionBlockType): {
  label: string;
  description: string;
  icon: string;
  color: BlockTypeColor;
} {
  const metadata = getBlockMetadata(type);
  if (!metadata) {
    return {
      label: "Unknown",
      description: "Unknown block type",
      icon: "Square",
      color: BLOCK_COLORS.custom,
    };
  }

  return {
    label: metadata.label,
    description: metadata.description,
    icon: metadata.icon,
    color: metadata.color,
  };
}

// =====================================
// Framework Templates (REQ-03)
// =====================================

/**
 * Russell Brunson's Perfect Webinar framework.
 * Used for high-ticket proposals with clear problem/solution structure.
 */
const RUSSELL_BRUNSON_FRAMEWORK: FrameworkTemplate = {
  id: "russell_brunson",
  name: "Perfect Webinar",
  description: "Russell Brunson's proven framework for high-converting proposals. Builds emotional connection through stories before presenting the offer.",
  requiredBlocks: [
    "pain_amplifier",
    "credibility",
    "offer_stack",
    "risk_reversal",
    "cta",
  ],
  recommendedSequence: [
    "pain_amplifier",
    "villain_story",
    "credibility",
    "social_proof",
    "process_reveal",
    "offer_stack",
    "risk_reversal",
    "objection_handler",
    "urgency",
    "cta",
  ],
};

/**
 * Donald Miller's StoryBrand framework.
 * Positions the client as the hero and the agency as the guide.
 */
const STORYBRAND_FRAMEWORK: FrameworkTemplate = {
  id: "storybrand",
  name: "StoryBrand",
  description: "Donald Miller's 7-part framework. Positions the prospect as the hero and you as the guide who helps them succeed.",
  requiredBlocks: [
    "pain_amplifier",
    "credibility",
    "process_reveal",
    "cta",
  ],
  recommendedSequence: [
    "pain_amplifier",      // 1. A Character (hero with problem)
    "villain_story",       // 2. Has a Problem
    "credibility",         // 3. Meets a Guide (that's you)
    "process_reveal",      // 4. Who Gives Them a Plan
    "cta",                 // 5. Calls Them to Action
    "risk_reversal",       // 6. Helps Them Avoid Failure
    "social_proof",        // 7. And Ends in Success
  ],
};

/**
 * Classic Problem-Agitate-Solution framework.
 * Simple but effective for straightforward proposals.
 */
const PAS_FRAMEWORK: FrameworkTemplate = {
  id: "pas",
  name: "Problem-Agitate-Solution",
  description: "The classic copywriting formula. Identify the problem, make it hurt, then present your solution as the relief.",
  requiredBlocks: [
    "pain_amplifier",
    "offer_stack",
    "cta",
  ],
  recommendedSequence: [
    "pain_amplifier",      // Problem
    "villain_story",       // Agitate (make it worse)
    "offer_stack",         // Solution
    "cta",                 // Action
  ],
};

/**
 * All available framework templates.
 */
export const FRAMEWORK_TEMPLATES: readonly FrameworkTemplate[] = [
  RUSSELL_BRUNSON_FRAMEWORK,
  STORYBRAND_FRAMEWORK,
  PAS_FRAMEWORK,
] as const;

/**
 * Get a specific framework template by ID.
 */
export function getFrameworkTemplate(
  id: string
): FrameworkTemplate | undefined {
  return FRAMEWORK_TEMPLATES.find((f) => f.id === id);
}

/**
 * Check if a list of blocks satisfies a framework's requirements.
 */
export function validateFrameworkCompliance(
  frameworkId: string,
  blockTypes: PersuasionBlockType[]
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

/**
 * Get the recommended block sequence for a framework.
 * Returns blocks in the suggested order for maximum persuasion impact.
 */
export function getFrameworkSequence(
  frameworkId: string
): PersuasionBlockType[] {
  const framework = getFrameworkTemplate(frameworkId);
  return framework?.recommendedSequence ?? [];
}
