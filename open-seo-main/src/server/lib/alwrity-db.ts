import { Pool } from "pg";

const connectionString = process.env.ALWRITY_DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "ALWRITY_DATABASE_URL is required — set it in .env or the deployment environment before starting the server. It must point at AI-Writer's `alwrity` PostgreSQL database.",
  );
}

// Dedicated pool for the alwrity DB. Kept small because we only read
// the `clients` table for per-request client_id validation (AUTH-03).
export const alwrityPool = new Pool({
  connectionString,
  max: 4,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: true }
      : false,
});

// Handle unexpected pool errors gracefully - log but don't exit to allow recovery
alwrityPool.on("error", (err) => {
  console.error("[alwrity-db] Unexpected pool error:", err);
});
