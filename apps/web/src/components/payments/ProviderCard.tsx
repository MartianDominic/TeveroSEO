"use client";

/**
 * ProviderCard Component
 * Phase 54-04: Payment Settings UI
 *
 * Visual card for payment provider showing status, features, and connect/disconnect actions.
 * v6 Design: ghost-edge shadows, emerald accent for connected state.
 */
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, CreditCard, Smartphone, Building2, Loader2 } from "lucide-react";

export type PaymentProviderType = "stripe" | "revolut";

interface ProviderCardProps {
  provider: PaymentProviderType;
  connected: boolean;
  enabled: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  isLoading?: boolean;
}

const PROVIDER_INFO: Record<
  PaymentProviderType,
  {
    name: string;
    logo: string;
    features: { icon: React.ElementType; label: string }[];
    color: string;
  }
> = {
  stripe: {
    name: "Stripe",
    logo: "/logos/stripe.svg",
    features: [
      { icon: CreditCard, label: "Cards (Visa, Mastercard, Amex)" },
      { icon: Smartphone, label: "Apple Pay & Google Pay" },
      { icon: Building2, label: "SEPA Bank Transfers" },
    ],
    color: "#635BFF",
  },
  revolut: {
    name: "Revolut",
    logo: "/logos/revolut.svg",
    features: [
      { icon: CreditCard, label: "Cards (Visa, Mastercard, Amex)" },
      { icon: Smartphone, label: "Apple Pay, Google Pay, Revolut Pay" },
      { icon: Building2, label: "SEPA & Faster Payments" },
    ],
    color: "#0075EB",
  },
};

export function ProviderCard({
  provider,
  connected,
  enabled,
  onConnect,
  onDisconnect,
  isLoading = false,
}: ProviderCardProps) {
  const info = PROVIDER_INFO[provider];

  return (
    <Card
      className={`
        relative overflow-hidden transition-all duration-200
        shadow-[0_1px_3px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.03)]
        hover:shadow-[0_4px_12px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.04)]
        ${connected ? "ring-2 ring-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-950/10" : ""}
      `}
    >
      {/* Provider accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ backgroundColor: connected ? "#10B981" : info.color }}
      />

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo placeholder - replace with actual SVG */}
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg"
              style={{ backgroundColor: info.color }}
            >
              {info.name[0]}
            </div>
            <div>
              <CardTitle className="text-lg">{info.name}</CardTitle>
              <CardDescription>Payment Provider</CardDescription>
            </div>
          </div>

          <Badge
            variant={connected ? "default" : "secondary"}
            className={
              connected
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : ""
            }
          >
            {connected ? (
              <>
                <Check className="w-3 h-3 mr-1" />
                Connected
              </>
            ) : (
              "Not Connected"
            )}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Features list */}
        <div className="space-y-2">
          {info.features.map((feature, idx) => (
            <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
              <feature.icon className="w-4 h-4" />
              <span>{feature.label}</span>
            </div>
          ))}
        </div>

        {/* Action button */}
        <div className="pt-2">
          {connected ? (
            <Button
              variant="outline"
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={onDisconnect}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                "Disconnect"
              )}
            </Button>
          ) : (
            <Button
              variant="default"
              className="w-full"
              onClick={onConnect}
              disabled={isLoading}
              style={{ backgroundColor: info.color }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect"
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
