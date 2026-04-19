"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@tevero/ui";
import { FileText, Loader2 } from "lucide-react";
import { generateReport } from "@/lib/reports/actions";

interface GenerateReportButtonProps {
  clientId: string;
}

const LOCALES = [
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "lt", label: "Lietuviu" },
];

export function GenerateReportButton({ clientId }: GenerateReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [locale, setLocale] = useState("en");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleGenerate = () => {
    startTransition(async () => {
      try {
        const result = await generateReport(clientId, { locale });
        setOpen(false);
        router.push(`/clients/${clientId}/reports/${result.reportId}` as Parameters<typeof router.push>[0]);
        router.refresh();
      } catch (error) {
        // Error handling - could show toast in future
        // eslint-disable-next-line no-console
        console.error("Failed to generate report:", error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <FileText className="h-4 w-4 mr-2" />
          Generate Report
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate New Report</DialogTitle>
          <DialogDescription>
            Create a new Monthly SEO Report for the last 30 days.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="locale">Report Language</Label>
          <Select value={locale} onValueChange={setLocale}>
            <SelectTrigger id="locale" className="mt-2">
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              {LOCALES.map((loc) => (
                <SelectItem key={loc.value} value={loc.value}>
                  {loc.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground mt-2">
            Keywords and queries will be shown in their original language.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
