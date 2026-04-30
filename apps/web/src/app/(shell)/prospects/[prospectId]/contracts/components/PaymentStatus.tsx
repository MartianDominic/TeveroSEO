"use client";

import { Badge, Button } from "@tevero/ui";
import { CreditCard, Clock, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";

interface PaymentStatusProps {
  status: string;
  totalCents: number;
  currency: string;
  paidAt?: string | null;
  paymentUrl?: string | null;
}

const STATUS_CONFIG: Record<string, {
  icon: React.ElementType;
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
}> = {
  draft: {
    icon: Clock,
    label: "Ruošiama",
    variant: "outline",
  },
  sent: {
    icon: CreditCard,
    label: "Laukiama apmokėjimo",
    variant: "secondary",
  },
  paid: {
    icon: CheckCircle,
    label: "Apmokėta",
    variant: "default",
  },
  overdue: {
    icon: AlertCircle,
    label: "Vėluojama",
    variant: "destructive",
  },
  cancelled: {
    icon: AlertCircle,
    label: "Atšaukta",
    variant: "destructive",
  },
};

export function PaymentStatus({
  status,
  totalCents,
  currency,
  paidAt,
  paymentUrl
}: PaymentStatusProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  const Icon = config.icon;

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("lt-LT", {
      style: "currency",
      currency: currency || "EUR",
    }).format(cents / 100);
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <Badge variant={config.variant} className="gap-1">
          <Icon className="h-3 w-3" />
          {config.label}
        </Badge>
        <span className="font-medium">{formatCurrency(totalCents)}</span>
      </div>

      {status === "sent" && paymentUrl && (
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={() => window.open(paymentUrl, "_blank")}
        >
          <ExternalLink className="h-3 w-3" />
          Apmokėti
        </Button>
      )}

      {status === "paid" && paidAt && (
        <span className="text-xs text-muted-foreground">
          {new Date(paidAt).toLocaleDateString("lt-LT")}
        </span>
      )}
    </div>
  );
}
