/**
 * HeroSection component
 * Phase 30: Interactive Proposal Page
 *
 * Full-screen hero with animated value counter and scroll indicator.
 */

import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { AnimatedCounter } from "../AnimatedCounter";
import type { ProposalContent, BrandConfig } from "@/db/proposal-schema";

interface HeroSectionProps {
  content: ProposalContent["hero"];
  brandConfig?: BrandConfig | null;
  companyName?: string;
  expiresAt?: Date | null;
  onScrollDown: () => void;
}

/**
 * Formats an expiration date in Lithuanian.
 */
function formatExpirationDate(date: Date): string {
  const months = [
    "sausio", "vasario", "kovo", "balandzio", "geguzes", "birzelio",
    "liepos", "rugpjucio", "rugsejo", "spalio", "lapkricio", "gruodzio",
  ];
  const day = date.getDate();
  const month = months[date.getMonth()];
  return `${month} ${day} d.`;
}

/**
 * Renders the hero section of the proposal.
 */
export function HeroSection({
  content,
  brandConfig,
  companyName,
  expiresAt,
  onScrollDown,
}: HeroSectionProps) {
  const primaryColor = brandConfig?.primaryColor ?? "#2563eb";
  const secondaryColor = brandConfig?.secondaryColor ?? "#1e40af";

  return (
    <section
      data-section="hero"
      className="min-h-screen relative flex flex-col items-center justify-center px-6 py-12"
      style={{
        background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
      }}
    >
      {/* Header with logo and expiration */}
      <motion.div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4 text-white/80"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6 }}
      >
        {brandConfig?.logoUrl ? (
          <img
            src={brandConfig.logoUrl}
            alt="Logo"
            className="h-10 object-contain"
          />
        ) : (
          <div className="h-10" />
        )}
        {expiresAt && (
          <span className="text-sm">
            Galioja iki: {formatExpirationDate(new Date(expiresAt))}
          </span>
        )}
      </motion.div>

      {/* Main content */}
      <div className="max-w-3xl mx-auto text-center text-white">
        <motion.p
          className="text-lg uppercase tracking-wider opacity-80 mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          SEO Galimybiu Analize
        </motion.p>

        {companyName && (
          <motion.h2
            className="text-xl md:text-2xl opacity-90 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            {companyName}
          </motion.h2>
        )}

        <motion.h1
          className="text-3xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
        >
          {content.headline}
        </motion.h1>

        <motion.p
          className="text-xl md:text-2xl opacity-90 mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
        >
          {content.subheadline}
        </motion.p>

        {/* Animated traffic value */}
        <motion.div
          className="bg-white/10 backdrop-blur-sm rounded-2xl px-8 py-6 inline-block"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.7, duration: 0.6 }}
        >
          <p className="text-sm uppercase tracking-wider opacity-70 mb-2">
            Neišnaudotas potencialas
          </p>
          <p className="text-4xl md:text-6xl font-bold">
            <AnimatedCounter
              value={content.trafficValue}
              prefix="EUR "
              suffix="/men."
              duration={2500}
              formatNumber={true}
              locale="lt-LT"
            />
          </p>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.button
        onClick={onScrollDown}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/80 hover:text-white transition-colors"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.6 }}
        aria-label="Scroll down"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="flex flex-col items-center gap-2"
        >
          <span className="text-sm">Skaityti analize</span>
          <ChevronDown className="w-6 h-6" />
        </motion.div>
      </motion.button>
    </section>
  );
}
