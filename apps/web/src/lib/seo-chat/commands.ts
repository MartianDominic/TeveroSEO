/**
 * SEO Chat Command System
 * Phase 98-10: Claude Code CLI-style /commands
 *
 * Provides:
 * - /analyze <domain>: Check domain health
 * - /keywords <domain>: Find keyword opportunities
 * - /feasibility <keyword>: Check ranking difficulty
 * - /proposal: Generate client proposal
 * - /clear: Clear conversation
 * - /help: Show available commands
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Command definition.
 */
export interface Command {
  /** Primary command name */
  name: string;
  /** Alternative names (e.g., 'a' for 'analyze') */
  aliases: string[];
  /** Short description for help/autocomplete */
  description: string;
  /** Usage example */
  usage: string;
  /** Regex pattern to match command input */
  pattern: RegExp;
  /** Whether this command is local (doesn't send to AI) */
  isLocal?: boolean;
  /** Transform command args to AI prompt text. Returns null for local commands. */
  execute: (...args: string[]) => string | null;
}

/**
 * Result of parsing user input for commands.
 */
export interface ParsedCommand {
  /** Matched command */
  command: Command;
  /** Extracted arguments */
  args: string[];
  /** Transformed text to send to AI (null for local commands) */
  text: string | null;
}

// ---------------------------------------------------------------------------
// Command Definitions
// ---------------------------------------------------------------------------

export const COMMANDS: Command[] = [
  {
    name: 'analyze',
    aliases: ['a', 'domain'],
    description: 'Analyze domain health',
    usage: '/analyze <domain>',
    pattern: /^\/(?:analyze|a|domain)\s+(.+)$/i,
    execute: (domain) => `Analyze the domain ${domain}`,
  },
  {
    name: 'keywords',
    aliases: ['k', 'kw'],
    description: 'Find keyword opportunities',
    usage: '/keywords <domain>',
    pattern: /^\/(?:keywords|k|kw)\s+(.+)$/i,
    execute: (domain) => `Find keyword opportunities for ${domain}`,
  },
  {
    name: 'feasibility',
    aliases: ['f', 'check'],
    description: 'Check keyword feasibility',
    usage: '/feasibility <keyword>',
    pattern: /^\/(?:feasibility|f|check)\s+(.+)$/i,
    execute: (keyword) => `Check if we can rank for "${keyword}"`,
  },
  {
    name: 'proposal',
    aliases: ['p', 'gen'],
    description: 'Generate proposal',
    usage: '/proposal',
    pattern: /^\/(?:proposal|p|gen)$/i,
    execute: () => `Generate a proposal for the keywords we've analyzed`,
  },
  {
    name: 'clear',
    aliases: ['reset', 'new'],
    description: 'Clear conversation',
    usage: '/clear',
    pattern: /^\/(?:clear|reset|new)$/i,
    isLocal: true,
    execute: () => null,
  },
  {
    name: 'help',
    aliases: ['h', '?'],
    description: 'Show available commands',
    usage: '/help',
    pattern: /^\/(?:help|h|\?)$/i,
    isLocal: true,
    execute: () => null,
  },
];

// ---------------------------------------------------------------------------
// Command Parsing
// ---------------------------------------------------------------------------

/**
 * Check if input starts with a command prefix.
 * Use this to determine whether to show command autocomplete.
 */
export function isCommandInput(input: string): boolean {
  return input.startsWith('/');
}

/**
 * Get commands matching partial input.
 * Filters by command name or alias starting with the input (without slash).
 */
export function filterCommands(input: string): Command[] {
  if (!input.startsWith('/')) return [];

  const query = input.slice(1).toLowerCase();
  if (!query) return COMMANDS;

  return COMMANDS.filter(
    (cmd) =>
      cmd.name.toLowerCase().startsWith(query) ||
      cmd.aliases.some((alias) => alias.toLowerCase().startsWith(query))
  );
}

/**
 * Parse user input for a command.
 * Returns null if input is not a command or doesn't match any pattern.
 */
export function parseCommand(input: string): ParsedCommand | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) return null;

  for (const cmd of COMMANDS) {
    const match = trimmed.match(cmd.pattern);
    if (match) {
      const args = match.slice(1);
      return {
        command: cmd,
        args,
        text: cmd.execute(...args),
      };
    }
  }

  return null;
}

/**
 * Get help text for all commands.
 * Returns formatted string for display.
 */
export function getHelpText(): string {
  return COMMANDS.map(
    (cmd) =>
      `${cmd.usage.padEnd(24)} ${cmd.description}${
        cmd.aliases.length > 0 ? ` (aliases: ${cmd.aliases.join(', ')})` : ''
      }`
  ).join('\n');
}

/**
 * Get command by name or alias.
 */
export function getCommand(nameOrAlias: string): Command | undefined {
  const lower = nameOrAlias.toLowerCase();
  return COMMANDS.find(
    (cmd) =>
      cmd.name === lower || cmd.aliases.includes(lower)
  );
}
