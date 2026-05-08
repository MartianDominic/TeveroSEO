/**
 * Shared Recharts Theme Configuration
 * Phase UI-04: Design System Chart Colors
 *
 * Uses CSS variables from the design system for consistent theming
 * and automatic dark mode support.
 */

/**
 * Chart color palette using CSS variables.
 * These colors are defined in app.css and support dark mode.
 */
export const CHART_COLORS = {
  primary: 'hsl(var(--chart-1))',
  secondary: 'hsl(var(--chart-2))',
  tertiary: 'hsl(var(--chart-3))',
  quaternary: 'hsl(var(--chart-4))',
  quinary: 'hsl(var(--chart-5))',
  // Semantic colors from design system
  success: 'hsl(var(--success))',
  warning: 'hsl(var(--warning))',
  destructive: 'hsl(var(--destructive))',
  muted: 'hsl(var(--muted-foreground))',
  info: 'hsl(var(--info))',
} as const;

/**
 * Array of chart colors for iteration
 */
export const CHART_COLOR_PALETTE = [
  CHART_COLORS.primary,
  CHART_COLORS.secondary,
  CHART_COLORS.tertiary,
  CHART_COLORS.quaternary,
  CHART_COLORS.quinary,
] as const;

/**
 * Get chart color by index (cycles through palette)
 */
export function getChartColor(index: number): string {
  return CHART_COLOR_PALETTE[index % CHART_COLOR_PALETTE.length];
}

/**
 * Recharts grid configuration
 */
export const CHART_GRID = {
  strokeDasharray: '3 3',
  stroke: 'hsl(var(--border))',
  strokeOpacity: 0.6,
} as const;

/**
 * Recharts axis configuration
 */
export const CHART_AXIS = {
  stroke: 'hsl(var(--muted-foreground))',
  fontSize: 12,
  fontFamily: 'var(--font-geist-sans, Inter, ui-sans-serif, system-ui)',
  tickLine: false,
  axisLine: false,
} as const;

/**
 * Recharts tooltip style configuration
 */
export const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: 'hsl(var(--popover))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '6px',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    padding: '8px 12px',
  },
  labelStyle: {
    color: 'hsl(var(--popover-foreground))',
    fontWeight: 500,
    marginBottom: '4px',
  },
  itemStyle: {
    color: 'hsl(var(--popover-foreground))',
    fontSize: '12px',
  },
} as const;

/**
 * Recharts legend style configuration
 */
export const CHART_LEGEND_STYLE = {
  wrapperStyle: {
    fontSize: 12,
    fontFamily: 'var(--font-geist-sans, Inter, ui-sans-serif, system-ui)',
  },
} as const;

/**
 * Combined chart configuration object
 */
export const CHART_CONFIG = {
  colors: CHART_COLORS,
  grid: CHART_GRID,
  axis: CHART_AXIS,
  tooltip: CHART_TOOLTIP_STYLE,
  legend: CHART_LEGEND_STYLE,
} as const;

/**
 * Default chart margins
 */
export const CHART_MARGINS = {
  top: 20,
  right: 30,
  left: 10,
  bottom: 20,
} as const;

/**
 * Status-based colors for data visualization
 */
export const STATUS_COLORS = {
  above: CHART_COLORS.success,
  at: CHART_COLORS.muted,
  below: CHART_COLORS.destructive,
  neutral: CHART_COLORS.muted,
} as const;

export type ChartColorKey = keyof typeof CHART_COLORS;
export type StatusColorKey = keyof typeof STATUS_COLORS;
