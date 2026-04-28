/**
 * Protection Rules Editor
 * Phase 37-05: Voice Settings UI
 *
 * Visual editor for content protection rules:
 * - List of existing rules with type, target, reason, expiration
 * - Add rule dialog with type-specific validation
 * - Test rule functionality to preview matches
 * - Delete rule with confirmation
 * - Bulk CSV import
 *
 * Security:
 * - T-37-13: Target values are displayed as text content, not HTML
 */
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Loader2,
  Plus,
  Trash2,
  Upload,
  FlaskConical,
  AlertTriangle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";
import { Badge } from "@/client/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/client/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/client/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import {
  getProtectionRulesFn,
  createProtectionRuleFn,
  deleteProtectionRuleFn,
  importProtectionRulesCsvFn,
} from "@/serverFunctions/voice";
import type {
  ContentProtectionRuleSelect,
  ProtectionRuleType,
} from "@/db/voice-schema";

interface Props {
  profileId: string;
}

interface TestResult {
  matched: boolean;
  preview: string;
  ruleTarget: string;
}

const RULE_TYPE_LABELS: Record<ProtectionRuleType, { label: string; hint: string }> = {
  page: {
    label: "Page",
    hint: "URL path (e.g., /about, /services/*)",
  },
  section: {
    label: "Section",
    hint: "CSS selector (e.g., .hero-text, #mission-statement)",
  },
  pattern: {
    label: "Pattern",
    hint: "Regex pattern (e.g., \\d{3}-\\d{4})",
  },
};

