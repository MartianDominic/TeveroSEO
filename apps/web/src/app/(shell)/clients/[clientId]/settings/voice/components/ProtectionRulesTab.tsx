"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Button,
  Card,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  Skeleton,
} from "@tevero/ui";
import { Plus, Trash2 } from "lucide-react";
import { getProtectionRules, addProtectionRule, removeProtectionRule } from "@/actions/voice";
import type { ProtectionRule } from "@/lib/voiceApi";

interface ProtectionRulesTabProps {
  clientId: string;
}

export function ProtectionRulesTab({ clientId }: ProtectionRulesTabProps) {
  const [rules, setRules] = useState<ProtectionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newRuleType, setNewRuleType] = useState<"page" | "section" | "pattern">("page");
  const [newTarget, setNewTarget] = useState("");
  const [newReason, setNewReason] = useState("");

  useEffect(() => {
    if (!clientId) return;
    setLoading(true);
    getProtectionRules(clientId)
      .then(setRules)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clientId]);

  const handleAddRule = useCallback(async () => {
    if (!newTarget) return;
    setAdding(true);
    try {
      const rule = await addProtectionRule(clientId, {
        ruleType: newRuleType,
        target: newTarget,
        reason: newReason || undefined,
      });
      setRules([...rules, rule]);
      setNewTarget("");
      setNewReason("");
    } catch {
      // Handle error
    } finally {
      setAdding(false);
    }
  }, [clientId, newRuleType, newTarget, newReason, rules]);

  const handleDeleteRule = useCallback(async (ruleId: string) => {
    setDeletingId(ruleId);
    try {
      await removeProtectionRule(clientId, ruleId);
      setRules(rules.filter((r) => r.id !== ruleId));
    } catch {
      // Handle error
    } finally {
      setDeletingId(null);
    }
  }, [clientId, rules]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add rule form */}
      <Card className="p-4 space-y-4">
        <h3 className="text-sm font-medium">Add Protection Rule</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Rule Type</Label>
            <Select value={newRuleType} onValueChange={(v: "page" | "section" | "pattern") => setNewRuleType(v)}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="page">Page (URL pattern)</SelectItem>
                <SelectItem value="section">Section (CSS selector)</SelectItem>
                <SelectItem value="pattern">Text Pattern (regex)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Target</Label>
            <Input
              className="mt-1.5"
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value)}
              placeholder={
                newRuleType === "page"
                  ? "/about/*"
                  : newRuleType === "section"
                  ? ".hero-section"
                  : "Our mission.*"
              }
            />
          </div>
          <div>
            <Label>Reason (optional)</Label>
            <Input
              className="mt-1.5"
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              placeholder="Why protect this?"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleAddRule} disabled={adding || !newTarget}>
            <Plus className="h-4 w-4 mr-2" />
            {adding ? "Adding..." : "Add Rule"}
          </Button>
        </div>
      </Card>

      {/* Rules list */}
      {rules.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No protection rules defined. Add rules to prevent specific content
            from being modified by SEO changes.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <Card key={rule.id} className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{rule.ruleType}</Badge>
                  <code className="text-xs bg-muted px-2 py-0.5 rounded">
                    {rule.target}
                  </code>
                </div>
                {rule.reason && (
                  <p className="text-xs text-muted-foreground">{rule.reason}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDeleteRule(rule.id)}
                disabled={deletingId === rule.id}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
