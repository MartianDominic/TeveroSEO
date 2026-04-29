# Dynamic Goals System Design

**Status:** Design Specification  
**Created:** 2026-04-20  
**Context:** Configurable goal templates with per-client target values

---

## Overview

Instead of hardcoded health scores, we provide **goal templates** (placeholders) that agencies select per client and fill in target values.

**Example Flow:**
1. Agency onboards "Acme Corp"
2. Selects goal template: "Keywords in Top 10"
3. Fills in target: `10` keywords (out of `100` tracked)
4. System computes: Currently 7/10 = 70% attainment
5. Dashboard shows: "7/10 keywords in top 10 (70%)"

---

## Goal Templates (System-Level)

Pre-defined goal types available to all agencies:

| Template | Name | Unit | Default | Computation |
|----------|------|------|---------|-------------|
| `keywords_top_10` | Keywords in Top 10 | keywords | 10 | COUNT WHERE position <= 10 |
| `keywords_top_3` | Keywords in Top 3 | keywords | 5 | COUNT WHERE position <= 3 |
| `keywords_position_1` | #1 Rankings | keywords | 2 | COUNT WHERE position = 1 |
| `weekly_clicks` | Weekly Clicks | clicks | 500 | SUM clicks last 7 days |
| `monthly_clicks` | Monthly Clicks | clicks | 2000 | SUM clicks last 30 days |
| `ctr_target` | CTR Target | % | 3.0 | AVG CTR last 30 days |
| `traffic_growth` | MoM Traffic Growth | % | 10 | (this_month - last_month) / last_month |
| `impressions_target` | Monthly Impressions | impressions | 10000 | SUM impressions last 30 days |
| `custom` | Custom Goal | — | — | Manual tracking |

---

## Schema Design

### Table: goal_templates

```sql
CREATE TABLE goal_templates (
  id TEXT PRIMARY KEY,
  goal_type TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT,                          -- 'keywords', 'clicks', '%', 'impressions'
  default_target NUMERIC,
  has_denominator BOOLEAN DEFAULT false,  -- For "X out of Y" goals
  computation_method TEXT NOT NULL,   -- Function name for worker
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed data
INSERT INTO goal_templates (id, goal_type, name, description, unit, default_target, has_denominator, computation_method, display_order) VALUES
  ('tmpl-kw-top10', 'keywords_top_10', 'Keywords in Top 10', 'Track how many target keywords rank in Google positions 1-10', 'keywords', 10, true, 'count_keywords_in_range', 1),
  ('tmpl-kw-top3', 'keywords_top_3', 'Keywords in Top 3', 'Track keywords in premium positions 1-3', 'keywords', 5, true, 'count_keywords_in_range', 2),
  ('tmpl-kw-pos1', 'keywords_position_1', '#1 Rankings', 'Track keywords holding the #1 position', 'keywords', 2, true, 'count_keywords_in_range', 3),
  ('tmpl-weekly-clicks', 'weekly_clicks', 'Weekly Organic Clicks', 'Target organic clicks from Google per week', 'clicks', 500, false, 'sum_clicks_period', 4),
  ('tmpl-monthly-clicks', 'monthly_clicks', 'Monthly Organic Clicks', 'Target organic clicks from Google per month', 'clicks', 2000, false, 'sum_clicks_period', 5),
  ('tmpl-ctr', 'ctr_target', 'CTR Target', 'Maintain click-through rate above threshold', '%', 3.0, false, 'avg_ctr_period', 6),
  ('tmpl-traffic-growth', 'traffic_growth', 'MoM Traffic Growth', 'Achieve month-over-month traffic growth percentage', '%', 10, false, 'mom_growth_pct', 7),
  ('tmpl-impressions', 'impressions_target', 'Monthly Impressions', 'Target search impressions per month', 'impressions', 10000, false, 'sum_impressions_period', 8),
  ('tmpl-custom', 'custom', 'Custom Goal', 'Define a custom goal with manual progress tracking', NULL, NULL, false, 'manual', 99);
```

### Table: client_goals

