/**
 * SEO Chat Session Page
 * Phase 98-08: Individual chat session with optional topical map
 *
 * Server component that verifies session ownership, then delegates to client component.
 * Co-located SessionPageClient handles client-side state (topical map, proposal drawer).
 */

import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { db, seoChatSessions } from '@/db';
import { eq, and } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Page Props
// ---------------------------------------------------------------------------

interface SessionPageProps {
  params: { sessionId: string };
}

// ---------------------------------------------------------------------------
// Server Component
// ---------------------------------------------------------------------------

export default async function SessionPage({ params }: SessionPageProps) {
  const { userId, orgId } = await auth();
  if (!userId) redirect('/sign-in');

  // Use organization ID as workspace, falling back to user ID for personal workspace
  const workspaceId = orgId || userId;
  const { sessionId } = params;

  // Verify session belongs to workspace (T-98-17 mitigation)
  const session = await db.query.seoChatSessions.findFirst({
    where: and(
      eq(seoChatSessions.id, sessionId),
      eq(seoChatSessions.workspaceId, workspaceId)
    ),
  });

  if (!session) {
    notFound();
  }

  return (
    <SessionPageClient
      sessionId={sessionId}
      workspaceId={workspaceId}
      prospectDomain={session.prospectDomain || undefined}
    />
  );
}

// ---------------------------------------------------------------------------
// Co-located Client Component
// ---------------------------------------------------------------------------

/**
 * SessionPageClient
 * Client wrapper for session page that manages:
 * - Topical map visibility based on user settings (D-03)
 * - Proposal slide-over open/close state
 * - Tab switching between chat and map views
 *
 * Co-located to keep session page self-contained.
 * All rendering delegated to ChatPanel, TopicalMapView, ProposalSlideOver.
 */
'use client';

import { useState } from 'react';
import { ChatPanel } from '@/components/seo-chat/ChatPanel';
import { TopicalMapView } from '@/components/seo-chat/TopicalMapView';
import { ProposalSlideOver } from '@/components/seo-chat/ProposalSlideOver';
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from '@tevero/ui';
import { MessageSquare, Map, FileText } from 'lucide-react';
import { useTopicalMapSettings } from '@/components/seo-chat/TopicalMapSettings';
import { useSeoChatDraftStore } from '@/stores/seoChatDraftStore';

interface SessionPageClientProps {
  sessionId: string;
  workspaceId: string;
  prospectDomain?: string;
}

export function SessionPageClient({
  sessionId,
  workspaceId,
  prospectDomain,
}: SessionPageClientProps) {
  const [proposalOpen, setProposalOpen] = useState(false);
  const { isMapVisible } = useTopicalMapSettings();
  const { draft } = useSeoChatDraftStore();

  const showMap = isMapVisible(sessionId);
  const hasKeywords = draft.keywords.length > 0;
  const hasClusters = draft.analysisResults.keywordAnalysis?.clusters?.length ?? 0 > 0;

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
                onClusterClick={(cluster) => {
                  // Could open cluster detail modal
                  console.log('Cluster clicked:', cluster);
                }}
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
