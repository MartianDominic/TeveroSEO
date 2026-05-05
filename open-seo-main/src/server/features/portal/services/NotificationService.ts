/**
 * NotificationService - Portal notification management.
 * Phase 90-01: Trust Foundation
 *
 * Manages notification queueing, settings, and delivery tracking.
 * Notifications are async via BullMQ, delivered via Resend for email.
 *
 * Notification types: win, alert, update, digest
 * Channels: in_app, email, slack, push
 */
import {
  db,
  portalNotifications,
  portalNotificationSettings,
  type PortalNotificationSelect,
  type PortalNotificationInsert,
  type PortalNotificationSettingsSelect,
  type NotificationType,
  type NotificationChannel,
  type NotificationPayload,
  NOTIFICATION_TYPES,
  NOTIFICATION_CHANNELS,
} from "@/db";
import { eq, and, desc } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";
import { getNotificationQueue, type NotificationJobData } from "@/server/queues/notificationQueue";

const log = createLogger({ module: "NotificationService" });

/**
 * Default notification settings for new clients.
 */
const DEFAULT_SETTINGS: Omit<PortalNotificationSettingsSelect, "clientId" | "updatedAt"> = {
  winEmail: true,
  winSlack: true,
  winPush: true,
  alertEmail: true,
  alertSlack: true,
  alertPush: true,
  updatePush: true,
  weeklyDigest: true,
  digestDay: 1, // Monday
  settings: {},
};

/**
 * Partial settings update type.
 */
export type NotificationSettingsUpdate = Partial<
  Omit<PortalNotificationSettingsSelect, "clientId" | "updatedAt">
>;

/**
 * NotificationService manages portal notification queueing and delivery.
 *
 * Flow:
 * 1. queueNotification() checks settings, creates DB record, adds to BullMQ
 * 2. Worker picks up job, sends via appropriate channel (email, Slack, etc.)
 * 3. Worker calls markNotificationSent() or markNotificationFailed()
 */
export class NotificationService {
  /**
   * Queue a notification for async delivery.
   *
   * Checks notification settings before queueing - returns null if
   * the client has disabled this notification type+channel combo.
   *
   * @param clientId - Client UUID
   * @param type - Notification type (win, alert, update, digest)
   * @param channel - Delivery channel (in_app, email, slack, push)
   * @param payload - Notification content (varies by type)
   * @param recipientEmail - Optional email override
   * @returns Created notification or null if disabled
   */
  static async queueNotification(
    clientId: string,
    type: NotificationType,
    channel: NotificationChannel,
    payload: NotificationPayload,
    recipientEmail?: string
  ): Promise<PortalNotificationSelect | null> {
    // Validate type and channel
    if (!NOTIFICATION_TYPES.includes(type)) {
      throw new Error(`Invalid notification type: ${type}`);
    }
    if (!NOTIFICATION_CHANNELS.includes(channel)) {
      throw new Error(`Invalid notification channel: ${channel}`);
    }

    // Check if this notification type+channel is enabled for the client
    const settings = await this.getNotificationSettings(clientId);
    const isEnabled = this.isNotificationEnabled(settings, type, channel);

    if (!isEnabled) {
      log.debug("Notification disabled by settings", { clientId, type, channel });
      return null;
    }

    // Create notification record
    const [notification] = await db
      .insert(portalNotifications)
      .values({
        clientId,
        type,
        channel,
        status: "pending",
        payload,
      })
      .returning();

    // Queue for async delivery
    const queue = getNotificationQueue();
    const jobData: NotificationJobData = {
      notificationId: notification.id,
      clientId,
      type,
      channel,
      payload,
      recipientEmail,
      slackWebhookUrl: settings.settings?.slackWebhookUrl,
    };

    await queue.add(type, jobData, {
      jobId: `notif-${notification.id}`,
    });

    log.info("Notification queued", {
      notificationId: notification.id,
      clientId,
      type,
      channel,
    });

    return notification;
  }

  /**
   * Get notification settings for a client.
   *
   * Returns defaults if no settings exist yet.
   *
   * @param clientId - Client UUID
   * @returns Notification settings with defaults applied
   */
  static async getNotificationSettings(
    clientId: string
  ): Promise<PortalNotificationSettingsSelect> {
    const [existing] = await db
      .select()
      .from(portalNotificationSettings)
      .where(eq(portalNotificationSettings.clientId, clientId))
      .limit(1);

    if (existing) {
      return existing;
    }

    // Return defaults without creating a record
    return {
      clientId,
      ...DEFAULT_SETTINGS,
      updatedAt: new Date(),
    };
  }