```sql
CREATE TABLE client_goals (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  template_id TEXT NOT NULL REFERENCES goal_templates(id),
  
  -- User-configured values
  target_value NUMERIC NOT NULL,
  target_denominator INTEGER,         -- For "X out of Y" (e.g., 10 out of 100 keywords)
  custom_name TEXT,                   -- Override template name if needed
  custom_description TEXT,            -- For custom goals
  
  -- Computed state (updated by worker)
  current_value NUMERIC,
  attainment_pct NUMERIC,             -- (current / target) * 100, can exceed 100
  trend_direction TEXT CHECK (trend_direction IN ('up', 'down', 'flat')),
  trend_value NUMERIC,                -- Change amount (+5 keywords, -2%, etc.)
  trend_period TEXT DEFAULT '30d',    -- Period for trend calculation
  last_computed_at TIMESTAMPTZ,
  
  -- Configuration
  is_primary BOOLEAN DEFAULT false,   -- One primary goal per client
  is_client_visible BOOLEAN DEFAULT true,  -- Show in client-facing reports
  notify_on_regression BOOLEAN DEFAULT true,
  regression_threshold NUMERIC DEFAULT 10,  -- Alert if drops > 10%
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT uq_client_goal_template UNIQUE (client_id, template_id) 
    WHERE template_id != 'tmpl-custom'  -- Allow multiple custom goals
);

CREATE INDEX idx_client_goals_client ON client_goals(client_id);
CREATE INDEX idx_client_goals_workspace ON client_goals(workspace_id);
CREATE INDEX idx_client_goals_primary ON client_goals(client_id, is_primary) WHERE is_primary = true;
```

### Table: goal_snapshots (Historical Tracking)

```sql
CREATE TABLE goal_snapshots (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL REFERENCES client_goals(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  current_value NUMERIC,
  attainment_pct NUMERIC,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT uq_goal_snapshot_date UNIQUE (goal_id, snapshot_date)
);

CREATE INDEX idx_goal_snapshots_goal_date ON goal_snapshots(goal_id, snapshot_date);
```

---

## Computation Methods

### Worker Implementation

```typescript
// src/server/workers/goal-computation.ts

interface GoalComputation {
  compute(clientId: string, goal: ClientGoal): Promise<number>;
}

const computations: Record<string, GoalComputation> = {
  
  count_keywords_in_range: {
    async compute(clientId, goal) {
      // Determine position range from template
      const positionMax = goal.template.goal_type === 'keywords_top_10' ? 10 
                        : goal.template.goal_type === 'keywords_top_3' ? 3 
                        : 1;
      
      const result = await db.query(`
        SELECT COUNT(DISTINCT kr.keyword_id) as count
        FROM keyword_rankings kr
        JOIN saved_keywords sk ON kr.keyword_id = sk.id
        JOIN projects p ON sk.project_id = p.id
        WHERE p.client_id = $1
          AND kr.position <= $2
          AND kr.date = (
            SELECT MAX(date) FROM keyword_rankings 
            WHERE keyword_id = kr.keyword_id
          )
      `, [clientId, positionMax]);
      
      return result.rows[0].count;
    }
  },
  
  sum_clicks_period: {
    async compute(clientId, goal) {
      const days = goal.template.goal_type === 'weekly_clicks' ? 7 : 30;
      
      const result = await db.query(`
        SELECT COALESCE(SUM(clicks), 0) as total
        FROM gsc_snapshots
        WHERE client_id = $1
          AND date >= CURRENT_DATE - INTERVAL '${days} days'
      `, [clientId]);
      
      return result.rows[0].total;
    }
  },
  
  sum_impressions_period: {
    async compute(clientId, goal) {
      const result = await db.query(`
        SELECT COALESCE(SUM(impressions), 0) as total
        FROM gsc_snapshots
        WHERE client_id = $1
          AND date >= CURRENT_DATE - INTERVAL '30 days'
      `, [clientId]);
      
      return result.rows[0].total;
    }
  },
  
  avg_ctr_period: {
    async compute(clientId, goal) {
      const result = await db.query(`
        SELECT COALESCE(AVG(ctr) * 100, 0) as avg_ctr
        FROM gsc_snapshots
        WHERE client_id = $1
          AND date >= CURRENT_DATE - INTERVAL '30 days'
      `, [clientId]);
      
      return result.rows[0].avg_ctr;
    }
  },
  
  mom_growth_pct: {
    async compute(clientId, goal) {
      const result = await db.query(`
        WITH monthly AS (
          SELECT 
            SUM(CASE WHEN date >= CURRENT_DATE - INTERVAL '30 days' THEN clicks ELSE 0 END) as this_month,
            SUM(CASE WHEN date >= CURRENT_DATE - INTERVAL '60 days' 
                      AND date < CURRENT_DATE - INTERVAL '30 days' THEN clicks ELSE 0 END) as last_month
          FROM gsc_snapshots
          WHERE client_id = $1
            AND date >= CURRENT_DATE - INTERVAL '60 days'
        )
        SELECT 
          CASE 
            WHEN last_month = 0 THEN 0
            ELSE ((this_month - last_month)::float / last_month * 100)
          END as growth_pct
        FROM monthly
      `, [clientId]);
      
      return result.rows[0].growth_pct;
    }
  },
  
  manual: {
    async compute(clientId, goal) {
      // Manual goals don't auto-compute - return existing value
      return goal.current_value ?? 0;
    }
  }
};
```

