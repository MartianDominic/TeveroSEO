/**
 * SEO Chat Types
 * Phase 98-01: Foundation data layer types
 *
 * These interfaces define the data contracts used throughout SEO Chat:
 * - SessionContext: Accumulated conversation state
 * - ProposalDraft: Pre-proposal keyword and package selection
 * - Tool result types: Structured outputs from analysis tools
 */

// ---------------------------------------------------------------------------
// Session Context
// ---------------------------------------------------------------------------

/**
 * Analysis history entry - tracks each tool execution for cost/progress.
 */
export interface AnalysisHistoryEntry {
  /** Type of analysis performed */
  type:
    | "domain_health"
    | "keyword_analysis"
    | "feasibility_check"
    | "add_to_proposal"
    | "generate_proposal";
  /** When the analysis was performed */
  timestamp: Date;
  /** Cost in micros ($0.01 = 10,000 micros) */
  costMicros: number;
}

/**
 * Session context - accumulated across messages.
 *
 * This context persists across all messages in a session, allowing the LLM
 * to maintain continuity without re-analyzing the same domain. Updated via
 * mergeContext() when tool results include new extracted entities.
 */
export interface SessionContext {
  /** Unique session identifier */
  sessionId: string;
  /** Workspace ID (for tenant isolation) */
  workspaceId: string;
  /** Prospect domain being analyzed */
  prospectDomain: string | null;
  /** Prospect business name (auto-extracted or user-provided) */
  prospectName: string | null;
  /** Prospect email (for magic link delivery) */
  prospectEmail: string | null;
  /** Business niche (e.g., "beauty salon") */
  niche: string | null;
  /** Target location for local keywords */
  location: string | null;
  /** Total keywords analyzed so far */
  keywordsAnalyzed: number;
  /** History of all analyses performed */
  analysisHistory: AnalysisHistoryEntry[];
  /** Proposal ID if generated */
  proposalId: string | null;
  /** Proposal lifecycle status */
  proposalStatus:
    | "draft"
    | "generated"
    | "sent"
    | "viewed"
    | "converted"
    | null;
}

// ---------------------------------------------------------------------------
// Keywords & Clustering
// ---------------------------------------------------------------------------

/**
 * Keyword - individual keyword with feasibility assessment.
 *
 * Produced by keyword_analysis and feasibility_check tools.
 */
export interface Keyword {
  /** Unique identifier */
  id: string;
  /** Keyword phrase */
  keyword: string;
  /** Monthly search volume */
  volume: number;
  /** Keyword difficulty (0-100) */
  difficulty: number;
  /** Feasibility assessment */
  feasibility: "feasible" | "challenging" | "difficult" | "unlikely";
  /** Search intent classification */
  intent: "informational" | "navigational" | "commercial" | "transactional";
  /** Cluster ID (if grouped) */
  clusterId?: string;
  /** Cluster name (if grouped) */
  clusterName?: string;
}

/**
 * Topical cluster - semantically related keywords grouped together.
 *
 * Produced by keyword_analysis tool via HDBSCAN clustering.
 */
export interface TopicalCluster {
  /** Unique cluster identifier */
  id: string;
  /** Cluster name (human-readable label) */
  name: string;
  /** Keywords in this cluster */
  keywords: string[];
  /** Funnel stage for this cluster */
  funnel: "tofu" | "mofu" | "bofu";
  /** Total monthly volume across all keywords */
  volume: number;
}

// ---------------------------------------------------------------------------
// Tool Result Types
// ---------------------------------------------------------------------------

/**
 * Domain health result - quick site assessment.
 *
 * Produced by domain_health tool (DataForSEO domain_overview API).
 */
export interface DomainHealthResult {
  /** Domain analyzed */
  domain: string;
  /** Domain Authority (Moz-style metric) */
  da: number;
  /** Domain Rating (Ahrefs-style metric) */
  dr: number;
  /** Monthly organic traffic estimate */
  traffic: number;
  /** Number of keywords ranking */
  rankedKeywords: number;
  /** Human-readable summary */
  summary: string;
}

