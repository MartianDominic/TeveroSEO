import { ErrorBoundary } from "@/components/error-boundary";
import { AppShell } from "@/components/shell/AppShell";
import { ClientSwitchOverlay } from "@/components/ui/client-switch-overlay";
import { ThemeProvider } from "@/contexts/ThemeContext";

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
      {/* HIGH-UX-01: Loading overlay during client switch */}
      <ClientSwitchOverlay />
    </ThemeProvider>
  );
}
