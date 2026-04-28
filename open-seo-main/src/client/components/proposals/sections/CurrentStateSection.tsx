/**
 * CurrentStateSection component
 * Phase 30: Interactive Proposal Page
 *
 * Displays current SEO metrics with animated counters and traffic chart.
 */

import { motion } from "framer-motion";
import { Users, Key, Euro } from "lucide-react";
import { AnimatedCounter } from "../AnimatedCounter";
import { TrafficChart } from "../TrafficChart";
import type { ProposalContent, BrandConfig } from "@/db/proposal-schema";

interface CurrentStateSectionProps {
  content: ProposalContent["currentState"];
  brandConfig?: BrandConfig | null;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix?: string;
  prefix?: string;
  primaryColor: string;
}

function StatCard({
  icon,
  label,
  value,
  suffix = "",
  prefix = "",
  primaryColor,
}: StatCardProps) {
  return (
    <motion.div
      className="bg-card rounded-xl p-6 border shadow-sm"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5 }}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
        style={{ backgroundColor: `${primaryColor}20` }}
      >
        <span style={{ color: primaryColor }}>{icon}</span>
      </div>
      <p className="text-sm text-muted-foreground mb-1">{label}</p>
      <p className="text-3xl font-bold" style={{ color: primaryColor }}>
        <AnimatedCounter
          value={value}
          prefix={prefix}
          suffix={suffix}
          duration={2000}
        />
      </p>
    </motion.div>
  );
}

/**
 * Renders the current state section with metrics and chart.
 */
export function CurrentStateSection({
  content,
  brandConfig,
}: CurrentStateSectionProps) {
  const primaryColor = brandConfig?.primaryColor ?? "#2563eb";

  return (
    <section
      data-section="current"
      className="py-20 px-6 bg-background"
    >
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-2">
            Dabartine Situacija
          </h2>
          <p className="text-muted-foreground mb-8">
            Jusu svetaines organinio srauto rodikliai
          </p>
        </motion.div>

        {/* Stat cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <StatCard
            icon={<Users className="w-6 h-6" />}
            label="Menesinis srautas"
            value={content.traffic}
            suffix=" lankytoju"
            primaryColor={primaryColor}
          />
          <StatCard
            icon={<Key className="w-6 h-6" />}
            label="Reitinguojami raktažodziai"
            value={content.keywords}
            primaryColor={primaryColor}
          />
          <StatCard
            icon={<Euro className="w-6 h-6" />}
            label="Srauto verte"
            value={content.value}
            prefix="EUR "
            suffix="/men."
            primaryColor={primaryColor}
          />
        </div>

        {/* Traffic chart */}
        {content.chartData.length > 0 && (
          <motion.div
            className="bg-card rounded-xl p-6 border shadow-sm"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <h3 className="text-lg font-semibold mb-4">Srauto tendencijos</h3>
            <TrafficChart
              data={content.chartData}
              primaryColor={primaryColor}
              height={250}
            />
          </motion.div>
        )}
      </div>
    </section>
  );
}
