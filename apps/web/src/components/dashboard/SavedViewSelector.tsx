"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
} from "@tevero/ui";
import { Bookmark, Plus, Trash2, Star, Check } from "lucide-react";
import type { SavedView, ClientTableFilters } from "@/lib/dashboard/types";
import {
  createSavedView,
  deleteSavedView,
  setDefaultView
} from "@/app/(shell)/dashboard/actions";

interface SavedViewSelectorProps {
  views: SavedView[];
  currentViewId: string | null;
  currentFilters: ClientTableFilters;
  onViewChange: (view: SavedView) => void;
}

export function SavedViewSelector({
  views,
  currentViewId,
  currentFilters,
  onViewChange,
}: SavedViewSelectorProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newViewName.trim()) return;

    try {
      const newView = await createSavedView(newViewName.trim(), currentFilters);
      setNewViewName("");
      setIsCreating(false);
      router.refresh();
      onViewChange(newView);
    } catch (error) {
      console.error("Failed to create view:", error);
    }
  };

  const handleDelete = async (viewId: string) => {
    if (viewId.startsWith("default-")) return; // Can't delete defaults

    setIsDeleting(viewId);
    try {
      await deleteSavedView(viewId);
      router.refresh();
    } catch (error) {
      console.error("Failed to delete view:", error);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleSetDefault = async (viewId: string) => {
    try {
      await setDefaultView(viewId);
      router.refresh();
    } catch (error) {
      console.error("Failed to set default:", error);
    }
  };

  const currentView = views.find(v => v.id === currentViewId);

  return (
    <div className="flex items-center gap-2">
      <Select
        value={currentViewId ?? "default-all"}
        onValueChange={(viewId) => {
          const view = views.find(v => v.id === viewId);
          if (view) onViewChange(view);
        }}
      >
        <SelectTrigger className="w-[200px]">
          <div className="flex items-center gap-2">
            <Bookmark className="h-4 w-4" />
            <SelectValue placeholder="Select view" />
          </div>
        </SelectTrigger>
        <SelectContent>
          {views.map((view) => (
            <SelectItem key={view.id} value={view.id}>
              <div className="flex items-center gap-2">
                {view.isDefault && <Star className="h-3 w-3 text-yellow-500" />}
                <span>{view.name}</span>
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
          <div className="space-y-4 pt-4">
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
              <Label>Current Filters</Label>
              <div className="flex flex-wrap gap-2">
                {currentFilters.search && (
                  <Badge variant="secondary">Search: {currentFilters.search}</Badge>
                )}
                {currentFilters.healthRange[0] > 0 || currentFilters.healthRange[1] < 100 ? (
                  <Badge variant="secondary">
                    Health: {currentFilters.healthRange[0]}-{currentFilters.healthRange[1]}
                  </Badge>
                ) : null}
                {currentFilters.hasAlerts !== null && (
                  <Badge variant="secondary">
                    {currentFilters.hasAlerts ? "With Alerts" : "No Alerts"}
                  </Badge>
                )}
                {currentFilters.connectionStatus.length > 0 && (
                  <Badge variant="secondary">
                    Status: {currentFilters.connectionStatus.join(", ")}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCreating(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={!newViewName.trim()}>
                Save View
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {currentView && !currentView.id.startsWith("default-") && (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleSetDefault(currentView.id)}
            disabled={currentView.isDefault}
            title="Set as default"
          >
            {currentView.isDefault ? (
              <Check className="h-4 w-4 text-yellow-500" />
            ) : (
              <Star className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(currentView.id)}
            disabled={isDeleting === currentView.id}
            title="Delete view"
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      )}
    </div>
  );
}
