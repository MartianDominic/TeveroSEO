/**
 * Resume analysis prompt dialog.
 *
 * Shown when user has an incomplete analysis checkpoint.
 * Allows resuming or starting fresh.
 *
 * @module client/features/keywords/components/ResumeAnalysisPrompt
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/client/components/ui/alert-dialog";
import { formatDistanceToNow } from "date-fns";
import type { AnalysisCheckpoint } from "../lib/checkpoint-manager";

interface ResumeAnalysisPromptProps {
  checkpoint: AnalysisCheckpoint;
  onResume: () => void;
  onDiscard: () => void;
  open?: boolean;
}

const STAGE_LABELS: Record<AnalysisCheckpoint["stage"], string> = {
  constraints: "Extracting constraints",
  embedding: "Generating embeddings",
  clustering: "Clustering keywords",
  scoring: "Scoring clusters",
  labeling: "Generating labels",
  complete: "Complete",
};

export function ResumeAnalysisPrompt({
  checkpoint,
  onResume,
  onDiscard,
  open = true,
}: ResumeAnalysisPromptProps) {
  const timeAgo = formatDistanceToNow(checkpoint.timestamp, { addSuffix: true });
  const stageLabel = STAGE_LABELS[checkpoint.stage] ?? checkpoint.stage;

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Resume Previous Analysis?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>You have an unfinished analysis from {timeAgo}.</p>
              <div className="rounded-md bg-muted p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stage:</span>
                  <span className="font-medium">{stageLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Progress:</span>
                  <span className="font-medium">{checkpoint.progress}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Keywords:</span>
                  <span className="font-medium">{checkpoint.keywords.length}</span>
                </div>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onDiscard}>Start Fresh</AlertDialogCancel>
          <AlertDialogAction onClick={onResume}>Resume Analysis</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