### Trend Calculation

```typescript
async function computeTrend(goalId: string, currentValue: number): Promise<{
  direction: 'up' | 'down' | 'flat';
  value: number;
}> {
  // Get value from 30 days ago
  const result = await db.query(`
    SELECT current_value FROM goal_snapshots
    WHERE goal_id = $1 AND snapshot_date = CURRENT_DATE - INTERVAL '30 days'
  `, [goalId]);
  
  const previousValue = result.rows[0]?.current_value ?? currentValue;
  const change = currentValue - previousValue;
  
  const direction = change > 0.5 ? 'up' : change < -0.5 ? 'down' : 'flat';
  
  return { direction, value: change };
}
```

---

## UI Components

### 1. GoalTemplateSelector

```tsx
// Select a goal type from available templates
interface GoalTemplateSelectorProps {
  value: string | null;
  onChange: (templateId: string) => void;
  excludeTemplates?: string[];  // Already added goals
}

function GoalTemplateSelector({ value, onChange, excludeTemplates = [] }: GoalTemplateSelectorProps) {
  const templates = useGoalTemplates();
  const available = templates.filter(t => !excludeTemplates.includes(t.id) || t.goal_type === 'custom');
  
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select a goal type..." />
      </SelectTrigger>
      <SelectContent>
        {available.map(template => (
          <SelectItem key={template.id} value={template.id}>
            <div className="flex items-center gap-2">
              <GoalIcon type={template.goal_type} />
              <span>{template.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

### 2. GoalConfigForm

```tsx
// Configure target value for selected goal
interface GoalConfigFormProps {
  template: GoalTemplate;
  initialValues?: Partial<ClientGoal>;
  onSubmit: (values: GoalFormValues) => void;
  onCancel: () => void;
}

function GoalConfigForm({ template, initialValues, onSubmit, onCancel }: GoalConfigFormProps) {
  const [targetValue, setTargetValue] = useState(initialValues?.target_value ?? template.default_target);
  const [denominator, setDenominator] = useState(initialValues?.target_denominator);
  const [isPrimary, setIsPrimary] = useState(initialValues?.is_primary ?? false);
  
  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4">
        {/* Goal name preview */}
        <div className="p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">Goal Preview</p>
          <p className="text-lg font-medium">
            {formatGoalName(template, targetValue, denominator)}
          </p>
        </div>
        
        {/* Target value input */}
        <div>
          <Label>Target Value</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={targetValue}
              onChange={(e) => setTargetValue(Number(e.target.value))}
              min={0}
            />
            <span className="text-muted-foreground">{template.unit}</span>
          </div>
        </div>
        
        {/* Denominator input (for "X out of Y" goals) */}
        {template.has_denominator && (
          <div>
            <Label>Out of (total tracked)</Label>
            <Input
              type="number"
              value={denominator}
              onChange={(e) => setDenominator(Number(e.target.value))}
              placeholder="e.g., 100 keywords"
              min={1}
            />
          </div>
        )}
        
        {/* Primary goal checkbox */}
        <div className="flex items-center gap-2">
          <Checkbox
            checked={isPrimary}
            onCheckedChange={setIsPrimary}
          />
          <Label>Set as primary goal (highlighted on dashboard)</Label>
        </div>
        
        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit">Save Goal</Button>
        </div>
      </div>
    </form>
  );
}

