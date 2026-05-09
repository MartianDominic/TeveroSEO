"use client";

/**
 * Developer Handoff Component
 * Phase 66-05: Developer Handoff Flow
 *
 * Form for sending installation instructions to a developer.
 * Features:
 * - Email input with validation
 * - Optional name and message fields
 * - Live email preview
 * - Send button with loading state
 */
import { useState, useCallback, useMemo } from "react";

import {
  Loader2,
  Mail,
  Send,
  Check,
  AlertCircle,
  User,
  MessageSquare,
  Eye,
} from "lucide-react";

import {
  Button,
  Input,
  Label,
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  Textarea,
} from "@tevero/ui";

// ============================================================================
// Types
// ============================================================================

interface DeveloperHandoffProps {
  /** Installation ID */
  installationId: string;
  /** Domain being installed */
  domain: string;
  /** Site ID for snippet */
  siteId: string;
  /** Current user's name (sender) */
  senderName: string;
  /** Callback when handoff is sent */
  onSent?: (handoffId: string, magicLink: string) => void;
  /** Callback to go back */
  onBack?: () => void;
}

interface HandoffFormData {
  email: string;
  name: string;
  message: string;
}

interface SendHandoffResult {
  handoffId: string;
  magicLink: string;
  status: "sent";
}

// ============================================================================
// Email validation
// ============================================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

// ============================================================================
// Component
// ============================================================================

export function DeveloperHandoff({
  installationId,
  domain,
  siteId,
  senderName,
  onSent,
  onBack,
}: DeveloperHandoffProps) {
  const [form, setForm] = useState<HandoffFormData>({
    email: "",
    name: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [sentData, setSentData] = useState<SendHandoffResult | null>(null);

  // Validate form
  const isValid = useMemo(() => {
    return form.email.trim() !== "" && validateEmail(form.email);
  }, [form.email]);

  // Generate email preview
  const emailPreview = useMemo(() => {
    const snippet = `<script async src="https://pixel.tevero.io/t.js" data-site="${siteId}"></script>`;

    return {
      subject: `Add TeveroSEO to ${domain} (30 seconds)`,
      body: `Hi,

${senderName} has asked you to add TeveroSEO tracking to ${domain}. Here's all you need:
${form.message ? `\n"${form.message}"\n` : ""}
Add this line to the <head> of your site:

${snippet}

Or click the button below for step-by-step instructions.

That's it! Questions? Reply to this email.`,
    };
  }, [domain, siteId, senderName, form.message]);

  // Handle form field changes
  const handleChange = useCallback(
    (field: keyof HandoffFormData) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
        setError(null);
      },
    []
  );

  // Send handoff
  const handleSend = useCallback(async () => {
    if (!isValid) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/connect/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installationId,
          email: form.email,
          name: form.name || undefined,
          message: form.message || undefined,
          senderName,
          domain,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send");
      }

      const result: SendHandoffResult = await response.json();
      setSentData(result);
      setSuccess(true);
      onSent?.(result.handoffId, result.magicLink);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [form, installationId, domain, senderName, isValid, onSent]);

  // Success state
  if (success && sentData) {
    return (
      <Card className="w-full max-w-lg mx-auto">
        <CardContent className="pt-8 pb-8">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Instructions Sent!
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                We sent an email to{" "}
                <span className="font-medium">{form.email}</span>
              </p>
            </div>
            <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md w-full">
              <p>They will receive:</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li>Step-by-step instructions</li>
                <li>The code snippet to paste</li>
                <li>A magic link to our guide</li>
              </ul>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button variant="outline" onClick={onBack}>
            Back to Connection
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <h3 className="text-lg font-semibold">Send to Your Tech Person</h3>
        <p className="text-sm text-muted-foreground">
          We will email them simple instructions. Usually done in 30 seconds.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Email field */}
        <div className="space-y-2">
          <Label htmlFor="email" className="flex items-center gap-1.5">
            <Mail className="h-4 w-4" />
            Their Email Address
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="developer@company.com"
            value={form.email}
            onChange={handleChange("email")}
            disabled={loading}
            className={
              form.email && !validateEmail(form.email)
                ? "border-destructive focus:ring-destructive"
                : ""
            }
          />
          {form.email && !validateEmail(form.email) && (
            <p className="text-xs text-destructive">
              Please enter a valid email address
            </p>
          )}
        </div>

        {/* Name field (optional) */}
        <div className="space-y-2">
          <Label htmlFor="name" className="flex items-center gap-1.5">
            <User className="h-4 w-4" />
            Their Name
            <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="name"
            placeholder="John"
            value={form.name}
            onChange={handleChange("name")}
            disabled={loading}
          />
        </div>

        {/* Message field (optional) */}
        <div className="space-y-2">
          <Label htmlFor="message" className="flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4" />
            Add a Message
            <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="message"
            placeholder="Hey! Can you add this to our site? Should take 30 seconds. Thanks!"
            value={form.message}
            onChange={handleChange("message")}
            disabled={loading}
            rows={3}
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground text-right">
            {form.message.length}/500
          </p>
        </div>

        {/* Email preview */}
        <div className="space-y-2 pt-2">
          <Label className="flex items-center gap-1.5">
            <Eye className="h-4 w-4" />
            Email Preview
          </Label>
          <div className="border rounded-md p-4 bg-muted/30 text-sm space-y-3">
            <div>
              <span className="text-muted-foreground">Subject: </span>
              <span className="font-medium">{emailPreview.subject}</span>
            </div>
            <hr className="border-border" />
            <pre className="whitespace-pre-wrap font-sans text-foreground/80 text-xs leading-relaxed">
              {emailPreview.body}
            </pre>
            <div className="pt-2">
              <Button size="sm" variant="outline" disabled className="w-full">
                One-Click Install
              </Button>
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button variant="ghost" onClick={onBack} disabled={loading}>
          Back
        </Button>
        <Button onClick={handleSend} disabled={!isValid || loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          Send Email
        </Button>
      </CardFooter>
    </Card>
  );
}

// ============================================================================
// Handoff Status Tracker
// ============================================================================

interface HandoffStatusProps {
  handoffs: Array<{
    id: string;
    developerEmail: string;
    developerName: string | null;
    status: string;
    sentAt: Date | string;
    openedAt: Date | string | null;
    completedAt: Date | string | null;
    reminderCount: number;
  }>;
  onSendReminder?: (handoffId: string) => void;
  loading?: boolean;
}

export function HandoffStatusTracker({
  handoffs,
  onSendReminder,
  loading,
}: HandoffStatusProps) {
  if (handoffs.length === 0) {
    return null;
  }

  const statusColors: Record<string, string> = {
    sent: "bg-yellow-100 text-yellow-800",
    opened: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    expired: "bg-gray-100 text-gray-500",
  };

  const statusLabels: Record<string, string> = {
    sent: "Sent",
    opened: "Opened",
    completed: "Completed",
    expired: "Expired",
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-foreground">Pending Handoffs</h4>
      {handoffs.map((h) => (
        <div
          key={h.id}
          className="flex items-center justify-between p-3 border rounded-md bg-card"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <Mail className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">{h.developerEmail}</p>
              <p className="text-xs text-muted-foreground">
                Sent{" "}
                {new Date(h.sentAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
                {h.reminderCount > 0 && ` (${h.reminderCount} reminders)`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[h.status] || statusColors.sent}`}
            >
              {statusLabels[h.status] || h.status}
            </span>
            {h.status === "sent" && h.reminderCount < 3 && onSendReminder && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onSendReminder(h.id)}
                disabled={loading}
              >
                Remind
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
