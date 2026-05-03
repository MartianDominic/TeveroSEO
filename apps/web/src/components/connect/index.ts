/**
 * Connection Wizard Components
 * Phase 66-04: Connection Wizard UI
 * Phase 66-06: Verification UI
 */

export { UrlInput } from "./url-input";
export type { UrlInputProps } from "./url-input";

export { PlatformDetected } from "./platform-detected";
export type { PlatformDetectedProps } from "./platform-detected";

export { ConnectionChoice } from "./connection-choice";
export type { ConnectionChoiceProps } from "./connection-choice";

export { ConnectionStepIndicator } from "./step-indicator";
export type { ConnectionStepIndicatorProps } from "./step-indicator";

export { PlatformGuide } from "./platform-guide";
export type { PlatformGuideProps } from "./platform-guide";

// Phase 66-06: Verification UI
export { VerificationScreen } from "./verification-screen";
export type { VerificationScreenProps } from "./verification-screen";

export { SuccessScreen } from "./success-screen";
export type { SuccessScreenProps } from "./success-screen";

export { ErrorScreen } from "./error-screen";
export type { ErrorScreenProps, ErrorType } from "./error-screen";

export { ManualCheck } from "./manual-check";
export type { ManualCheckProps } from "./manual-check";

// Phase 66-09: OAuth Enhancement
export { OAuthEnhancement } from "./oauth-enhancement";
export type { OAuthEnhancementProps, EnhancementPlatform } from "./oauth-enhancement";

export {
  GscPrompt,
  GaPrompt,
  GbpPrompt,
  CmsPublishPrompt,
  useOAuthPrompts,
  isPromptDismissed,
  dismissPrompt,
} from "./oauth-prompts";
export type {
  PromptProps,
  CmsPublishPromptProps,
  UseOAuthPromptsOptions,
  UseOAuthPromptsResult,
} from "./oauth-prompts";
