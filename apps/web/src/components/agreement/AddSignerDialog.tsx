"use client";

/**
 * Add Signer Dialog Component
 * Phase 59: Agreement & Signing Excellence - Pre-Signing Flow (59-06)
 *
 * Modal form for adding a new signer to the agreement.
 * Collects name (required), email (required), phone (optional), title (optional).
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@tevero/ui";
import { Button } from "@tevero/ui";
import { Input } from "@tevero/ui";
import { Label } from "@tevero/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@tevero/ui";

interface AddSignerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (data: {
    name: string;
    email: string;
    phone?: string;
    title?: string;
    role?: string;
  }) => void;
}

export function AddSignerDialog({ open, onOpenChange, onAdd }: AddSignerDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [role, setRole] = useState<string>("client");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    setIsSubmitting(true);
    await onAdd({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      title: title.trim() || undefined,
      role,
    });

    // Reset form
    setName("");
    setEmail("");
    setPhone("");
    setTitle("");
    setRole("client");
    setIsSubmitting(false);
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      // Reset form when closing
      setName("");
      setEmail("");
      setPhone("");
      setTitle("");
      setRole("client");
    }
    onOpenChange(isOpen);
  };

  const isValid = name.trim().length > 0 && email.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Signer</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="signer-name">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="signer-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Smith"
              required
              autoFocus
              aria-invalid={!name.trim() && name !== "" ? "true" : undefined}
              aria-describedby="signer-name-error"
            />
            {!name.trim() && name !== "" && (
              <p id="signer-name-error" role="alert" className="text-sm text-red-500">
                Name is required
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="signer-email">
              Email <span className="text-red-500">*</span>
            </Label>
            <Input
              id="signer-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
              required
              aria-invalid={!email.trim() && email !== "" ? "true" : undefined}
              aria-describedby="signer-email-error"
            />
            {!email.trim() && email !== "" && (
              <p id="signer-email-error" role="alert" className="text-sm text-red-500">
                Email is required
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="signer-phone">Phone</Label>
            <Input
              id="signer-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+370 600 12345"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="signer-title">Title / Position</Label>
            <Input
              id="signer-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="CEO, Director, etc."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="role">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="provider">Provider</SelectItem>
                <SelectItem value="client">Client</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !isValid}>
              {isSubmitting ? "Adding..." : "Add Signer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
