import * as React from "react";
import { Link, useLocation } from "@tanstack/react-router";
import {
  ChevronsUpDown,
  CircleHelp,
  CreditCard,
  Menu,
  User,
} from "lucide-react";
import {
  AppContent,
  MissingSeoSetupModal,
  SeoApiStatusBanners,
} from "@/client/layout/AppShellParts";
import { ThemePreferenceMenuItems } from "@/client/components/ThemePreferenceMenuItems";
import { getProjectNavItems } from "@/client/navigation/items";
import { signOutAndRedirect, useSession } from "@/lib/auth-client";
import { isHostedClientAuthMode } from "@/lib/auth-mode";
import { BILLING_ROUTE } from "@/shared/billing";
import { getSeoApiKeyStatus } from "@/serverFunctions/config";
import { Button, buttonVariants } from "@/client/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/client/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/client/components/ui/tooltip";
import { cn } from "@/client/lib/utils";

const DATAFORSEO_HELP_PATH = "/help/dataforseo-api-key";
const SUPPORT_PATH = "/support";

export function AuthenticatedAppLayout({
  children,
  projectId,
}: {
  children: React.ReactNode;
  projectId?: string;
}) {
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const setupModalRef = React.useRef<HTMLDivElement | null>(null);
  const [isSeoApiKeyConfigured, setIsSeoApiKeyConfigured] = React.useState<
    boolean | null
  >(null);
  const [seoApiKeyStatusError, setSeoApiKeyStatusError] = React.useState(false);
  const [showMissingSeoApiKeyModal, setShowMissingSeoApiKeyModal] =
    React.useState(false);

  React.useEffect(() => {
    if (location.pathname === BILLING_ROUTE) {
      setSeoApiKeyStatusError(false);
      setIsSeoApiKeyConfigured(null);
      setShowMissingSeoApiKeyModal(false);
      return;
    }

    let cancelled = false;

    const checkSeoApiKeyStatus = async () => {
      try {
        const result = await getSeoApiKeyStatus();
        if (cancelled) return;

        setSeoApiKeyStatusError(false);
        setIsSeoApiKeyConfigured(result.configured);
        if (!result.configured) {
          setShowMissingSeoApiKeyModal(true);
        }
      } catch {
        if (cancelled) return;
        setSeoApiKeyStatusError(true);
        setIsSeoApiKeyConfigured(null);
        setShowMissingSeoApiKeyModal(false);
      }
    };

    void checkSeoApiKeyStatus();

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  const shouldShowMissingSeoApiKeyModal =
    showMissingSeoApiKeyModal && location.pathname !== DATAFORSEO_HELP_PATH;

  const shouldShowSeoApiWarning =
    !seoApiKeyStatusError &&
    isSeoApiKeyConfigured === false &&
    !shouldShowMissingSeoApiKeyModal;

  React.useEffect(() => {
    if (!shouldShowMissingSeoApiKeyModal) return;

    setupModalRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowMissingSeoApiKeyModal(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [shouldShowMissingSeoApiKeyModal]);

  React.useEffect(() => {
    if (!projectId) {
      setDrawerOpen(false);
    }
  }, [projectId]);

  return (
    <div className="flex h-[100dvh] flex-col bg-muted">
      <TopNav
        drawerOpen={drawerOpen}
        projectId={projectId ?? null}
        pathname={location.pathname}
        onOpenDrawer={() => setDrawerOpen(true)}
      />

      <SeoApiStatusBanners
        shouldShowSeoApiWarning={shouldShowSeoApiWarning}
        seoApiKeyStatusError={seoApiKeyStatusError}
      />

      <AppContent
        drawerOpen={drawerOpen}
        projectId={projectId ?? null}
        onCloseDrawer={() => setDrawerOpen(false)}
      >
        {children}
      </AppContent>

      <MissingSeoSetupModal
        ref={setupModalRef}
        isOpen={shouldShowMissingSeoApiKeyModal}
        onClose={() => setShowMissingSeoApiKeyModal(false)}
      />
    </div>
  );
}

function TopNav({
  drawerOpen,
  projectId,
  pathname,
  onOpenDrawer,
}: {
  drawerOpen: boolean;
  projectId: string | null;
  pathname: string;
  onOpenDrawer: () => void;
}) {
  const projectNavItems = projectId ? getProjectNavItems(projectId) : [];
  const isSupportActive = pathname === SUPPORT_PATH;

  return (
    <div className="shrink-0 flex items-center gap-2 border-b border-border bg-background px-2 h-14">
      <div className="flex flex-none items-center md:hidden">
        {projectId ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Toggle sidebar"
            aria-expanded={drawerOpen}
            onClick={onOpenDrawer}
          >
            <Menu className="h-6 w-6" />
          </Button>
        ) : null}
        <Link to="/" className="ml-1 font-semibold text-foreground">
          OpenSEO
        </Link>
      </div>

      <div className="hidden items-center gap-1 md:flex">
        <Link to="/" className="px-2 text-lg font-semibold text-foreground">
          OpenSEO
        </Link>
        {projectId
          ? projectNavItems.map((item) => {
              const { icon: Icon, matchSegment, ...linkProps } = item;
              const isActive = pathname.includes(matchSegment);

              return (
                <Link
                  key={linkProps.to}
                  {...linkProps}
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" }),
                    "gap-2",
                    isActive
                      ? "border-transparent bg-primary/10 font-medium text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })
          : null}
      </div>

      <div className="flex-1" />

      <div className="hidden flex-none items-center gap-2 md:flex">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to={SUPPORT_PATH}
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "h-8 w-8",
                isSupportActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <CircleHelp className="h-4 w-4" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="bottom">Help & Community</TooltipContent>
        </Tooltip>

        <div className="flex items-center rounded-full border border-border bg-background/70 px-1 py-1 shadow-sm">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="flex h-10 cursor-default items-center gap-2 rounded-full px-3 text-left transition-colors hover:bg-muted/80"
                aria-label="Current project"
              >
                <span className="max-w-28 truncate text-sm font-medium text-foreground">
                  Default
                </span>
                <ChevronsUpDown className="size-3.5 shrink-0 text-foreground/35" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">Multiple projects coming soon</TooltipContent>
          </Tooltip>

          <AccountMenu />
        </div>
      </div>

      <AccountMenu mobileOnly />
    </div>
  );
}

function AccountMenu({ mobileOnly = false }: { mobileOnly?: boolean }) {
  const { data: session } = useSession();
  const isHostedMode = isHostedClientAuthMode();
  const email = session?.user?.email;

  const handleSignOut = () => signOutAndRedirect();

  const trigger = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={mobileOnly ? "" : "hover:bg-muted/80"}
      aria-label="Open account menu"
    >
      <User className="h-5 w-5" />
    </Button>
  );

  const menu = (
    <div className={mobileOnly ? "ml-2 flex-none md:hidden" : "flex-none"}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {trigger}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          {email ? (
            <>
              <DropdownMenuLabel className="max-w-full">
                <span className="truncate text-foreground block">{email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
            </>
          ) : null}
          {mobileOnly ? (
            <DropdownMenuItem asChild>
              <Link to={SUPPORT_PATH} className="flex items-center gap-2">
                <CircleHelp className="h-4 w-4" />
                Help & Community
              </Link>
            </DropdownMenuItem>
          ) : null}
          {isHostedMode ? (
            <DropdownMenuItem asChild>
              <a href={BILLING_ROUTE} className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Billing
              </a>
            </DropdownMenuItem>
          ) : null}
          {isHostedMode && email ? (
            <DropdownMenuItem
              onClick={handleSignOut}
              className="text-destructive"
            >
              Sign out
            </DropdownMenuItem>
          ) : null}
          <ThemePreferenceMenuItems />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  if (mobileOnly) {
    return menu;
  }

  return (
    <>
      <div className="mx-1 h-6 w-px bg-border" />
      {menu}
    </>
  );
}
