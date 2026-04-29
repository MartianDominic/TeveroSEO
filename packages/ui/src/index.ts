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
