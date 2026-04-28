import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { getPipelineStatus } from "@/server/api/pipeline/status";
import { startPipeline } from "@/server/api/pipeline/start";
import { pausePipeline } from "@/server/api/pipeline/pause";
import { resumePipeline } from "@/server/api/pipeline/resume";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Progress } from "@/client/components/ui/progress";
import { Badge } from "@/client/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/client/components/ui/alert";
import { formatDistanceToNow } from "date-fns";
import { PlayIcon, PauseIcon, RefreshCwIcon, AlertTriangleIcon, CheckCircleIcon, ClockIcon } from "lucide-react";

export const Route = createFileRoute("/pipeline/dashboard")({
  component: PipelineDashboard,
  loader: async () => {
    return getPipelineStatus({});
  },
});

interface PipelineStatus {
  status: "idle" | "running" | "paused" | "verifying" | "error";
  currentPhase: string | null;
  lastCompletedPlan: string | null;
  progress: {
    completedPlans: number;
    totalPlans: number;
    percentage: number;
  };
  eta: {
    eta: string;
    remainingMinutes: number;
    confidence: "low" | "medium" | "high";
  };
  phases: Array<{
    number: number;
    name: string;
    slug: string;
    status: "not_started" | "in_progress" | "complete";
    planCount: number;
  }>;
}

interface Blocker {
  type: string;
  message: string;
  suggestedAction: string;
  recoverable: boolean;
  planId: string;
  phaseNumber: number;
}

function PipelineDashboard() {
  const initialStatus = Route.useLoaderData();
  const [status, setStatus] = useState<PipelineStatus>(initialStatus);
  const [blocker, setBlocker] = useState<Blocker | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Socket.IO connection
  useEffect(() => {
    const newSocket = io(window.location.origin, {
      transports: ["websocket", "polling"],
    });

    newSocket.on("connect", () => {
      // Join workspace room (workspace ID would come from auth context)
      newSocket.emit("join-workspace", "default");
    });

    newSocket.on("activity:new", (event) => {
      if (event.type === "pipeline:progress") {
        setStatus((prev) => ({
          ...prev,
          status: event.data.status,
          currentPhase: event.data.currentPhase?.slug ?? null,
          progress: event.data.progress,
          eta: event.data.eta,
        }));
      } else if (event.type === "pipeline:blocker") {
        setBlocker({
          type: event.data.blocker.type,
          message: event.data.blocker.message,
          suggestedAction: event.data.blocker.suggestedAction,
          recoverable: event.data.blocker.recoverable,
          planId: event.data.planId,
          phaseNumber: event.data.phaseNumber,
        });
      } else if (event.type === "pipeline:plan-complete" || event.type === "pipeline:phase-complete") {
        // Refresh full status on completion events
        refreshStatus();
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const refreshStatus = async () => {
    const newStatus = await getPipelineStatus({});
    setStatus(newStatus);
  };

  const handleStart = async () => {
    setIsLoading(true);
    try {
      await startPipeline({});
      await refreshStatus();
    } finally {
      setIsLoading(false);
    }
  };

  const handlePause = async () => {
    setIsLoading(true);
    try {
      await pausePipeline({});
      await refreshStatus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResume = async () => {
    setIsLoading(true);
    setBlocker(null);
    try {
      await resumePipeline({});
      await refreshStatus();
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case "running":
        return <Badge className="bg-green-500">Running</Badge>;
      case "paused":
        return <Badge className="bg-yellow-500">Paused</Badge>;
      case "error":
        return <Badge className="bg-red-500">Error</Badge>;
      case "verifying":
        return <Badge className="bg-blue-500">Verifying</Badge>;
      default:
        return <Badge variant="secondary">Idle</Badge>;
    }
  };

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence) {
      case "high":
        return <Badge className="bg-green-100 text-green-800">High confidence</Badge>;
      case "medium":
        return <Badge className="bg-yellow-100 text-yellow-800">Medium confidence</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">Low confidence</Badge>;
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pipeline Dashboard</h1>
          <p className="text-muted-foreground">Autonomous execution monitoring</p>
        </div>
        <div className="flex gap-2">
          {status.status === "idle" && (
            <Button onClick={handleStart} disabled={isLoading}>
              <PlayIcon className="w-4 h-4 mr-2" />
              Start Pipeline
            </Button>
          )}
          {status.status === "running" && (
            <Button onClick={handlePause} variant="outline" disabled={isLoading}>
              <PauseIcon className="w-4 h-4 mr-2" />
              Pause
            </Button>
          )}
          {(status.status === "paused" || status.status === "error") && (
            <Button onClick={handleResume} disabled={isLoading}>
              <PlayIcon className="w-4 h-4 mr-2" />
              Resume
            </Button>
          )}
          <Button variant="ghost" onClick={refreshStatus}>
            <RefreshCwIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Blocker Alert */}
      {blocker && (
        <Alert variant="destructive">
          <AlertTriangleIcon className="h-4 w-4" />
          <AlertTitle>Pipeline Blocked</AlertTitle>
          <AlertDescription>
            <p className="font-medium">{blocker.message}</p>
            <p className="text-sm mt-1">{blocker.suggestedAction}</p>
            <p className="text-xs mt-2">Phase {blocker.phaseNumber}, Plan {blocker.planId}</p>
          </AlertDescription>
        </Alert>
      )}

      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Progress</CardTitle>
            {getStatusBadge(status.status)}
          </div>
          <CardDescription>
            {status.progress.completedPlans} of {status.progress.totalPlans} plans completed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={status.progress.percentage} className="h-4" />
          <div className="flex justify-between mt-2 text-sm text-muted-foreground">
            <span>{status.progress.percentage}% complete</span>
            {status.eta && (
              <div className="flex items-center gap-2">
                <ClockIcon className="w-4 h-4" />
                <span>ETA: {formatDistanceToNow(new Date(status.eta.eta))}</span>
                {getConfidenceBadge(status.eta.confidence)}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Phase List */}
      <Card>
        <CardHeader>
          <CardTitle>Phases</CardTitle>
          <CardDescription>Execution order and status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {status.phases.map((phase) => (
              <div
                key={phase.number}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  phase.status === "complete"
                    ? "bg-green-50 border-green-200"
                    : phase.status === "in_progress"
                    ? "bg-blue-50 border-blue-200"
                    : "bg-gray-50 border-gray-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  {phase.status === "complete" ? (
                    <CheckCircleIcon className="w-5 h-5 text-green-500" />
                  ) : phase.status === "in_progress" ? (
                    <RefreshCwIcon className="w-5 h-5 text-blue-500 animate-spin" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                  )}
                  <div>
                    <p className="font-medium">Phase {phase.number}: {phase.name}</p>
                    <p className="text-sm text-muted-foreground">{phase.planCount} plans</p>
                  </div>
                </div>
                <Badge variant={phase.status === "complete" ? "default" : "secondary"}>
                  {phase.status.replace("_", " ")}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Last Activity */}
      {status.lastCompletedPlan && (
        <Card>
          <CardHeader>
            <CardTitle>Last Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-mono">{status.lastCompletedPlan}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
