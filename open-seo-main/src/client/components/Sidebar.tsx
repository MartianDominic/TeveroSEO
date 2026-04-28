import { Link } from "@tanstack/react-router";
import { ChevronsUpDown, X } from "lucide-react";
import { getProjectNavItems } from "@/client/navigation/items";
import { Button } from "@/client/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/client/components/ui/tooltip";

interface SidebarProps {
  projectId: string;
  onNavigate?: () => void;
  onClose?: () => void;
}

export function Sidebar({ projectId, onNavigate, onClose }: SidebarProps) {
  const projectNavItems = getProjectNavItems(projectId);

  return (
    <div className="sidebar w-64 border-r border-border h-full bg-background flex flex-col">
      {/* Header */}
      <div className="px-4 py-4 border-b border-border flex items-center justify-between">
        <span className="font-semibold text-foreground">OpenSEO</span>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Project picker */}
      <div className="px-3 py-3 border-b border-border">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between font-medium text-sm cursor-default"
            >
              <span className="truncate">Default</span>
              <ChevronsUpDown className="size-3.5 shrink-0 text-foreground/40" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Multiple projects coming soon</TooltipContent>
        </Tooltip>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 pl-3 overflow-y-auto">
        {projectNavItems.map((item) => {
          const { icon: Icon, ...linkProps } = item;

          return (
            <Link
              key={linkProps.to}
              {...linkProps}
              onClick={onNavigate}
              activeOptions={{ exact: false, includeSearch: false }}
              className="relative flex items-center gap-3 px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              activeProps={{ className: "text-foreground font-medium" }}
            >
              {({ isActive }: { isActive: boolean }) => (
                <>
                  {isActive ? (
                    <div className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-primary" />
                  ) : null}
                  <Icon className="h-5 w-5" />
                  {item.label}
                </>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
