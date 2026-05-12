# Confirmation Workflow Patterns for TeveroSEO Chat

> **Purpose**: Define when the SEO chat should auto-execute actions vs. ask for user permission.
> **Design Principle**: Balance efficiency (minimal friction) with safety (prevent costly mistakes).
> **Pattern**: Progressive autonomy based on trust score and action classification.

---

## 1. Action Classification Matrix

### 1.1 Classification Dimensions

| Dimension | Definition | Impact on Confirmation |
|-----------|------------|------------------------|
| **Cost** | Direct monetary cost (DataForSEO, LLM tokens) | Higher cost = more confirmation |
| **Reversibility** | Can the action be undone? | Irreversible = strong confirmation |
| **Scope** | Single item vs. batch operations | Larger scope = more confirmation |
| **External** | Does it leave the system? (emails, API calls) | External = explicit confirmation |
| **Data Mutation** | Creates/modifies/deletes data | Destructive = strong confirmation |

### 1.2 Action Categories

#### Category 1: READ-ONLY (No Confirmation)
Actions that only fetch and display data. Auto-execute immediately.

| Action | Example | Rationale |
|--------|---------|-----------|
| View cached SERP data | "Show rankings for this keyword" | No cost, no mutation |
| Display saved keywords | "List my tracked keywords" | Read from database |
| Show client profile | "What's this client's domain?" | Context retrieval |
| Check analysis status | "Is my audit complete?" | Status polling |
| View previous analyses | "Show last week's analysis" | Cached results |

**UX Pattern**: Inline response, no delay.
```
User: "What keywords are we tracking?"
[Immediately shows list]
```

#### Category 2: LOW-COST REVERSIBLE (Soft Confirmation)
Actions with minimal cost that can be undone. Show preview, execute on continue.

| Action | Est. Cost | Reversible? | Confirmation |
|--------|-----------|-------------|--------------|
| Save keyword to tracking | $0 | Yes (delete) | "I'll add [keyword] to tracking." |
| Add note to client | $0 | Yes (edit) | Execute with undo option |
| Categorize keywords | ~$0.001 | Yes | Show preview, auto-proceed |
| Update funnel distribution | $0 | Yes (revert) | Preview new distribution |

**UX Pattern**: Inline confirmation with auto-proceed timer.
```
User: "Track 'makita dalys'"
Assistant: "Adding 'makita dalys' to tracking... [Cancel 3s]"
         --> Auto-executes after 3 seconds unless canceled
         --> Shows "Tracked 'makita dalys' [Undo]"
```

#### Category 3: COSTLY OPERATIONS (Cost Disclosure + Confirmation)
Actions that incur direct API costs. Require explicit cost disclosure.

| Action | Est. Cost | Confirmation UX |
|--------|-----------|-----------------|
| Keyword research (DataForSEO) | $0.01-0.05 | "This will cost ~$0.03. Proceed?" |
| SERP analysis (live fetch) | $0.01-0.02 | "Fetching live SERP data (~$0.02). Continue?" |
| Backlinks analysis | $0.02-0.10 | "Backlinks analysis costs ~$0.05. Run?" |
| Competitor gap analysis | $0.05-0.15 | "Full gap analysis: ~$0.10. Confirm?" |
| Bulk keyword enrichment | $0.001/kw | "Enriching 500 keywords (~$0.50). Proceed?" |

**UX Pattern**: Cost badge with confirm/cancel.
```tsx
<CostConfirmation
  action="SERP Analysis"
  estimatedCost={0.02}
  details="Live Google SERP fetch for 'makita dalys'"
  onConfirm={executeAnalysis}
  onCancel={dismiss}
/>
```

**Visual Design (v6 tokens)**:
```
┌──────────────────────────────────────────────────────┐
│  SERP Analysis                              $0.02   │
│  ─────────────────────────────────────────────────  │
│  Live Google SERP fetch for "makita dalys"          │
│                                                      │
│  This will query DataForSEO for current             │
│  search results and competitor positions.           │
│                                                      │
│                          [Cancel]  [Run Analysis]   │
└──────────────────────────────────────────────────────┘
```

