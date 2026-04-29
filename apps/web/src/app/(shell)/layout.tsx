import { AppShell } from "@/components/shell/AppShell";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ErrorBoundary } from "@/components/error-boundary";

export default function ShelledLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <AppShell>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </AppShell>
    </ThemeProvider>
  );
}
