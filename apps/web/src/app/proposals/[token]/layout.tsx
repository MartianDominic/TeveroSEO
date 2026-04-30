/**
 * Public proposal layout.
 * Phase 46-47: Proposal System
 *
 * Minimal layout without auth wrapper for public proposal viewing.
 * Uses Geist font for clean typography.
 */
import type { Metadata } from "next";
import "../../../globals.css";

export const metadata: Metadata = {
  title: "Proposal",
  description: "View your SEO proposal",
};

export default function ProposalPublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="lt">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,300..700;1,6..72,400..600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[#fafaf7] antialiased">
        {children}
      </body>
    </html>
  );
}
