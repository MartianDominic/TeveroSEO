/**
 * ProgressIndicator component
 * Phase 30: Interactive Proposal Page
 *
 * Side navigation dots showing current section in scrollytelling.
 * Click to scroll to any section.
 */

import { motion } from "framer-motion";
import { cn } from "@/client/lib/utils";

interface Section {
  id: string;
  label: string;
}

interface ProgressIndicatorProps {
  /** List of sections to display */
  sections: readonly Section[];
  /** Currently active section ID */
  activeSection: string;
  /** Callback when a section dot is clicked */
  onSectionClick: (sectionId: string) => void;
  /** Position on screen */
  position?: "left" | "right";
  /** Additional CSS class */
  className?: string;
}

/**
 * Renders a vertical progress indicator with clickable dots.
 * Shows which section is currently active.
 */
export function ProgressIndicator({
  sections,
  activeSection,
  onSectionClick,
  position = "right",
  className,
}: ProgressIndicatorProps) {
  return (
    <nav
      className={cn(
        "fixed top-1/2 -translate-y-1/2 z-50 hidden md:flex flex-col items-center gap-3",
        position === "right" ? "right-6" : "left-6",
        className,
      )}
      aria-label="Section navigation"
    >
      {sections.map((section) => {
        const isActive = section.id === activeSection;

        return (
          <button
            key={section.id}
            onClick={() => onSectionClick(section.id)}
            className="group relative flex items-center"
            aria-label={`Go to ${section.label}`}
            aria-current={isActive ? "true" : undefined}
          >
            {/* Dot */}
            <motion.div
              className={cn(
                "w-3 h-3 rounded-full border-2 transition-colors duration-300",
                isActive
                  ? "bg-primary border-primary"
                  : "bg-transparent border-muted-foreground/40 group-hover:border-primary/60",
              )}
              initial={false}
              animate={{
                scale: isActive ? 1.2 : 1,
              }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            />

            {/* Label tooltip */}
            <motion.span
              className={cn(
                "absolute whitespace-nowrap px-2 py-1 text-xs font-medium bg-background/95 border rounded shadow-sm",
                position === "right"
                  ? "right-full mr-3"
                  : "left-full ml-3",
                "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto",
                "transition-opacity duration-200",
              )}
            >
              {section.label}
            </motion.span>
          </button>
        );
      })}

      {/* Connecting line */}
      <div
        className={cn(
          "absolute top-0 bottom-0 w-px bg-muted-foreground/20",
          position === "right" ? "right-[5px]" : "left-[5px]",
          "-z-10",
        )}
        style={{
          top: "6px",
          bottom: "6px",
        }}
      />

      {/* Active section highlight line */}
      <motion.div
        className={cn(
          "absolute w-px bg-primary",
          position === "right" ? "right-[5px]" : "left-[5px]",
          "-z-10",
        )}
        initial={false}
        animate={{
          top: `${sections.findIndex((s) => s.id === activeSection) * 24 + 6}px`,
          height: "12px",
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      />
    </nav>
  );
}