#### Category 4: DESTRUCTIVE OPERATIONS (Strong Confirmation)
Actions that delete or significantly modify data. Require explicit confirmation with impact disclosure.

| Action | Impact | Confirmation UX |
|--------|--------|-----------------|
| Delete keyword from tracking | Loses history | "Delete 'makita dalys'? You'll lose 30 days of ranking history." |
| Remove cluster from proposal | Modifies proposal | "Remove 'Power Tools' cluster? This affects 15 keywords." |
| Archive client | Hides from view | "Archive [Client]? They'll move to archived clients." |
| Clear analysis session | Deletes work | "Clear this analysis? Partial results will be lost." |
| Blacklist keyword | Permanent exclusion | "Blacklist 'makita repair'? It won't appear in future proposals." |

**UX Pattern**: AlertDialog with destructive action styling.
```tsx
<AlertDialog>
  <AlertDialogTitle>Delete Keyword</AlertDialogTitle>
  <AlertDialogDescription>
    Delete "makita dalys" from tracking?
    <span className="text-destructive">
      You'll lose 30 days of ranking history.
    </span>
  </AlertDialogDescription>
  <AlertDialogFooter>
    <AlertDialogCancel>Keep</AlertDialogCancel>
    <AlertDialogAction className="bg-destructive">Delete</AlertDialogAction>
  </AlertDialogFooter>
</AlertDialog>
```

#### Category 5: EXTERNAL OPERATIONS (Explicit Confirmation)
Actions that communicate outside the system. Always require explicit confirmation with preview.

| Action | External System | Confirmation UX |
|--------|-----------------|-----------------|
| Send report email | Email to client | Preview email content + recipients |
| Publish to CMS | WordPress/Webflow | Preview content + publish confirmation |
| Generate shareable proposal | Creates public link | Show what will be visible |
| Export to Google Sheets | Google Drive | Confirm sheet location |
| Trigger IndexNow ping | Search engines | Show URLs to be submitted |

**UX Pattern**: Full preview modal with explicit "Send" action.
```tsx
<ExternalActionModal
  title="Send Weekly Report"
  recipient="client@example.com"
  preview={<ReportPreview data={reportData} />}
  actions={[
    { label: "Send Now", onClick: sendReport, variant: "primary" },
    { label: "Schedule", onClick: openScheduler },
    { label: "Cancel", onClick: dismiss },
  ]}
/>
```

---

## 2. Confirmation UI Components

### 2.1 Inline Confirmation (Category 2)

```tsx
// components/chat/InlineConfirmation.tsx
interface InlineConfirmationProps {
  action: string;
  description: string;
  autoExecuteMs?: number;  // Default: 3000
  onConfirm: () => void;
  onCancel: () => void;
}

export function InlineConfirmation({
  action,
  description,
  autoExecuteMs = 3000,
  onConfirm,
  onCancel,
}: InlineConfirmationProps) {
  const [timeLeft, setTimeLeft] = useState(autoExecuteMs / 1000);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          onConfirm();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onConfirm]);
  
  return (
    <div className="flex items-center gap-2 p-3 bg-surface rounded-lg border">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      <span className="text-sm">{description}</span>
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={onCancel}
        className="ml-auto"
      >
        Cancel ({timeLeft}s)
      </Button>
    </div>
  );
}
```

### 2.2 Cost Disclosure (Category 3)

