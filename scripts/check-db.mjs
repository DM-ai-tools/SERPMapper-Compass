/**
 * Quick check: can we connect to PostgreSQL using DATABASE_URL in .env.local?
 *
 *   npm run db:check
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const root = process.cwd();
config({ path: join(root, ".env.local") });
config({ path: join(root, ".env") });

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("Missing DATABASE_URL in .env.local");
  process.exit(1);
}

if (!existsSync(join(root, ".env.local"))) {
  console.warn("No .env.local in project root — only .env may be loaded.\n");
}

const pool = new pg.Pool({ connectionString: url, connectionTimeoutMillis: 8_000 });
try {
  const r = await pool.query("SELECT current_database() AS db, current_user AS u, version() AS v");
  const row = r.rows[0];
  console.log("OK — connected to database:", row.db, "as", row.user);
} catch (e) {
  const m = e instanceof Error ? e.message : String(e);
  const c = e && typeof e === "object" && "code" in e ? (e).code : "";
  console.error("FAIL —", c || "", m);
  if (String(m).includes("ECONNREFUSED") || c === "ECONNREFUSED") {
    console.error("\n  Nothing is listening on the host:port in DATABASE_URL. Usually:");
    console.error("  1) Start the PostgreSQL Windows service: Services (services.msc) → your postgresql-… service → Start.");
    console.error("  2) In PowerShell (as Admin if needed): Start-Service postgresql-x64-* -ErrorAction SilentlyContinue");
    console.error("  3) Restart the dev server after fixing: npm run dev");
    console.error("  4) If you run the app in WSL but PostgreSQL is on Windows, 127.0.0.1 is the Linux VM, not Windows.");
    console.error("     Use the Windows host IP in DATABASE_URL (in WSL: `ip route | grep default` → use that gateway, often 172.x).");
  }
  if (c === "28P01" || /password authentication failed/i.test(m)) {
    console.error("\n  The server is up, but the username or password in DATABASE_URL is wrong.");
  }
  await pool.end();
  process.exit(1);
}
await pool.end();
process.exit(0);
