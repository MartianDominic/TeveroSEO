/**
 * Types for the Agency Command Center dashboard.
 */

export interface HealthBreakdown {
  traffic: number;
  rankings: number;
  technical: number;
  backlinks: number;
  content: number;
}

export interface ClientMetrics {
  id: string;
  clientId: string;
  clientName: string;
  healthScore: number;
  healthBreakdown: HealthBreakdown;
  trafficCurrent: number;
  trafficPrevious: number;
  trafficTrendPct: number;
  keywordsTotal: number;
  keywordsTop10: number;
  keywordsTop3: number;
  keywordsPosition1: number;
  alertsOpen: number;
  alertsCritical: number;
  lastReportAt: string | null;
  lastAuditAt: string | null;
  computedAt: string;
  connectionStatus: "connected" | "stale" | "disconnected";
}

export interface PortfolioSummary {
  totalClients: number;
  clientsNeedingAttention: number;
  winsThisWeek: number;
  totalClicks30d: number;
  totalImpressions30d: number;
  avgTrafficChange: number;
  keywordsTotal: number;
  keywordsTop10: number;
  keywordsTop3: number;
  keywordsPosition1: number;
}

export interface AttentionItem {
  id: string;
  clientId: string;
  clientName: string;
  type: "alert" | "health" | "connection";
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface WinItem {
  id: string;
  clientId: string;
  clientName: string;
  type: "position_1" | "top_10_entry" | "traffic_milestone" | "high_da_backlink";
  title: string;
  description: string;
  achievedAt: string;
  metadata?: Record<string, unknown>;
}
