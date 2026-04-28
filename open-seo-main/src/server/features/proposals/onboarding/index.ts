/**
 * Onboarding module exports.
 * Phase 30-07: Auto-Onboarding
 */

export {
  triggerOnboarding,
  createClientFromProposal,
  createProjectFromAnalysis,
  notifyAgency,
  type OnboardingResult,
  type AgencyNotificationParams,
} from "./onboarding";

export {
  generateGscInviteEmail,
  generateKickoffSchedulingEmail,
  generateClientWelcomeEmail,
  generateAgencyNotificationEmail,
  sendGscInviteEmail,
  sendKickoffSchedulingEmail,
  sendClientWelcomeEmail,
  sendAgencyNotificationEmail,
  type GscInviteEmailParams,
  type KickoffSchedulingEmailParams,
  type ClientWelcomeEmailParams,
  type AgencyNotificationEmailParams,
} from "./email";

export {
  formatSlackNotification,
  notifyAgencySlack,
  type AgencyNotificationData,
  type SlackMessage,
} from "./notifications";
