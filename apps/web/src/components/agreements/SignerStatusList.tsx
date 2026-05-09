"use client";

/**
 * SignerStatusList Component
 * Phase 59-08: Success Page & Status Tracking
 *
 * Displays a list of signers with their signing status.
 * Used in the admin agreement detail view.
 */

import { CheckCircle, Clock, AlertCircle, Mail } from "lucide-react";

import { cn } from "@/lib/utils";

import { Badge, Button } from "@tevero/ui";

export interface SignerStatus {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "pending" | "sent" | "viewed" | "signed" | "declined";
  signedAt: string | null;
  viewedAt: string | null;
  sentAt: string | null;
}

interface SignerStatusListProps {
  signers: SignerStatus[];
  onResendInvite?: (signerId: string) => Promise<void>;
  onCancelInvite?: (signerId: string) => Promise<void>;
  locale?: string;
}

const STATUS_CONFIG = {
  pending: {
    icon: Clock,
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    label: "Pending",
    labelLt: "Laukiama",
  },
  sent: {
    icon: Mail,
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    label: "Sent",
    labelLt: "Issiusta",
  },
  viewed: {
    icon: Clock,
    color: "text-amber-600",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    label: "Viewed",
    labelLt: "Perziureta",
  },
  signed: {
    icon: CheckCircle,
    color: "text-green-600",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    label: "Signed",
    labelLt: "Pasirasytas",
  },
  declined: {
    icon: AlertCircle,
    color: "text-red-600",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    label: "Declined",
    labelLt: "Atmesta",
  },
};

export function SignerStatusList({
  signers,
  onResendInvite,
  onCancelInvite,
  locale = "en",
}: SignerStatusListProps) {
  const formatDate = (date: string | null) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString(locale === "lt" ? "lt-LT" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-3">
      {signers.map((signer) => {
        const config = STATUS_CONFIG[signer.status];
        const StatusIcon = config.icon;

        return (
          <div
            key={signer.id}
            className="flex items-start justify-between p-4 rounded-lg border bg-card"
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                  config.bgColor
                )}
              >
                <StatusIcon className={cn("h-5 w-5", config.color)} />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground truncate">
                    {signer.name}
                  </p>
                  <Badge
                    variant="secondary"
                    className={cn("text-xs-safe", config.bgColor, config.color)}
                  >
                    {locale === "lt" ? config.labelLt : config.label}
                  </Badge>
                </div>

                <p className="text-sm text-muted-foreground truncate">
                  {signer.email}
                </p>

                <p className="text-xs-safe text-muted-foreground mt-1">
                  {signer.role}
                </p>

                {signer.signedAt && (
                  <p className="text-xs-safe text-green-600 mt-1">
                    {locale === "lt" ? "Pasirasytas" : "Signed"}: {formatDate(signer.signedAt)}
                  </p>
                )}

                {!signer.signedAt && signer.viewedAt && (
                  <p className="text-xs-safe text-amber-600 mt-1">
                    {locale === "lt" ? "Perziureta" : "Viewed"}: {formatDate(signer.viewedAt)}
                  </p>
                )}

                {!signer.signedAt && !signer.viewedAt && signer.sentAt && (
                  <p className="text-xs-safe text-muted-foreground mt-1">
                    {locale === "lt" ? "Issiusta" : "Sent"}: {formatDate(signer.sentAt)}
                  </p>
                )}
              </div>
            </div>

            {/* Actions for pending/sent signers */}
            {(signer.status === "pending" || signer.status === "sent" || signer.status === "viewed") && (
              <div className="flex items-center gap-2">
                {onResendInvite && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onResendInvite(signer.id)}
                  >
                    <Mail className="h-4 w-4 mr-1" />
                    {locale === "lt" ? "Siusti dar karta" : "Resend"}
                  </Button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {signers.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          {locale === "lt" ? "Nera pasirasymo dalyviu" : "No signers added yet"}
        </div>
      )}
    </div>
  );
}

export default SignerStatusList;