function formatGoalName(template: GoalTemplate, target: number, denominator?: number): string {
  switch (template.goal_type) {
    case 'keywords_top_10':
      return denominator 
        ? `${target} of ${denominator} keywords in top 10`
        : `${target} keywords in top 10`;
    case 'keywords_top_3':
      return `${target} keywords in top 3`;
    case 'keywords_position_1':
      return `${target} keywords at #1`;
    case 'weekly_clicks':
      return `${target.toLocaleString()} clicks per week`;
    case 'monthly_clicks':
      return `${target.toLocaleString()} clicks per month`;
    case 'ctr_target':
      return `CTR above ${target}%`;
    case 'traffic_growth':
      return `${target}% MoM traffic growth`;
    case 'impressions_target':
      return `${target.toLocaleString()} impressions per month`;
    default:
      return `${target} ${template.unit}`;
  }
}
```

### 3. ClientGoalsList

```tsx
// List all goals for a client with edit/delete
function ClientGoalsList({ clientId }: { clientId: string }) {
  const { goals, isLoading } = useClientGoals(clientId);
  const [editingGoal, setEditingGoal] = useState<string | null>(null);
  
  if (isLoading) return <GoalsListSkeleton />;
  
  return (
    <div className="space-y-4">
      {goals.map(goal => (
        <GoalCard
          key={goal.id}
          goal={goal}
          onEdit={() => setEditingGoal(goal.id)}
          onDelete={() => handleDelete(goal.id)}
        />
      ))}
      
      <AddGoalButton clientId={clientId} existingGoals={goals} />
    </div>
  );
}

