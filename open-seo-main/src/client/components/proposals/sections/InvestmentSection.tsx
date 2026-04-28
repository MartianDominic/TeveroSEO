/**
 * InvestmentSection component
 * Phase 30: Interactive Proposal Page
 *
 * Displays pricing with setup fee, monthly fee, and inclusions checklist.
 */

import { motion } from "framer-motion";
import { Check, Euro, Calendar, Sparkles } from "lucide-react";
import { Card } from "@/client/components/ui/card";
import { AnimatedCounter } from "../AnimatedCounter";
import type { ProposalContent, BrandConfig } from "@/db/proposal-schema";

interface InvestmentSectionProps {
  investment: ProposalContent["investment"];
  currency?: string;
  brandConfig?: BrandConfig | null;
}

/**
 * Renders the investment/pricing section.
 */
export function InvestmentSection({
  investment,
  currency = "EUR",
  brandConfig,
}: InvestmentSectionProps) {
  const primaryColor = brandConfig?.primaryColor ?? "#2563eb";

  return (
    <section
      data-section="investment"
      className="py-20 px-6 bg-muted/30"
    >
      <div className="max-w-4xl mx-auto">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-2">
            Investicija
          </h2>
          <p className="text-muted-foreground">
            Skaidi kainodara be papildomu mokesciu
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {/* Setup fee card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5 }}
          >
            <Card className="p-6 h-full">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${primaryColor}20` }}
                >
                  <Sparkles className="w-6 h-6" style={{ color: primaryColor }} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pradinis mokestis</p>
                  <p className="text-xs text-muted-foreground">Vienkartinis</p>
                </div>
              </div>
              <p className="text-4xl font-bold" style={{ color: primaryColor }}>
                <AnimatedCounter
                  value={investment.setupFee}
                  prefix={`${currency} `}
                  duration={1500}
                />
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Svetaines auditas, strategijos kurimas, pradiniu optimizavimo darbu
              </p>
            </Card>
          </motion.div>

          {/* Monthly fee card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card className="p-6 h-full border-2" style={{ borderColor: primaryColor }}>
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Menesinis mokestis</p>
                  <p className="text-xs text-muted-foreground">Kas menesi</p>
                </div>
              </div>
              <p className="text-4xl font-bold" style={{ color: primaryColor }}>
                <AnimatedCounter
                  value={investment.monthlyFee}
                  prefix={`${currency} `}
                  suffix="/men."
                  duration={1500}
                />
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Nuolatinis optimizavimas, ataskaitos, technine prieziura
              </p>
            </Card>
          </motion.div>
        </div>

        {/* Inclusions checklist */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="p-6">
            <h3 className="font-semibold mb-6 flex items-center gap-2">
              <Euro className="w-5 h-5" style={{ color: primaryColor }} />
              Ka gausite:
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {investment.inclusions.map((item, index) => (
                <motion.div
                  key={index}
                  className="flex items-start gap-3"
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <span>{item}</span>
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Guarantee note */}
        <motion.p
          className="text-center text-sm text-muted-foreground mt-8"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
        >
          * Visi kainos nurodytos be PVM. Sutartis gali buti nutraukta per 30 dienu ispejus.
        </motion.p>
      </div>
    </section>
  );
}
