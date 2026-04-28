/**
 * Proposal tracking module exports.
 * Phase 30-04: Engagement Analytics
 */

export {
  ViewTrackingService,
  hashIpAddress,
  detectDeviceType,
  type ViewTrackingInput,
} from "./ViewTrackingService";

export {
  calculateEngagementSignals,
  getEngagementSummary,
  getEngagementLevel,
  type EngagementSignals,
} from "./EngagementSignals";
