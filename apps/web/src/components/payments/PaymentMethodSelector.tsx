"use client";

/**
 * PaymentMethodSelector Component
 * Phase 54-04: Client Payment Page Updates
 *
 * Visual cards for client to select payment provider.
 * Shows supported payment methods per provider.
 */
import { CreditCard, Smartphone, Building2, Check } from "lucide-react";

export type PaymentProviderType = "stripe" | "revolut";

interface PaymentMethodSelectorProps {
  providers: PaymentProviderType[];
  selected: PaymentProviderType;
  onSelect: (provider: PaymentProviderType) => void;
}

const PROVIDER_INFO: Record<
  PaymentProviderType,
  {
    name: string;
    color: string;
    methods: string[];
  }
> = {
  stripe: {
    name: "Stripe",
    color: "#635BFF",
    methods: ["Visa", "Mastercard", "Amex", "Apple Pay", "Google Pay"],
  },
  revolut: {
    name: "Revolut",
    color: "#0075EB",
    methods: ["Visa", "Mastercard", "Revolut Pay", "Apple Pay", "Google Pay"],
  },
};

export function PaymentMethodSelector({
  providers,
  selected,
  onSelect,
}: PaymentMethodSelectorProps) {
  if (providers.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No payment methods available
      </div>
    );
  }

  if (providers.length === 1) {
    // Single provider - no selection needed
    return null;
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">Choose payment method</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {providers.map((provider) => {
          const info = PROVIDER_INFO[provider];
          const isSelected = selected === provider;

          return (
            <button
              key={provider}
              type="button"
              onClick={() => onSelect(provider)}
              className={`
                relative p-4 rounded-lg border-2 text-left transition-all duration-200
                ${
                  isSelected
                    ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
                    : "border-border hover:border-muted-foreground/30 bg-card"
                }
              `}
            >
              {/* Selection indicator */}
              <div
                className={`
                  absolute top-3 right-3 w-5 h-5 rounded-full border-2 flex items-center justify-center
                  ${
                    isSelected
                      ? "border-emerald-500 bg-emerald-500"
                      : "border-muted-foreground/30"
                  }
                `}
              >
                {isSelected && <Check className="w-3 h-3 text-white" />}
              </div>

              {/* Provider info */}
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: info.color }}
                >
                  {info.name[0]}
                </div>
                <span className="font-medium">{info.name}</span>
              </div>

              {/* Payment methods icons */}
              <div className="flex flex-wrap gap-1">
                {info.methods.map((method) => (
                  <span
                    key={method}
                    className="text-xs px-2 py-0.5 bg-muted rounded text-muted-foreground"
                  >
                    {method}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
