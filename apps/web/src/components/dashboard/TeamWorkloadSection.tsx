import { Card, CardContent, CardHeader, CardTitle, Badge } from "@tevero/ui";
import { Users, AlertTriangle } from "lucide-react";
import type { TeamMember } from "@/lib/dashboard/types";

interface TeamWorkloadSectionProps {
  members: TeamMember[];
}

export function TeamWorkloadSection({ members }: TeamWorkloadSectionProps) {
  if (members.length === 0) {
    return null; // Don't show for solo operators
  }

  const getCapacityColor = (count: number, max: number) => {
    const pct = count / max;
    if (pct >= 0.9) return "bg-red-500";
    if (pct >= 0.7) return "bg-yellow-500";
    return "bg-emerald-500";
  };

  const isOverloaded = (count: number, max: number) => count >= max * 0.9;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <CardTitle className="text-lg">Team Workload</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {members.map((member) => (
          <div key={member.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {member.avatarUrl ? (
                  <img
                    src={member.avatarUrl}
                    alt={member.name}
                    className="h-6 w-6 rounded-full"
                  />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="font-medium text-sm">{member.name}</span>
                {isOverloaded(member.clientCount, member.maxCapacity) && (
                  <Badge variant="destructive" className="text-xs gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Overloaded
                  </Badge>
                )}
              </div>
              <span className="text-sm text-muted-foreground">
                {member.clientCount} / {member.maxCapacity} clients
              </span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${getCapacityColor(member.clientCount, member.maxCapacity)}`}
                style={{ width: `${Math.min((member.clientCount / member.maxCapacity) * 100, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
