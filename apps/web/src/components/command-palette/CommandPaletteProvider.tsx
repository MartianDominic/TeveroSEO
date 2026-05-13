"use client";

/**
 * CommandPaletteProvider - Phase 101-03
 *
 * Provider component that wraps the app and includes GlobalCommandPalette.
 * Place at the root layout to enable Cmd+K everywhere.
 */
import * as React from "react";
import { GlobalCommandPalette } from "./GlobalCommandPalette";

interface CommandPaletteProviderProps {
  children: React.ReactNode;
}

/**
 * Provider that enables the global command palette.
 *
 * Usage in layout.tsx:
 * ```tsx
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <CommandPaletteProvider>
 *           {children}
 *         </CommandPaletteProvider>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 */
export function CommandPaletteProvider({
  children,
}: CommandPaletteProviderProps) {
  const [showQuickCapture, setShowQuickCapture] = React.useState(false);
  const [showNewDeal, setShowNewDeal] = React.useState(false);
  const [showRecordPayment, setShowRecordPayment] = React.useState(false);

  return (
    <>
      {children}
      <GlobalCommandPalette
        onQuickCapture={() => setShowQuickCapture(true)}
        onNewDeal={() => setShowNewDeal(true)}
        onRecordPayment={() => setShowRecordPayment(true)}
      />
      {/* QuickCaptureModal and other modals will be wired in Task 3 */}
    </>
  );
}

// Re-export hook for convenience
export { useCommandPalette } from "@/hooks/useCommandPalette";
