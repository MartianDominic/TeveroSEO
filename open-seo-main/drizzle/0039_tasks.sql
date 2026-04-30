-- Migration: 0039_tasks.sql
-- Phase 49-51: Onboarding & Agency Dashboard
-- Creates tasks table for Today's Tasks feed
--
-- Implements:
-- - D-09: Task sources (checklist, pipeline, follow_up, expiring, seo, manual)
-- - D-10: Full task system with assignees, priority, due date, reminders
-- - D-11: 5-layer priority system support (pinnedAt, snoozedUntil for user overrides)

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,

  -- Task content
  title TEXT NOT NULL,
  description TEXT,

  -- Source tracking (D-09)
  source TEXT NOT NULL DEFAULT 'manual',
  entity_type TEXT,
  entity_id TEXT,

  -- Assignment and priority (D-10)
  assigned_to TEXT,
  priority TEXT DEFAULT 'medium',
  category TEXT DEFAULT 'other',

  -- Scheduling (D-10)
  due_at TIMESTAMPTZ,
  reminder_at TIMESTAMPTZ,

  -- D-11 Layer 2: User overrides
  pinned_at TIMESTAMPTZ,
  snoozed_until TIMESTAMPTZ,

  -- Completion
  completed_at TIMESTAMPTZ,
  completed_by TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- D-09: Task source must be valid enum value
  CONSTRAINT chk_task_source_valid CHECK (
    source IN ('checklist', 'pipeline', 'follow_up', 'expiring', 'seo', 'manual')
  ),

  -- D-10: Task priority must be valid enum value
  CONSTRAINT chk_task_priority_valid CHECK (
    priority IN ('high', 'medium', 'low')
  )
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS ix_tasks_workspace ON tasks(workspace_id);
CREATE INDEX IF NOT EXISTS ix_tasks_client ON tasks(client_id);
CREATE INDEX IF NOT EXISTS ix_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS ix_tasks_due ON tasks(due_at);
CREATE INDEX IF NOT EXISTS ix_tasks_pinned ON tasks(pinned_at);
CREATE INDEX IF NOT EXISTS ix_tasks_source_entity ON tasks(source, entity_id);
CREATE INDEX IF NOT EXISTS ix_tasks_active ON tasks(workspace_id, completed_at);

COMMENT ON TABLE tasks IS 'Today''s Tasks feed for agency command center (Phase 49-51)';
COMMENT ON COLUMN tasks.source IS 'D-09: Task source type (checklist, pipeline, follow_up, expiring, seo, manual)';
COMMENT ON COLUMN tasks.priority IS 'D-10: Task priority (high, medium, low)';
COMMENT ON COLUMN tasks.pinned_at IS 'D-11 Layer 2: When task was pinned to My Focus';
COMMENT ON COLUMN tasks.snoozed_until IS 'D-11 Layer 2: Task hidden until this date';
