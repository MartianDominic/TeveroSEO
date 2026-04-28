# Autonomous SEO Platform Settings Architecture

> Design document for granular settings control across workspace, client, and feature levels.

## Table of Contents

1. [Design Principles](#design-principles)
2. [Three-Level Hierarchy](#three-level-hierarchy)
3. [Inheritance Model](#inheritance-model)
4. [Database Schema](#database-schema)
5. [Settings by Phase](#settings-by-phase)
6. [UI Information Architecture](#ui-information-architecture)
7. [Preventing Toggle Overload](#preventing-toggle-overload)

---

## Design Principles

### 1. Progressive Disclosure
- Show simple controls by default
- Advanced settings behind "Show Advanced" toggle
- Expert mode unlocks all controls

### 2. Smart Defaults
- Every setting has a sensible default
- Defaults are based on industry best practices
- New clients inherit workspace defaults automatically

### 3. Override Transparency
- Always show when a setting overrides workspace default
- Visual indicator: "Overriding workspace default"
- One-click "Reset to workspace default"

### 4. Audit Trail
- Log all setting changes with timestamp and user
- Enable rollback to previous configuration
- Show diff when settings change

---

## Three-Level Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                     WORKSPACE LEVEL                              │
│  Agency-wide defaults that apply to ALL clients unless          │
│  explicitly overridden. Set once, apply everywhere.             │
│                                                                  │
│  Owner: Agency Admin                                             │
│  Scope: All clients in workspace                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CLIENT LEVEL                                │
│  Per-client overrides. Can inherit, override, or disable        │
│  any workspace setting. Client-specific customizations.         │
│                                                                  │
│  Owner: Account Manager                                          │
│  Scope: Single client                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     FEATURE LEVEL                                │
│  Micro-controls within a feature. Nested under client settings. │
│  Fine-tune behavior for specific automation capabilities.       │
│                                                                  │
│  Owner: SEO Specialist                                           │
│  Scope: Single feature for single client                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Inheritance Model

### Inheritance Modes

| Mode | Behavior | Use Case |
|------|----------|----------|
| `inherit` | Use parent value (default) | Client follows workspace standard |
| `override` | Use explicit value | Client needs different behavior |
| `disable` | Turn off entirely | Feature not applicable to client |
| `lock` | Prevent child override | Enforce agency policy |

### Resolution Algorithm

```typescript
function resolveSettingValue<T>(
  settingKey: string,
  clientId: string,
  workspaceId: string
): T {
  // 1. Check if workspace setting is locked
  const workspaceSetting = getWorkspaceSetting(workspaceId, settingKey);
  if (workspaceSetting.locked) {
    return workspaceSetting.value;
  }
  
  // 2. Check client override
  const clientSetting = getClientSetting(clientId, settingKey);
  if (clientSetting.mode === 'override') {
    return clientSetting.value;
  }
  if (clientSetting.mode === 'disable') {
    return null; // Feature disabled
  }
  
  // 3. Inherit workspace default
  return workspaceSetting.value;
}
```

---

## Database Schema

### workspace_settings Table

```typescript
export const workspaceSettings = pgTable("workspace_settings", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  
  // Setting identity
  category: text("category").notNull(), // 'site_connection', 'seo_checks', etc.
  settingKey: text("setting_key").notNull(),
  
  // Value storage (JSONB for flexibility)
  value: jsonb("value").notNull(),
  valueType: text("value_type").notNull(), // 'boolean', 'number', 'select', 'text', 'json'
  
  // Enforcement
  locked: boolean("locked").default(false), // Prevent client override
  
  // Audit
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: text("updated_by").references(() => user.id),
}, (table) => [
  uniqueIndex("workspace_settings_unique").on(table.workspaceId, table.category, table.settingKey),
  index("workspace_settings_workspace_idx").on(table.workspaceId),
]);
```

### client_settings Table

```typescript
export const clientSettings = pgTable("client_settings", {
  id: text("id").primaryKey(),
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  
  // Setting identity
  category: text("category").notNull(),
  settingKey: text("setting_key").notNull(),
  
  // Override mode
  mode: text("mode").notNull().default("inherit"), // 'inherit', 'override', 'disable'
  
  // Value (only used when mode = 'override')
  value: jsonb("value"),
  
  // Audit
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: text("updated_by").references(() => user.id),
}, (table) => [
  uniqueIndex("client_settings_unique").on(table.clientId, table.category, table.settingKey),
  index("client_settings_client_idx").on(table.clientId),
]);
```

### settings_audit_log Table

```typescript
export const settingsAuditLog = pgTable("settings_audit_log", {
  id: text("id").primaryKey(),
  
  // Scope
  level: text("level").notNull(), // 'workspace', 'client'
  workspaceId: text("workspace_id").notNull(),
  clientId: text("client_id"), // null for workspace-level changes
  
  // Change details
  category: text("category").notNull(),
  settingKey: text("setting_key").notNull(),
  previousValue: jsonb("previous_value"),
  newValue: jsonb("new_value"),
  previousMode: text("previous_mode"),
  newMode: text("new_mode"),
  
  // Who and when
  changedBy: text("changed_by").notNull().references(() => user.id),
  changedAt: timestamp("changed_at").notNull().defaultNow(),
  reason: text("reason"), // Optional change reason
}, (table) => [
  index("settings_audit_log_workspace_idx").on(table.workspaceId, table.changedAt),
  index("settings_audit_log_client_idx").on(table.clientId, table.changedAt),
]);
```

---

## Settings by Phase

### Phase 31: Site Connection

| Setting Key | Level | Type | Default | UI Component | Description |
|-------------|-------|------|---------|--------------|-------------|
| `connection.preferred_platform` | Workspace | select | `auto_detect` | Dropdown | WordPress, Shopify, Custom, Auto-detect |
| `connection.credential_storage` | Workspace | select | `encrypted_db` | Dropdown | Encrypted DB, External Vault |
| `connection.health_check_frequency` | Workspace | select | `daily` | Dropdown | Hourly, Daily, Weekly |
| `connection.alert_on_disconnect` | Workspace | boolean | `true` | Toggle | Alert when site connection lost |
| `connection.reconnect_attempts` | Workspace | number | `3` | Number input | Auto-reconnect attempts before alerting |
| `connection.api_timeout_seconds` | Client | number | `30` | Slider | API request timeout |
| `connection.enabled` | Client | boolean | `true` | Toggle | Enable site connection for client |

### Phase 32: 107 SEO Checks

| Setting Key | Level | Type | Default | UI Component | Description |
|-------------|-------|------|---------|--------------|-------------|
| `checks.categories_enabled` | Workspace | json | `["technical","content","links","performance","security"]` | Checkbox group | Which check categories to run |
| `checks.severity_critical_threshold` | Workspace | number | `90` | Slider | Score below this = critical |
| `checks.severity_warning_threshold` | Workspace | number | `70` | Slider | Score below this = warning |
| `checks.auto_run_frequency` | Workspace | select | `weekly` | Dropdown | Daily, Weekly, Monthly, Manual |
| `checks.max_pages_per_audit` | Workspace | number | `500` | Number input | Maximum pages to crawl |
| `checks.include_lighthouse` | Workspace | boolean | `true` | Toggle | Run Lighthouse performance tests |
| `checks.lighthouse_strategy` | Workspace | select | `both` | Dropdown | Mobile, Desktop, Both |
| `checks.custom_rules` | Client | json | `[]` | Rule builder | Custom check rules |
| `checks.ignored_paths` | Client | json | `[]` | Path list | URL paths to skip |
| `checks.priority_pages` | Client | json | `[]` | URL list | Always check these first |

### Phase 33: Auto-Fix System

| Setting Key | Level | Type | Default | UI Component | Description |
|-------------|-------|------|---------|--------------|-------------|
| `autofix.enabled` | Workspace | boolean | `true` | Toggle | Master auto-fix toggle |
| `autofix.approval_mode` | Workspace | select | `batch_approve` | Dropdown | auto_approve, single_approve, batch_approve |
| `autofix.safe_fixes_auto` | Workspace | boolean | `true` | Toggle | Auto-apply safe fixes (meta, alt text) |
| `autofix.risky_fixes_require_approval` | Workspace | boolean | `true` | Toggle | Require approval for content changes |
| `autofix.revert_on_traffic_drop_percent` | Workspace | number | `15` | Slider | Auto-revert if traffic drops by % |
| `autofix.revert_on_ranking_drop_positions` | Workspace | number | `5` | Number input | Auto-revert if ranking drops positions |
| `autofix.revert_lookback_days` | Workspace | number | `7` | Number input | Days to monitor before revert decision |
| `autofix.max_fixes_per_day` | Client | number | `10` | Number input | Velocity limit |
| `autofix.blacklisted_pages` | Client | json | `[]` | URL list | Never auto-fix these pages |
| `autofix.fix_types_enabled` | Client | json | `["meta","headings","images","links"]` | Checkbox group | Which fix types allowed |

### Phase 34: Keyword-to-Page Mapping

| Setting Key | Level | Type | Default | UI Component | Description |
|-------------|-------|------|---------|--------------|-------------|
| `mapping.auto_mapping_enabled` | Workspace | boolean | `true` | Toggle | Enable automatic keyword-page mapping |
| `mapping.confidence_threshold` | Workspace | number | `0.75` | Slider | Minimum confidence for auto-mapping |
| `mapping.suggest_new_content` | Workspace | boolean | `true` | Toggle | Suggest new pages for unmapped keywords |
| `mapping.keyword_sources` | Workspace | json | `["gsc","manual","competitor"]` | Checkbox group | Sources for keyword discovery |
| `mapping.max_keywords_per_page` | Workspace | number | `5` | Number input | Target keywords per page limit |
| `mapping.cannibalization_detection` | Workspace | boolean | `true` | Toggle | Detect keyword cannibalization |
| `mapping.exclude_branded` | Client | boolean | `false` | Toggle | Exclude branded keywords from mapping |
| `mapping.priority_keywords` | Client | json | `[]` | Keyword list | High-priority keywords to map first |

### Phase 35: Internal Linking

| Setting Key | Level | Type | Default | UI Component | Description |
|-------------|-------|------|---------|--------------|-------------|
| `linking.auto_insert_enabled` | Workspace | boolean | `false` | Toggle | Auto-insert internal links |
| `linking.confidence_threshold` | Workspace | number | `0.85` | Slider | Minimum confidence for auto-link |
| `linking.max_links_per_page` | Workspace | number | `5` | Number input | Maximum new links per page |
| `linking.velocity_per_day` | Workspace | number | `20` | Number input | Links inserted per day limit |
| `linking.anchor_text_mode` | Workspace | select | `natural_variation` | Dropdown | exact_match, natural_variation, mixed |
| `linking.avoid_over_optimization` | Workspace | boolean | `true` | Toggle | Vary anchor text automatically |
| `linking.link_to_new_content` | Workspace | boolean | `true` | Toggle | Prioritize linking to new pages |
| `linking.excluded_anchor_texts` | Client | json | `[]` | Text list | Never use these anchors |
| `linking.hub_pages` | Client | json | `[]` | URL list | Pages that should receive more links |

### Phase 36: Content Briefs

| Setting Key | Level | Type | Default | UI Component | Description |
|-------------|-------|------|---------|--------------|-------------|
| `briefs.auto_generate` | Workspace | boolean | `true` | Toggle | Auto-generate briefs for gaps |
| `briefs.default_word_count_min` | Workspace | number | `1500` | Number input | Minimum target word count |
| `briefs.default_word_count_max` | Workspace | number | `2500` | Number input | Maximum target word count |
| `briefs.required_sections` | Workspace | json | `["intro","main_content","conclusion","faq"]` | Checkbox group | Required content sections |
| `briefs.include_competitor_analysis` | Workspace | boolean | `true` | Toggle | Include competitor content analysis |
| `briefs.include_serp_features` | Workspace | boolean | `true` | Toggle | Include SERP feature targets |
| `briefs.auto_assign_writer` | Workspace | boolean | `false` | Toggle | Auto-assign to AI writer |
| `briefs.review_required_before_publish` | Client | boolean | `true` | Toggle | Human review before publishing |
| `briefs.custom_sections` | Client | json | `[]` | Section builder | Client-specific required sections |

### Phase 37: Brand Voice

| Setting Key | Level | Type | Default | UI Component | Description |
|-------------|-------|------|---------|--------------|-------------|
| `voice.mode` | Workspace | select | `best_practices` | Dropdown | preserve, apply, best_practices |
| `voice.analysis_pages_count` | Workspace | number | `10` | Number input | Pages to analyze for voice learning |
| `voice.tone` | Client | select | `professional` | Dropdown | professional, casual, technical, friendly |
| `voice.vocabulary_level` | Client | select | `intermediate` | Dropdown | simple, intermediate, advanced |
| `voice.words_to_use` | Client | json | `[]` | Word list | Preferred vocabulary |
| `voice.words_to_avoid` | Client | json | `[]` | Word list | Forbidden vocabulary |
| `voice.competitor_differentiation` | Client | json | `[]` | Competitor list | Competitors to differentiate from |
| `voice.protection_rules` | Client | json | `[]` | Rule builder | Brand protection rules |

### Phase 38: Autonomous Loop

| Setting Key | Level | Type | Default | UI Component | Description |
|-------------|-------|------|---------|--------------|-------------|
| `loop.enabled` | Workspace | boolean | `true` | Toggle | Enable autonomous operation |
| `loop.run_frequency` | Workspace | select | `daily` | Dropdown | hourly, daily, weekly, custom |
| `loop.run_time_utc` | Workspace | text | `"03:00"` | Time picker | Preferred run time (UTC) |
| `loop.pause_on_critical_error` | Workspace | boolean | `true` | Toggle | Pause loop on critical errors |
| `loop.pause_on_traffic_anomaly` | Workspace | boolean | `true` | Toggle | Pause if traffic anomaly detected |
| `loop.traffic_anomaly_threshold` | Workspace | number | `30` | Slider | % change to trigger pause |
| `loop.notification_channel` | Workspace | select | `email` | Dropdown | email, slack, webhook, none |
| `loop.notification_frequency` | Workspace | select | `daily_digest` | Dropdown | immediate, daily_digest, weekly_digest |
| `loop.max_actions_per_run` | Client | number | `50` | Number input | Actions per loop iteration |
| `loop.quiet_hours_start` | Client | text | `null` | Time picker | Don't run during these hours |
| `loop.quiet_hours_end` | Client | text | `null` | Time picker | Don't run during these hours |

---

## UI Information Architecture

### Settings Navigation Structure

```
Settings
├── Workspace Settings (Agency Defaults)
│   ├── Overview Dashboard
│   │   └── Quick toggles for common settings
│   ├── Site Connection
│   │   ├── Platform Preferences
│   │   ├── Credential Security
│   │   └── Health Monitoring
│   ├── SEO Audits
│   │   ├── Check Categories
│   │   ├── Severity Thresholds
│   │   └── Scheduling
│   ├── Automation
│   │   ├── Auto-Fix Rules
│   │   ├── Approval Workflow
│   │   └── Revert Sensitivity
│   ├── Keywords & Content
│   │   ├── Keyword Mapping
│   │   ├── Content Briefs
│   │   └── Internal Linking
│   ├── Brand Voice
│   │   ├── Voice Mode
│   │   └── Learning Sources
│   ├── Autonomous Loop
│   │   ├── Scheduling
│   │   ├── Pause Conditions
│   │   └── Notifications
│   └── Advanced
│       ├── API Limits
│       ├── Locked Settings
│       └── Export/Import
│
├── Client Settings (Per-Client)
│   ├── [Client Selector Dropdown]
│   ├── Overview
│   │   ├── Active overrides count
│   │   └── Quick status
│   ├── Overrides
│   │   └── [Same categories as workspace]
│   │       └── Each setting shows: Inherited | Overridden | Disabled
│   ├── Brand Voice
│   │   └── [Client-specific voice settings]
│   └── Exclusions
│       ├── Blacklisted Pages
│       ├── Excluded Keywords
│       └── Disabled Features
│
└── Audit Log
    ├── Filter by: Workspace | Client | Category | User
    └── Timeline of all setting changes
```

### Settings Card Component

```
┌─────────────────────────────────────────────────────────────┐
│ Auto-Fix Enabled                                    [Toggle]│
│                                                             │
│ Automatically apply safe SEO fixes without manual review.   │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ ⚡ Workspace default: ON                                ││
│ │    This client: Inheriting                    [Override]││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ [Show Advanced Options ▼]                                   │
└─────────────────────────────────────────────────────────────┘
```

### Override Indicator States

| State | Visual | Meaning |
|-------|--------|---------|
| Inherited | Gray dot | Using workspace default |
| Overridden | Blue dot + value | Client has custom value |
| Disabled | Red slash | Feature turned off for client |
| Locked | Lock icon | Cannot be overridden (agency policy) |

---

## Preventing Toggle Overload

### 1. Setting Tiers

| Tier | Visibility | Who Sees It |
|------|------------|-------------|
| Essential | Always visible | Everyone |
| Standard | Default visible | Everyone |
| Advanced | Hidden by default | Click "Show Advanced" |
| Expert | Expert mode only | Enable in user preferences |

### Setting Tier Assignments

```typescript
const SETTING_TIERS = {
  // Essential - always visible
  'autofix.enabled': 'essential',
  'loop.enabled': 'essential',
  'linking.auto_insert_enabled': 'essential',
  
  // Standard - visible by default
  'autofix.approval_mode': 'standard',
  'checks.auto_run_frequency': 'standard',
  'briefs.auto_generate': 'standard',
  
  // Advanced - hidden by default
  'autofix.revert_on_traffic_drop_percent': 'advanced',
  'mapping.confidence_threshold': 'advanced',
  'linking.velocity_per_day': 'advanced',
  
  // Expert - requires expert mode
  'connection.api_timeout_seconds': 'expert',
  'checks.custom_rules': 'expert',
  'loop.max_actions_per_run': 'expert',
};
```

### 2. Preset Configurations

Instead of configuring every toggle, offer presets:

| Preset | Description | Auto-Fix | Approval | Loop |
|--------|-------------|----------|----------|------|
| **Conservative** | Human approval for everything | Safe only | All require approval | Weekly |
| **Balanced** | Auto-fix safe, approve risky | Safe auto | Risky needs approval | Daily |
| **Aggressive** | Maximum automation | All auto | Batch approve | Daily |
| **Custom** | Configure each setting | - | - | - |

```typescript
const PRESETS = {
  conservative: {
    'autofix.enabled': true,
    'autofix.safe_fixes_auto': true,
    'autofix.risky_fixes_require_approval': true,
    'autofix.approval_mode': 'single_approve',
    'loop.run_frequency': 'weekly',
    'linking.auto_insert_enabled': false,
  },
  balanced: {
    'autofix.enabled': true,
    'autofix.safe_fixes_auto': true,
    'autofix.risky_fixes_require_approval': true,
    'autofix.approval_mode': 'batch_approve',
    'loop.run_frequency': 'daily',
    'linking.auto_insert_enabled': true,
    'linking.confidence_threshold': 0.85,
  },
  aggressive: {
    'autofix.enabled': true,
    'autofix.safe_fixes_auto': true,
    'autofix.risky_fixes_require_approval': false,
    'autofix.approval_mode': 'auto_approve',
    'loop.run_frequency': 'daily',
    'linking.auto_insert_enabled': true,
    'linking.confidence_threshold': 0.75,
  },
};
```

### 3. Smart Grouping

Group related settings together to reduce cognitive load:

```
┌─────────────────────────────────────────────────────────────┐
│ AUTOMATION SAFETY                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Revert Sensitivity                                          │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ Conservative ◄═══════════●═══════════► Aggressive      ││
│ │                                                         ││
│ │ • Traffic drop threshold: 15%                          ││
│ │ • Ranking drop threshold: 5 positions                  ││
│ │ • Lookback period: 7 days                              ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ This controls how quickly the system reverts changes when   │
│ negative signals are detected.                              │
│                                                             │
│ [Customize Individual Values ▼]                             │
└─────────────────────────────────────────────────────────────┘
```

### 4. Contextual Help

Every setting includes:
- One-line description
- "Learn more" expandable section
- Link to documentation
- Impact indicator (Low/Medium/High risk)

---

## TypeScript Types

```typescript
// Setting value types
export type SettingValueType = 'boolean' | 'number' | 'select' | 'text' | 'json';

// Override modes
export type OverrideMode = 'inherit' | 'override' | 'disable';

// Setting tiers
export type SettingTier = 'essential' | 'standard' | 'advanced' | 'expert';

// Setting categories (phases)
export type SettingCategory = 
  | 'connection'
  | 'checks'
  | 'autofix'
  | 'mapping'
  | 'linking'
  | 'briefs'
  | 'voice'
  | 'loop';

// Setting definition
export interface SettingDefinition {
  key: string;
  category: SettingCategory;
  level: 'workspace' | 'client' | 'both';
  type: SettingValueType;
  default: unknown;
  tier: SettingTier;
  label: string;
  description: string;
  helpUrl?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  options?: Array<{ value: string; label: string }>; // For select type
  min?: number; // For number type
  max?: number; // For number type
  lockable?: boolean; // Can workspace admin lock this?
}

// Resolved setting with inheritance info
export interface ResolvedSetting<T = unknown> {
  key: string;
  value: T;
  effectiveValue: T;
  mode: OverrideMode;
  isLocked: boolean;
  workspaceDefault: T;
  hasOverride: boolean;
  lastUpdated: Date;
  lastUpdatedBy: string;
}
```

---

## API Endpoints

```typescript
// Get all settings for a workspace
GET /api/settings/workspace/:workspaceId
// Returns: Record<string, WorkspaceSetting>

// Update workspace setting
PATCH /api/settings/workspace/:workspaceId/:category/:key
// Body: { value: unknown, locked?: boolean }

// Get all settings for a client (with inheritance)
GET /api/settings/client/:clientId
// Returns: Record<string, ResolvedSetting>

// Update client setting
PATCH /api/settings/client/:clientId/:category/:key
// Body: { mode: OverrideMode, value?: unknown }

// Reset client setting to workspace default
DELETE /api/settings/client/:clientId/:category/:key

// Apply preset to workspace
POST /api/settings/workspace/:workspaceId/preset
// Body: { preset: 'conservative' | 'balanced' | 'aggressive' }

// Get settings audit log
GET /api/settings/audit?workspaceId=X&clientId=Y&from=Z&to=W
// Returns: SettingsAuditLogEntry[]
```

---

## Implementation Priority

### Phase 1: Core Infrastructure
1. Database schema migration
2. Settings service with inheritance logic
3. Basic workspace settings UI

### Phase 2: Client Overrides
1. Client settings UI with override indicators
2. Reset to default functionality
3. Audit logging

### Phase 3: UX Enhancements
1. Presets
2. Setting tiers (show/hide advanced)
3. Contextual help
4. Settings search

### Phase 4: Advanced Features
1. Settings export/import
2. Settings templates
3. A/B testing settings
4. Settings recommendations based on client performance
