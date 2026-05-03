import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { getLocale } from "next-intl/server";
import { ThemeScript } from "@/contexts/ThemeContext";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: "Tevero",
  description: "TeveroSEO unified platform",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  return (
    <ClerkProvider>
      <html lang={locale} className={`${geist.variable} ${geistMono.variable} ${newsreader.variable}`} suppressHydrationWarning>
        <head>
          {/* MED-25 FIX: Blocking script to prevent theme flash */}
          <ThemeScript />
        </head>
        <body className="min-h-screen bg-canvas text-text-2 antialiased font-sans">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
