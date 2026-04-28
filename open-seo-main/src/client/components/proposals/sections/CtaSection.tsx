/**
 * CtaSection component
 * Phase 30: Interactive Proposal Page
 *
 * Call-to-action section with accept button and next steps.
 */

import { motion } from "framer-motion";
import { ArrowRight, CheckCircle } from "lucide-react";
import { Button } from "@/client/components/ui/button";
import type { ProposalContent, BrandConfig } from "@/db/proposal-schema";

interface CtaSectionProps {
  nextSteps: ProposalContent["nextSteps"];
  brandConfig?: BrandConfig | null;
  onAccept: () => void;
  isAccepting?: boolean;
}

/**
 * Renders the CTA section with next steps and accept button.
 */
export function CtaSection({
  nextSteps,
  brandConfig,
  onAccept,
  isAccepting = false,
}: CtaSectionProps) {
  const primaryColor = brandConfig?.primaryColor ?? "#2563eb";

  return (
    <section
      data-section="cta"
      className="py-20 px-6 bg-background"
    >
      <div className="max-w-3xl mx-auto">
        {/* Next steps */}
        {nextSteps.length > 0 && (
          <motion.div
            className="mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center">
              Tolesni Žingsniai
            </h2>
            <div className="space-y-4">
              {nextSteps.map((step, index) => (
                <motion.div
                  key={index}
                  className="flex items-start gap-4"
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {index + 1}
                  </div>
                  <div className="pt-2">
                    <p className="text-lg">{step}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* CTA card */}
        <motion.div
          className="rounded-2xl p-8 md:p-12 text-center text-white"
          style={{ backgroundColor: primaryColor }}
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <motion.div
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ type: "spring", delay: 0.3 }}
          >
            <CheckCircle className="w-16 h-16 mx-auto mb-6 opacity-90" />
          </motion.div>

          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Pasiruose pradeti?
          </h2>
          <p className="text-lg opacity-90 mb-8 max-w-xl mx-auto">
            Paspauskite mygtuka, kad patvirtintumete pasiulyma ir pradetumete bendradarbiavima.
          </p>

          <Button
            onClick={onAccept}
            disabled={isAccepting}
            size="lg"
            className="bg-white text-foreground hover:bg-white/90 px-8 py-6 text-lg font-semibold shadow-lg transition-transform hover:scale-105 active:scale-95"
          >
            {isAccepting ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Palaukite...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Sutinku su pasiulymu
                <ArrowRight className="w-5 h-5" />
              </span>
            )}
          </Button>

          <p className="text-sm opacity-70 mt-6">
            Paspaudus mygtuka, bussite nukreipti i e. pasirasymo sistema.
          </p>
        </motion.div>

        {/* Footer */}
        <motion.div
          className="mt-12 text-center text-sm text-muted-foreground"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
        >
          <p>
            Turite klausimų? Susisiekite su mumis -{" "}
            <a
              href="mailto:info@tevero.io"
              className="underline hover:text-foreground transition-colors"
            >
              info@tevero.io
            </a>
          </p>
        </motion.div>
      </div>
    </section>
  );
}