```tsx
// components/chat/CostDisclosure.tsx
interface CostDisclosureProps {
  action: string;
  estimatedCost: number;
  details?: string;
  breakdown?: { item: string; cost: number }[];
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function CostDisclosure({
  action,
  estimatedCost,
  details,
  breakdown,
  onConfirm,
  onCancel,
  loading,
}: CostDisclosureProps) {
  return (
    <div className="rounded-lg border bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between mb-3">
        <h4 className="font-semibold text-sm">{action}</h4>
        <CostBadge amount={estimatedCost} />
      </div>
      
      {details && (
        <p className="text-sm text-muted-foreground mb-3">{details}</p>
      )}
      
      {breakdown && (
        <div className="text-xs space-y-1 mb-3 bg-surface-2 p-2 rounded">
          {breakdown.map(({ item, cost }) => (
            <div key={item} className="flex justify-between">
              <span>{item}</span>
              <span>${cost.toFixed(4)}</span>
            </div>
          ))}
        </div>
      )}
      
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={onConfirm} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Proceed (${estimatedCost.toFixed(2)})
        </Button>
      </div>
    </div>
  );
}

function CostBadge({ amount }: { amount: number }) {
  const tier = amount < 0.01 ? "low" : amount < 0.05 ? "medium" : "high";
  const colors = {
    low: "bg-green-100 text-green-700",
    medium: "bg-yellow-100 text-yellow-700", 
    high: "bg-red-100 text-red-700",
  };
  
  return (
    <span className={cn("px-2 py-0.5 rounded text-xs font-medium", colors[tier])}>
      ${amount.toFixed(2)}
    </span>
  );
}
```

### 2.3 Destructive Action Dialog (Category 4)

