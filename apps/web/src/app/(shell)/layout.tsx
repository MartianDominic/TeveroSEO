import { AppShell } from "@/components/shell/AppShell";
import { ThemeProvider } from "@/contexts/ThemeContext";

export default function ShelledLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <AppShell>{children}</AppShell>
    </ThemeProvider>
  );
}
