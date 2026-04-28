/**
 * RoiCalculatorSection component
 * Phase 30: Interactive Proposal Page
 *
 * Interactive ROI calculator with sliders and real-time calculation.
 */

import { motion } from "framer-motion";
import { Calculator, RotateCcw, TrendingUp, Clock } from "lucide-react";
import { Button } from "@/client/components/ui/button";
import { Label } from "@/client/components/ui/label";
import { AnimatedCounter } from "../AnimatedCounter";
import { useRoiCalculator, INDUSTRY_DEFAULTS, type IndustryType } from "@/client/hooks/useRoiCalculator";
import type { ProposalContent, BrandConfig } from "@/db/proposal-schema";

interface RoiCalculatorSectionProps {
  roi: ProposalContent["roi"];
  monthlyFee: number;
  brandConfig?: BrandConfig | null;
  onCalculatorUsed?: () => void;
}

interface SliderInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  unit: string;
  primaryColor: string;
}

function SliderInput({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
  primaryColor,
}: SliderInputProps) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <span className="text-lg font-semibold tabular-nums" style={{ color: primaryColor }}>
          {value.toLocaleString("lt-LT")}{unit}
        </span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, ${primaryColor} 0%, ${primaryColor} ${percentage}%, hsl(var(--muted)) ${percentage}%, hsl(var(--muted)) 100%)`,
          }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{min.toLocaleString("lt-LT")}{unit}</span>
        <span>{max.toLocaleString("lt-LT")}{unit}</span>
      </div>
    </div>
  );
}

/**
 * Renders the ROI calculator section with interactive inputs.
 */
export function RoiCalculatorSection({
  roi,
  monthlyFee,
  brandConfig,
  onCalculatorUsed,
}: RoiCalculatorSectionProps) {
  const primaryColor = brandConfig?.primaryColor ?? "#2563eb";

  const {
    conversionRate,
    setConversionRate,
    aov,
    setAov,
    calculations,
    resetToDefaults,
    applyIndustryDefaults,
  } = useRoiCalculator({
    trafficGain: roi.projectedTrafficGain,
    trafficValue: roi.trafficValue,
    monthlyFee,
    defaultConversionRate: roi.defaultConversionRate,
    defaultAov: roi.defaultAov,
  });

  const handleSliderChange = (setter: (value: number) => void) => (value: number) => {
    setter(value);
    onCalculatorUsed?.();
  };

  const handleIndustrySelect = (industry: IndustryType) => {
    applyIndustryDefaults(industry);
    onCalculatorUsed?.();
  };

  return (
    <section
      data-section="roi"
      className="py-20 px-6 bg-background"
    >
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <Calculator className="w-8 h-8" style={{ color: primaryColor }} />
            <h2 className="text-2xl md:text-3xl font-bold">
              ROI Skaiciuokle
            </h2>
          </div>
          <p className="text-muted-foreground mb-8">
            Pasirinkite savo verslo rodiklius ir pamatykite numatomus rezultatus
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input controls */}
          <motion.div
            className="bg-card rounded-xl p-6 border shadow-sm space-y-8"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5 }}
          >
            <div>
              <h3 className="font-semibold mb-4">Jusu verslo rodikliai</h3>

              {/* Industry presets */}
              <div className="mb-6">
                <Label className="text-sm text-muted-foreground mb-2 block">
                  Industrijos numatytosios reiksmes:
                </Label>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(INDUSTRY_DEFAULTS) as IndustryType[]).map((industry) => (
                    <Button
                      key={industry}
                      variant="outline"
                      size="sm"
                      onClick={() => handleIndustrySelect(industry)}
                      className="text-xs"
                    >
                      {industry === "ecommerce" && "El. parduotuve"}
                      {industry === "saas" && "SaaS"}
                      {industry === "services" && "Paslaugos"}
                      {industry === "lead_gen" && "Lead Gen"}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <SliderInput
                  label="Konversijos procentas"
                  value={conversionRate}
                  onChange={handleSliderChange(setConversionRate)}
                  min={0.5}
                  max={10}
                  step={0.1}
                  unit="%"
                  primaryColor={primaryColor}
                />

                <SliderInput
                  label="Vidutine uzsakymo verte"
                  value={aov}
                  onChange={handleSliderChange(setAov)}
                  min={10}
                  max={5000}
                  step={10}
                  unit=" EUR"
                  primaryColor={primaryColor}
                />
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={resetToDefaults}
                className="mt-4 gap-2 text-muted-foreground"
              >
                <RotateCcw className="w-4 h-4" />
                Atstatyti numatytasias
              </Button>
            </div>
          </motion.div>

          {/* Results */}
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            {/* Traffic metrics */}
            <div className="bg-card rounded-xl p-6 border shadow-sm">
              <h3 className="font-semibold mb-4">Numatomas srautas</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Papildomas srautas</p>
                  <p className="text-2xl font-bold">
                    +{roi.projectedTrafficGain.toLocaleString("lt-LT")}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Srauto verte</p>
                  <p className="text-2xl font-bold" style={{ color: primaryColor }}>
                    EUR {calculations.trafficValue.toLocaleString("lt-LT")}
                  </p>
                </div>
              </div>
            </div>

            {/* Conversion metrics */}
            <div className="bg-card rounded-xl p-6 border shadow-sm">
              <h3 className="font-semibold mb-4">Numatomi rezultatai</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Konversijos/men.</p>
                  <p className="text-2xl font-bold">
                    {calculations.projectedConversions.toLocaleString("lt-LT")}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pajamos/men.</p>
                  <p className="text-2xl font-bold" style={{ color: primaryColor }}>
                    EUR {calculations.projectedRevenue.toLocaleString("lt-LT")}
                  </p>
                </div>
              </div>
            </div>

            {/* ROI highlight */}
            <motion.div
              className="rounded-xl p-6 text-white"
              style={{ backgroundColor: primaryColor }}
              initial={{ scale: 0.95 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-6 h-6" />
                  <span className="font-semibold">Investiciju graza</span>
                </div>
                <span className="text-4xl font-bold">
                  {calculations.roi > 0 ? "+" : ""}{calculations.roi}%
                </span>
              </div>
              <div className="flex items-center gap-2 text-white/80">
                <Clock className="w-4 h-4" />
                <span>
                  Atsipirkimo laikotarpis: {calculations.paybackMonths} men.
                </span>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