function GoalCard({ goal, onEdit, onDelete }: GoalCardProps) {
  return (
    <Card className={cn(goal.is_primary && "ring-2 ring-primary")}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            {/* Goal name */}
            <div className="flex items-center gap-2">
              {goal.is_primary && <Badge variant="secondary">Primary</Badge>}
              <h4 className="font-medium">{goal.display_name}</h4>
            </div>
            
            {/* Progress bar */}
            <div className="w-64">
              <Progress value={Math.min(100, goal.attainment_pct ?? 0)} />
            </div>
            
            {/* Current / Target */}
            <div className="flex items-center gap-4 text-sm">
              <span>
                {goal.current_value?.toLocaleString()} / {goal.target_value.toLocaleString()}
                {goal.template.unit && ` ${goal.template.unit}`}
              </span>
              <span className="text-muted-foreground">
                ({goal.attainment_pct?.toFixed(0) ?? 0}%)
              </span>
              {goal.trend_direction && (
                <TrendIndicator direction={goal.trend_direction} value={goal.trend_value} />
              )}
            </div>
          </div>
          
          {/* Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
```

### 4. Goal Setup Wizard (Onboarding)

```tsx
// Quick setup wizard for new clients
function GoalSetupWizard({ clientId, onComplete }: GoalSetupWizardProps) {
  const [step, setStep] = useState<'select' | 'configure'>('select');
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [goalConfigs, setGoalConfigs] = useState<Record<string, GoalConfig>>({});
  
  return (
    <Dialog>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Set Up Client Goals</DialogTitle>
          <DialogDescription>
            Select which goals to track for this client and set target values.
          </DialogDescription>
        </DialogHeader>
        
        {step === 'select' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select the goals you want to track:
            </p>
            
            <div className="grid grid-cols-2 gap-3">
              {templates.map(template => (
                <GoalTemplateCard
                  key={template.id}
                  template={template}
                  selected={selectedTemplates.includes(template.id)}
                  onToggle={() => toggleTemplate(template.id)}
                />
              ))}
            </div>
            
            <div className="flex justify-between">
              <Button variant="ghost" onClick={onComplete}>Skip for now</Button>
              <Button onClick={() => setStep('configure')} disabled={selectedTemplates.length === 0}>
                Configure Selected ({selectedTemplates.length})
              </Button>
            </div>
          </div>
        )}
        
        {step === 'configure' && (
          <div className="space-y-6">
            {selectedTemplates.map((templateId, index) => (
              <GoalQuickConfig
                key={templateId}
                template={templates.find(t => t.id === templateId)!}
                value={goalConfigs[templateId]}
                onChange={(config) => setGoalConfigs({ ...goalConfigs, [templateId]: config })}
                isPrimary={index === 0}
              />
            ))}
            
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep('select')}>Back</Button>
              <Button onClick={handleSaveAll}>Save All Goals</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

---

## API Endpoints

### Goals CRUD

```typescript
// GET /api/goal-templates
// Returns all active goal templates

// GET /api/clients/:clientId/goals
// Returns all goals for a client

// POST /api/clients/:clientId/goals
// Create a new goal
// Body: { templateId, targetValue, targetDenominator?, isPrimary?, isClientVisible? }

// PUT /api/clients/:clientId/goals/:goalId
// Update a goal
// Body: { targetValue?, targetDenominator?, isPrimary?, isClientVisible? }

// DELETE /api/clients/:clientId/goals/:goalId
// Delete a goal

// POST /api/clients/:clientId/goals/bulk
// Create multiple goals at once (for wizard)
// Body: { goals: [{ templateId, targetValue, ... }, ...] }
```

### Server Actions

```typescript
// src/server/actions/goals.ts

export async function createClientGoal(clientId: string, data: CreateGoalInput) {
  const id = generateId();
  
  // If setting as primary, unset any existing primary
  if (data.isPrimary) {
    await db.update(clientGoals)
      .set({ isPrimary: false })
      .where(eq(clientGoals.clientId, clientId));
  }
  
  await db.insert(clientGoals).values({
    id,
    clientId,
    workspaceId: data.workspaceId,
    templateId: data.templateId,
    targetValue: data.targetValue,
    targetDenominator: data.targetDenominator,
    isPrimary: data.isPrimary ?? false,
    isClientVisible: data.isClientVisible ?? true,
  });
  
  // Trigger immediate computation
  await goalComputationQueue.add('compute-goal', { goalId: id });
  
  revalidatePath(`/clients/${clientId}`);
  return { id };
}
```

---

## Dashboard Integration

### Update client_dashboard_metrics

Add goal summary fields:

```sql
ALTER TABLE client_dashboard_metrics ADD COLUMN
  goal_attainment_pct NUMERIC,          -- Average attainment across all goals
  goals_met_count INTEGER DEFAULT 0,    -- Goals at 100%+
  goals_total_count INTEGER DEFAULT 0,  -- Total active goals
  primary_goal_name TEXT,               -- "10 keywords in top 10"
  primary_goal_pct NUMERIC,             -- Primary goal attainment
  primary_goal_trend TEXT;              -- 'up', 'down', 'flat'
```

### Replace Health Score Display

```tsx
// Before: <HealthScoreBadge score={client.healthScore} />
// After:
<GoalAttainmentBadge 
  attainmentPct={client.goalAttainmentPct}
  goalsMet={client.goalsMetCount}
  goalsTotal={client.goalsTotalCount}
  trend={client.primaryGoalTrend}
/>
```

---

## Summary

**The Dynamic Goals System provides:**

1. **Goal Templates** — Pre-defined goal types agencies can select from
2. **Per-Client Configuration** — Each client gets their own target values
3. **Auto-Computation** — Worker computes current values from GSC/ranking data
4. **Trend Tracking** — Shows if goals are improving or declining
5. **Primary Goal** — One highlighted goal per client for quick scanning
6. **Setup Wizard** — Easy onboarding for new clients
7. **Dashboard Integration** — Replaces arbitrary health scores

**Key Benefits:**
- Goals map directly to what client is paying for
- No arbitrary weights — explicit targets
- Transparent — everyone knows the criteria
- Flexible — different clients, different goals
- Actionable — "7/10" tells you exactly where you stand
