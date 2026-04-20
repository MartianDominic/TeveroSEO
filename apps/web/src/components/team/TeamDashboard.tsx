"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
} from "@tevero/ui";
import { Users, AlertTriangle, CheckCircle, TrendingUp } from "lucide-react";
import type { TeamMetrics, TeamMemberWithAssignments } from "@/types/team";

interface TeamDashboardProps {
  metrics: TeamMetrics;
  onMemberClick?: (memberId: string) => void;
}

/**
 * Get capacity bar color based on utilization percentage.
 */
function getCapacityColor(utilizationPct: number): string {
  if (utilizationPct >= 100) return "bg-red-500";
  if (utilizationPct >= 80) return "bg-yellow-500";
  return "bg-emerald-500";
}

/**
 * Get badge variant based on utilization.
 */
function getStatusBadge(member: TeamMemberWithAssignments) {
  if (member.isOverloaded) {
    return (
      <Badge variant="destructive" className="text-xs gap-1">
        <AlertTriangle className="h-3 w-3" />
        Overloaded
      </Badge>
    );
  }
  if (member.utilizationPct >= 80) {
    return (
      <Badge variant="secondary" className="text-xs gap-1 bg-yellow-100 text-yellow-800">
        <TrendingUp className="h-3 w-3" />
        Near Capacity
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-xs gap-1 bg-emerald-100 text-emerald-800">
      <CheckCircle className="h-3 w-3" />
      Available
    </Badge>
  );
}

/**
 * Member avatar component with fallback.
 */
function MemberAvatar({
  name,
  avatar,
}: {
  name: string;
  avatar?: string;
}) {
  if (avatar) {
    return (
      <img
        src={avatar}
        alt={name}
        className="h-10 w-10 rounded-full object-cover"
      />
    );
  }
  return (
    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

/**
 * Individual team member card with capacity visualization.
 */
function MemberCard({
  member,
  onClick,
}: {
  member: TeamMemberWithAssignments;
  onClick?: () => void;
}) {
  return (
    <div
      className={`p-4 rounded-lg border ${
        onClick ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""
      } ${member.isOverloaded ? "border-red-200 bg-red-50/50" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <MemberAvatar name={member.name} avatar={member.avatar} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h4 className="font-medium text-sm truncate">{member.name}</h4>
              <p className="text-xs text-muted-foreground truncate">
                {member.email}
              </p>
            </div>
            {getStatusBadge(member)}
          </div>

          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Workload: {member.clientCount} / {member.capacity} clients
              </span>
              <span
                className={`font-medium ${
                  member.isOverloaded
                    ? "text-red-600"
                    : member.utilizationPct >= 80
                    ? "text-yellow-600"
                    : "text-emerald-600"
                }`}
              >
                {member.utilizationPct}%
              </span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${getCapacityColor(
                  member.utilizationPct
                )}`}
                style={{
                  width: `${Math.min(member.utilizationPct, 100)}%`,
                }}
              />
            </div>
          </div>

          {member.assignments.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {member.assignments.slice(0, 3).map((assignment) => (
                <span
                  key={assignment.clientId}
                  className="text-xs px-2 py-0.5 bg-muted rounded-full truncate max-w-[100px]"
                  title={assignment.clientName}
                >
                  {assignment.clientName}
                </span>
              ))}
              {member.assignments.length > 3 && (
                <span className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
                  +{member.assignments.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Team summary stats bar.
 */
function TeamSummary({ metrics }: { metrics: TeamMetrics }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
      <div>
        <p className="text-xs text-muted-foreground">Team Members</p>
        <p className="text-lg font-semibold">{metrics.members.length}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Total Capacity</p>
        <p className="text-lg font-semibold">
          {metrics.utilizedCapacity} / {metrics.totalCapacity}
        </p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Utilization</p>
        <p
          className={`text-lg font-semibold ${
            metrics.utilizationPct >= 90
              ? "text-red-600"
              : metrics.utilizationPct >= 70
              ? "text-yellow-600"
              : "text-emerald-600"
          }`}
        >
          {metrics.utilizationPct}%
        </p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Overloaded</p>
        <p
          className={`text-lg font-semibold ${
            metrics.overloadedMembers > 0 ? "text-red-600" : "text-emerald-600"
          }`}
        >
          {metrics.overloadedMembers} member{metrics.overloadedMembers !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
}

/**
 * Team Dashboard showing all members with their capacity bars and workload status.
 */
export function TeamDashboard({ metrics, onMemberClick }: TeamDashboardProps) {
  if (metrics.members.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <CardTitle className="text-lg">Team Dashboard</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No team members found. Invite team members to start managing workloads.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <CardTitle className="text-lg">Team Dashboard</CardTitle>
          {metrics.overloadedMembers > 0 && (
            <Badge variant="destructive" className="ml-auto">
              {metrics.overloadedMembers} Overloaded
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <TeamSummary metrics={metrics} />

        <div className="grid gap-3 md:grid-cols-2">
          {metrics.members.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              onClick={onMemberClick ? () => onMemberClick(member.id) : undefined}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