/**
 * Keyword analysis result - comprehensive keyword discovery.
 *
 * Produced by keyword_analysis tool (DataForSEO keywords_for_site + clustering).
 */
export interface KeywordAnalysisResult {
  /** Domain analyzed */
  domain: string;
  /** Discovered keywords */
  keywords: Keyword[];
  /** Total monthly volume across all keywords */
  totalVolume: number;
  /** Topical clusters */
  clusters: TopicalCluster[];
}

/**
 * Feasibility result - can-we-rank-for assessment.
 *
 * Produced by feasibility_check tool (evidence-based scoring formula).
 */
export interface FeasibilityResult {
  /** Keyword assessed */
  keyword: string;
  /** Feasibility score (0-100) */
  score: number;
  /** Overall verdict */
  verdict: "feasible" | "challenging" | "difficult" | "unlikely";
  /** Confidence level in this assessment */
  confidence: "high" | "medium" | "low";
  /** Timeline estimate */
  timeline: {
    /** Minimum months to rank */
    minMonths: number;
    /** Maximum months to rank */
    maxMonths: number;
    /** Important caveats */
    caveats: string[];
  };
  /** Requirements to achieve ranking */
  requirements: {
    /** Estimated backlinks needed */
    backlinksNeeded: number;
    /** Minimum content word count */
    contentWordCount: number;
    /** Must fix technical issues first */
    technicalFixesFirst: boolean;
  };
  /** Factor breakdown (for transparency) */
  factors: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Proposal Draft
// ---------------------------------------------------------------------------

/**
 * Proposal draft - accumulated state before generating proposal.
 *
 * Stored in Zustand with persist middleware (localStorage).
 * Hydrated from database when resuming a session.
 */
export interface ProposalDraft {
  /** Associated session ID */
  sessionId: string | null;
  /** Prospect domain */
  domain: string | null;
  /** Keywords selected for proposal */
  keywords: Keyword[];
  /** Selected package tier */
  package: "pamatas" | "augimas" | "autoritetas" | null;
  /** Analysis results attached to draft */
  analysisResults: {
    /** Domain health assessment */
    domainHealth: DomainHealthResult | null;
    /** Keyword analysis results */
    keywordAnalysis: KeywordAnalysisResult | null;
    /** Feasibility assessments */
    feasibilityResults: FeasibilityResult[];
  };
}

// ---------------------------------------------------------------------------
// Context Management
// ---------------------------------------------------------------------------

/**
 * Merge extracted context into existing session context.
 *
 * Used by the chat API to update session context after tool execution.
 * Applies intelligent merging rules:
 * - Strings: Replace if new value provided
 * - Numbers: Add (for keywordsAnalyzed)
 * - Arrays: Concat (for analysisHistory)
 *
 * @param existing - Current session context
 * @param extracted - Newly extracted context from tool results
 * @returns Updated session context
 */
export function mergeContext(
  existing: SessionContext,
  extracted: Partial<SessionContext>
): SessionContext {
  return {
    ...existing,
    // Replace strings if provided
    prospectDomain: extracted.prospectDomain ?? existing.prospectDomain,
    prospectName: extracted.prospectName ?? existing.prospectName,
    prospectEmail: extracted.prospectEmail ?? existing.prospectEmail,
    niche: extracted.niche ?? existing.niche,
    location: extracted.location ?? existing.location,
    // Add numbers
    keywordsAnalyzed:
      (extracted.keywordsAnalyzed ?? 0) + existing.keywordsAnalyzed,
    // Concat arrays
    analysisHistory: [
      ...existing.analysisHistory,
      ...(extracted.analysisHistory ?? []),
    ],
    // Replace proposal fields if provided
    proposalId: extracted.proposalId ?? existing.proposalId,
    proposalStatus: extracted.proposalStatus ?? existing.proposalStatus,
  };
}
