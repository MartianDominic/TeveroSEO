import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SEO Proposal',
  description: 'View your personalized SEO proposal',
  robots: 'noindex, nofollow', // Don't index proposal pages
};

export default function ProspectPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {children}
    </div>
  );
}
