/**
 * Pixel Feature Module
 * Phase 66: Platform Unification Excellence
 *
 * Exports:
 * - PixelScriptService: Manages pixel installations and configurations
 * - PixelCollectorService: Processes analytics events from browser pixels
 * - PixelVerificationService: Real-time installation verification
 */

// Script generation service (Phase 66-01)
export {
  PixelScriptService,
  generatePixelScript,
  generatePixelLoader,
  type PixelScriptConfig,
  type ApprovedChange,
} from "./pixel-script.service";

// Collector service (Phase 66-02)
export {
  PixelCollectorService,
  getPixelCollector,
  processPixelEvent,
  type PixelEvent,
  type PixelEventType,
  type ProcessEventResult,
  type GeoData,
} from "./pixel-collector.service";

// Verification service (Phase 66-02)
export {
  PixelVerificationService,
  getPixelVerificationService,
  verifyInstallation,
  type VerificationStatus,
  type VerificationStatusType,
  type GeoLocation,
} from "./pixel-verification.service";

// Platform detection service (Phase 66-03)
export {
  PlatformDetectorService,
  detectPlatform,
  SUPPORTED_PLATFORMS as DETECTABLE_PLATFORMS,
  type SupportedPlatform,
  type PlatformDetectionResult,
} from "./platform-detector.service";

// CMS installation guides (Phase 66-03)
export {
  CMS_GUIDES,
  getGuide,
  SUPPORTED_PLATFORMS,
  type InstallationGuide,
  type GuideStep,
} from "./cms-guides";

// Developer handoff service (Phase 66-05)
export {
  DeveloperHandoffService,
  createDeveloperHandoffService,
  type CreateHandoffRequest,
  type CreateHandoffResult,
  type HandoffEmail,
  type EmailServiceInterface,
} from "./developer-handoff.service";

// DOM change service (Phase 66-07)
export {
  DomChangeService,
  createDomChangeService,
  queueChange,
  approveChange,
  rejectChange,
  rollbackChange,
  type QueueChangeRequest,
  type ApprovedChangesResponse,
  type ApprovedChange,
  type PaginationOptions,
} from "./dom-change.service";

// Platform Integration Facade (Phase 66-09)
export {
  PlatformIntegrationFacade,
  type ConnectionStatus,
  type OAuthConnectionInfo,
  type PlatformCapabilities,
  type Integration,
  type Analytics,
  type Content,
  type Result,
  type PixelStatus,
  type PixelAnalytics,
  type DateRange,
  type DomChange,
  type SeoField,
  type FacadeDependencies,
  type PixelServiceInterface,
  type OAuthServiceInterface,
  type WriteAdapterRegistryInterface,
  type CmsPublisherRegistryInterface,
} from "./platform-facade";
