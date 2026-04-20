"use client";

import { useState, useCallback, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
} from "@tevero/ui";
import {
  Scale,
  ArrowRight,
  CheckCircle,
  Lightbulb,
  GripVertical,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
  TeamMetrics,
  TeamMemberWithAssignments,
  ClientAssignment,
  ReassignmentSuggestion,
} from "@/types/team";

interface WorkloadBalancerProps {
  metrics: TeamMetrics;
  onReassign: (clientId: string, toMemberId: string) => Promise<void>;
}

/**
 * Generate workload balancing suggestions.
 * Identifies overloaded members and suggests moving clients to underutilized members.
 */
function generateReassignmentSuggestions(
  metrics: TeamMetrics
): ReassignmentSuggestion[] {
  const suggestions: ReassignmentSuggestion[] = [];
  const { members } = metrics;

  // Sort members by utilization (highest first)
  const sortedByUtilization = [...members].sort(
    (a, b) => b.utilizationPct - a.utilizationPct
  );

  // Find overloaded members (>= 100%)
  const overloaded = sortedByUtilization.filter((m) => m.isOverloaded);
  // Find available members (< 80%)
  const available = sortedByUtilization.filter((m) => m.utilizationPct < 80);

  if (overloaded.length === 0 || available.length === 0) {
    return suggestions;
  }

  // For each overloaded member, suggest moving clients to available members
  for (const fromMember of overloaded) {
    // Calculate how many clients need to be moved
    const excessClients = fromMember.clientCount - fromMember.capacity;

    // Get clients sorted by assignment date (newest first - least established relationships)
    const clientsToMove = [...fromMember.assignments]
      .sort(
        (a, b) =>
          new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime()
      )
      .slice(0, Math.max(excessClients, 1));

    for (const client of clientsToMove) {
      // Find best available member (lowest utilization with capacity)
      const bestTarget = available.find(
        (m) => m.clientCount < m.capacity && m.id !== fromMember.id
      );

      if (bestTarget) {
        const fromUtil = fromMember.utilizationPct;
        const toUtil = bestTarget.utilizationPct;
        const avgBefore = (fromUtil + toUtil) / 2;

        // Calculate new utilizations after move
        const newFromUtil =
          ((fromMember.clientCount - 1) / fromMember.capacity) * 100;
        const newToUtil =
          ((bestTarget.clientCount + 1) / bestTarget.capacity) * 100;
        const avgAfter = (newFromUtil + newToUtil) / 2;

        // Impact score: how much more balanced the workload becomes
        const impactScore = Math.round(Math.abs(fromUtil - toUtil) - Math.abs(newFromUtil - newToUtil));

        suggestions.push({
          clientId: client.clientId,
          clientName: client.clientName,
          fromMemberId: fromMember.id,
          fromMemberName: fromMember.name,
          toMemberId: bestTarget.id,
          toMemberName: bestTarget.name,
          reason: `${fromMember.name} is at ${fromMember.utilizationPct}% capacity. ${bestTarget.name} has availability at ${bestTarget.utilizationPct}%.`,
          impactScore,
        });
      }
    }
  }

  // Sort by impact score (highest first)
  return suggestions.sort((a, b) => b.impactScore - a.impactScore).slice(0, 5);
}

/**
 * Draggable client item component.
 */
function DraggableClient({
  assignment,
  memberId,
}: {
  assignment: ClientAssignment;
  memberId: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `${memberId}:${assignment.clientId}`,
    data: {
      assignment,
      memberId,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-2 py-1.5 bg-background border rounded text-sm cursor-grab active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-3 w-3 text-muted-foreground" />
      <span className="truncate">{assignment.clientName}</span>
    </div>
  );
}

/**
 * Member column for drag-and-drop.
 */
function MemberColumn({
  member,
  children,
}: {
  member: TeamMemberWithAssignments;
  children: React.ReactNode;
}) {
  const getCapacityColor = (pct: number) => {
    if (pct >= 100) return "border-red-300 bg-red-50";
    if (pct >= 80) return "border-yellow-300 bg-yellow-50";
    return "border-emerald-300 bg-emerald-50";
  };

  return (
    <div
      className={`flex-1 min-w-[200px] max-w-[280px] border-2 rounded-lg p-3 ${getCapacityColor(
        member.utilizationPct
      )}`}
    >
      <div className="mb-3">
        <h4 className="font-medium text-sm">{member.name}</h4>
        <p className="text-xs text-muted-foreground">
          {member.clientCount} / {member.capacity} clients ({member.utilizationPct}%)
        </p>
      </div>
      <div className="space-y-2 min-h-[100px]">{children}</div>
    </div>
  );
}

/**
 * Suggestion card component.
 */
function SuggestionCard({
  suggestion,
  onApply,
  isApplying,
}: {
  suggestion: ReassignmentSuggestion;
  onApply: () => void;
  isApplying: boolean;
}) {
  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
      <Lightbulb className="h-5 w-5 text-yellow-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{suggestion.clientName}</p>
        <p className="text-xs text-muted-foreground">
          {suggestion.fromMemberName}
          <ArrowRight className="inline h-3 w-3 mx-1" />
          {suggestion.toMemberName}
        </p>
        <p className="text-xs text-muted-foreground mt-1">{suggestion.reason}</p>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={onApply}
        disabled={isApplying}
        className="flex-shrink-0"
      >
        {isApplying ? "Moving..." : "Apply"}
      </Button>
    </div>
  );
}

