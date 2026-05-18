# Research 07: Editorial Workflow

> **Status:** Complete  
> **Agent:** 7 of 20 (Stream B: Content Calendar)  
> **Dependencies:** Research-05 (Content Calendar), Research-06 (Priority Queue)

---

## Executive Summary

This document specifies the editorial workflow for TeveroSEO content management: state transitions (Draft, Review, Published), role-based access control (Writer, Editor, Admin), approval workflows, revision history, and collaboration patterns. All interfaces follow design-system-v6 principles.

---

## 1. Content States (The Pipeline)

### 1.1 State Machine

```
                    ┌──────────────────────────────────────────────────────────────┐
                    │                    CONTENT STATE MACHINE                      │
                    └──────────────────────────────────────────────────────────────┘

   ┌─────────┐      ┌─────────┐      ┌─────────┐      ┌─────────┐      ┌─────────┐
   │  IDEA   │─────►│  DRAFT  │─────►│ REVIEW  │─────►│APPROVED │─────►│PUBLISHED│
   │         │      │         │      │         │      │         │      │         │
   └─────────┘      └─────────┘      └─────────┘      └─────────┘      └─────────┘
        │               │  ▲             │  ▲             │               │
        │               │  │             │  │             │               │
        │               ▼  │             ▼  │             │               ▼
        │          ┌─────────┐      ┌─────────┐           │          ┌─────────┐
        └─────────►│ARCHIVED │      │REVISION │◄──────────┘          │ UPDATED │
                   │         │      │REQUESTED│                      │         │
                   └─────────┘      └─────────┘                      └─────────┘
```

### 1.2 State Definitions

| State | Description | Who Can Move Here | Next States |
|-------|-------------|-------------------|-------------|
| **IDEA** | Concept captured, not started | Anyone | Draft, Archived |
| **DRAFT** | In progress, being written | Writer, Editor, Admin | Review, Archived |
| **REVIEW** | Submitted for editorial review | Writer (submit), Editor (receives) | Approved, Revision Requested |
| **REVISION_REQUESTED** | Needs changes, returned to writer | Editor | Draft |
| **APPROVED** | Passed review, awaiting publish | Editor, Admin | Published, Draft (rollback) |
| **PUBLISHED** | Live on site | Admin, Auto (if score >= 80) | Updated |
| **UPDATED** | Published content was revised | Same as Published | Published |
| **ARCHIVED** | Removed from active pipeline | Editor, Admin | Draft (restore) |

### 1.3 Database Schema

```sql
-- Content items table
CREATE TABLE content_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id),
    
    -- Content metadata
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255),
    target_keyword VARCHAR(255),
    content_type VARCHAR(50) NOT NULL, -- 'article', 'landing_page', 'product_page'
    
    -- State machine
    status VARCHAR(30) NOT NULL DEFAULT 'idea',
    status_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status_changed_by UUID REFERENCES users(id),
    
    -- Quality metrics
    quality_score INTEGER, -- 0-100, from quality gate
    voice_score INTEGER,   -- 0-100, from voice compliance
    seo_score INTEGER,     -- 0-100, from on-page checks
    
    -- Workflow metadata
    assigned_writer_id UUID REFERENCES users(id),
    assigned_editor_id UUID REFERENCES users(id),
    due_date DATE,
    priority VARCHAR(20) DEFAULT 'normal', -- 'urgent', 'high', 'normal', 'low'
    
    -- Publishing
    published_at TIMESTAMPTZ,
    published_url TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT valid_status CHECK (status IN (
        'idea', 'draft', 'review', 'revision_requested', 
        'approved', 'published', 'updated', 'archived'
    ))
);

-- Status change audit log
CREATE TABLE content_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES content_items(id),
    from_status VARCHAR(30),
    to_status VARCHAR(30) NOT NULL,
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason TEXT, -- Required for revision_requested
    metadata JSONB DEFAULT '{}'
);

-- Content versions (revision history)
CREATE TABLE content_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES content_items(id),
    version_number INTEGER NOT NULL,
    
    -- Content snapshot
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    meta_description TEXT,
    
    -- Scores at time of version
    quality_score INTEGER,
    voice_score INTEGER,
    seo_score INTEGER,
    
    -- Metadata
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    commit_message TEXT,
    
    UNIQUE(content_id, version_number)
);
```

---

## 2. Role-Based Access Control (RBAC)

### 2.1 Role Definitions

