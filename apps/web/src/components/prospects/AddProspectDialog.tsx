"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Button,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@tevero/ui";
import { Plus, Loader2 } from "lucide-react";
import { createProspectAction } from "@/app/(shell)/prospects/actions";

interface AddProspectDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

const INDUSTRIES = [
  "Technology",
  "E-commerce",
  "Healthcare",
  "Finance",
  "Real Estate",
  "Education",
  "Manufacturing",
  "Professional Services",
  "Hospitality",
  "Other",
];

const SOURCES = [
  "Referral",
  "Cold Outreach",
  "Inbound Lead",
  "Conference",
  "LinkedIn",
  "Website",
  "Other",
];

export function AddProspectDialog({
  trigger,
  onSuccess,
}: AddProspectDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    domain: "",
    companyName: "",
    contactEmail: "",
    contactName: "",
    industry: "",
    source: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!formData.domain.trim()) {
        throw new Error("Domain is required");
      }

      await createProspectAction({
        domain: formData.domain.trim(),
        companyName: formData.companyName.trim() || undefined,
        contactEmail: formData.contactEmail.trim() || undefined,
        contactName: formData.contactName.trim() || undefined,
        industry: formData.industry || undefined,
        source: formData.source || undefined,
        notes: formData.notes.trim() || undefined,
      });

      setOpen(false);
      setFormData({
        domain: "",
        companyName: "",
        contactEmail: "",
        contactName: "",
        industry: "",
        source: "",
        notes: "",
      });

      onSuccess?.();
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create prospect",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Prospect
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add New Prospect</DialogTitle>
            <DialogDescription>
              Enter the domain and contact details for the prospect you want to
              analyze.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="domain">
                Domain <span className="text-destructive">*</span>
              </Label>
              <Input
                id="domain"
                placeholder="example.com"
                value={formData.domain}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, domain: e.target.value }))
                }
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Enter the domain without https:// or www.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                placeholder="Acme Corporation"
                value={formData.companyName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    companyName: e.target.value,
                  }))
                }
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="contactName">Contact Name</Label>
                <Input
                  id="contactName"
                  placeholder="John Smith"
                  value={formData.contactName}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      contactName: e.target.value,
                    }))
                  }
                  disabled={loading}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contactEmail">Contact Email</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  placeholder="john@example.com"
                  value={formData.contactEmail}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      contactEmail: e.target.value,
                    }))
                  }
                  disabled={loading}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="industry">Industry</Label>
                <Select
                  value={formData.industry}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, industry: value }))
                  }
                  disabled={loading}
                >
                  <SelectTrigger id="industry">
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map((industry) => (
                      <SelectItem key={industry} value={industry}>
                        {industry}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="source">Source</Label>
                <Select
                  value={formData.source}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, source: value }))
                  }
                  disabled={loading}
                >
                  <SelectTrigger id="source">
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCES.map((source) => (
                      <SelectItem key={source} value={source}>
                        {source}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes about this prospect..."
                value={formData.notes}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, notes: e.target.value }))
                }
                disabled={loading}
                rows={3}
              />
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Prospect
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
