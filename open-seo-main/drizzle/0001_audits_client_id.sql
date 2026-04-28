ALTER TABLE "audits" ADD COLUMN "client_id" text;--> statement-breakpoint
CREATE INDEX "audits_client_id_started_at_idx" ON "audits" USING btree ("client_id","started_at" desc);