| Role | Description | Typical User |
|------|-------------|--------------|
| **WRITER** | Creates and edits content, submits for review | Content creators, freelancers |
| **EDITOR** | Reviews content, approves/rejects, edits any content | Senior writers, content managers |
| **ADMIN** | Full access, publishes, manages users and settings | Agency owners, account managers |
| **VIEWER** | Read-only access to content and reports | Client stakeholders |

### 2.2 Permission Matrix

| Action | Writer | Editor | Admin | Viewer |
|--------|--------|--------|-------|--------|
| Create content | Yes | Yes | Yes | No |
| Edit own draft | Yes | Yes | Yes | No |
| Edit any draft | No | Yes | Yes | No |
| Submit for review | Yes | Yes | Yes | No |
| View review queue | Own only | Yes | Yes | No |
| Approve content | No | Yes | Yes | No |
| Request revisions | No | Yes | Yes | No |
| Publish content | No | No | Yes | No |
| Unpublish content | No | No | Yes | No |
| Archive content | No | Yes | Yes | No |
| Restore archived | No | Yes | Yes | No |
| View revision history | Yes | Yes | Yes | Yes |
| Restore old version | No | Yes | Yes | No |
| Manage users | No | No | Yes | No |
| Configure settings | No | No | Yes | No |
| View analytics | Own only | Yes | Yes | Yes |

### 2.3 Database Schema

```sql
-- User roles
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    client_id UUID NOT NULL REFERENCES clients(id), -- Role is per-client
    role VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id, client_id),
    CONSTRAINT valid_role CHECK (role IN ('writer', 'editor', 'admin', 'viewer'))
);

-- Permissions (fine-grained overrides)
CREATE TABLE role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role VARCHAR(20) NOT NULL,
    permission VARCHAR(50) NOT NULL,
    allowed BOOLEAN NOT NULL DEFAULT true,
    
    UNIQUE(role, permission)
);
```

---

## 3. Approval Workflow

### 3.1 Standard Review Process

```
Writer submits content
         │
         ▼
    ┌─────────────────┐
    │ Auto-validation │
    │ - Quality >= 60 │
    │ - Voice >= 70   │
    │ - SEO >= 50     │
    └────────┬────────┘
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
 PASSED            FAILED
    │                 │
    ▼                 ▼
Review Queue     Return to Writer
    │            with auto-feedback
    ▼
Editor Reviews
    │
    ├──────────────────┐
    │                  │
    ▼                  ▼
 APPROVE         REQUEST REVISION
    │                  │
    ▼                  ▼
Score >= 80?      Return to Writer
    │             with editor notes
    ├─────┐
    │     │
    ▼     ▼
  AUTO  MANUAL
PUBLISH PUBLISH
```

### 3.2 Approval Thresholds

| Metric | Minimum for Review | Minimum for Publish | Auto-Publish Threshold |
|--------|-------------------|--------------------|-----------------------|
| Quality Score | 60 | 75 | 80 |
| Voice Score | 70 | 80 | 85 |
| SEO Score | 50 | 70 | 75 |

### 3.3 Review Interface (v6 Design)

```
┌────────────────────────────────────────────────────────────────────────────┐
│  REVIEW QUEUE                                                    ◉ 12 items │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                                                                     │  │
│  │  "Best Running Shoes for Marathon Training"                         │  │
│  │                                                                     │  │
│  │  Submitted by Marcus L. · 2h ago · running-shoes-marathon-training  │  │
│  │                                                                     │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                          │  │
│  │  │ QUALITY  │  │  VOICE   │  │   SEO    │                          │  │
│  │  │    78    │  │    84    │  │    72    │                          │  │
│  │  │ ●●●●○    │  │ ●●●●●    │  │ ●●●●○    │                          │  │
│  │  └──────────┘  └──────────┘  └──────────┘                          │  │
│  │                                                                     │  │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │  │
│  │  │  View Content →  │  │     Approve      │  │ Request Revision │  │  │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘  │  │
│  │                                                                     │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  "How to Choose Trail Running Shoes"                                │  │
│  │  ...                                                                │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

**v6 Compliance:**
- Score cards use ghost-edge shadows (`--shadow-card`)
- Severity dots (1-5) indicate score ranges
- Hover-to-reveal action buttons with `--motion-reveal`
- Card lifts 1px on hover with `--shadow-lift`

### 3.4 Revision Request Modal

```
┌────────────────────────────────────────────────────────────────────────────┐
│  REQUEST REVISION                                                      ✕  │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  "Best Running Shoes for Marathon Training"                                │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │  Select issues (or write custom feedback below):                     │ │
│  │                                                                      │ │
│  │  ☐ Voice doesn't match brand guidelines                             │ │
│  │  ☐ Missing key points from brief                                    │ │
│  │  ☐ SEO improvements needed (see audit)                              │ │
│  │  ☐ Factual accuracy concerns                                        │ │
│  │  ☐ Structure/flow needs work                                        │ │
│  │  ☐ Too short / Too long                                             │ │
│  │                                                                      │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│  Additional notes:                                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │                                                                      │ │
│  │  The intro is too generic. Please add specific marathon distance    │ │
│  │  context (5K vs full marathon) in the opening paragraph.            │ │
│  │                                                                      │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │                    Send Revision Request                           │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Revision History

