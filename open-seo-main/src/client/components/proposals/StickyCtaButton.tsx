/**
 * StickyCtaButton component
 * Phase 30: Interactive Proposal Page
 *
 * Sticky call-to-action button that appears after the investment section.
 * Fixed to bottom of screen on mobile, side on desktop.
 */

import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/client/components/ui/button";
import { cn } from "@/client/lib/utils";

interface StickyCtaButtonProps {
  /** Whether the button should be visible */
  isVisible: boolean;
  /** Button click handler */
  onClick: () => void;
  /** Button label text */
  label?: string;
  /** Primary color for the button */
  primaryColor?: string;
  /** Whether the button is in loading state */
  isLoading?: boolean;
  /** Additional CSS class */
  className?: string;
}

/**
 * Renders a sticky CTA button that appears when scrolled past pricing.
 */
export function StickyCtaButton({
  isVisible,
  onClick,
  label = "Sutinku su pasiulymu",
  primaryColor,
  isLoading = false,
  className,
}: StickyCtaButtonProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={cn(
            // Mobile: fixed to bottom
            "fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-md border-t z-50",
            // Desktop: positioned on right side
            "md:bottom-8 md:left-auto md:right-8 md:p-0 md:bg-transparent md:border-0",
            className,
          )}
        >
          <Button
            onClick={onClick}
            disabled={isLoading}
            size="lg"
            className={cn(
              "w-full md:w-auto md:px-8 md:py-6 text-lg font-semibold shadow-lg",
              "transition-transform hover:scale-105 active:scale-95",
            )}
            style={
              primaryColor
                ? {
                    backgroundColor: primaryColor,
                    color: "white",
                  }
                : undefined
            }
          >
            {isLoading ? (
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
              label
            )}
          </Button>

          {/* Mobile safe area padding */}
          <div className="h-safe-area-inset-bottom md:hidden" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
