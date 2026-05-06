// @tevero/ui — shared design system
// Barrel: every symbol apps/web imports from @/components/ui/* must be re-exported here.
// Keep sorted alphabetically by component file.

export { cn } from "./lib/utils";
export * from "./lib/tokens";
export * from "./lib/status-config";
export { formatRelativeTime, formatShortDate, formatDateTime, formatTime } from "./lib/format-time";

export { CardActionMenu } from "./components/card-action-menu";
export type { CardActionMenuProps, CardAction } from "./components/card-action-menu";

export { Checklist, ChecklistItem } from "./components/checklist";
export type { ChecklistProps, ChecklistItemProps } from "./components/checklist";

export { ProgressBar, progressBarVariants, progressBarFillVariants } from "./components/progress-bar";
export type { ProgressBarProps } from "./components/progress-bar";

export { Badge, badgeVariants } from "./components/badge";
export type { BadgeProps } from "./components/badge";

export { Button, buttonVariants } from "./components/button";
export type { ButtonProps } from "./components/button";

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from "./components/card";
export type { CardProps } from "./components/card";

export { ProgressBlock } from "./components/progress-block";
export type { ProgressBlockProps } from "./components/progress-block";

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "./components/chart";
export type { ChartConfig } from "./components/chart";

export { Checkbox } from "./components/checkbox";

export { CmsHealthBadge } from "./components/cms-health-badge";

export {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from "./components/command";
// NOTE: CommandDialog is NOT exported — it does not exist in command.tsx source.
// Plan 03 should not import CommandDialog from @tevero/ui.

export { Alert, AlertTitle, AlertDescription, alertVariants } from "./components/alert";

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "./components/alert-dialog";

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./components/dialog";

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
} from "./components/dropdown-menu";

export { ErrorBanner } from "./components/error-banner";

export { Input } from "./components/input";
export type { InputProps } from "./components/input";

export { KanbanColumn, KanbanCard } from "./components/kanban";
export type { KanbanColumnProps, KanbanCardProps } from "./components/kanban";

export { Label } from "./components/label";

export { PageHeader } from "./components/page-header";
export type { PageHeaderProps } from "./components/page-header";

export { PipelineStageCard } from "./components/pipeline-stage-card";
export type { PipelineStageCardProps } from "./components/pipeline-stage-card";

export {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
} from "./components/popover";

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
} from "./components/select";

export { Separator } from "./components/separator";

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from "./components/sheet";

export { Skeleton } from "./components/skeleton";

export { StepIndicator } from "./components/step-indicator";
export type { StepIndicatorProps } from "./components/step-indicator";

export { Slider } from "./components/slider";

export { StatusChip } from "./components/status-chip";
export type { StatusChipProps } from "./components/status-chip";

export { Switch } from "./components/switch";

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from "./components/table";

export { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/tabs";

export { Textarea } from "./components/textarea";
export type { TextareaProps } from "./components/textarea";

export { TodayFeedItem } from "./components/today-feed-item";
export type { TodayFeedItemProps } from "./components/today-feed-item";

// Phase 44-04 Components
export { EntityCard } from "./components/entity-card";
export type { EntityCardProps, EntityCardAvatar } from "./components/entity-card";

export { StepWizard } from "./components/step-wizard";
export type { StepWizardProps, WizardStep } from "./components/step-wizard";

export { SegmentedProgressBar } from "./components/segmented-progress-bar";
export type { SegmentedProgressBarProps, ProgressSegment } from "./components/segmented-progress-bar";

export { MetricCard } from "./components/metric-card";
export type { MetricCardProps, MetricDelta } from "./components/metric-card";

export {
  PageTitle,
  SectionTitle,
  TypographyCardTitle,
  Eyebrow,
  SmallCaps,
  Mono,
  Body,
  Caption,
} from "./components/typography";
export type { TypographyProps } from "./components/typography";

export { NumMega, NumHero, NumCard, NumRow, NumTiny, NumDelta } from "./components/numerals";
export type { NumProps, NumDeltaProps } from "./components/numerals";

export { RelativeTimestamp } from "./components/relative-timestamp";
export type { RelativeTimestampProps } from "./components/relative-timestamp";

// Phase 44-05 Components
export { HealthGauge } from "./components/health-gauge";
export type { HealthGaugeProps } from "./components/health-gauge";

export { SeverityDots } from "./components/severity-dots";
export type { SeverityDotsProps } from "./components/severity-dots";

export { TierBreakdownTable } from "./components/tier-breakdown-table";
export type { TierBreakdownTableProps, Finding } from "./components/tier-breakdown-table";

export { ConnectionStatusCard } from "./components/connection-status-card";
export type {
  ConnectionStatusCardProps,
  ConnectionService,
  ConnectionStatus,
} from "./components/connection-status-card";

export { DropCausesPanel } from "./components/drop-causes-panel";
export type {
  DropCausesPanelProps,
  DropCause,
  DropCauseType,
} from "./components/drop-causes-panel";

export { ReportPreviewCard } from "./components/report-preview-card";
export type {
  ReportPreviewCardProps,
  ReportType,
  ReportStatus,
} from "./components/report-preview-card";

export { OpsStrip } from "./components/ops-strip";
export type {
  OpsStripProps,
  OpsStripItem,
  OpsStripItemType,
  OpsStripItemStatus,
} from "./components/ops-strip";

export { VelocityStrip } from "./components/velocity-strip";
export type { VelocityStripProps } from "./components/velocity-strip";

export { PeriodSelector } from "./components/period-selector";
export type { PeriodSelectorProps, PeriodValue } from "./components/period-selector";

export { KeyboardShortcutHint } from "./components/keyboard-shortcut-hint";
export type { KeyboardShortcutHintProps } from "./components/keyboard-shortcut-hint";

export { IntentBadge } from "./components/intent-badge";
export type { IntentBadgeProps, SearchIntent } from "./components/intent-badge";

export { CountBadge } from "./components/count-badge";
export type { CountBadgeProps } from "./components/count-badge";

// Phase 44-06 UX State Components
export { EmptyState, emptyStateVariants } from "./components/empty-state";
export type { EmptyStateProps, EmptyStateAction } from "./components/empty-state";

export { ErrorState, errorStateVariants } from "./components/error-state";
export type { ErrorStateProps } from "./components/error-state";

export { LoadingSkeleton, loadingSkeletonVariants } from "./components/loading-skeleton";
export type { LoadingSkeletonProps } from "./components/loading-skeleton";

export { DataStateWrapper } from "./components/data-state-wrapper";
export type { DataStateWrapperProps } from "./components/data-state-wrapper";

// Phase 44-07: Accessibility Foundation
export { FocusTrap } from "./components/focus-trap";
export type { FocusTrapProps } from "./components/focus-trap";

export { SkipToMain } from "./components/skip-to-main";
export type { SkipToMainProps } from "./components/skip-to-main";

export { AriaLive } from "./components/aria-live";
export type { AriaLiveProps } from "./components/aria-live";

export {
  KeyboardPatterns,
  useKeyboardNavigation,
  getKeyboardAction,
} from "./lib/keyboard-patterns";
export type { KeyboardAction, KeyboardPatternName } from "./lib/keyboard-patterns";
