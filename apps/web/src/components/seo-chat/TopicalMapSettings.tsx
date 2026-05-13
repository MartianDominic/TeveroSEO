/**
 * Topical Map Settings
 * Phase 98-06: 3-level toggle for map display (D-03)
 *
 * Controls when topical map visualization appears:
 * - Always Off: Never show map
 * - Per-Prospect: Toggle per conversation (default)
 * - Always On: Show for all conversations
 */

'use client';

import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Map, MapPin, MapPinOff } from 'lucide-react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TopicalMapMode = 'off' | 'per-prospect' | 'always';

interface TopicalMapSettingsProps {
  mode: TopicalMapMode;
  onModeChange: (mode: TopicalMapMode) => void;
}

/**
 * Topical Map Settings Component.
 *
 * Provides 3-level toggle for controlling map visibility per D-03.
 */
export function TopicalMapSettings({
  mode,
  onModeChange,
}: TopicalMapSettingsProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Map className="h-4 w-4" />
          Topical Map Display
        </CardTitle>
        <CardDescription className="text-xs">
          Control when the topical map visualization appears
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={mode}
          onValueChange={(value) => onModeChange(value as TopicalMapMode)}
          className="space-y-2"
        >
          {/* Per D-03: 3-level toggle */}
          <div className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="off" id="map-off" />
            <Label
              htmlFor="map-off"
              className="flex-1 cursor-pointer flex items-center gap-2"
            >
              <MapPinOff className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Always Off</p>
                <p className="text-xs text-muted-foreground">
                  Never show topical map
                </p>
              </div>
            </Label>
          </div>

          <div className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="per-prospect" id="map-per-prospect" />
            <Label
              htmlFor="map-per-prospect"
              className="flex-1 cursor-pointer flex items-center gap-2"
            >
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Per-Prospect</p>
                <p className="text-xs text-muted-foreground">
                  Toggle per conversation
                </p>
              </div>
            </Label>
          </div>

          <div className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="always" id="map-always" />
            <Label
              htmlFor="map-always"
              className="flex-1 cursor-pointer flex items-center gap-2"
            >
              <Map className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Always On</p>
                <p className="text-xs text-muted-foreground">
                  Show for all conversations
                </p>
              </div>
            </Label>
          </div>
        </RadioGroup>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Zustand Store for Persisting Topical Map Preference
// ---------------------------------------------------------------------------

interface TopicalMapSettingsStore {
  /** Global mode setting */
  mode: TopicalMapMode;
  /** Per-prospect enabled state (sessionId → enabled) */
  perProspectEnabled: Record<string, boolean>;
  /** Set global mode */
  setMode: (mode: TopicalMapMode) => void;
  /** Set per-prospect enabled state */
  setPerProspectEnabled: (sessionId: string, enabled: boolean) => void;
  /** Check if map is visible for given session */
  isMapVisible: (sessionId: string) => boolean;
}

/**
 * Topical Map Settings Store.
 *
 * Persists user preference in localStorage. Per-prospect mode stores
 * enabled state per sessionId.
 */
export const useTopicalMapSettings = create<TopicalMapSettingsStore>()(
  persist(
    (set, get) => ({
      mode: 'per-prospect', // default per D-03
      perProspectEnabled: {},
      setMode: (mode) => set({ mode }),
      setPerProspectEnabled: (sessionId, enabled) =>
        set((state) => ({
          perProspectEnabled: {
            ...state.perProspectEnabled,
            [sessionId]: enabled,
          },
        })),
      isMapVisible: (sessionId) => {
        const { mode, perProspectEnabled } = get();
        if (mode === 'off') return false;
        if (mode === 'always') return true;
        return perProspectEnabled[sessionId] ?? false; // per-prospect default off
      },
    }),
    {
      name: 'seo-chat-topical-map-settings',
      partialize: (state) => ({
        mode: state.mode,
        perProspectEnabled: state.perProspectEnabled,
      }),
    }
  )
);
