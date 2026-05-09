/**
 * Payment Plan Selector Component
 * Phase 60-02: Payment Plan Selector UI + Checkout Flow
 *
 * Client-facing radio card selector for choosing payment plans.
 * Displays all available plans with calculated breakdowns.
 *
 * Design reference: D-09 in DESIGN.md
 */
import * as React from "react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { cn } from "@/client/lib/utils";
import { Button } from "@/client/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/client/components/ui/radio-group";
import {
  formatCurrency,
  calculatePlan,
  getPlanName,
  type PlanType,
  type PaymentPlan,
} from "@/lib/format-currency";

/**
 * Props for the PaymentPlanSelector component.
 */
export interface PaymentPlanSelectorProps {
  /** Total invoice amount in cents */
  totalCents: number;
  /** Currency code (EUR, USD) */
  currency: string;
  /** List of available plan types */
  availablePlans: PlanType[];
  /** Currently selected plan */
  selectedPlan: PlanType | null;
  /** Callback when plan selection changes */
  onPlanChange: (plan: PlanType) => void;
  /** Callback when Continue button is clicked */
  onContinue: () => void;
  /** Whether a submission is in progress */
  isLoading?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * Single plan card within the selector.
 */
interface PlanCardProps {
  plan: PaymentPlan;
  currency: string;
  isSelected: boolean;
  onSelect: () => void;
}

function PlanCard({
  plan,
  currency,
  isSelected,
  onSelect,
}: PlanCardProps): React.ReactElement {
  const firstInstallment = plan.installments[0];
  const planName = getPlanName(plan.type);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full text-left rounded-lg border-2 p-4 transition-all",
        "hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        isSelected
          ? "border-primary bg-primary/5"
          : "border-border bg-card"
      )}
      role="radio"
      aria-checked={isSelected}
      aria-label={`${planName}: ${formatCurrency(firstInstallment.amount, currency)} today`}
    >
      <div className="flex items-start gap-3">
        {/* Radio indicator */}
        <div className="flex-shrink-0 mt-0.5">
          <div
            className={cn(
              "h-4 w-4 rounded-full border-2 flex items-center justify-center",
              isSelected
                ? "border-primary bg-primary"
                : "border-muted-foreground"
            )}
          >
            {isSelected && (
              <div className="h-2 w-2 rounded-full bg-primary-foreground" />
            )}
          </div>
        </div>

        {/* Plan details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">{planName}</h3>
            {plan.type === "full" && (
              <span className="text-xs-safe text-muted-foreground">
                Single payment
              </span>
            )}
          </div>

          {/* First payment amount */}
          <p className="text-lg font-bold text-foreground mt-1">
            {formatCurrency(firstInstallment.amount, currency)} today
          </p>

          {/* Divider and installment breakdown */}
          {plan.installments.length > 1 && (
            <>
              <div className="h-px bg-border my-3" />
              <ul className="space-y-2">
                {plan.installments.map((installment) => (
                  <li
                    key={installment.number}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-muted-foreground">
                      Payment {installment.number}:{" "}
                      {formatCurrency(installment.amount, currency)}
                    </span>
                    <span className="text-muted-foreground">
                      {installment.number === 1
                        ? "Today"
                        : format(installment.dueDate, "MMM d, yyyy")}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* Total for split plans */}
          {plan.installments.length > 1 && (
            <p className="text-xs-safe text-muted-foreground mt-3">
              Total: {formatCurrency(plan.totalAmount, currency)}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

/**
 * PaymentPlanSelector displays available payment plans as radio cards.
 *
 * Features:
 * - Shows all available plans with calculated breakdowns
 * - Radio selection with visual feedback
 * - Amounts formatted correctly with currency
 * - Dates formatted in user-friendly format
 * - Continue button triggers onContinue callback
 * - Loading state prevents double-submission
 *
 * @example
 * <PaymentPlanSelector
 *   totalCents={420000}
 *   currency="EUR"
 *   availablePlans={["full", "split_2", "split_3"]}
 *   selectedPlan="split_2"
 *   onPlanChange={(plan) => setSelectedPlan(plan)}
 *   onContinue={() => handleContinue()}
 *   isLoading={false}
 * />
 */
export function PaymentPlanSelector({
  totalCents,
  currency,
  availablePlans,
  selectedPlan,
  onPlanChange,
  onContinue,
  isLoading = false,
  className,
}: PaymentPlanSelectorProps): React.ReactElement {
  // Calculate plan breakdowns for all available plans
  const plans = React.useMemo<PaymentPlan[]>(() => {
    return availablePlans.map((planType) => calculatePlan(totalCents, planType));
  }, [availablePlans, totalCents]);

  // Determine continue button state
  const canContinue = selectedPlan !== null && !isLoading;

  return (
    <Card className={cn("w-full max-w-2xl", className)}>
      <CardHeader>
        <CardTitle>Choose your payment plan</CardTitle>
        <CardDescription>
          Select how you would like to pay for this invoice.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className="space-y-3"
          role="radiogroup"
          aria-label="Payment plan options"
        >
          {plans.map((plan) => (
            <PlanCard
              key={plan.type}
              plan={plan}
              currency={currency}
              isSelected={selectedPlan === plan.type}
              onSelect={() => onPlanChange(plan.type)}
            />
          ))}
        </div>

        <div className="mt-6">
          <Button
            onClick={onContinue}
            disabled={!canContinue}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Continue to Payment"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
