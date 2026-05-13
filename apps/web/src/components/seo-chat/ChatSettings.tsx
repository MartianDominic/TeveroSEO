'use client';

/**
 * ChatSettings Component
 * Phase 98-08: Settings panel for SEO Chat preferences
 *
 * Features:
 * - Topical map display toggle (D-03)
 * - Auto-execute tool preferences
 * - Notification settings
 * - Draft clearing (danger zone)
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Switch,
  Separator,
  Button,
} from '@tevero/ui';
import { TopicalMapSettings, useTopicalMapSettings } from './TopicalMapSettings';
import { useSeoChatDraftStore } from '@/stores/seoChatDraftStore';
import { Trash2, Map, Bell, Zap } from 'lucide-react';

export function ChatSettings() {
  const { mode, setMode } = useTopicalMapSettings();
  const { clearDraft } = useSeoChatDraftStore();

  return (
    <div className="space-y-6">
      {/* Topical Map Settings - per D-03 */}
      <TopicalMapSettings mode={mode} onModeChange={setMode} />

      {/* Auto-execute settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Tool Execution
          </CardTitle>
          <CardDescription className="text-xs">
            Control how SEO analysis tools execute during chat
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="auto-domain">Auto-analyze domains</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Automatically run domain health check when a domain is mentioned
              </p>
            </div>
            <Switch id="auto-domain" defaultChecked />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="auto-feasibility">Auto-check feasibility</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Automatically check feasibility when keywords are analyzed
              </p>
            </div>
            <Switch id="auto-feasibility" defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* Notification settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </CardTitle>
          <CardDescription className="text-xs">
            Get notified about proposal activity
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="notify-view">Proposal viewed</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Notify when a prospect views your proposal
              </p>
            </div>
            <Switch id="notify-view" defaultChecked />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="notify-convert">Prospect converted</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Notify when a prospect accepts a proposal
              </p>
            </div>
            <Switch id="notify-convert" defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2 text-destructive">
            <Trash2 className="h-4 w-4" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label>Clear proposal draft</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Remove all keywords and analysis from the current draft
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (confirm('Clear all draft data? This cannot be undone.')) {
                  clearDraft();
                }
              }}
            >
              Clear Draft
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