  /**
   * Update notification settings for a client.
   *
   * Uses upsert to create if doesn't exist.
   *
   * @param clientId - Client UUID
   * @param updates - Partial settings to update
   * @returns Updated settings
   */
  static async updateNotificationSettings(
    clientId: string,
    updates: NotificationSettingsUpdate
  ): Promise<PortalNotificationSettingsSelect> {
    log.debug("Updating notification settings", { clientId, updates });

    // Upsert: insert or update on conflict
    const [result] = await db
      .insert(portalNotificationSettings)
      .values({
        clientId,
        ...DEFAULT_SETTINGS,
        ...updates,
      })
      .onConflictDoUpdate({
        target: portalNotificationSettings.clientId,
        set: {
          ...updates,
          updatedAt: new Date(),
        },
      })
      .returning();

    log.info("Notification settings updated", { clientId });

    return result;
  }

  /**
   * Get recent notifications for a client (for in_app display).
   *
   * @param clientId - Client UUID
   * @param limit - Maximum notifications to return (default: 20)
   * @returns Recent notifications sorted by createdAt desc
   */
  static async getClientNotifications(
    clientId: string,
    limit: number = 20
  ): Promise<PortalNotificationSelect[]> {
    const notifications = await db
      .select()
      .from(portalNotifications)
      .where(
        and(
          eq(portalNotifications.clientId, clientId),
          eq(portalNotifications.channel, "in_app")
        )
      )
      .orderBy(desc(portalNotifications.createdAt))
      .limit(limit);

    return notifications;
  }

  /**
   * Mark a notification as sent.
   *
   * Called by the worker after successful delivery.
   *
   * @param notificationId - Notification UUID
   * @returns Updated notification
   */
  static async markNotificationSent(
    notificationId: string
  ): Promise<PortalNotificationSelect | null> {
    const [updated] = await db
      .update(portalNotifications)
      .set({
        status: "sent",
        sentAt: new Date(),
      })
      .where(eq(portalNotifications.id, notificationId))
      .returning();

    if (updated) {
      log.debug("Notification marked as sent", { notificationId });
    }

    return updated ?? null;
  }

  /**
   * Mark a notification as failed.
   *
   * Called by the worker after failed delivery.
   *
   * @param notificationId - Notification UUID
   * @param reason - Failure reason
   * @returns Updated notification
   */
  static async markNotificationFailed(
    notificationId: string,
    reason: string
  ): Promise<PortalNotificationSelect | null> {
    const [updated] = await db
      .update(portalNotifications)
      .set({
        status: "failed",
        failedAt: new Date(),
        failureReason: reason,
      })
      .where(eq(portalNotifications.id, notificationId))
      .returning();

    if (updated) {
      log.warn("Notification marked as failed", { notificationId, reason });
    }

    return updated ?? null;
  }

  /**
   * Get a notification by ID.
   */
  static async getNotificationById(
    notificationId: string
  ): Promise<PortalNotificationSelect | null> {
    const [notification] = await db
      .select()
      .from(portalNotifications)
      .where(eq(portalNotifications.id, notificationId))
      .limit(1);

    return notification ?? null;
  }

  // =========================================================================
  // Private Helpers
  // =========================================================================

  /**
   * Check if a notification type+channel is enabled in settings.
   */
  private static isNotificationEnabled(
    settings: PortalNotificationSettingsSelect,
    type: NotificationType,
    channel: NotificationChannel
  ): boolean {
    // in_app is always enabled
    if (channel === "in_app") {
      return true;
    }

    // Map type+channel to setting field
    const settingKey = this.getSettingKey(type, channel);
    if (!settingKey) {
      return false;
    }

    return Boolean(settings[settingKey as keyof PortalNotificationSettingsSelect]);
  }

  /**
   * Get the settings key for a type+channel combination.
   */
  private static getSettingKey(
    type: NotificationType,
    channel: NotificationChannel
  ): string | null {
    const mapping: Record<string, string | null> = {
      // Win notifications
      "win_email": "winEmail",
      "win_slack": "winSlack",
      "win_push": "winPush",
      // Alert notifications
      "alert_email": "alertEmail",
      "alert_slack": "alertSlack",
      "alert_push": "alertPush",
      // Update notifications
      "update_push": "updatePush",
      // Digest notifications
      "digest_email": "weeklyDigest",
    };

    return mapping[`${type}_${channel}`] ?? null;
  }
}