```tsx
// components/chat/DestructiveActionDialog.tsx
interface DestructiveActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  impact: string;
  confirmLabel?: string;
  onConfirm: () => void;
  loading?: boolean;
}

export function DestructiveActionDialog({
  open,
  onOpenChange,
  title,
  description,
  impact,
  confirmLabel = "Delete",
  onConfirm,
  loading,
}: DestructiveActionDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 my-2">
          <p className="text-sm text-destructive font-medium">
            {impact}
          </p>
        </div>
        
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

### 2.4 External Action Preview (Category 5)

```tsx
// components/chat/ExternalActionPreview.tsx
interface ExternalActionPreviewProps {
  title: string;
  externalSystem: string;
  recipient?: string;
  preview: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ExternalActionPreview({
  title,
  externalSystem,
  recipient,
  preview,
  onConfirm,
  onCancel,
  loading,
}: ExternalActionPreviewProps) {
  return (
    <Dialog open onOpenChange={() => onCancel()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            This will be sent to <strong>{externalSystem}</strong>
            {recipient && <> for <strong>{recipient}</strong></>}.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto border rounded-md p-4 bg-muted/50 my-4">
          {preview}
        </div>
        
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
            <p className="text-sm text-amber-800">
              This action will send data outside TeveroSEO. Please review before confirming.
            </p>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={onConfirm} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Send to {externalSystem}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### 2.5 Batch Action Confirmation

```tsx
// components/chat/BatchActionConfirmation.tsx
interface BatchAction {
  id: string;
  description: string;
  cost?: number;
  category: ActionCategory;
}

interface BatchActionConfirmationProps {
  actions: BatchAction[];
  onConfirmAll: () => void;
  onConfirmSelected: (ids: string[]) => void;
  onCancel: () => void;
}

export function BatchActionConfirmation({
  actions,
  onConfirmAll,
  onConfirmSelected,
  onCancel,
}: BatchActionConfirmationProps) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(actions.map(a => a.id))
  );
  
  const totalCost = actions
    .filter(a => selected.has(a.id))
    .reduce((sum, a) => sum + (a.cost ?? 0), 0);
  
  return (
    <div className="rounded-lg border bg-surface p-4 shadow-card max-w-md">
      <h4 className="font-semibold mb-3">
        {actions.length} actions queued
      </h4>
      
      <div className="space-y-2 max-h-60 overflow-auto mb-4">
        {actions.map((action) => (
          <label 
            key={action.id}
            className="flex items-center gap-2 p-2 rounded hover:bg-surface-2 cursor-pointer"
          >
            <Checkbox
              checked={selected.has(action.id)}
              onCheckedChange={(checked) => {
                const next = new Set(selected);
                if (checked) next.add(action.id);
                else next.delete(action.id);
                setSelected(next);
              }}
            />
            <span className="flex-1 text-sm">{action.description}</span>
            {action.cost && (
              <span className="text-xs text-muted-foreground">
                ${action.cost.toFixed(2)}
              </span>
            )}
          </label>
        ))}
      </div>
      
      {totalCost > 0 && (
        <div className="flex justify-between text-sm mb-4 p-2 bg-surface-2 rounded">
          <span>Estimated cost:</span>
          <span className="font-medium">${totalCost.toFixed(2)}</span>
        </div>
      )}
      
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          size="sm" 
          onClick={() => onConfirmSelected(Array.from(selected))}
          disabled={selected.size === 0}
        >
          Run Selected ({selected.size})
        </Button>
      </div>
    </div>
  );
}
```

---

## 3. Trust/Autonomy Progression Model

### 3.1 Trust Score Calculation

```typescript
// lib/chat/trust-score.ts

interface UserTrustProfile {
  userId: string;
  totalActions: number;
  successfulActions: number;
  canceledActions: number;
  undoneActions: number;
  costlyActionCount: number;
  destructiveActionCount: number;
  lastActionAt: Date;
  createdAt: Date;
}

interface TrustScore {
  score: number;           // 0-100
  tier: 'new' | 'standard' | 'power' | 'admin';
  confirmationLevel: ConfirmationLevel;
}

type ConfirmationLevel = {
  readOnly: 'none';
  reversible: 'inline' | 'none';
  costly: 'full' | 'quick' | 'auto-with-limit';
  destructive: 'full' | 'quick';
  external: 'full' | 'quick';
};

export function calculateTrustScore(profile: UserTrustProfile): TrustScore {
  const { 
    totalActions, 
    successfulActions, 
    canceledActions, 
    undoneActions,
    createdAt 
  } = profile;
  
  // Base score from action history
  const successRate = totalActions > 0 ? successfulActions / totalActions : 0;
  const cancelRate = totalActions > 0 ? canceledActions / totalActions : 0;
  const undoRate = totalActions > 0 ? undoneActions / totalActions : 0;
  
  // Account age factor (days since creation)
  const accountAgeDays = Math.floor(
    (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  const ageFactor = Math.min(accountAgeDays / 30, 1); // Max out at 30 days
  
  // Calculate score
  let score = 50; // Base score
  score += successRate * 20;          // Up to +20 for success
  score -= cancelRate * 10;           // Up to -10 for cancels (indicates hesitation)
  score -= undoRate * 15;             // Up to -15 for undos (indicates mistakes)
  score += ageFactor * 15;            // Up to +15 for account age
  score += Math.min(totalActions, 100) / 10; // Up to +10 for experience
  
  score = Math.max(0, Math.min(100, score));
  
  // Determine tier
  let tier: TrustScore['tier'];
  if (score < 30 || totalActions < 10) tier = 'new';
  else if (score < 60) tier = 'standard';
  else if (score < 85) tier = 'power';
  else tier = 'admin';
  
  return {
    score,
    tier,
    confirmationLevel: TIER_CONFIRMATION_LEVELS[tier],
  };
}

const TIER_CONFIRMATION_LEVELS: Record<TrustScore['tier'], ConfirmationLevel> = {
  new: {
    readOnly: 'none',
    reversible: 'inline',       // 3s auto-execute
    costly: 'full',             // Full cost disclosure
    destructive: 'full',        // Full confirmation
    external: 'full',           // Full preview
  },
  standard: {
    readOnly: 'none',
    reversible: 'none',         // Instant with undo
    costly: 'quick',            // Cost badge, single confirm
    destructive: 'full',
    external: 'full',
  },
  power: {
    readOnly: 'none',
    reversible: 'none',
    costly: 'auto-with-limit',  // Auto-execute under $0.10
    destructive: 'quick',       // Simplified dialog
    external: 'quick',          // Condensed preview
  },
  admin: {
    readOnly: 'none',
    reversible: 'none',
    costly: 'auto-with-limit',  // Higher limit ($1.00)
    destructive: 'quick',
    external: 'quick',
  },
};
```

### 3.2 User Preference Overrides

```typescript
// lib/chat/user-preferences.ts

interface ChatActionPreferences {
  // Per-action-type overrides
  alwaysAllow: ActionType[];       // Skip confirmation for these
  neverAutoExecute: ActionType[];  // Always confirm these
  
  // Cost thresholds
  autoApproveCostLimit: number;    // Auto-approve costs under this amount
  dailyCostLimit: number;          // Alert when approaching daily limit
  
  // Notification preferences
  showCostBadges: boolean;         // Show cost on all actions
  showUndoToasts: boolean;         // Toast on successful reversible actions
  
  // Session vs permanent
  sessionOnly: boolean;            // Preferences apply to session only
}

// Schema for database storage
export const userChatPreferences = pgTable("user_chat_preferences", {
  userId: text("user_id").primaryKey(),
  alwaysAllow: text("always_allow").array().default(sql`'{}'::text[]`),
  neverAutoExecute: text("never_auto_execute").array().default(sql`'{}'::text[]`),
  autoApproveCostLimit: integer("auto_approve_cost_limit").default(0), // cents
  dailyCostLimit: integer("daily_cost_limit").default(500), // cents ($5.00)
  showCostBadges: boolean("show_cost_badges").default(true),
  showUndoToasts: boolean("show_undo_toasts").default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

### 3.3 "Always Allow" / "Never Auto-Execute" UI

```tsx
// components/chat/ActionPreferencesSheet.tsx
export function ActionPreferencesSheet() {
  const [preferences, setPreferences] = useUserChatPreferences();
  
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm">
          <Settings className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Chat Action Preferences</SheetTitle>
          <SheetDescription>
            Customize how actions are confirmed in chat.
          </SheetDescription>
        </SheetHeader>
        
        <div className="space-y-6 py-4">
          {/* Cost thresholds */}
          <div className="space-y-2">
            <Label>Auto-approve actions under</Label>
            <Select
              value={String(preferences.autoApproveCostLimit)}
              onValueChange={(v) => setPreferences(p => ({
                ...p,
                autoApproveCostLimit: parseInt(v),
              }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Always confirm</SelectItem>
                <SelectItem value="5">$0.05</SelectItem>
                <SelectItem value="10">$0.10</SelectItem>
                <SelectItem value="25">$0.25</SelectItem>
                <SelectItem value="100">$1.00</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Action type toggles */}
          <div className="space-y-3">
            <Label>Action-specific settings</Label>
            
            {ACTION_TYPES.map((action) => (
              <div key={action.type} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{action.label}</p>
                  <p className="text-xs text-muted-foreground">{action.description}</p>
                </div>
                <Select
                  value={getPreferenceForAction(preferences, action.type)}
                  onValueChange={(v) => updateActionPreference(action.type, v)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default</SelectItem>
                    <SelectItem value="always">Always allow</SelectItem>
                    <SelectItem value="never">Always confirm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

const ACTION_TYPES = [
  { type: 'track_keyword', label: 'Track Keywords', description: 'Add keywords to tracking' },
  { type: 'keyword_research', label: 'Keyword Research', description: 'Fetch keyword data' },
  { type: 'serp_analysis', label: 'SERP Analysis', description: 'Analyze search results' },
  { type: 'generate_proposal', label: 'Generate Proposal', description: 'Create client proposal' },
  { type: 'send_report', label: 'Send Report', description: 'Email reports to clients' },
];
```

---

## 4. Error Handling and Recovery

### 4.1 Undo Capabilities

```typescript
// lib/chat/undo-stack.ts

interface UndoableAction {
  id: string;
  type: ActionType;
  description: string;
  executedAt: Date;
  undoFn: () => Promise<void>;
  expiresAt: Date;           // Undo available until this time
  data: unknown;             // Original state for rollback
}

class UndoStack {
  private stack: UndoableAction[] = [];
  private maxSize = 50;
  
  push(action: UndoableAction): void {
    this.stack.unshift(action);
    this.stack = this.stack.slice(0, this.maxSize);
    this.cleanExpired();
  }
  
  async undo(actionId: string): Promise<boolean> {
    const action = this.stack.find(a => a.id === actionId);
    if (!action) return false;
    if (new Date() > action.expiresAt) {
      throw new Error('Undo window expired');
    }
    
    await action.undoFn();
    this.stack = this.stack.filter(a => a.id !== actionId);
    return true;
  }
  
  getRecent(limit = 10): UndoableAction[] {
    return this.stack
      .filter(a => new Date() < a.expiresAt)
      .slice(0, limit);
  }
  
  private cleanExpired(): void {
    const now = new Date();
    this.stack = this.stack.filter(a => now < a.expiresAt);
  }
}

// Usage in chat action
async function trackKeyword(keyword: string): Promise<void> {
  const result = await addKeywordToTracking(keyword);
  
  undoStack.push({
    id: crypto.randomUUID(),
    type: 'track_keyword',
    description: `Tracked "${keyword}"`,
    executedAt: new Date(),
    expiresAt: addMinutes(new Date(), 5), // 5 minute undo window
    undoFn: async () => {
      await removeKeywordFromTracking(result.id);
    },
    data: { keywordId: result.id },
  });
}
```

### 4.2 Rollback Patterns

```typescript
// lib/chat/rollback.ts

interface RollbackableOperation<T> {
  execute: () => Promise<T>;
  rollback: (result: T) => Promise<void>;
  description: string;
}

async function executeWithRollback<T>(
  operation: RollbackableOperation<T>,
  options: { showToast?: boolean } = {}
): Promise<{ success: boolean; result?: T; error?: Error }> {
  try {
    const result = await operation.execute();
    
    if (options.showToast) {
      toast.success(`${operation.description}`, {
        action: {
          label: 'Undo',
          onClick: async () => {
            await operation.rollback(result);
            toast.info(`Undone: ${operation.description}`);
          },
        },
        duration: 5000,
      });
    }
    
    return { success: true, result };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

// Usage
await executeWithRollback({
  execute: () => saveKeywords(keywords),
  rollback: (result) => deleteKeywords(result.ids),
  description: `Saved ${keywords.length} keywords`,
}, { showToast: true });
```

### 4.3 Failure Recovery

```typescript
// lib/chat/failure-recovery.ts

interface FailedAction {
  id: string;
  type: ActionType;
  params: unknown;
  error: string;
  attemptCount: number;
  firstAttemptAt: Date;
  lastAttemptAt: Date;
}

class FailureRecoveryManager {
  private failed: Map<string, FailedAction> = new Map();
  
  async handleFailure(
    actionId: string,
    type: ActionType,
    params: unknown,
    error: Error
  ): Promise<RecoveryOption[]> {
    const existing = this.failed.get(actionId);
    
    if (existing) {
      existing.attemptCount++;
      existing.lastAttemptAt = new Date();
      existing.error = error.message;
    } else {
      this.failed.set(actionId, {
        id: actionId,
        type,
        params,
        error: error.message,
        attemptCount: 1,
        firstAttemptAt: new Date(),
        lastAttemptAt: new Date(),
      });
    }
    
    return this.getRecoveryOptions(type, error);
  }
  
  private getRecoveryOptions(type: ActionType, error: Error): RecoveryOption[] {
    const options: RecoveryOption[] = [];
    
    // Common options
    options.push({ id: 'retry', label: 'Retry', action: 'retry' });
    options.push({ id: 'dismiss', label: 'Dismiss', action: 'dismiss' });
    
    // Type-specific recovery
    if (type === 'keyword_research' && error.message.includes('rate limit')) {
      options.push({
        id: 'schedule',
        label: 'Schedule for later',
        action: 'schedule',
      });
    }
    
    if (error.message.includes('cost')) {
      options.push({
        id: 'use_cached',
        label: 'Use cached data instead',
        action: 'use_cached',
      });
    }
    
    return options;
  }
}

interface RecoveryOption {
  id: string;
  label: string;
  action: 'retry' | 'dismiss' | 'schedule' | 'use_cached' | 'modify';
}
```

### 4.4 Cost Refund on Failure

```typescript
// lib/chat/cost-tracking.ts

interface CostTransaction {
  id: string;
  userId: string;
  actionId: string;
  actionType: ActionType;
  amount: number;          // In cents
  status: 'pending' | 'charged' | 'refunded';
  createdAt: Date;
  chargedAt?: Date;
  refundedAt?: Date;
  refundReason?: string;
}

async function handleCostlyActionFailure(
  actionId: string,
  error: Error
): Promise<void> {
  const transaction = await getCostTransaction(actionId);
  if (!transaction || transaction.status !== 'charged') return;
  
  // Determine if refund is appropriate
  const refundable = isRefundableError(error);
  
  if (refundable) {
    await refundTransaction(transaction.id, {
      reason: error.message,
    });
    
    toast.info(`Refunded $${(transaction.amount / 100).toFixed(2)} for failed action`, {
      description: 'No charge for failed API calls',
    });
  }
}

function isRefundableError(error: Error): boolean {
  // Refund for API errors, not user errors
  const refundablePatterns = [
    'timeout',
    'rate limit',
    'server error',
    'unavailable',
    'network error',
  ];
  
  return refundablePatterns.some(p => 
    error.message.toLowerCase().includes(p)
  );
}
```

---

## 5. Configuration Options

### 5.1 Admin-Level Configuration

```typescript
// lib/chat/admin-config.ts

interface ChatConfirmationConfig {
  // Global thresholds
  costThresholds: {
    noConfirmation: number;      // Auto-approve under this (cents)
    quickConfirmation: number;   // Quick confirm under this (cents)
    fullConfirmation: number;    // Always full above this (cents)
  };
  
  // Trust score adjustments
  trustScoreWeights: {
    successRate: number;
    cancelRate: number;
    undoRate: number;
    accountAge: number;
    experience: number;
  };
  
  // Undo windows (minutes)
  undoWindows: {
    reversible: number;
    costly: number;
    destructive: number;  // 0 = no undo
  };
  
  // Rate limits
  rateLimits: {
    actionsPerMinute: number;
    costlyActionsPerHour: number;
    dailyCostLimit: number;  // cents
  };
  
  // Feature flags
  features: {
    enableTrustScoring: boolean;
    enableAutoApprove: boolean;
    enableBatchActions: boolean;
    enableUndoStack: boolean;
  };
}

// Default configuration
export const DEFAULT_CHAT_CONFIG: ChatConfirmationConfig = {
  costThresholds: {
    noConfirmation: 0,        // Always confirm by default
    quickConfirmation: 10,    // $0.10
    fullConfirmation: 100,    // $1.00
  },
  trustScoreWeights: {
    successRate: 20,
    cancelRate: -10,
    undoRate: -15,
    accountAge: 15,
    experience: 10,
  },
  undoWindows: {
    reversible: 5,
    costly: 2,
    destructive: 0,
  },
  rateLimits: {
    actionsPerMinute: 10,
    costlyActionsPerHour: 50,
    dailyCostLimit: 1000,  // $10.00
  },
  features: {
    enableTrustScoring: true,
    enableAutoApprove: false,  // Opt-in
    enableBatchActions: true,
    enableUndoStack: true,
  },
};
```

### 5.2 Per-Workspace Overrides

```typescript
// Schema for workspace-level chat config
export const workspaceChatConfig = pgTable("workspace_chat_config", {
  workspaceId: text("workspace_id").primaryKey(),
  
  // Override cost thresholds (null = use default)
  costNoConfirmation: integer("cost_no_confirmation"),
  costQuickConfirmation: integer("cost_quick_confirmation"),
  costFullConfirmation: integer("cost_full_confirmation"),
  
  // Daily cost limits
  dailyCostLimit: integer("daily_cost_limit"),
  monthlyCostLimit: integer("monthly_cost_limit"),
  
  // Feature overrides
  allowAutoApprove: boolean("allow_auto_approve"),
  allowBatchActions: boolean("allow_batch_actions"),
  
  // Audit settings
  auditAllActions: boolean("audit_all_actions").default(false),
  
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

---

## 6. Integration with Existing Chat Actions

### 6.1 Action Wrapper

```typescript
// lib/chat/action-executor.ts

interface ActionDefinition {
  type: ActionType;
  category: ActionCategory;
  estimateCost?: (params: unknown) => number;
  execute: (params: unknown) => Promise<unknown>;
  rollback?: (result: unknown) => Promise<void>;
}

async function executeAction<T>(
  definition: ActionDefinition,
  params: unknown,
  context: ActionContext
): Promise<ActionResult<T>> {
  const { userProfile, preferences, config } = context;
  
  // 1. Check trust level and determine confirmation needed
  const trustScore = calculateTrustScore(userProfile);
  const confirmationLevel = trustScore.confirmationLevel[definition.category];
  
  // 2. Check user preferences for overrides
  if (preferences.alwaysAllow.includes(definition.type)) {
    return await executeWithTracking(definition, params, context);
  }
  
  if (preferences.neverAutoExecute.includes(definition.type)) {
    return { needsConfirmation: true, confirmationType: 'full' };
  }
  
  // 3. Cost-based confirmation
  const estimatedCost = definition.estimateCost?.(params) ?? 0;
  
  if (definition.category === 'costly') {
    if (estimatedCost <= preferences.autoApproveCostLimit) {
      return await executeWithTracking(definition, params, context);
    }
    
    return {
      needsConfirmation: true,
      confirmationType: confirmationLevel,
      estimatedCost,
    };
  }
  
  // 4. Category-based confirmation
  if (confirmationLevel === 'none') {
    return await executeWithTracking(definition, params, context);
  }
  
  return {
    needsConfirmation: true,
    confirmationType: confirmationLevel,
    estimatedCost,
  };
}
```

### 6.2 CopilotKit Integration

```typescript
// lib/copilot/action-middleware.ts

import { useCopilotAction } from '@copilotkit/react-core';

function useConfirmedCopilotAction(definition: ActionDefinition) {
  const { userProfile, preferences } = useChatContext();
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  
  useCopilotAction({
    name: definition.type,
    description: definition.description,
    parameters: definition.parameters,
    handler: async (params) => {
      const result = await executeAction(definition, params, {
        userProfile,
        preferences,
        config: getConfig(),
      });
      
      if (result.needsConfirmation) {
        setPendingAction({
          definition,
          params,
          confirmationType: result.confirmationType,
          estimatedCost: result.estimatedCost,
        });
        
        // Return early - action will continue after confirmation
        return { pending: true, message: 'Awaiting confirmation...' };
      }
      
      return result.data;
    },
  });
  
  // Render confirmation UI based on pending action
  return { pendingAction, confirmAction, cancelAction };
}
```

---

## 7. Summary: Decision Matrix

| Action Type | Category | Default Confirmation | Trust Override | User Override |
|-------------|----------|---------------------|----------------|---------------|
| View data | Read-only | None | N/A | N/A |
| Track keyword | Reversible | Inline 3s | Standard: None | Yes |
| Add note | Reversible | None + Undo | N/A | Yes |
| Keyword research | Costly | Full cost disclosure | Power: Quick confirm | Yes |
| SERP analysis | Costly | Full cost disclosure | Power: Auto <$0.10 | Yes |
| Delete keyword | Destructive | Full dialog | Power: Quick dialog | Always confirm option |
| Archive client | Destructive | Full dialog | Always full | Always confirm option |
| Send report | External | Preview modal | Quick preview | Always confirm option |
| Publish to CMS | External | Full preview | Quick preview | Always confirm option |

---

*Document created: 2026-05-09*
*Phase: 98-general-seo-chat*
*Author: Claude Code Agent*
