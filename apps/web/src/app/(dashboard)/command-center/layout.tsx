import type { Metadata } from "next";

/**
 * Command Center Layout
 * Phase 62-05: Command Center Dashboard Core
 *
 * Layout wrapper for the Command Center with metadata.
 */

export const metadata: Metadata = {
  title: "Command Center | TeveroSEO",
  description: "Agency operations dashboard - pipeline, revenue, and actions",
};

export default function CommandCenterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-full min-h-screen bg-background">
      {children}
    </div>
  );
}
