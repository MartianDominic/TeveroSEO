// Standalone migration runner for CI-02.
// Uses drizzle-orm/node-postgres/migrator (prod dep) — NOT drizzle-kit (dev dep, pruned in runtime image).
// Invoked by the open-seo-migrate compose service during deploy, BEFORE new app containers go live.

import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createLogger } from "@/server/lib/logger";
import { seedGoalTemplates } from "@/db/seeds/goal-templates";

const log = createLogger({ module: "migrate" });

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    log.error("DATABASE_URL is required");
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString });
  const db = drizzle(pool);

  log.info("Applying migrations from ./drizzle");
  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
    log.info("Migrations applied successfully");
  } catch (err) {
    log.error("Migration failed", err instanceof Error ? err : new Error(String(err)));
    await pool.end();
    process.exit(1);
  }

  // Seed goal templates after migrations
  log.info("Seeding goal templates...");
  try {
    await seedGoalTemplates();
    log.info("Goal templates seeded successfully");
  } catch (err) {
    log.error("Seed failed", err instanceof Error ? err : new Error(String(err)));
    // Non-fatal: continue even if seeding fails (templates may already exist)
  }

  await pool.end();
  process.exit(0);
}

main();