export function ProtectionRulesEditor({ profileId }: Props) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newRuleType, setNewRuleType] = useState<ProtectionRuleType>("page");
  const [newTarget, setNewTarget] = useState("");
  const [newReason, setNewReason] = useState("");
  const [newExpires, setNewExpires] = useState("");

  // Test result state
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  // Import state
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  // Fetch rules
  const {
    data: rules,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["protection-rules", profileId],
    queryFn: () => getProtectionRulesFn({ data: { profileId } }),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: createProtectionRuleFn,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["protection-rules", profileId],
      });
      resetForm();
      setShowAddDialog(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProtectionRuleFn,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["protection-rules", profileId],
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: importProtectionRulesCsvFn,
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ["protection-rules", profileId],
      });
      setImportSuccess(`Imported ${result.imported} rules`);
      setImportError(null);
      if (result.errors && result.errors.length > 0) {
        setImportError(`${result.errors.length} rows had errors`);
      }
    },
    onError: (err: Error) => {
      setImportError(err.message);
      setImportSuccess(null);
    },
  });

  const resetForm = () => {
    setNewRuleType("page");
    setNewTarget("");
    setNewReason("");
    setNewExpires("");
  };

  const handleAddRule = () => {
    if (!newTarget.trim() || !newReason.trim()) return;

    createMutation.mutate({
      data: {
        profileId,
        ruleType: newRuleType,
        target: newTarget.trim(),
        reason: newReason.trim(),
        expiresAt: newExpires ? new Date(newExpires).toISOString() : undefined,
      },
    });
  };

  const handleDeleteRule = (ruleId: string) => {
    deleteMutation.mutate({ data: { ruleId } });
  };

  /**
   * Test a rule by simulating a match.
   */
  const handleTestRule = (rule: ContentProtectionRuleSelect) => {
    let preview = "";

    switch (rule.ruleType) {
      case "page":
        preview = `Would match URLs like: /about, /services/consulting\nPattern: ${rule.target}`;
        break;
      case "section":
        preview = `Would select elements matching CSS: ${rule.target}\nExample: <div class="${rule.target.replace(".", "")}">...content...</div>`;
        break;
      case "pattern":
        try {
          const regex = new RegExp(rule.target, "gi");
          const testText =
            "Contact us at 555-1234 or email support@example.com";
          const matches = testText.match(regex);
          preview = matches
            ? `Matches found in test text: ${matches.join(", ")}`
            : "No matches in test text";
        } catch {
          preview = "Invalid regex pattern";
        }
        break;
    }

    setTestResult({
      matched: true,
      preview,
      ruleTarget: rule.target,
    });
  };

  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const csvContent = event.target?.result as string;
      importMutation.mutate({
        data: {
          profileId,
          csvContent,
        },
      });
    };
    reader.readAsText(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load protection rules: {(error as Error).message}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Protection Rules</CardTitle>
            <CardDescription>
              Define content that should be preserved from changes
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {/* CSV Import */}
            <input
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={handleCsvImport}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={importMutation.isPending}
            >
              {importMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              Import CSV
            </Button>

            {/* Add Rule Dialog */}
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Rule
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Protection Rule</DialogTitle>
                  <DialogDescription>
                    Define content that should be preserved from changes
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  {/* Rule Type */}
                  <div className="space-y-2">
                    <Label>Rule Type</Label>
                    <Select
                      value={newRuleType}
                      onValueChange={(v) => setNewRuleType(v as ProtectionRuleType)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="page">Page - URL path</SelectItem>
                        <SelectItem value="section">
                          Section - CSS selector
                        </SelectItem>
                        <SelectItem value="pattern">
                          Pattern - Regex
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Target */}
                  <div className="space-y-2">
                    <Label>Target</Label>
                    <Input
                      placeholder={RULE_TYPE_LABELS[newRuleType].hint}
                      value={newTarget}
                      onChange={(e) => setNewTarget(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {RULE_TYPE_LABELS[newRuleType].hint}
                    </p>
                  </div>

                  {/* Reason */}
                  <div className="space-y-2">
                    <Label>Reason</Label>
                    <Textarea
                      placeholder="Why should this be protected?"
                      value={newReason}
                      onChange={(e) => setNewReason(e.target.value)}
                      rows={2}
                    />
                  </div>

                  {/* Expiration */}
                  <div className="space-y-2">
                    <Label>Expires (optional)</Label>
                    <Input
                      type="date"
                      value={newExpires}
                      onChange={(e) => setNewExpires(e.target.value)}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setShowAddDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddRule}
                    disabled={
                      createMutation.isPending ||
                      !newTarget.trim() ||
                      !newReason.trim()
                    }
                  >
                    {createMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    Add Rule
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Import status messages */}
        {importSuccess && (
          <Alert className="mb-4">
            <AlertDescription>{importSuccess}</AlertDescription>
          </Alert>
        )}
        {importError && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{importError}</AlertDescription>
          </Alert>
        )}

        {/* Rules table */}
        {!rules || rules.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-2">
              No protection rules defined yet
            </p>
            <p className="text-sm text-muted-foreground">
              Add rules to protect specific pages, sections, or text patterns
              from being modified
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Type</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="w-28">Expires</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule: ContentProtectionRuleSelect) => (
                <TableRow key={rule.id}>
                  <TableCell>
                    <Badge variant="outline">
                      {RULE_TYPE_LABELS[rule.ruleType as ProtectionRuleType]?.label ||
                        rule.ruleType}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm max-w-xs truncate">
                    {/* Render as text content - safe from XSS */}
                    {rule.target}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {rule.reason || "-"}
                  </TableCell>
                  <TableCell>
                    {rule.expiresAt
                      ? format(new Date(rule.expiresAt), "PP")
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTestRule(rule)}
                      >
                        <FlaskConical className="w-4 h-4" />
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Rule?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove the protection rule. Content
                              matching this rule will no longer be protected.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteRule(rule.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Test result preview */}
        {testResult && (
          <Alert className="mt-4">
            <FlaskConical className="h-4 w-4" />
            <AlertDescription>
              <div className="font-medium">
                Testing rule: <code>{testResult.ruleTarget}</code>
              </div>
              <pre className="mt-2 bg-muted p-2 rounded text-sm whitespace-pre-wrap">
                {testResult.preview}
              </pre>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => setTestResult(null)}
              >
                Close
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