### 4.1 Version Control Model

Every significant change creates a new version:
- **Auto-save:** Every 30 seconds during editing (no version created)
- **Manual save:** Creates version if content changed significantly (>5% diff)
- **Submit for review:** Always creates version
- **Approval:** Creates version snapshot
- **Publish:** Creates version with `is_published: true`

### 4.2 Diff Visualization

```
┌────────────────────────────────────────────────────────────────────────────┐
│  VERSION HISTORY                                            Compare ▼     │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  v5 · Published · May 10, 2026 at 14:32                                   │
│       by Sarah M. (Editor) · "Final edits, approved for publish"          │
│       Quality: 86 · Voice: 91 · SEO: 82                                   │
│                                                                            │
│  ─────────────────────────────────────────────────────────────────────    │
│                                                                            │
│  v4 · Approved · May 10, 2026 at 11:45                                    │
│       by Sarah M. (Editor) · "Approved after revision"                    │
│       Quality: 84 · Voice: 89 · SEO: 80                                   │
│                                                                            │
│  ─────────────────────────────────────────────────────────────────────    │
│                                                                            │
│  v3 · Revision Requested · May 9, 2026 at 16:20                           │
│       by Sarah M. (Editor) · "Voice doesn't match brand"                  │
│       Quality: 78 · Voice: 72 · SEO: 78                                   │
│                                                                            │
│  ─────────────────────────────────────────────────────────────────────    │
│                                                                            │
│  v2 · Review · May 9, 2026 at 14:05                                       │
│       by Marcus L. (Writer) · "Submitted for review"                      │
│                                                                            │
│  ─────────────────────────────────────────────────────────────────────    │
│                                                                            │
│  v1 · Draft · May 8, 2026 at 10:30                                        │
│       by Marcus L. (Writer) · "Initial draft"                             │
│                                                                            │
│  ┌───────────────────────────────────────────────────────────────────┐    │
│  │  Restore v4  │  View Diff v4 → v5  │  Download v4                 │    │
│  └───────────────────────────────────────────────────────────────────┘    │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Side-by-Side Diff View

```
┌────────────────────────────────────────────────────────────────────────────┐
│  COMPARING v3 → v4                                    ← Back to History   │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐         │
│  │         VERSION 3          │  │         VERSION 4          │         │
│  │      May 9, 16:20          │  │      May 10, 11:45          │         │
│  ├─────────────────────────────┤  ├─────────────────────────────┤         │
│  │                             │  │                             │         │
│  │ Running shoes are an       │  │ Finding the perfect running │         │
│  │ important purchase for     │  │ shoes for marathon training │         │
│  │ marathon runners. There    │  │ can make or break your      │         │
│  │ are many options...        │  │ race day performance...     │         │
│  │ ─────────────────────────  │  │ ─────────────────────────   │         │
│  │ [DELETED BLOCK]            │  │ [ADDED BLOCK]               │         │
│  │                             │  │                             │         │
│  └─────────────────────────────┘  └─────────────────────────────┘         │
│                                                                            │
│  Summary: +42 words, -18 words, 3 paragraphs changed                       │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Collaboration Patterns

### 5.1 Comment System

Inline comments allow collaboration without blocking workflow:

