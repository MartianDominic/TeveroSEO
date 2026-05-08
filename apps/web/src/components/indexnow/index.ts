/**
 * IndexNow Components
 *
 * Platform-specific manual instruction system for IndexNow key deployment.
 * Used when auto-deployment fails.
 */

export { InstructionViewer } from "./instruction-viewer";
export type {
  Platform,
  Difficulty,
  InstructionStep,
  PlatformInstructions,
  InstructionVariables,
  CommonError,
  VerificationStep,
} from "@/lib/indexnow/instruction-templates";
export {
  PLATFORM_INSTRUCTIONS,
  generateInstructions,
  getSupportedPlatforms,
  generateKeyFileName,
  generateKeyFileContent,
  generateVerificationUrl,
  interpolateVariables,
} from "@/lib/indexnow/instruction-templates";
