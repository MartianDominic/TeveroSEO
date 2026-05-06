-- Phase 87-01: Client Portal Foundation
-- Portal tokens for shareable client access links
-- Client settings for communication and workflow preferences

-- Portal tokens table
CREATE TABLE IF NOT EXISTS "portal_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "token" varchar(32) NOT NULL UNIQUE,
  "auth_level" text NOT NULL DEFAULT 'token_only',
  "expires_at" timestamp with time zone NOT NULL,
  "last_accessed_at" timestamp with time zone,
  "access_count" integer DEFAULT 0,
  "is_revoked" boolean DEFAULT false,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "chk_portal_token_auth_level" CHECK (auth_level IN ('token_only', 'email_verify', 'full_login'))
);

-- Portal tokens indexes
CREATE INDEX IF NOT EXISTS "ix_portal_tokens_client" ON "portal_tokens" ("client_id");
CREATE INDEX IF NOT EXISTS "ix_portal_tokens_expires" ON "portal_tokens" ("expires_at");
CREATE UNIQUE INDEX IF NOT EXISTS "ix_portal_tokens_token" ON "portal_tokens" ("token");

-- Portal users table
CREATE TABLE IF NOT EXISTS "portal_users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "email" varchar(255) NOT NULL,
  "clerk_user_id" varchar(255),
  "email_verified_at" timestamp with time zone,
  "last_login_at" timestamp with time zone,
  "login_count" integer DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Portal users indexes
CREATE INDEX IF NOT EXISTS "ix_portal_users_client" ON "portal_users" ("client_id");
CREATE INDEX IF NOT EXISTS "ix_portal_users_email" ON "portal_users" ("email");
CREATE UNIQUE INDEX IF NOT EXISTS "ix_portal_users_client_email" ON "portal_users" ("client_id", "email");

-- Client settings table
CREATE TABLE IF NOT EXISTS "client_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" uuid NOT NULL UNIQUE REFERENCES "clients"("id") ON DELETE CASCADE,
  "communication_style" text DEFAULT 'hybrid',
  "portal_enabled" boolean DEFAULT false,
  "portal_auth_level" text DEFAULT 'token_only',
  "notifications_enabled" boolean DEFAULT false,
  "content_approval_required" boolean DEFAULT false,
  "auto_approve_after_days" integer DEFAULT 3,
  "keyword_lockin_enabled" boolean DEFAULT true,
  "keyword_lockin_strict" boolean DEFAULT false,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "chk_client_settings_comm_style" CHECK (communication_style IN ('high_touch', 'hybrid', 'self_service')),
  CONSTRAINT "chk_client_settings_portal_auth" CHECK (portal_auth_level IN ('token_only', 'email_verify', 'full_login'))
);

-- Client settings indexes
CREATE UNIQUE INDEX IF NOT EXISTS "ix_client_settings_client" ON "client_settings" ("client_id");

-- Notification preferences table
CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" uuid NOT NULL UNIQUE REFERENCES "clients"("id") ON DELETE CASCADE,
  "weekly_digest" boolean DEFAULT false,
  "monthly_report" boolean DEFAULT false,
  "milestone_alerts" boolean DEFAULT false,
  "content_published" boolean DEFAULT false,
  "recipient_emails" text[] DEFAULT '{}',
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Notification preferences indexes
CREATE UNIQUE INDEX IF NOT EXISTS "ix_notification_prefs_client" ON "notification_preferences" ("client_id");
