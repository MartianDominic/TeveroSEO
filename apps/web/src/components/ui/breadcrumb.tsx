/**
 * Breadcrumb Navigation Component
 *
 * HIGH-UX-03: Accessible breadcrumb navigation for deep route hierarchies.
 *
 * Features:
 * - aria-label="Breadcrumb" for screen readers
 * - Structured data support (optional)
 * - Works with any nesting depth
 * - Current page (last item) is not linked
 * - Responsive truncation for mobile
 */

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  /** Display label for the breadcrumb item */
  label: string;
  /** Navigation href - omit for current page (last item) */
  href?: string;
  /** Optional icon component */
  icon?: React.ComponentType<{ className?: string }>;
}

export interface BreadcrumbProps {
  /** Array of breadcrumb items in order from root to current */
  items: BreadcrumbItem[];
  /** Whether to show home icon for first item (default: true) */
  showHomeIcon?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Maximum items to show before collapsing middle items (0 = no collapse) */
  maxItems?: number;
}

/**
 * Breadcrumb navigation component.
 *
 * @example
 * ```tsx
 * <Breadcrumb
 *   items={[
 *     { label: "Dashboard", href: "/dashboard" },
 *     { label: "Clients", href: "/clients" },
 *     { label: "Acme Corp", href: "/clients/123" },
 *     { label: "Settings" }, // Current page - no href
 *   ]}
 * />
 * ```
 */
export function Breadcrumb({
  items,
  showHomeIcon = true,
  className,
  maxItems = 0,
}: BreadcrumbProps) {
  if (items.length === 0) {
    return null;
  }

  // Collapse middle items if maxItems is set and we have more items
  let displayItems = items;
  let hasCollapsed = false;

  if (maxItems > 0 && items.length > maxItems) {
    // Keep first item, ellipsis, and last (maxItems - 2) items
    const keepEnd = maxItems - 2;
    displayItems = [
      items[0],
      { label: "...", href: undefined }, // Ellipsis marker
      ...items.slice(items.length - keepEnd),
    ];
    hasCollapsed = true;
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex items-center gap-1 text-sm", className)}
    >
      <ol className="flex items-center gap-1">
        {displayItems.map((item, index) => {
          const isFirst = index === 0;
          const isLast = index === displayItems.length - 1;
          const isEllipsis = hasCollapsed && index === 1;
          const Icon = item.icon;

          // Generate stable key from href or label
          const key = item.href ?? `${item.label}-${index}`;

          return (
            <li key={key} className="flex items-center gap-1">
              {/* Separator (not for first item) */}
              {!isFirst && (
                <ChevronRight
                  className="h-4 w-4 text-muted-foreground flex-shrink-0"
                  aria-hidden="true"
                />
              )}

              {/* Ellipsis for collapsed items */}
              {isEllipsis ? (
                <span
                  className="text-muted-foreground px-1"
                  aria-hidden="true"
                >
                  ...
                </span>
              ) : item.href && !isLast ? (
                /* Linked item (not current page) */
                <Link
                  href={item.href as Parameters<typeof Link>[0]["href"]}
                  className={cn(
                    "flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors",
                    "max-w-[150px] truncate"
                  )}
                >
                  {isFirst && showHomeIcon && !Icon && (
                    <Home className="h-4 w-4 flex-shrink-0" />
                  )}
                  {Icon && <Icon className="h-4 w-4 flex-shrink-0" />}
                  <span className="truncate">{item.label}</span>
                </Link>
              ) : (
                /* Current page (not linked) */
                <span
                  className={cn(
                    "flex items-center gap-1 font-medium text-foreground",
                    "max-w-[200px] truncate"
                  )}
                  aria-current={isLast ? "page" : undefined}
                >
                  {Icon && <Icon className="h-4 w-4 flex-shrink-0" />}
                  <span className="truncate">{item.label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Helper to build breadcrumb items from pathname segments.
 *
 * @example
 * ```tsx
 * const items = buildBreadcrumbsFromPath("/clients/123/settings", {
 *   "clients": "Clients",
 *   "123": "Acme Corp", // Dynamic segment name
 *   "settings": "Settings",
 * });
 * ```
 */
export function buildBreadcrumbsFromPath(
  pathname: string,
  labelMap: Record<string, string>
): BreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean);
  const items: BreadcrumbItem[] = [];

  let currentPath = "";

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    currentPath += `/${segment}`;

    const label = labelMap[segment] ?? segment;
    const isLast = i === segments.length - 1;

    items.push({
      label,
      href: isLast ? undefined : currentPath,
    });
  }

  return items;
}
