/**
 * useRoiCalculator hook
 * Phase 30: Interactive Proposal Page
 *
 * Manages ROI calculator state and performs real-time calculations.
 * Supports industry defaults and custom user inputs.
 */

import { useState, useMemo, useCallback } from "react";

// Industry default presets
export const INDUSTRY_DEFAULTS = {
  ecommerce: {
    conversionRate: 2.5,
    aov: 120,
  },
  saas: {
    conversionRate: 3,
    aov: 500,
  },
  services: {
    conversionRate: 5,
    aov: 2000,
  },
  lead_gen: {
    conversionRate: 8,
    aov: 50,
  },
} as const;

export type IndustryType = keyof typeof INDUSTRY_DEFAULTS;

interface RoiCalculatorInput {
  trafficGain: number;
  trafficValue: number;
  monthlyFee: number;
  defaultConversionRate?: number;
  defaultAov?: number;
}

interface RoiCalculations {
  trafficValue: number;
  projectedConversions: number;
  projectedRevenue: number;
  roi: number;
  paybackMonths: string;
}

interface UseRoiCalculatorReturn {
  conversionRate: number;
  setConversionRate: (rate: number) => void;
  aov: number;
  setAov: (value: number) => void;
  calculations: RoiCalculations;
  resetToDefaults: () => void;
  applyIndustryDefaults: (industry: IndustryType) => void;
}

const DEFAULT_CONVERSION_RATE = 2;
const DEFAULT_AOV = 150;

export function useRoiCalculator(
  initialData: RoiCalculatorInput,
): UseRoiCalculatorReturn {
  const defaultConversionRate =
    initialData.defaultConversionRate ?? DEFAULT_CONVERSION_RATE;
  const defaultAov = initialData.defaultAov ?? DEFAULT_AOV;

  const [conversionRate, setConversionRate] = useState(defaultConversionRate);
  const [aov, setAov] = useState(defaultAov);

  // Memoized calculations - recalculate when inputs change
  const calculations = useMemo<RoiCalculations>(() => {
    const monthlyClicks = initialData.trafficGain;
    const monthlyConversions = monthlyClicks * (conversionRate / 100);
    const monthlyRevenue = monthlyConversions * aov;

    // Handle edge cases for ROI calculation
    let roi: number;
    if (initialData.monthlyFee === 0) {
      roi = monthlyRevenue > 0 ? Infinity : 0;
    } else {
      roi = ((monthlyRevenue - initialData.monthlyFee) / initialData.monthlyFee) * 100;
    }

    // Handle edge cases for payback calculation
    let paybackMonths: string;
    if (monthlyRevenue === 0) {
      paybackMonths = "N/A";
    } else {
      const months = initialData.monthlyFee / (monthlyRevenue / 12);
      paybackMonths = Number.isFinite(months) ? months.toFixed(1) : "N/A";
    }

    return {
      trafficValue: initialData.trafficValue,
      projectedConversions: Math.round(monthlyConversions),
      projectedRevenue: Math.round(monthlyRevenue),
      roi: Number.isFinite(roi) ? Math.round(roi) : 0,
      paybackMonths,
    };
  }, [conversionRate, aov, initialData]);

  // Reset to initial defaults
  const resetToDefaults = useCallback(() => {
    setConversionRate(defaultConversionRate);
    setAov(defaultAov);
  }, [defaultConversionRate, defaultAov]);

  // Apply industry-specific defaults
  const applyIndustryDefaults = useCallback((industry: IndustryType) => {
    const defaults = INDUSTRY_DEFAULTS[industry];
    setConversionRate(defaults.conversionRate);
    setAov(defaults.aov);
  }, []);

  return {
    conversionRate,
    setConversionRate,
    aov,
    setAov,
    calculations,
    resetToDefaults,
    applyIndustryDefaults,
  };
}
