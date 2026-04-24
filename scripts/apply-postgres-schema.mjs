/**
 * Apply migrations/postgres_schema.sql (+ optional 003 + alters) to the database
 * in DATABASE_URL. Matches what src/lib/db.ts runs on first connect.
 *
 * Prerequisite: create an empty database first, e.g.:
 *   psql -U postgres -h 127.0.0.1 -c "CREATE DATABASE serpmapper;"
 *
 * Usage (from repo root, with .env.local):
 *   npm run db:setup
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import pg from "pg";

config({ path: join(process.cwd(), ".env.local") });
config({ path: join(process.cwd(), ".env") });

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("Missing DATABASE_URL. Copy .env.local.example to .env.local and set:");
  console.error("  postgresql://USERNAME:PASSWORD@127.0.0.1:5432/DATABASE_NAME");
  process.exit(1);
}

function resolveMigrationsDir() {
  const candidates = [join(process.cwd(), "migrations"), join(process.cwd(), "serpmapper", "migrations")];
  for (const dir of candidates) {
    if (existsSync(join(dir, "postgres_schema.sql"))) return dir;
  }
  return join(process.cwd(), "migrations");
}

const dir = resolveMigrationsDir();
const main = join(dir, "postgres_schema.sql");
if (!existsSync(main)) {
  console.error("Not found:", main);
  process.exit(1);
}

let sql = readFileSync(main, "utf8");
const volCache = join(dir, "003_keyword_volume_cache.sql");
if (existsSync(volCache)) {
  sql += "\n\n" + readFileSync(volCache, "utf8");
}
sql += `
ALTER TABLE suburb_coordinates ADD COLUMN IF NOT EXISTS search_volumes JSONB DEFAULT '{}'::jsonb;
ALTER TABLE serpmap_reports ADD COLUMN IF NOT EXISTS maps_search_query TEXT;
ALTER TABLE serpmap_reports ADD COLUMN IF NOT EXISTS city_monthly_volume INTEGER;
ALTER TABLE serpmap_reports ADD COLUMN IF NOT EXISTS radius_band_label TEXT;
ALTER TABLE serpmap_results ADD COLUMN IF NOT EXISTS device_type TEXT NOT NULL DEFAULT 'desktop';
ALTER TABLE serpmap_results ADD COLUMN IF NOT EXISTS os_type TEXT;
ALTER TABLE opportunity_cards ADD COLUMN IF NOT EXISTS device_type TEXT NOT NULL DEFAULT 'desktop';
`;

const pool = new pg.Pool({ connectionString: url, connectionTimeoutMillis: 15_000 });
try {
  await pool.query(sql);
  console.log("OK: Schema applied to database from DATABASE_URL (tables: suburb_coordinates, serpmap_* etc.).");
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error("Failed to apply schema:", msg);
  if (msg.includes("ECONNREFUSED")) {
    console.error("Hint: Is PostgreSQL running? Try 127.0.0.1 instead of localhost if IPv6 causes issues.");
  }
  if (msg.includes("does not exist") && /database/i.test(msg)) {
    console.error("Hint: Create the database first, e.g. CREATE DATABASE serpmapper;");
  }
  process.exit(1);
} finally {
  await pool.end();
}
