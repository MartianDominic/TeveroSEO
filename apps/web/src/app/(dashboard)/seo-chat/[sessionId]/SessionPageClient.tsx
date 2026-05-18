'use client';

/**
 * SEO Chat Session Page Client Component
 * Phase 98-08: Client-side rendering for individual chat session
 *
 * Manages:
 * - Topical map visibility based on user settings (D-03)
 * - Proposal slide-over open/close state
 * - Tab switching between chat and map views
 *
 * HYDRATION HANDLING:
 * Both useSeoChatDraftStore and useTopicalMapSettings use skipHydration: true
 * to prevent SSR/client state mismatch. We trigger rehydration on mount and
 * use safe defaults until hydration completes.
 */

import { useState, useEffect } from 'react';
import { ChatPanel } from '@/components/seo-chat/ChatPanel';
import { TopicalMapView } from '@/components/seo-chat/TopicalMapView';
import { ProposalSlideOver } from '@/components/seo-chat/ProposalSlideOver';
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from '@tevero/ui';
import { MessageSquare, Map, FileText } from 'lucide-react';
import { useTopicalMapSettings } from '@/components/seo-chat/TopicalMapSettings';
import { useSeoChatDraftStore } from '@/stores/seoChatDraftStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionPageClientProps {
  sessionId: string;
  workspaceId: string;
  prospectDomain?: string;
}

// ---------------------------------------------------------------------------
// Client Component
// ---------------------------------------------------------------------------

export function SessionPageClient({
  sessionId,
  workspaceId,
  prospectDomain,
}: SessionPageClientProps) {
  const [proposalOpen, setProposalOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const { isMapVisible } = useTopicalMapSettings();
  const { draft } = useSeoChatDraftStore();

  // Hydrate Zustand stores on mount (skipHydration: true prevents auto-hydration)
  useEffect(() => {
    // Rehydrate both persisted stores
    useSeoChatDraftStore.persist.rehydrate();
    useTopicalMapSettings.persist.rehydrate();
    setIsHydrated(true);
  }, []);

  // Use safe defaults until hydrated to prevent SSR/client mismatch
  const showMap = isHydrated ? isMapVisible(sessionId) : false;
  const hasKeywords = isHydrated ? draft.keywords.length > 0 : false;
  // Fixed operator precedence: (length ?? 0) > 0, not length ?? (0 > 0)
  const hasClusters = isHydrated
    ? (draft.analysisResults.keywordAnalysis?.clusters?.length ?? 0) > 0
    : false;

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Tab bar for chat vs map */}
        {showMap && hasClusters && (
          <Tabs defaultValue="chat" className="flex-1 flex flex-col">
            <div className="border-b px-4">
              <TabsList className="h-12">
                <TabsTrigger value="chat" className="gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Chat
                </TabsTrigger>
                <TabsTrigger value="map" className="gap-2">
                  <Map className="h-4 w-4" />
                  Topical Map
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="chat" className="flex-1 mt-0">
              <ChatPanel
                sessionId={sessionId}
                workspaceId={workspaceId}
                prospectDomain={prospectDomain}
              />
            </TabsContent>

            <TabsContent value="map" className="flex-1 mt-0">
              <TopicalMapView
                clusters={draft.analysisResults.keywordAnalysis?.clusters || []}
              />
            </TabsContent>
          </Tabs>
        )}

        {/* No tabs - just chat */}
        {(!showMap || !hasClusters) && (
          <ChatPanel
            sessionId={sessionId}
            workspaceId={workspaceId}
            prospectDomain={prospectDomain}
          />
        )}
      </div>

      {/* Floating proposal button */}
      {hasKeywords && (
        <div className="fixed bottom-6 right-6">
          <Button
            size="lg"
            onClick={() => setProposalOpen(true)}
            className="shadow-lg"
          >
            <FileText className="h-4 w-4 mr-2" />
            View Proposal ({draft.keywords.length})
          </Button>
        </div>
      )}

      {/* Proposal slide-over */}
      <ProposalSlideOver
        open={proposalOpen}
        onOpenChange={setProposalOpen}
        proposalId={draft.sessionId || undefined}
      />
    </div>
  );
}
