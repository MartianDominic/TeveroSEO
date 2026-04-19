/**
 * Event type definitions for WebSocket communication.
 */

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  clientId?: string;
  clientName?: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export type ActivityEventType =
  | "alert.triggered"
  | "alert.acknowledged"
  | "alert.resolved"
  | "ranking.drop"
  | "ranking.gain"
  | "ranking.entered_top_10"
  | "ranking.position_1"
  | "report.generated"
  | "report.delivered"
  | "connection.new"
  | "connection.expired"
  | "sync.completed"
  | "sync.failed";

export const EVENT_TYPE_LABELS: Record<ActivityEventType, string> = {
  "alert.triggered": "Alert Triggered",
  "alert.acknowledged": "Alert Acknowledged",
  "alert.resolved": "Alert Resolved",
  "ranking.drop": "Ranking Drop",
  "ranking.gain": "Ranking Gain",
  "ranking.entered_top_10": "Entered Top 10",
  "ranking.position_1": "#1 Position",
  "report.generated": "Report Generated",
  "report.delivered": "Report Delivered",
  "connection.new": "New Connection",
  "connection.expired": "Connection Expired",
  "sync.completed": "Sync Completed",
  "sync.failed": "Sync Failed",
};

export const EVENT_TYPE_COLORS: Record<ActivityEventType, string> = {
  "alert.triggered": "text-red-600",
  "alert.acknowledged": "text-yellow-600",
  "alert.resolved": "text-emerald-600",
  "ranking.drop": "text-red-600",
  "ranking.gain": "text-emerald-600",
  "ranking.entered_top_10": "text-emerald-600",
  "ranking.position_1": "text-yellow-500",
  "report.generated": "text-blue-600",
  "report.delivered": "text-blue-600",
  "connection.new": "text-emerald-600",
  "connection.expired": "text-orange-600",
  "sync.completed": "text-emerald-600",
  "sync.failed": "text-red-600",
};

export type ActivityEventCategory = "alerts" | "rankings" | "reports" | "connections" | "sync";

export const EVENT_CATEGORIES: Record<ActivityEventCategory, ActivityEventType[]> = {
  alerts: ["alert.triggered", "alert.acknowledged", "alert.resolved"],
  rankings: ["ranking.drop", "ranking.gain", "ranking.entered_top_10", "ranking.position_1"],
  reports: ["report.generated", "report.delivered"],
  connections: ["connection.new", "connection.expired"],
  sync: ["sync.completed", "sync.failed"],
};
