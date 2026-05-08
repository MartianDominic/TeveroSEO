-- Phase 96-02: Master Dashboard tag-based filtering
-- Site tags and client tags for multi-site aggregation

-- Site tags table
CREATE TABLE IF NOT EXISTS "site_tags" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "site_id" text NOT NULL REFERENCES "site_connections"("id") ON DELETE CASCADE,
  "tag_name" text NOT NULL,
  "tag_color" text,
  "tag_category" text,
  "created_at" timestamp with time zone DEFAULT now()
);

-- Unique constraint: one tag name per site
CREATE UNIQUE INDEX IF NOT EXISTS "uq_site_tags_site_name" ON "site_tags" ("site_id", "tag_name");

-- Index for tag filtering performance
CREATE INDEX IF NOT EXISTS "idx_site_tags_name" ON "site_tags" ("tag_name");

-- Index for category filtering
CREATE INDEX IF NOT EXISTS "idx_site_tags_category" ON "site_tags" ("tag_category");

-- Client tags table
CREATE TABLE IF NOT EXISTS "client_tags" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "tag_name" text NOT NULL,
  "tag_color" text,
  "tag_category" text,
  "created_at" timestamp with time zone DEFAULT now()
);

-- Unique constraint: one tag name per client
CREATE UNIQUE INDEX IF NOT EXISTS "uq_client_tags_client_name" ON "client_tags" ("client_id", "tag_name");

-- Index for tag filtering performance
CREATE INDEX IF NOT EXISTS "idx_client_tags_name" ON "client_tags" ("tag_name");
