/**
 * Command palette groups - Phase 101-03
 *
 * Context-aware command groups for the global command palette.
 * Per D-03: Different commands shown based on current view.
 */
import type { LucideIcon } from "lucide-react";
import {
  Plus,
  Search,
  CreditCard,
  FileText,
  Send,
  Edit,
  Archive,
  CheckCircle,
  Upload,
  MessageSquare,
  Zap,
  User,
  Settings,
} from "lucide-react";

/**
 * Views where command palette can show context-aware actions.
 */
export type CommandView =
  | "pipeline"
  | "deal-detail"
  | "payment-review"
  | "documents"
  | "settings"
  | "default";

/**
 * Single command item in a group.
 */
export interface CommandItem {
  id: string;
  label: string;
  shortcut?: string;
  icon: LucideIcon;
  action: string;
  keywords?: string[]; // For fuzzy search
}

/**
 * Group of related commands.
 */
export interface CommandGroup {
  heading: string;
  items: CommandItem[];
}

// Base commands available everywhere
const baseCommands: CommandGroup = {
  heading: "Quick Actions",
  items: [
    {
      id: "new-deal",
      label: "New deal",
      shortcut: "N",
      icon: Plus,
      action: "new-deal",
      keywords: ["create", "add", "prospect"],
    },
    {
      id: "search",
      label: "Search deals...",
      shortcut: "/",
      icon: Search,
      action: "search",
      keywords: ["find", "lookup"],
    },
  ],
};

// Pipeline-specific commands
const pipelineCommands: CommandGroup = {
  heading: "Pipeline",
  items: [
    {
      id: "quick-capture",
      label: "Quick capture",
      shortcut: "Shift+N",
      icon: Zap,
      action: "quick-capture",
      keywords: ["fast", "stub"],
    },
    {
      id: "record-payment",
      label: "Record payment",
      shortcut: "P",
      icon: CreditCard,
      action: "record-payment",
      keywords: ["money", "pay"],
    },
    {
      id: "close-deal",
      label: "Close deal",
      shortcut: "C",
      icon: CheckCircle,
      action: "close-deal",
      keywords: ["finish", "complete"],
    },
  ],
};

// Deal detail commands (context-dependent on stage)
const dealDetailCommands: CommandGroup = {
  heading: "Deal Actions",
  items: [
    {
      id: "send-proposal",
      label: "Send proposal",
      shortcut: "S",
      icon: Send,
      action: "send-proposal",
      keywords: ["email", "deliver"],
    },
    {
      id: "record-payment-deal",
      label: "Record payment",
      shortcut: "P",
      icon: CreditCard,
      action: "record-payment",
      keywords: ["money", "pay"],
    },
    {
      id: "edit-deal",
      label: "Edit",
      shortcut: "E",
      icon: Edit,
      action: "edit",
      keywords: ["modify", "change"],
    },
    {
      id: "add-comment",
      label: "Add comment",
      shortcut: "C",
      icon: MessageSquare,
      action: "add-comment",
      keywords: ["note", "remark"],
    },
    {
      id: "mark-accepted",
      label: "Mark as accepted",
      icon: CheckCircle,
      action: "mark-accepted",
      keywords: ["verbal", "agree"],
    },
    {
      id: "upload-signed",
      label: "Upload signed doc",
      shortcut: "U",
      icon: Upload,
      action: "upload-signed",
      keywords: ["contract", "file"],
    },
    {
      id: "archive-deal",
      label: "Archive",
      shortcut: "A",
      icon: Archive,
      action: "archive",
      keywords: ["remove", "delete"],
    },
  ],
};

// Payment review commands
const paymentReviewCommands: CommandGroup = {
  heading: "Payments",
  items: [
    {
      id: "confirm-match",
      label: "Confirm match",
      shortcut: "Enter",
      icon: CheckCircle,
      action: "confirm-match",
    },
    {
      id: "find-match",
      label: "Find match",
      shortcut: "F",
      icon: Search,
      action: "find-match",
    },
    {
      id: "create-credit",
      label: "Create credit",
      icon: CreditCard,
      action: "create-credit",
    },
  ],
};

// Navigation commands
const navigationCommands: CommandGroup = {
  heading: "Navigate",
  items: [
    {
      id: "go-pipeline",
      label: "Go to Pipeline",
      icon: FileText,
      action: "navigate:/pipeline",
      keywords: ["deals", "board"],
    },
    {
      id: "go-payments",
      label: "Go to Payments",
      icon: CreditCard,
      action: "navigate:/payments",
      keywords: ["review", "reconcile"],
    },
    {
      id: "go-clients",
      label: "Go to Clients",
      icon: User,
      action: "navigate:/clients",
      keywords: ["customers"],
    },
    {
      id: "go-settings",
      label: "Go to Settings",
      icon: Settings,
      action: "navigate:/settings",
    },
  ],
};

/**
 * Get command groups based on current view context.
 * Per D-03: Context-aware suggestions based on current view.
 */
export function getCommandGroups(
  view: CommandView,
  dealStage?: string
): CommandGroup[] {
  const groups: CommandGroup[] = [baseCommands];

  switch (view) {
    case "pipeline":
      groups.push(pipelineCommands);
      break;
    case "deal-detail":
      // Filter deal commands based on stage
      const filteredDealCommands = filterDealCommandsByStage(
        dealDetailCommands,
        dealStage
      );
      groups.push(filteredDealCommands);
      break;
    case "payment-review":
      groups.push(paymentReviewCommands);
      break;
    case "documents":
      // Could add document-specific commands in future
      break;
    default:
      // Default view gets base + navigation only
      break;
  }

  groups.push(navigationCommands);
  return groups;
}

/**
 * Filter deal commands based on current stage.
 * Removes irrelevant actions (e.g., can't send proposal if already signed).
 */
function filterDealCommandsByStage(
  group: CommandGroup,
  stage?: string
): CommandGroup {
  if (!stage) return group;

  let filteredItems = [...group.items];

  // Hide "Send proposal" if already sent/viewed/accepted/signed/paid
  if (["viewed", "accepted", "signed", "paid"].includes(stage)) {
    filteredItems = filteredItems.filter((item) => item.id !== "send-proposal");
  }

  // Hide "Mark accepted" if already accepted or beyond
  if (["accepted", "signed", "paid", "onboarded"].includes(stage)) {
    filteredItems = filteredItems.filter((item) => item.id !== "mark-accepted");
  }

  // Show "Record payment" prominently for signed deals
  if (stage === "signed") {
    const paymentItem = filteredItems.find(
      (item) => item.id === "record-payment-deal"
    );
    if (paymentItem) {
      filteredItems = [
        paymentItem,
        ...filteredItems.filter((item) => item.id !== "record-payment-deal"),
      ];
    }
  }

  return { ...group, items: filteredItems };
}
