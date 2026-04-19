"use client";

/**
 * Live preview of branded report header.
 *
 * Shows how the report header will look with current branding settings.
 */

interface BrandingPreviewProps {
  /** Logo URL (null for no logo) */
  logoUrl: string | null;
  /** Primary color (hex) */
  primaryColor: string;
  /** Secondary color (hex) */
  secondaryColor: string;
  /** Client name to display */
  clientName: string;
}

/**
 * Convert hex color to RGB format for preview consistency.
 */
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Live preview component showing branded report header.
 */
export function BrandingPreview({
  logoUrl,
  primaryColor,
  secondaryColor,
  clientName,
}: BrandingPreviewProps) {
  const primaryRgb = hexToRgb(primaryColor);
  const borderColor = "rgb(229, 231, 235)"; // Same as REPORT_COLORS.border

  // Format today's date for preview
  const today = new Date();
  const lastMonth = new Date(today);
  lastMonth.setMonth(lastMonth.getMonth() - 1);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="rounded-lg border border-border bg-white overflow-hidden">
      <div className="px-3 py-2 bg-muted/30 border-b border-border">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Report Header Preview
        </p>
      </div>

      <div
        className="p-6"
        style={{
          borderBottom: `2px solid ${borderColor}`,
        }}
      >
        {/* Logo + Title row */}
        <div className="flex items-start gap-4">
          {logoUrl && (
            <img
              src={logoUrl}
              alt="Logo preview"
              className="h-12 max-w-[160px] object-contain shrink-0"
            />
          )}
          <div className="flex-1">
            <h1
              className="text-xl font-bold mb-0.5"
              style={{ color: primaryRgb }}
            >
              {clientName || "Your Company"}
            </h1>
            <h2 className="text-base font-medium text-muted-foreground mb-2">
              Monthly SEO Report
            </h2>
            <p className="text-sm text-muted-foreground">
              Date Range: {formatDate(lastMonth)} - {formatDate(today)}
            </p>
          </div>
        </div>
      </div>

      {/* Stats preview (muted to show header is main focus) */}
      <div className="p-4 opacity-50">
        <div className="grid grid-cols-4 gap-3">
          {["Clicks", "Impressions", "Sessions", "Users"].map((label) => (
            <div
              key={label}
              className="rounded border border-border p-3"
            >
              <div className="text-xs text-muted-foreground mb-1">{label}</div>
              <div
                className="text-lg font-semibold"
                style={{ color: label === "Clicks" ? primaryRgb : undefined }}
              >
                ---
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
