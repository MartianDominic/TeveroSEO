-- Rollback for migration 0002_clerk_auth_migration.sql
-- Date: 2026-04-28
--
-- This rollback recreates the dropped better-auth session management tables
-- and removes the clerk_user_id column added to the user table.
--
-- WARNING: This will NOT restore session/account/verification DATA.
-- To restore data, you must have a backup from before 0002 was applied.

BEGIN;

-- Step 1: Drop the clerk_user_id index
DROP INDEX IF EXISTS "user_clerk_user_id_idx";

-- Step 2: Drop the clerk_user_id column from user table
ALTER TABLE "user" DROP COLUMN IF EXISTS "clerk_user_id";

-- Step 3: Recreate the session table (structure only - data cannot be restored)
CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "token" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "user_id" text NOT NULL,
  "active_organization_id" text,
  CONSTRAINT "session_token_unique" UNIQUE("token")
);

-- Step 4: Recreate the account table (structure only)
CREATE TABLE IF NOT EXISTS "account" (
  "id" text PRIMARY KEY NOT NULL,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "user_id" text NOT NULL,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamp with time zone,
  "refresh_token_expires_at" timestamp with time zone,
  "scope" text,
  "password" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

-- Step 5: Recreate the verification table (structure only)
CREATE TABLE IF NOT EXISTS "verification" (
  "id" text PRIMARY KEY NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Step 6: Recreate foreign key constraints
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;

-- Step 7: Recreate indexes
CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" USING btree ("identifier");

-- Step 8: Remove migration record from Drizzle tracking table
DELETE FROM drizzle.__drizzle_migrations WHERE hash = '0002_clerk_auth_migration';

COMMIT;

-- Post-rollback verification
-- SELECT COUNT(*) FROM session;
-- SELECT COUNT(*) FROM account;
-- SELECT COUNT(*) FROM verification;
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'user' AND column_name = 'clerk_user_id';
