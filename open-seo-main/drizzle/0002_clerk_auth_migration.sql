-- Add clerk_user_id to user table
ALTER TABLE "user" ADD COLUMN "clerk_user_id" TEXT UNIQUE;

-- Create index for clerk_user_id lookups
CREATE INDEX "user_clerk_user_id_idx" ON "user" ("clerk_user_id");

-- Drop better-auth session management tables (no production data to preserve)
DROP TABLE IF EXISTS "session" CASCADE;
DROP TABLE IF EXISTS "account" CASCADE;
DROP TABLE IF EXISTS "verification" CASCADE;

-- Note: user, organization, member, invitation tables are preserved
-- clerk_user_id will be populated on first login via Clerk
