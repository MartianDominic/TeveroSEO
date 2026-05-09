/**
 * Contracted Scope View
 * Phase 89-06: Progress Tracking UI
 *
 * Main component for displaying contracted keywords and progress.
 */
"use client";

import { useEffect, useState } from "react";

import { CheckCircle, Clock, AlertCircle, FileQuestion } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { GoalProgressCard, type GoalProgressCardProps } from "./GoalProgressCard";


interface KeywordDistribution {
  total: number;
  rankedTop10: number;
  inProgress: number;
  notStarted: number;
}

interface OutOfScopeRequest {
  id: string;
  keywordText: string;
  status: string;
  requestedAt: string;
  requestedBy: string | null;
}

interface ScopeData {
  contract: {
    id: string;
    title: string;
    status: string;
    expiresAt: string | null;
  };
  keywords: {
    total: number;
    distribution: KeywordDistribution;
  };
  goals: GoalProgressCardProps[];
  outOfScope: {
    pendingCount: number;
    requests: OutOfScopeRequest[];
  };
}

export interface ContractedScopeViewProps {
  contractId: string;
  apiBaseUrl?: string;
}

export function ContractedScopeView({
  contractId,
  apiBaseUrl = "",
}: ContractedScopeViewProps) {
  const [data, setData] = useState<ScopeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const response = await fetch(`${apiBaseUrl}/api/portal/scope/${contractId}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch scope data: ${response.status}`);
        }

        const result = await response.json();
        if (result.success && result.data) {
          setData(result.data);
        } else {
          throw new Error(result.error || "Unknown error");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [contractId, apiBaseUrl]);

  if (loading) {
    return <ScopeViewSkeleton />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const { distribution } = data.keywords;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Contracted Scope</h2>
        <p className="text-muted-foreground">
          {distribution.total} keywords in contract
        </p>
      </div>

      {/* Keyword Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Keyword Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Ranked Top 10 */}
          <StatusBar
            icon={<CheckCircle className="h-4 w-4 text-green-600" />}
            label="Ranked Top 10"
            count={distribution.rankedTop10}
            total={distribution.total}
            color="bg-green-500"
          />

          {/* In Progress */}
          <StatusBar
            icon={<Clock className="h-4 w-4 text-blue-600" />}
            label="In Progress"
            count={distribution.inProgress}
            total={distribution.total}
            color="bg-blue-500"
          />

          {/* Not Started */}
          <StatusBar
            icon={<AlertCircle className="h-4 w-4 text-gray-400" />}
            label="Not Started"
            count={distribution.notStarted}
            total={distribution.total}
            color="bg-gray-300"
          />
        </CardContent>
      </Card>

      {/* Out of Scope Requests */}
      {data.outOfScope.pendingCount > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileQuestion className="h-5 w-5" />
                Out of Scope Requests
              </CardTitle>
              <Badge variant="outline">{data.outOfScope.pendingCount} pending</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Keywords requested outside original contract
            </p>
            <div className="space-y-2">
              {data.outOfScope.requests.slice(0, 5).map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <span className="font-medium">{req.keywordText}</span>
                  <Badge variant="secondary">{req.status}</Badge>
                </div>
              ))}
            </div>
            {data.outOfScope.requests.length > 5 && (
              <Button variant="link" className="mt-2 p-0">
                View all {data.outOfScope.requests.length} requests
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Goals */}
      {data.goals.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Contract Goals</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {data.goals.map((goal) => (
              <GoalProgressCard key={goal.id} {...goal} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface StatusBarProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  total: number;
  color: string;
}

function StatusBar({ icon, label, count, total, color }: StatusBarProps) {
  const percent = total > 0 ? (count / total) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium">{label}</span>
        </div>
        <span className="text-lg font-bold">{count}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-300`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function ScopeViewSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Card>
        <CardContent className="py-6 space-y-4">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
