-- keyword_page_mapping table for Phase 34: Keyword-to-Page Mapping
CREATE TABLE IF NOT EXISTS "keyword_page_mapping" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"keyword" text NOT NULL,
	"target_url" text,
	"action" text NOT NULL,
	"relevance_score" real,
	"reason" text,
	"search_volume" integer,
	"difficulty" integer,
	"current_position" integer,
	"current_url" text,
	"is_manual_override" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Foreign key constraint
DO $$ BEGIN
 ALTER TABLE "keyword_page_mapping" ADD CONSTRAINT "keyword_page_mapping_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "uq_mapping_project_keyword" ON "keyword_page_mapping" USING btree ("project_id","keyword");
CREATE INDEX IF NOT EXISTS "ix_mapping_project" ON "keyword_page_mapping" USING btree ("project_id");
CREATE INDEX IF NOT EXISTS "ix_mapping_target_url" ON "keyword_page_mapping" USING btree ("target_url");
CREATE INDEX IF NOT EXISTS "ix_mapping_action" ON "keyword_page_mapping" USING btree ("action");
