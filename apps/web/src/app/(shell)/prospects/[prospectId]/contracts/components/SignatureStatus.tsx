"use client";

import { Badge } from "@tevero/ui";
import { FileCheck, Clock, Send, AlertCircle } from "lucide-react";

interface SignatureStatusProps {
  status: string;
  signedAt?: string | null;
  signerName?: string | null;
}

const STATUS_CONFIG: Record<string, {
  icon: React.ElementType;
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  description: string;
}> = {
  draft: {
    icon: Clock,
    label: "Laukia parengimo",
    variant: "outline",
    description: "Sutartis dar neišsiųsta pasirašymui",
  },
  sent: {
    icon: Send,
    label: "Išsiųsta pasirašyti",
    variant: "secondary",
    description: "Laukiama kliento parašo",
  },
  signed: {
    icon: FileCheck,
    label: "Pasirašyta",
    variant: "default",
    description: "Sutartis pasirašyta",
  },
  expired: {
    icon: AlertCircle,
    label: "Pasibaigė galiojimas",
    variant: "destructive",
    description: "Pasirašymo laikas baigėsi",
  },
  cancelled: {
    icon: AlertCircle,
    label: "Atšaukta",
    variant: "destructive",
    description: "Sutartis atšaukta",
  },
  executed: {
    icon: FileCheck,
    label: "Įvykdyta",
    variant: "default",
    description: "Sutartis pasirašyta ir įsigaliojusi",
  },
};

export function SignatureStatus({ status, signedAt, signerName }: SignatureStatusProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
      {status === "signed" && signerName && (
        <span className="text-xs text-muted-foreground">
          {signerName} - {signedAt ? new Date(signedAt).toLocaleDateString("lt-LT") : ""}
        </span>
      )}
    </div>
  );
}
