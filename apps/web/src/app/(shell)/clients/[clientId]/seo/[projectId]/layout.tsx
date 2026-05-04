/**
 * Layout for SEO project pages.
 *
 * FIX-06 H-NEXT-01: Converted to RSC by extracting QueryClient to SeoQueryProvider.
 * This allows child routes to be Server Components when possible, improving
 * performance by reducing client-side JavaScript bundle size.
 *
 * The SeoQueryProvider handles TanStack Query context for data fetching.
 */
import type { ReactNode } from "react";
import { SeoQueryProvider } from "./SeoQueryProvider";

export default function SeoProjectLayout({ children }: { children: ReactNode }) {
  return <SeoQueryProvider>{children}</SeoQueryProvider>;
}
