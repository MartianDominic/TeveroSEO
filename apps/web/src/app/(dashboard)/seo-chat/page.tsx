'use client';

/**
 * SEO Chat Landing Page
 * Phase 98-08: Main entry point for SEO Chat with session list sidebar
 *
 * Co-located client components:
 * - NewSessionButton: Dialog for creating new chat sessions
 * - SessionListSkeleton: Loading state for session list
 */

import { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SessionList } from '@/components/seo-chat/SessionList';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
} from '@tevero/ui';
import { Plus, MessageSquare, Settings } from 'lucide-react';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Main Page Component (Client)
// ---------------------------------------------------------------------------

export default function SeoChatPage() {
  // This page is client-side only since we need session list state
  // Real workspace ID would come from useAuth() or similar
  const workspaceId = 'workspace-1'; // TODO: Get from auth context

  return (
    <div className="flex h-full">
      {/* Sidebar with session list */}
      <aside className="w-80 border-r bg-muted/30 flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              SEO Chat
            </h1>
            <Link href="/seo-chat/settings">
              <Button variant="ghost" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <NewSessionButton workspaceId={workspaceId} />
        </div>

        <div className="flex-1 overflow-hidden">
          <Suspense fallback={<SessionListSkeleton />}>
            <SessionList workspaceId={workspaceId} />
          </Suspense>
        </div>
      </aside>

      {/* Main content area - empty state */}
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
          <h2 className="text-xl font-semibold mb-2">Start a New Conversation</h2>
          <p className="text-muted-foreground mb-6">
            Enter a prospect&apos;s domain to analyze their SEO potential and generate a proposal.
          </p>
          <NewSessionButton workspaceId={workspaceId} variant="default" />
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Co-located Client Components
// ---------------------------------------------------------------------------

/**
 * NewSessionButton
 * Dialog for creating new SEO chat sessions with domain input.
 *
 * Co-located here to avoid separate file for small interactive component.
 * Creates session via POST /api/seo-chat/sessions and redirects to /seo-chat/[sessionId].
 */
interface NewSessionButtonProps {
  workspaceId: string;
  variant?: 'default' | 'outline' | 'ghost';
}

function NewSessionButton({ workspaceId, variant = 'outline' }: NewSessionButtonProps) {
  const [open, setOpen] = useState(false);
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleCreate = async () => {
    if (!domain.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/seo-chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, prospectDomain: domain.trim() }),
      });

      if (!res.ok) throw new Error('Failed to create session');

      const { sessionId } = await res.json();
      router.push(`/seo-chat/${sessionId}`);
      setOpen(false);
    } catch (error) {
      console.error('Failed to create session:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          New Chat
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New SEO Chat</DialogTitle>
          <DialogDescription>
            Enter the prospect&apos;s domain to start analyzing their SEO potential.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="domain">Prospect Domain</Label>
          <Input
            id="domain"
            placeholder="example.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            className="mt-2"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={loading || !domain.trim()}>
            {loading ? 'Creating...' : 'Start Chat'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * SessionListSkeleton
 * Loading skeleton for session list.
 *
 * Pure presentational component, co-located to keep loading states near their usage.
 */
function SessionListSkeleton() {
  return (
    <div className="p-4 space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
      ))}
    </div>
  );
}
