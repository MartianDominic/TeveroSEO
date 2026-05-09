/**
 * EntityIcon Component
 * Phase 62-06: Needs Attention List
 *
 * Displays appropriate icon for each entity type in the command center.
 */
import { Users, FileText, FileSignature, CreditCard, User } from "lucide-react";

import type { EntityType } from "@/types/command-center";

import type { LucideIcon } from "lucide-react";

const ENTITY_ICONS: Record<EntityType, LucideIcon> = {
  prospect: Users,
  proposal: FileText,
  contract: FileSignature,
  invoice: CreditCard,
  client: User,
};

export interface EntityIconProps {
  type: EntityType;
  className?: string;
}

export function EntityIcon({ type, className }: EntityIconProps) {
  const Icon = ENTITY_ICONS[type] ?? Users;
  return <Icon className={className} />;
}