/**
 * Before/After capacity comparison.
 */
function CapacityComparison({
  metrics,
  pendingChanges,
}: {
  metrics: TeamMetrics;
  pendingChanges: Map<string, string>; // clientId -> newMemberId
}) {
  if (pendingChanges.size === 0) return null;

  // Calculate new utilizations
  const memberChanges = new Map<string, number>();
  for (const [clientId, toMemberId] of pendingChanges) {
    // Find current owner
    for (const member of metrics.members) {
      const hasClient = member.assignments.some((a) => a.clientId === clientId);
      if (hasClient) {
        memberChanges.set(member.id, (memberChanges.get(member.id) ?? 0) - 1);
      }
    }
    memberChanges.set(toMemberId, (memberChanges.get(toMemberId) ?? 0) + 1);
  }

  return (
    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <h4 className="text-sm font-medium text-blue-800 mb-2">
        Preview: {pendingChanges.size} change{pendingChanges.size !== 1 ? "s" : ""}
      </h4>
      <div className="space-y-1">
        {Array.from(memberChanges.entries()).map(([memberId, delta]) => {
          const member = metrics.members.find((m) => m.id === memberId);
          if (!member) return null;
          const newCount = member.clientCount + delta;
          const newPct = Math.round((newCount / member.capacity) * 100);
          return (
            <div key={memberId} className="flex items-center gap-2 text-xs">
              <span className="font-medium">{member.name}:</span>
              <span className="text-muted-foreground">
                {member.utilizationPct}%
              </span>
              <ArrowRight className="h-3 w-3" />
              <span
                className={
                  newPct >= 100
                    ? "text-red-600"
                    : newPct >= 80
                    ? "text-yellow-600"
                    : "text-emerald-600"
                }
              >
                {newPct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * WorkloadBalancer component for reassigning clients between team members.
 * Features drag-and-drop reassignment and AI-generated suggestions.
 */
export function WorkloadBalancer({
  metrics,
  onReassign,
}: WorkloadBalancerProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const suggestions = useMemo(
    () => generateReassignmentSuggestions(metrics),
    [metrics]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over || active.id === over.id) return;

      // Parse the IDs: format is "memberId:clientId"
      const [, clientId] = (active.id as string).split(":");
      const overId = over.id as string;

      // Check if dropped on a member column or another client
      let toMemberId: string;
      if (overId.includes(":")) {
        // Dropped on another client - get that client's member
        [toMemberId] = overId.split(":");
      } else {
        // Dropped on member column directly
        toMemberId = overId;
      }

      // Don't reassign to same member
      const activeData = active.data.current as { memberId: string };
      if (activeData.memberId === toMemberId) return;

      await onReassign(clientId, toMemberId);
    },
    [onReassign]
  );

  const handleApplySuggestion = useCallback(
    async (suggestion: ReassignmentSuggestion) => {
      setApplyingId(suggestion.clientId);
      try {
        await onReassign(suggestion.clientId, suggestion.toMemberId);
      } finally {
        setApplyingId(null);
      }
    },
    [onReassign]
  );

  // Get active item for drag overlay
  const activeAssignment = useMemo(() => {
    if (!activeId) return null;
    const [memberId, clientId] = activeId.split(":");
    const member = metrics.members.find((m) => m.id === memberId);
    return member?.assignments.find((a) => a.clientId === clientId);
  }, [activeId, metrics.members]);

  if (metrics.members.length < 2) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            <CardTitle className="text-lg">Workload Balancer</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Workload balancing requires at least 2 team members.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Scale className="h-5 w-5" />
          <CardTitle className="text-lg">Workload Balancer</CardTitle>
          {metrics.overloadedMembers === 0 && (
            <Badge variant="secondary" className="ml-auto bg-emerald-100 text-emerald-800">
              <CheckCircle className="h-3 w-3 mr-1" />
              Balanced
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
              Suggested Reassignments
            </h4>
            {suggestions.map((suggestion) => (
              <SuggestionCard
                key={`${suggestion.clientId}-${suggestion.toMemberId}`}
                suggestion={suggestion}
                onApply={() => handleApplySuggestion(suggestion)}
                isApplying={applyingId === suggestion.clientId}
              />
            ))}
          </div>
        )}

        {/* Drag and Drop Columns */}
        <div>
          <h4 className="text-sm font-medium mb-3">
            Drag clients between team members to reassign
          </h4>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 overflow-x-auto pb-4">
              {metrics.members.map((member) => (
                <SortableContext
                  key={member.id}
                  items={member.assignments.map(
                    (a) => `${member.id}:${a.clientId}`
                  )}
                  strategy={verticalListSortingStrategy}
                >
                  <MemberColumn member={member}>
                    {member.assignments.map((assignment) => (
                      <DraggableClient
                        key={assignment.clientId}
                        assignment={assignment}
                        memberId={member.id}
                      />
                    ))}
                    {member.assignments.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        No clients assigned
                      </p>
                    )}
                  </MemberColumn>
                </SortableContext>
              ))}
            </div>
            <DragOverlay>
              {activeAssignment && (
                <div className="flex items-center gap-2 px-2 py-1.5 bg-background border rounded text-sm shadow-lg">
                  <GripVertical className="h-3 w-3 text-muted-foreground" />
                  <span className="truncate">{activeAssignment.clientName}</span>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>
      </CardContent>
    </Card>
  );
}
