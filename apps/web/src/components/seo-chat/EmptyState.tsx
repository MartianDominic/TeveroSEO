'use client';

/**
 * EmptyState Component
 * Phase 98-10: Claude Code-style empty state with /commands
 *
 * Shows:
 * - Quick command reference (like Claude Code /help output)
 * - Example natural language prompts
 * - Click-to-insert commands
 */

import { memo } from 'react';
import { COMMANDS } from '@/lib/seo-chat/commands';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmptyStateProps {
  /** Handler when user selects a prompt/command */
  onSelectPrompt: (text: string) => void;
}

// ---------------------------------------------------------------------------
// Example Prompts
// ---------------------------------------------------------------------------

const EXAMPLE_PROMPTS = [
  'What does groziosalon.lt look like?',
  'Find keywords for plaukupasaka.lt',
  'Can this domain rank for "grozio salonas vilnius"?',
];

// ---------------------------------------------------------------------------
// Command Row Component
// ---------------------------------------------------------------------------

interface CommandRowProps {
  cmd: string;
  args?: string;
  desc: string;
  onClick: () => void;
}

function CommandRow({ cmd, args, desc, onClick }: CommandRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2 py-1.5 px-2 hover:bg-muted rounded transition-colors text-left"
    >
      <code className="text-accent font-mono">{cmd}</code>
      {args && <code className="text-muted-foreground font-mono">{args}</code>}
      <span className="text-muted-foreground ml-auto text-xs">{desc}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Empty State - Shows commands and example prompts.
 *
 * Design:
 * - Monospace command display (Claude Code style)
 * - Click to insert command in input
 * - Example prompts for natural language users
 */
export const EmptyState = memo(function EmptyState({ onSelectPrompt }: EmptyStateProps) {
  // Filter to show main commands (not local ones like /help, /clear)
  const mainCommands = COMMANDS.filter((c) => !c.isLocal);

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <h2 className="text-xl font-semibold mb-2">SEO Chat</h2>
      <p className="text-muted-foreground mb-6 max-w-md">
        Analyze prospects, find keywords, and generate proposals.
      </p>

      {/* Quick commands - like Claude Code help output */}
      <div className="w-full max-w-md space-y-1 text-left font-mono text-sm mb-8">
        <p className="text-muted-foreground text-xs mb-2 font-sans">Quick commands:</p>
        {mainCommands.map((cmd) => {
          // Extract args from usage (e.g., "/analyze <domain>" -> "<domain>")
          const argsMatch = cmd.usage.match(/<[^>]+>/);
          const args = argsMatch ? argsMatch[0] : undefined;

          return (
            <CommandRow
              key={cmd.name}
              cmd={`/${cmd.name}`}
              args={args}
              desc={cmd.description}
              onClick={() => {
                // Insert command with trailing space if it takes args
                const hasArgs = cmd.usage.includes('<');
                onSelectPrompt(`/${cmd.name}${hasArgs ? ' ' : ''}`);
              }}
            />
          );
        })}

        {/* Show local commands in muted style */}
        <div className="pt-2 border-t border-hairline mt-2">
          <p className="text-muted-foreground text-xs mb-2 font-sans">Other commands:</p>
          {COMMANDS.filter((c) => c.isLocal).map((cmd) => (
            <CommandRow
              key={cmd.name}
              cmd={`/${cmd.name}`}
              desc={cmd.description}
              onClick={() => onSelectPrompt(`/${cmd.name}`)}
            />
          ))}
        </div>
      </div>

      {/* Example prompts */}
      <div className="w-full max-w-md">
        <p className="text-xs text-muted-foreground mb-3">Or try a natural question:</p>
        <div className="grid grid-cols-1 gap-2">
          {EXAMPLE_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onSelectPrompt(prompt)}
              className="px-4 py-2.5 text-sm text-left rounded-lg border hover:bg-muted transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});