```sql
CREATE TABLE content_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES content_items(id),
    version_id UUID REFERENCES content_versions(id), -- Optional: anchor to version
    
    -- Position (for inline comments)
    anchor_type VARCHAR(20), -- 'paragraph', 'sentence', 'selection'
    anchor_start INTEGER,    -- Character offset
    anchor_end INTEGER,
    
    -- Comment data
    author_id UUID NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    resolved BOOLEAN DEFAULT false,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    
    -- Threading
    parent_comment_id UUID REFERENCES content_comments(id),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 5.2 Comment UI (v6 Design)

```
┌────────────────────────────────────────────────────────────────────────────┐
│  CONTENT EDITOR                                              ⋯ Comments 3 │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Finding the perfect running shoes for marathon training can make or      │
│  break your race day performance. [Whether you're training for your       │
│  first marathon or your fiftieth], the right footwear provides the        │◄── Highlighted selection
│  cushioning, support, and durability...                                   │
│                                                                            │
│                    ┌───────────────────────────────────────────┐          │
│                    │  Sarah M. · Editor · May 9                │          │
│                    │                                           │          │
│                    │  Love this voice! Much better than v3.    │          │
│                    │  Feels authentic to the brand.            │          │
│                    │                                           │          │
│                    │  ☑ Resolved                               │          │
│                    └───────────────────────────────────────────┘          │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Assignment and Handoff

```
┌────────────────────────────────────────────────────────────────────────────┐
│  ASSIGN CONTENT                                                        ✕  │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  "Best Running Shoes for Marathon Training"                                │
│                                                                            │
│  Writer:                                                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │  Marcus L.                                                        ▼ │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│  Editor:                                                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │  Sarah M.                                                         ▼ │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│  Due date:                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │  May 15, 2026                                                     📅 │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│  Priority:                                                                 │
│  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐                                 │
│  │ Urgent│ │ High  │ │Normal │ │  Low  │                                 │
│  └───────┘ └───────┘ └───────┘ └───────┘                                 │
│                ▲                                                           │
│                └── Selected                                                │
│                                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │                        Save Assignment                             │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 5.4 Activity Feed

Real-time activity stream for collaboration awareness:

```
┌────────────────────────────────────────────────────────────────────────────┐
│  ACTIVITY                                                                 │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Today                                                                     │
│  ─────────────────────────────────────────────────────────────────────    │
│                                                                            │
│  14:32  Sarah M. published "Best Running Shoes for Marathon Training"     │
│         → View article                                                     │
│                                                                            │
│  11:45  Sarah M. approved "Best Running Shoes for Marathon Training"      │
│         Quality: 84 · Voice: 89 · SEO: 80                                 │
│                                                                            │
│  10:20  Marcus L. submitted revision for "Best Running Shoes..."          │
│         3 changes from v3                                                  │
│                                                                            │
│  Yesterday                                                                 │
│  ─────────────────────────────────────────────────────────────────────    │
│                                                                            │
│  16:20  Sarah M. requested revision on "Best Running Shoes..."            │
│         Reason: Voice doesn't match brand guidelines                       │
│                                                                            │
│  14:05  Marcus L. submitted "Best Running Shoes for Marathon Training"    │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Pipeline Dashboard (v6 Design)

### 6.1 Editorial Moment

The pipeline dashboard's editorial moment is the **content velocity indicator**:

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│     12 / 20                                                  ● ON TRACK    │
│                                                              ETA May 31    │
│     articles this month                                      3 days ahead  │
│                                                                            │
│     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │
│                                                    ▲                       │
│                                                 TARGET                     │
│                                                                            │
│     60% to goal · 8 to publish · +4 last 7d · +10 last 30d                │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

**v6 Compliance:**
- `12` uses `--num-mega` (clamp 58-80px, Newsreader 400)
- `/` uses `--text-4` (whisper)
- `20` uses `--num-hero` size, `--text-3` (muted)
- Status pill with `--success-soft` background

### 6.2 Pipeline Stages (Kanban Summary)

