"use client";

import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  Switch,
} from "@tevero/ui";
import { Bookmark, Plus, Trash2, Star, Check, Share2, Loader2 } from "lucide-react";
import type { SavedView, ViewConfig } from "@/types/saved-views";
import { useSavedViews } from "@/hooks/useSavedViews";

interface SavedViewSelectorProps {
  /** Workspace ID for fetching views */
  workspaceId: string;
  /** Currently active view configuration */
  currentConfig: ViewConfig;
  /** Callback when a saved view is selected */
  onViewSelect: (config: ViewConfig) => void;
  /** Currently selected view ID (optional) */
  selectedViewId?: string | null;
}

export function SavedViewSelector({
  workspaceId,
  currentConfig,
  onViewSelect,
  selectedViewId,
}: SavedViewSelectorProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [newViewDescription, setNewViewDescription] = useState("");
  const [isShared, setIsShared] = useState(false);

  const {
    views,
    defaultView,
    isLoading,
    createView,
    isCreating: isSubmitting,
    deleteView,
    isDeleting,
    setDefault,
    isSettingDefault,
  } = useSavedViews({ workspaceId });

  const handleCreate = async () => {
    if (!newViewName.trim()) return;

    try {
      const newView = await createView({
        name: newViewName.trim(),
        description: newViewDescription.trim() || undefined,
        config: currentConfig,
        isShared,
      });
      setNewViewName("");
      setNewViewDescription("");
      setIsShared(false);
      setIsCreating(false);
      onViewSelect(newView.config);
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleDelete = async (viewId: string) => {
    if (viewId.startsWith("default-")) return; // Can't delete defaults

    try {
      await deleteView(viewId);
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleSetDefault = async (viewId: string) => {
    try {
      await setDefault(viewId);
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleViewChange = (viewId: string) => {
    const view = views.find((v) => v.id === viewId);
    if (view) {
      onViewSelect(view.config);
    }
  };

  const selectedView = selectedViewId
    ? views.find((v) => v.id === selectedViewId)
    : defaultView;

  // Count active filters for badge display
  const activeFilters = Object.entries(currentConfig.filters).filter(
    ([, value]) => value !== undefined && value !== null && value !== ""
  );

  return (
    <div className="flex items-center gap-2">
      <Select
        value={selectedViewId ?? defaultView?.id ?? "default-all"}
        onValueChange={handleViewChange}
        disabled={isLoading}
      >
        <SelectTrigger className="w-[200px]">
          <div className="flex items-center gap-2">
            <Bookmark className="h-4 w-4" />
            <SelectValue placeholder={isLoading ? "Loading..." : "Select view"} />
          </div>
        </SelectTrigger>
        <SelectContent>
          {views.length === 0 && !isLoading && (
            <SelectItem value="default-all" disabled>
              No saved views
            </SelectItem>
          )}
          {views.map((view) => (
            <SelectItem key={view.id} value={view.id}>
              <div className="flex items-center gap-2">
                {view.isDefault && (
                  <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                )}
                {view.isShared && (
                  <Share2 className="h-3 w-3 text-blue-500" />
                )}
                <span className="truncate">{view.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            <Plus className="h-4 w-4" />
            Save View
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Current View</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="view-name">View Name</Label>
              <Input
                id="view-name"
                placeholder="e.g., My Active Clients"
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="view-description">Description (optional)</Label>
              <Input
                id="view-description"
                placeholder="e.g., Clients with active alerts"
                value={newViewDescription}
                onChange={(e) => setNewViewDescription(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <Label htmlFor="share-view" className="text-sm font-medium">
                  Share with team
                </Label>
                <p className="text-xs text-muted-foreground">
                  Team members can see and use this view
                </p>
              </div>
              <Switch
                id="share-view"
                checked={isShared}
                onCheckedChange={setIsShared}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Saving configuration</Label>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {currentConfig.columns.length} columns
                </Badge>
                {activeFilters.length > 0 && (
                  <Badge variant="secondary">
                    {activeFilters.length} filter{activeFilters.length > 1 ? "s" : ""}
                  </Badge>
                )}
                {currentConfig.sortBy && (
                  <Badge variant="secondary">
                    Sort: {currentConfig.sortBy} {currentConfig.sortDir}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreating(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newViewName.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save View"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedView && !selectedView.id.startsWith("default-") && (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleSetDefault(selectedView.id)}
            disabled={selectedView.isDefault || isSettingDefault}
            title="Set as default"
          >
            {selectedView.isDefault ? (
              <Check className="h-4 w-4 text-yellow-500" />
            ) : isSettingDefault ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Star className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(selectedView.id)}
            disabled={isDeleting}
            title="Delete view"
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 text-red-500" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
