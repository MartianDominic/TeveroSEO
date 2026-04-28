/**
 * PricingEditor component
 * Phase 30: Interactive Proposals - Builder UI
 *
 * Allows editing proposal pricing (setup fee, monthly fee, currency).
 */
import { useState } from "react";
import { Card } from "@/client/components/ui/card";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { DollarSign, Calendar, Info } from "lucide-react";

interface PricingEditorProps {
  setupFeeCents: number;
  monthlyFeeCents: number;
  currency: string;
  onSetupFeeChange: (cents: number) => void;
  onMonthlyFeeChange: (cents: number) => void;
  onCurrencyChange: (currency: string) => void;
}

const CURRENCIES = [
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "PLN", symbol: "zł", name: "Polish Zloty" },
  { code: "SEK", symbol: "kr", name: "Swedish Krona" },
];

/**
 * Renders pricing configuration form
 */
export function PricingEditor({
  setupFeeCents,
  monthlyFeeCents,
  currency,
  onSetupFeeChange,
  onMonthlyFeeChange,
  onCurrencyChange,
}: PricingEditorProps) {
  const [setupFeeDisplay, setSetupFeeDisplay] = useState(
    (setupFeeCents / 100).toString()
  );
  const [monthlyFeeDisplay, setMonthlyFeeDisplay] = useState(
    (monthlyFeeCents / 100).toString()
  );

  const currencyInfo = CURRENCIES.find((c) => c.code === currency) ?? CURRENCIES[0];

  const handleSetupFeeBlur = () => {
    const value = parseFloat(setupFeeDisplay) || 0;
    const cents = Math.round(value * 100);
    onSetupFeeChange(cents);
    setSetupFeeDisplay((cents / 100).toString());
  };

  const handleMonthlyFeeBlur = () => {
    const value = parseFloat(monthlyFeeDisplay) || 0;
    const cents = Math.round(value * 100);
    onMonthlyFeeChange(cents);
    setMonthlyFeeDisplay((cents / 100).toString());
  };

  // Calculate annual value
  const annualValue = monthlyFeeCents * 12 + setupFeeCents;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Pricing</h3>
        <p className="text-sm text-muted-foreground">
          Set the investment for this proposal
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Currency selector */}
        <div className="space-y-2">
          <Label>Currency</Label>
          <Select value={currency} onValueChange={onCurrencyChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.symbol} {c.code} - {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Setup fee */}
        <div className="space-y-2">
          <Label htmlFor="setup-fee">Setup Fee (one-time)</Label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="setup-fee"
              type="number"
              min="0"
              step="0.01"
              value={setupFeeDisplay}
              onChange={(e) => setSetupFeeDisplay(e.target.value)}
              onBlur={handleSetupFeeBlur}
              className="pl-9"
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Monthly fee */}
        <div className="space-y-2">
          <Label htmlFor="monthly-fee">Monthly Fee</Label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="monthly-fee"
              type="number"
              min="0"
              step="0.01"
              value={monthlyFeeDisplay}
              onChange={(e) => setMonthlyFeeDisplay(e.target.value)}
              onBlur={handleMonthlyFeeBlur}
              className="pl-9"
              placeholder="0.00"
            />
          </div>
        </div>
      </div>

      {/* Summary card */}
      <Card className="p-4 bg-muted/30">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="text-sm">
              <span className="font-medium">Total first year value: </span>
              <span className="text-lg font-bold">
                {currencyInfo.symbol}
                {(annualValue / 100).toLocaleString()}
              </span>
            </p>
            <p className="text-sm text-muted-foreground">
              {currencyInfo.symbol}
              {(setupFeeCents / 100).toLocaleString()} setup +{" "}
              {currencyInfo.symbol}
              {(monthlyFeeCents / 100).toLocaleString()}/mo x 12 months
            </p>
          </div>
        </div>
      </Card>

      {/* Quick presets */}
      <div>
        <p className="text-sm font-medium mb-2">Quick Presets</p>
        <div className="flex flex-wrap gap-2">
          <PresetButton
            label="Starter"
            setup={100000}
            monthly={50000}
            currency={currency}
            onClick={() => {
              onSetupFeeChange(100000);
              onMonthlyFeeChange(50000);
              setSetupFeeDisplay("1000");
              setMonthlyFeeDisplay("500");
            }}
          />
          <PresetButton
            label="Growth"
            setup={250000}
            monthly={150000}
            currency={currency}
            onClick={() => {
              onSetupFeeChange(250000);
              onMonthlyFeeChange(150000);
              setSetupFeeDisplay("2500");
              setMonthlyFeeDisplay("1500");
            }}
          />
          <PresetButton
            label="Enterprise"
            setup={500000}
            monthly={300000}
            currency={currency}
            onClick={() => {
              onSetupFeeChange(500000);
              onMonthlyFeeChange(300000);
              setSetupFeeDisplay("5000");
              setMonthlyFeeDisplay("3000");
            }}
          />
        </div>
      </div>
    </div>
  );
}

function PresetButton({
  label,
  setup,
  monthly,
  currency,
  onClick,
}: {
  label: string;
  setup: number;
  monthly: number;
  currency: string;
  onClick: () => void;
}) {
  const currencyInfo = CURRENCIES.find((c) => c.code === currency) ?? CURRENCIES[0];

  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-2 text-sm border rounded-md hover:bg-muted transition-colors"
    >
      <span className="font-medium">{label}</span>
      <span className="text-muted-foreground ml-2">
        {currencyInfo.symbol}
        {(setup / 100).toLocaleString()} + {currencyInfo.symbol}
        {(monthly / 100).toLocaleString()}/mo
      </span>
    </button>
  );
}
