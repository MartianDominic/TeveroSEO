/**
 * OpportunitiesSection component
 * Phase 30: Interactive Proposal Page
 *
 * Displays keyword opportunities with difficulty badges and search volume.
 */

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/client/components/ui/button";
import { Badge } from "@/client/components/ui/badge";
import { AnimatedCounter } from "../AnimatedCounter";
import type { ProposalContent, BrandConfig, OpportunityDifficulty } from "@/db/proposal-schema";

interface OpportunitiesSectionProps {
  opportunities: ProposalContent["opportunities"];
  brandConfig?: BrandConfig | null;
}

/**
 * Returns styling for difficulty badge.
 */
function getDifficultyBadgeStyle(difficulty: OpportunityDifficulty) {
  switch (difficulty) {
    case "easy":
      return "bg-green-500/20 text-green-400 border-green-500/30";
    case "medium":
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "hard":
      return "bg-red-500/20 text-red-400 border-red-500/30";
  }
}

/**
 * Returns Lithuanian label for difficulty.
 */
function getDifficultyLabel(difficulty: OpportunityDifficulty): string {
  switch (difficulty) {
    case "easy":
      return "Lengvas";
    case "medium":
      return "Vidutinis";
    case "hard":
      return "Sunkus";
  }
}

interface KeywordRowProps {
  keyword: string;
  volume: number;
  difficulty: OpportunityDifficulty;
  potential: number;
  primaryColor: string;
  index: number;
}

function KeywordRow({
  keyword,
  volume,
  difficulty,
  potential,
  primaryColor,
  index,
}: KeywordRowProps) {
  return (
    <motion.div
      className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg bg-muted/50 gap-3"
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <div className="flex-1">
        <span className="font-medium">{keyword}</span>
        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Search className="w-3 h-3" />
            {volume.toLocaleString("lt-LT")} paiesku/men.
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Badge
          variant="outline"
          className={getDifficultyBadgeStyle(difficulty)}
        >
          {getDifficultyLabel(difficulty)}
        </Badge>
        <div className="text-right min-w-[100px]">
          <span className="flex items-center gap-1 justify-end font-semibold" style={{ color: primaryColor }}>
            <TrendingUp className="w-4 h-4" />
            EUR {potential.toLocaleString("lt-LT")}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

const INITIAL_DISPLAY_COUNT = 10;

/**
 * Renders the opportunities section with expandable keyword list.
 */
export function OpportunitiesSection({
  opportunities,
  brandConfig,
}: OpportunitiesSectionProps) {
  const [showAll, setShowAll] = useState(false);
  const primaryColor = brandConfig?.primaryColor ?? "#2563eb";

  const displayedOpportunities = showAll
    ? opportunities
    : opportunities.slice(0, INITIAL_DISPLAY_COUNT);

  const totalPotential = useMemo(
    () => opportunities.reduce((sum, o) => sum + o.potential, 0),
    [opportunities]
  );
  const totalVolume = useMemo(
    () => opportunities.reduce((sum, o) => sum + o.volume, 0),
    [opportunities]
  );

  return (
    <section
      data-section="opportunities"
      className="py-20 px-6 bg-muted/30"
    >
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-2">
                Raktažodžiu Galimybes
              </h2>
              <p className="text-muted-foreground">
                Rasta {opportunities.length} galimybiu auginti organini srauta
              </p>
            </div>

            <div className="flex gap-6 text-sm">
              <div className="text-right">
                <p className="text-muted-foreground">Bendras potencialas</p>
                <p className="text-2xl font-bold" style={{ color: primaryColor }}>
                  <AnimatedCounter
                    value={totalPotential}
                    prefix="EUR "
                    duration={2000}
                  />
                </p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground">Menesines paieskos</p>
                <p className="text-2xl font-bold">
                  <AnimatedCounter
                    value={totalVolume}
                    duration={2000}
                  />
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {opportunities.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">
            Nera galimybiu duomenu.
          </p>
        ) : (
          <>
            {/* Keyword list */}
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {displayedOpportunities.map((opp, index) => (
                  <KeywordRow
                    key={opp.keyword}
                    keyword={opp.keyword}
                    volume={opp.volume}
                    difficulty={opp.difficulty}
                    potential={opp.potential}
                    primaryColor={primaryColor}
                    index={index}
                  />
                ))}
              </AnimatePresence>
            </div>

            {/* Show more/less button */}
            {opportunities.length > INITIAL_DISPLAY_COUNT && (
              <motion.div
                className="mt-6 text-center"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
              >
                <Button
                  variant="outline"
                  onClick={() => setShowAll(!showAll)}
                  className="gap-2"
                >
                  {showAll ? (
                    <>
                      Rodyti maziau
                      <ChevronUp className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      Rodyti visas {opportunities.length} galimybes
                      <ChevronDown className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </motion.div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
