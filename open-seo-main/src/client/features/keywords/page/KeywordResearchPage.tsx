import { AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { useKeywordResearchController } from "@/client/features/keywords/state/useKeywordResearchController";
import type { KeywordResearchControllerInput } from "@/client/features/keywords/state/useKeywordResearchController";
import { KeywordResearchEmptyState } from "./KeywordResearchEmptyState";
import { KeywordResearchLoadingState } from "./KeywordResearchLoadingState";
import { KeywordResearchResults } from "./KeywordResearchResults";
import { KeywordResearchSearchBar } from "./KeywordResearchSearchBar";
import type { KeywordResearchControllerState } from "./types";

type Props = KeywordResearchControllerInput & {
  onShowRecentSearches: () => void;
};

export function KeywordResearchPage({ onShowRecentSearches, ...input }: Props) {
  const controller = useKeywordResearchController(input);
  const handleShowRecentSearches = () => {
    controller.resetView();
    onShowRecentSearches();
  };

  return (
    <div className="px-4 py-4 md:px-6 md:py-6 pb-24 md:pb-8 overflow-auto">
      <div className="mx-auto max-w-7xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Keyword Research</h1>
          <p className="text-sm text-foreground/70">
            Discover keyword ideas, search demand, and ranking opportunities.
          </p>
        </div>

        <KeywordResearchSearchBar controller={controller} />
        <KeywordResearchContent
          controller={controller}
          onShowRecentSearches={handleShowRecentSearches}
        />
        <KeywordSaveDialog controller={controller} />
      </div>
    </div>
  );
}

function KeywordResearchContent({
  controller,
  onShowRecentSearches,
}: {
  controller: KeywordResearchControllerState;
  onShowRecentSearches: () => void;
}) {
  const recentSearchesButton = controller.hasSearched ? (
    <div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-2 px-0 text-foreground/70 hover:bg-transparent"
        onClick={onShowRecentSearches}
      >
        <ArrowLeft className="size-4" />
        Recent searches
      </Button>
    </div>
  ) : null;

  if (controller.isLoading) {
    return <KeywordResearchLoadingState />;
  }

  if (controller.researchError) {
    return (
      <div className="space-y-4 pt-1">
        {recentSearchesButton}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-xl rounded-xl border border-error/30 bg-error/10 p-5 text-destructive space-y-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <p className="text-sm">{controller.researchError}</p>
            </div>
            <Button
              size="sm"
              onClick={() => controller.onSearch()}
            >
              Try again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (controller.rows.length === 0) {
    return (
      <div className="space-y-4 pt-1">
        {recentSearchesButton}
        <KeywordResearchEmptyState controller={controller} />
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-1">
      {recentSearchesButton}
      <KeywordResearchResults controller={controller} />
    </div>
  );
}

function KeywordSaveDialog({
  controller,
}: {
  controller: KeywordResearchControllerState;
}) {
  return (
    <Dialog
      open={controller.showSaveDialog}
      onOpenChange={(open) => !open && controller.setShowSaveDialog(false)}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save {controller.selectedRows.size} Keywords</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground text-sm">
          These keywords will be saved to your current project.
        </p>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => controller.setShowSaveDialog(false)}
          >
            Cancel
          </Button>
          <Button onClick={controller.confirmSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
