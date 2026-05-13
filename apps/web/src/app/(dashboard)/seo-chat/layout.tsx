import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SEO Chat | TeveroSEO',
  description: 'AI-powered SEO analysis and proposal generation',
};

export default function SeoChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-[calc(100vh-4rem)]">
      {children}
    </div>
  );
}
