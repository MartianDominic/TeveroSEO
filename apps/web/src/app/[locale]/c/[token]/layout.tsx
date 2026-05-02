import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

/**
 * Contract page layout.
 * Phase 59: Agreement & Signing Excellence
 *
 * Minimal public layout with no authentication.
 * Provides NextIntlClientProvider for i18n in client components.
 */

interface ContractLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function ContractLayout({
  children,
  params,
}: ContractLayoutProps) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div className="min-h-screen bg-gray-50">{children}</div>
    </NextIntlClientProvider>
  );
}
