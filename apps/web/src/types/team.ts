/**
 * Team management types for Phase 25: Team & Intelligence.
 */

/**
 * Team member with role and capacity information.
 */
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: "owner" | "admin" | "member";
  /** Maximum number of clients this member can handle */
  capacity: number;
  /** Current number of clients assigned */
  clientCount: number;
}

/**
 * Client assignment to team member.
 */
export interface ClientAssignment {
  clientId: string;
  clientName: string;
  memberId: string;
  memberName: string;
  assignedAt: string;
}

/**
 * Aggregated team metrics for capacity planning.
 */
export interface TeamMetrics {
  /** Total capacity across all team members */
  totalCapacity: number;
  /** Total clients currently assigned */
  utilizedCapacity: number;
  /** Utilization percentage (0-100+) */
  utilizationPct: number;
  /** Number of members at or over capacity */
  overloadedMembers: number;
  /** Number of members with available capacity */
  availableMembers: number;
  /** Team members with their assignments */
  members: TeamMemberWithAssignments[];
}

/**
 * Team member with full assignment details.
 */
export interface TeamMemberWithAssignments extends TeamMember {
  /** Assigned clients */
  assignments: ClientAssignment[];
  /** Capacity utilization percentage */
  utilizationPct: number;
  /** Whether member is at or over capacity */
  isOverloaded: boolean;
}

/**
 * Suggestion for rebalancing workload.
 */
export interface ReassignmentSuggestion {
  /** Client to reassign */
  clientId: string;
  clientName: string;
  /** Current assignee */
  fromMemberId: string;
  fromMemberName: string;
  /** Suggested new assignee */
  toMemberId: string;
  toMemberName: string;
  /** Reason for suggestion */
  reason: string;
  /** Impact on balance (positive = improvement) */
  impactScore: number;
}
