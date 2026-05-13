'use client';

/**
 * SessionList Component
 * Phase 98-08: Searchable list of SEO chat sessions
 *
 * Features:
 * - Search filter by domain or title
 * - Active state highlighting for current session
 * - Session metadata (status, message count, last updated)
 * - Loading skeleton during fetch
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Input, Badge } from '@tevero/ui';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, MessageSquare, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Session {
  id: string;
  prospectDomain: string | null;
  title: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

interface SessionListProps {
  workspaceId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SessionList({ workspaceId }: SessionListProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const pathname = usePathname();

  useEffect(() => {
    async function fetchSessions() {
      try {
        const res = await fetch(`/api/seo-chat/sessions?workspaceId=${workspaceId}`);
        if (!res.ok) throw new Error('Failed to fetch sessions');
        const data = await res.json();
        setSessions(data.sessions);
      } catch (error) {
        console.error('Failed to fetch sessions:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchSessions();
  }, [workspaceId]);

  const filteredSessions = sessions.filter((session) => {
    const searchLower = search.toLowerCase();
    return (
      session.prospectDomain?.toLowerCase().includes(searchLower) ||
      session.title?.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <div className="p-4 space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Session list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {filteredSessions.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              {search ? 'No matching conversations' : 'No conversations yet'}
            </p>
          ) : (
            filteredSessions.map((session) => {
              const isActive = pathname === `/seo-chat/${session.id}`;
              return (
                <Link
                  key={session.id}
                  href={`/seo-chat/${session.id}`}
                  className={cn(
                    'block p-3 rounded-lg transition-colors',
                    isActive
                      ? 'bg-primary/10 border border-primary/20'
                      : 'hover:bg-muted'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <p className="font-medium text-sm truncate">
                          {session.prospectDomain || 'New conversation'}
                        </p>
                      </div>
                      {session.title && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5 ml-6">
                          {session.title}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant={session.status === 'converted' ? 'default' : 'secondary'}
                      className="text-xs flex-shrink-0"
                    >
                      {session.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between mt-2 ml-6 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {session.messageCount}
                    </span>
                    <span>
                      {formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true })}
                    </span>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