```
┌────────────────────────────────────────────────────────────────────────────┐
│  PIPELINE                                                                 │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐         │
│  │  IDEA   │  │  DRAFT  │  │ REVIEW  │  │APPROVED │  │PUBLISHED│         │
│  │         │  │         │  │         │  │         │  │         │         │
│  │    8    │  │    5    │  │    3    │  │    2    │  │   12    │         │
│  │  ━━━    │  │  ━━━━   │  │  ━━     │  │  ━      │  │ ━━━━━━  │         │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘         │
│                                                                            │
│  Total: 30 items · Last publish: 2h ago                                   │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

**v6 Compliance:**
- 3px volume bars under each count (relative to max)
- Published stage uses `--accent` fill with hatched pattern
- Counts use Newsreader serif (`--num-row`)

---

## 7. Notifications

### 7.1 Notification Triggers

| Event | Notify | Channel |
|-------|--------|---------|
| Content assigned to writer | Writer | In-app, Email |
| Submitted for review | Assigned editor | In-app, Email |
| Revision requested | Writer | In-app, Email |
| Content approved | Writer | In-app |
| Content published | Writer, Editor | In-app |
| Comment added | Content author, mentioned users | In-app |
| Due date approaching (24h) | Assigned user | In-app, Email |
| Due date passed | Assigned user, Editor | In-app, Email |

### 7.2 Notification Preferences

```sql
CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    
    -- Per-event toggles
    assignment_email BOOLEAN DEFAULT true,
    assignment_in_app BOOLEAN DEFAULT true,
    review_email BOOLEAN DEFAULT true,
    review_in_app BOOLEAN DEFAULT true,
    revision_email BOOLEAN DEFAULT true,
    revision_in_app BOOLEAN DEFAULT true,
    approval_in_app BOOLEAN DEFAULT true,
    publish_in_app BOOLEAN DEFAULT true,
    comment_in_app BOOLEAN DEFAULT true,
    due_date_email BOOLEAN DEFAULT true,
    due_date_in_app BOOLEAN DEFAULT true,
    
    -- Digest preferences
    daily_digest BOOLEAN DEFAULT false,
    weekly_digest BOOLEAN DEFAULT true,
    
    UNIQUE(user_id)
);
```

---

## 8. API Endpoints

### 8.1 Content State Transitions

```typescript
// Submit for review
POST /api/content/:id/submit
Request: { commit_message?: string }
Response: { status: 'review', version_id: string }
Permissions: Writer+

// Approve content
POST /api/content/:id/approve
Request: { commit_message?: string }
Response: { status: 'approved', version_id: string }
Permissions: Editor+

// Request revision
POST /api/content/:id/request-revision
Request: { reason: string, issues?: string[] }
Response: { status: 'revision_requested', version_id: string }
Permissions: Editor+

// Publish content
POST /api/content/:id/publish
Request: { scheduled_at?: string }
Response: { status: 'published', published_url: string }
Permissions: Admin

// Archive content
POST /api/content/:id/archive
Request: { reason?: string }
Response: { status: 'archived' }
Permissions: Editor+

// Restore from archive
POST /api/content/:id/restore
Response: { status: 'draft' }
Permissions: Editor+
```

### 8.2 Revision History

```typescript
// Get version history
GET /api/content/:id/versions
Response: { versions: ContentVersion[] }

// Get specific version
GET /api/content/:id/versions/:version
Response: { version: ContentVersion }

// Compare versions
GET /api/content/:id/versions/compare?from=3&to=4
Response: { diff: DiffResult, summary: DiffSummary }

// Restore version
POST /api/content/:id/versions/:version/restore
Response: { content: ContentItem, new_version_id: string }
Permissions: Editor+
```

### 8.3 Comments

```typescript
// Add comment
POST /api/content/:id/comments
Request: { body: string, anchor?: AnchorPosition, parent_id?: string }
Response: { comment: Comment }

// Resolve comment
POST /api/content/:id/comments/:comment_id/resolve
Response: { comment: Comment }

// Reply to comment
POST /api/content/:id/comments/:comment_id/reply
Request: { body: string }
Response: { comment: Comment }
```

---

## 9. Implementation Priorities

### Phase 1: Core State Machine
1. Content status field and transitions
2. Status history audit log
3. Basic permission checks
4. Review queue UI

### Phase 2: Revision History
1. Version creation on key events
2. Version list UI
3. Side-by-side diff view
4. Restore from version

### Phase 3: Collaboration
1. Comment system with threading
2. Inline comment anchoring
3. Activity feed
4. Notification system

### Phase 4: Advanced Features
1. Auto-publish based on score thresholds
2. Scheduled publishing
3. Batch operations (approve multiple)
4. Workflow automation rules

---

## 10. Integration Points

| System | Integration |
|--------|-------------|
| **Quality Gate** | Scores determine auto-approval eligibility |
| **Voice Compliance** | Score displayed in review UI |
| **On-Page SEO** | Score displayed in review UI |
| **Content Calendar** | Status flows to calendar view |
| **Publishing** | Approved content enters publish queue |
| **GSC/IndexNow** | Triggered on publish |
| **Notifications** | Triggered on state transitions |

---

## References

- `.planning/design/design-system-v6.md` -- Visual patterns
- `.planning/phases/99-unified-seo-content-pipeline/PHASE-99-MASTER-SPEC.md` -- Pipeline overview
- Research-05: Content Calendar Architecture
- Research-06: Priority Queue System
- Research-11: Quality Gate Architecture
