"use client";

import React, { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  LayoutDashboard,
  Calendar,
  Brain,
  Settings,
  BarChart3,
  Globe,
  List,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Plus,
  Sun,
  Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useClientStore } from "@/stores";
import { useAuth } from "@clerk/nextjs";
import { TopBar } from "./TopBar";
import { CommandPalette } from "./CommandPalette";
import { useTheme } from "@/contexts/ThemeContext";
import { TeveroMark } from "@/components/brand/TeveroLogo";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { apiGet } from "@/lib/api-client";

const COLLAPSED_KEY = "appshell_collapsed";

// ---------------------------------------------------------------------------
// usePlatformHealth — fetches /api/platform-secrets/status and derives health
// ---------------------------------------------------------------------------

type PlatformHealth = "ok" | "partial" | "none";

const usePlatformHealth = (): PlatformHealth => {
  const { isSignedIn } = useAuth();
  const [health, setHealth] = useState<PlatformHealth>("none");

  useEffect(() => {
    if (!isSignedIn) return;
    apiGet<Array<{ key_name: string; required: boolean; configured: boolean }>>(
      "/api/platform-secrets/status"
    )
      .then((data) => {
        // Standard required keys (excludes dataforseo keys which are all required:false now)
        const standardRequired = data.filter((s) => s.required);
        const standardConfigured = standardRequired.filter(
          (s) => s.configured
        ).length;

        // DataForSEO: either (login + password) or base_code counts as one satisfied slot
        const login = data.find((s) => s.key_name === "dataforseo_login");
        const password = data.find((s) => s.key_name === "dataforseo_password");
        const baseCode = data.find(
          (s) => s.key_name === "dataforseo_base_code"
        );
        const dataforseoOk =
          (login?.configured && password?.configured) || baseCode?.configured;

        // Total slots = standard required + dataforseo-as-a-service
        const totalSlots = standardRequired.length + 1;
        const configuredSlots = standardConfigured + (dataforseoOk ? 1 : 0);

        if (configuredSlots === totalSlots) setHealth("ok");
        else if (configuredSlots > 0) setHealth("partial");
        else setHealth("none");
      })
      .catch(() => {
        // silent fail — don't break the shell on network errors
      });
  }, [isSignedIn]);

  return health;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a stable HSL color from a string (client name → avatar circle) */
function seedColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 48%)`;
}

function clientInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

// ---------------------------------------------------------------------------
// NavItem types
// ---------------------------------------------------------------------------

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: (clientId: string) => string;
  clientScoped: boolean;
}

const CLIENT_NAV: NavItem[] = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: (id) => `/clients/${id}`,
    clientScoped: true,
  },
  {
    label: "Calendar",
    icon: Calendar,
    href: (id) => `/clients/${id}/calendar`,
    clientScoped: true,
  },
  {
    label: "Articles",
    icon: List,
    href: (id) => `/clients/${id}/articles`,
    clientScoped: true,
  },
  {
    label: "Intelligence",
    icon: Brain,
    href: (id) => `/clients/${id}/intelligence`,
    clientScoped: true,
  },
  {
    label: "Settings",
    icon: Settings,
    href: (id) => `/clients/${id}/settings`,
    clientScoped: true,
  },
  {
    label: "Analytics",
    icon: BarChart3,
    href: (id) => `/clients/${id}/analytics`,
    clientScoped: true,
  },
  {
    label: "SEO Audit",
    icon: Search,
    href: (id) => `/clients/${id}/seo`,
    clientScoped: true,
  },
];

const GLOBAL_NAV: NavItem[] = [
  {
    label: "Global Settings",
    icon: Globe,
    href: () => "/settings",
    clientScoped: false,
  },
];

// ---------------------------------------------------------------------------
// ClientSwitcherButton — inline integrated switcher (top of sidebar)
// ---------------------------------------------------------------------------

interface ClientSwitcherButtonProps {
  collapsed: boolean;
}

const ClientSwitcherButton: React.FC<ClientSwitcherButtonProps> = ({
  collapsed,
}) => {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const {
    clients,
    activeClient,
    activeClientId,
    isLoading,
    fetchClients,
    setActiveClient,
  } = useClientStore();

  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isSignedIn && clients.length === 0) {
      fetchClients();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  if (!isSignedIn) return null;

  const handleSelect = (clientId: string) => {
    setActiveClient(clientId);
    setOpen(false);
    router.push(
      `/clients/${clientId}` as Parameters<typeof router.push>[0]
    );
    router.refresh();
  };

  const handleAddNew = () => {
    setOpen(false);
    router.push("/clients" as Parameters<typeof router.push>[0]);
  };

  const name = activeClient?.name ?? "";
  const triggerLabel = name || "Select client";

  // Collapsed: just the colored initial circle
  if (collapsed) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            title={triggerLabel}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white",
              "transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
            style={name ? { backgroundColor: seedColor(name) } : undefined}
          >
            {name ? (
              clientInitial(name)
            ) : (
              <Globe className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-64 p-0"
          align="start"
          side="right"
          sideOffset={8}
        >
          <ClientSwitcherPopoverContent
            clients={clients}
            activeClientId={activeClientId}
            isLoading={isLoading}
            onSelect={handleSelect}
            onAddNew={handleAddNew}
          />
        </PopoverContent>
      </Popover>
    );
  }

  // Expanded: full-width button with circle + name + chevron
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium",
            "hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
        >
          {/* Colored initial circle */}
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-white"
            style={
              name
                ? { backgroundColor: seedColor(name) }
                : { backgroundColor: "hsl(var(--muted))" }
            }
          >
            {name ? clientInitial(name) : "?"}
          </span>

          {/* Name */}
          <span className="flex-1 truncate text-left">
            {isLoading ? "Loading..." : triggerLabel}
          </span>

          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-64 p-0"
        align="start"
        side="right"
        sideOffset={8}
      >
        <ClientSwitcherPopoverContent
          clients={clients}
          activeClientId={activeClientId}
          isLoading={isLoading}
          onSelect={handleSelect}
          onAddNew={handleAddNew}
        />
      </PopoverContent>
    </Popover>
  );
};

// Shared popover body
interface PopoverBodyProps {
  clients: Array<{ id: string; name: string }>;
  activeClientId: string | null;
  isLoading: boolean;
  onSelect: (id: string) => void;
  onAddNew: () => void;
}

const ClientSwitcherPopoverContent: React.FC<PopoverBodyProps> = ({
  clients,
  activeClientId,
  onSelect,
  onAddNew,
}) => (
  <Command>
    <CommandInput placeholder="Search clients..." className="h-9" />
    <CommandList>
      <CommandEmpty>No clients found.</CommandEmpty>
      <CommandGroup>
        {clients.map((client) => (
          <CommandItem
            key={client.id}
            value={client.name}
            onSelect={() => onSelect(client.id)}
            className="flex items-center gap-2"
          >
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white"
              style={{ backgroundColor: seedColor(client.name) }}
            >
              {clientInitial(client.name)}
            </span>
            <span className="flex-1 truncate">{client.name}</span>
            {client.id === activeClientId && (
              <Check className="h-4 w-4 shrink-0 text-primary" />
            )}
          </CommandItem>
        ))}
      </CommandGroup>
      <CommandGroup>
        <CommandItem
          onSelect={onAddNew}
          className="flex items-center gap-2 text-muted-foreground"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span>Add new client</span>
        </CommandItem>
      </CommandGroup>
    </CommandList>
  </Command>
);

// ---------------------------------------------------------------------------
// AppShell
// ---------------------------------------------------------------------------

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { activeClientId } = useClientStore();
  const { theme, toggleTheme } = useTheme();
  const platformHealth = usePlatformHealth();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return (
        typeof window !== "undefined" &&
        localStorage.getItem(COLLAPSED_KEY) === "true"
      );
    } catch {
      return false;
    }
  });

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, String(collapsed));
    } catch {
      // ignore storage errors
    }
  }, [collapsed]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      document.documentElement.style.setProperty(
        "--cursor-x",
        e.clientX + "px"
      );
      document.documentElement.style.setProperty(
        "--cursor-y",
        e.clientY + "px"
      );
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const toggle = useCallback(() => setCollapsed((prev) => !prev), []);

  const isActive = useCallback(
    (href: string): boolean => {
      if (activeClientId && href === `/clients/${activeClientId}`) {
        return pathname === href;
      }
      return pathname.startsWith(href);
    },
    [pathname, activeClientId]
  );

  const renderNavItem = (item: NavItem, index: number) => {
    const Icon = item.icon;
    const disabled = item.clientScoped && !activeClientId;
    const href = activeClientId ? item.href(activeClientId) : "#";
    const active = activeClientId ? isActive(item.href(activeClientId)) : false;
    const isGlobalSettings = item.label === "Global Settings";

    return (
      <button
        key={index}
        title={collapsed ? item.label : undefined}
        disabled={disabled}
        onClick={() => {
          if (!disabled && href !== "#") {
            router.push(href as Parameters<typeof router.push>[0]);
          }
        }}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
          collapsed ? "justify-center" : "justify-start",
          active
            ? "bg-accent text-foreground font-medium"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
          disabled && "pointer-events-none opacity-40"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="truncate">{item.label}</span>}
        {/* Platform health dot — only on the Global Settings nav item */}
        {isGlobalSettings && !collapsed && (
          <span
            className={cn(
              "ml-auto h-2 w-2 rounded-full shrink-0",
              platformHealth === "ok" && "bg-emerald-500",
              platformHealth === "partial" && "bg-amber-400",
              platformHealth === "none" && "bg-red-500 animate-pulse"
            )}
          />
        )}
      </button>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex shrink-0 flex-col border-r border-border bg-card",
          "transition-[width] duration-200 ease-in-out",
          collapsed ? "w-12" : "w-[220px]"
        )}
      >
        {/* Logo row */}
        <div
          className={cn(
            "flex h-14 shrink-0 items-center border-b border-border px-4",
            collapsed ? "justify-center" : "gap-2"
          )}
        >
          <TeveroMark size={22} className="shrink-0" />
          {!collapsed && (
            <span className="truncate text-sm font-semibold tracking-tight text-foreground">
              TeveroSEO
            </span>
          )}
        </div>

        {/* Client switcher — TOP, most prominent element */}
        <div
          className={cn(
            "shrink-0 border-b border-border",
            collapsed ? "flex justify-center p-3" : "p-3"
          )}
        >
          <ClientSwitcherButton collapsed={collapsed} />
        </div>

        {/* Client nav */}
        <nav className="flex-1 overflow-y-auto p-3">
          {!collapsed && (
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground px-3 mb-1.5 mt-5">
              Client
            </p>
          )}
          <div className="space-y-0.5">
            {CLIENT_NAV.map((item, i) => renderNavItem(item, i))}
          </div>

          {!collapsed && (
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground px-3 mb-1.5 mt-5">
              Workspace
            </p>
          )}
          {collapsed && <div className="mt-2" />}
          <div className="space-y-0.5">
            {GLOBAL_NAV.map((item, i) =>
              renderNavItem(item, i + CLIENT_NAV.length)
            )}
          </div>
        </nav>

        {/* Bottom section: UserButton + theme toggle + collapse toggle */}
        <div className="shrink-0 border-t border-border p-3 space-y-0.5">
          {/* Clerk UserButton */}
          <div
            className={cn(
              "flex items-center rounded-md px-2 py-2",
              collapsed ? "justify-center" : "gap-2.5"
            )}
          >
            <UserButton />
            {!collapsed && (
              <span className="text-xs text-muted-foreground truncate">
                Account
              </span>
            )}
          </div>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            title={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
            className={cn(
              "flex w-full items-center rounded-md px-2 py-2 text-xs text-muted-foreground",
              "transition-colors hover:bg-accent/50 hover:text-foreground",
              collapsed ? "justify-center" : "gap-2.5"
            )}
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4 shrink-0" />
            ) : (
              <Moon className="h-4 w-4 shrink-0" />
            )}
            {!collapsed && (
              <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
            )}
          </button>

          {/* Collapse toggle */}
          <button
            onClick={toggle}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex w-full items-center rounded-md px-2 py-2 text-xs text-muted-foreground",
              "transition-colors hover:bg-accent/50 hover:text-foreground",
              collapsed ? "justify-center" : "gap-2.5"
            )}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4 shrink-0" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 shrink-0" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Content column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar onOpen={() => setIsCommandPaletteOpen(true)} />
        <main
          className={cn(
            "flex-1 overflow-y-auto relative",
            theme === "light" && "dot-grid cursor-glow"
          )}
        >
          {children}
        </main>
      </div>

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
    </div>
  );
};
