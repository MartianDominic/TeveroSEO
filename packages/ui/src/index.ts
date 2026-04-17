// @tevero/ui — shared design system
// Barrel: every symbol apps/web imports from @/components/ui/* must be re-exported here.
// Keep sorted alphabetically by component file.

export { cn } from "./lib/utils";

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

export { Label } from "./components/label";

export { PageHeader } from "./components/page-header";
export type { PageHeaderProps } from "./components/page-header";

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
