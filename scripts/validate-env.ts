/**
 * Environment Variable Validator
 *
 * Run: npx tsx scripts/validate-env.ts
 *
 * Aligned with src/ (PostgreSQL + Next.js), not legacy Supabase-only docs.
 */

const REQUIRED: Array<{ key: string; description: string }> = [
  { key: "DATABASE_URL", description: "PostgreSQL connection string (used by src/lib/db.ts)" },
  { key: "DATAFORSEO_LOGIN", description: "DataforSEO account email" },
  { key: "DATAFORSEO_PASSWORD", description: "DataforSEO API password" },
  { key: "GOOGLE_PLACES_API_KEY", description: "Google Places API (New) key" },
  { key: "ANTHROPIC_API_KEY", description: "Anthropic API key (Claude — /api/analyze)" },
  { key: "NEXT_PUBLIC_APP_URL", description: "Public app URL (metadata, emails)" },
  { key: "LEAD_CTA_BASE_URL", description: "Server-side CTA base (sendgrid buildLeadCtaUrl)" },
  { key: "NEXT_PUBLIC_LEAD_CTA_BASE_URL", description: "Client-side CTA (ReportView, layout nav)" },
];

const OPTIONAL: Array<{ key: string; description: string; default?: string }> = [
  { key: "DAILY_REPORT_QUOTA", description: "Max new reports per day (quota table)", default: "200" },
  { key: "WEBHOOK_SECRET", description: "POST /api/webhooks/conversion (x-webhook-secret)" },
  { key: "SENDGRID_API_KEY", description: "SendGrid key (SG.*) for /api/lead email" },
  { key: "SENDGRID_FROM_EMAIL", description: "Verified sender" },
  { key: "NEXT_PUBLIC_WAITLIST_URL", description: "Fallback nav CTA if LEAD public URL unset" },
  { key: "LOGIN_USERNAME", description: "Override /api/auth/login username" },
  { key: "LOGIN_PASSWORD", description: "Override /api/auth/login password" },
  { key: "ANTHROPIC_MODEL", description: "Override primary Claude model id" },
  { key: "ANTHROPIC_MODEL_FALLBACK", description: "Override fallback Claude model id" },
];

export {};

// Load .env.local if running locally
try {
  const fs = await import("fs");
  const path = await import("path");
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const [key, ...rest] = line.split("=");
      if (key && !key.trim().startsWith("#") && rest.length > 0) {
        process.env[key.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
      }
    }
    console.log("Loaded .env.local\n");
  }
} catch {
  // Ignore
}

const placeholderPatterns = [
  "your-",
  "change-me",
  "replace-me",
  "generate-a-random-32-char-secret-here",
  "d-your-template-id",
];

function isBad(value: string | undefined): boolean {
  if (!value) return true;
  const t = value.trim();
  if (!t) return true;
  return placeholderPatterns.some((p) => t.toLowerCase().includes(p));
}

let hasErrors = false;
const errors: string[] = [];
const warnings: string[] = [];

console.log("=".repeat(55));
console.log("  SERPMapper — Environment Variable Validation");
console.log("=".repeat(55));

console.log("\n[ REQUIRED ]\n");
for (const { key, description } of REQUIRED) {
  const value = process.env[key];
  if (isBad(value)) {
    console.log(`  ✗  ${key}`);
    console.log(`     ${description}`);
    errors.push(key);
    hasErrors = true;
  } else {
    const masked = value && value.length > 8 ? value.slice(0, 4) + "****" + value.slice(-4) : "****";
    console.log(`  ✓  ${key} = ${masked}`);
  }
}

console.log("\n[ OPTIONAL ]\n");
for (const { key, description, default: defaultVal } of OPTIONAL) {
  const value = process.env[key];
  if (isBad(value) || !value) {
    if (key === "WEBHOOK_SECRET") {
      if (!value) {
        console.log(`  ⚠  ${key} — not set (${description}) — required in prod for /api/webhooks/conversion`);
      } else {
        console.log(`  ⚠  ${key} — still a placeholder; change before using webhooks in prod`);
      }
      warnings.push(key);
    } else if (key === "SENDGRID_API_KEY" && (!value || (value && !value.startsWith("SG.")))) {
      console.log(`  ⚠  ${key} — ${!value ? "not set" : "must start with SG."} (lead emails skipped)`);
      warnings.push(key);
    } else {
      console.log(`  ⚠  ${key} — not set (default: ${defaultVal ?? "see code"})`);
      if (key !== "LOGIN_USERNAME" && key !== "LOGIN_PASSWORD") warnings.push(key);
    }
  } else {
    const masked = value && value.length > 6 ? value.slice(0, 2) + "****" : "set";
    console.log(`  ✓  ${key} = ${masked}`);
  }
}

// External API bases (code constants — not env)
console.log("\n[ EXTERNAL API BASES (fixed in code) ]\n");
console.log("  • DataforSEO: https://api.dataforseo.com/v3  (src/lib/dataforseo.ts)");
console.log("  • Google Places: https://places.googleapis.com/v1/places:searchText  (src/lib/places.ts)");
console.log("  • Anthropic: https://api.anthropic.com  (@anthropic-ai/sdk)");

// Next.js route handlers
console.log("\n[ IN-APP HTTP ENDPOINTS (App Router) ]\n");
const routes = [
  "POST /api/analyze",
  "GET  /api/report/[id]",
  "GET  /api/stream/[id]  (SSE)",
  "POST /api/lead",
  "POST /api/verify  (optional OTP path)",
  "GET  /api/suburb-geo",
  "POST /api/auth/login  ·  POST /api/auth/logout",
  "POST /api/webhooks/conversion  (header: x-webhook-secret)",
  "POST /api/webhooks/rankpilot  (410 — removed)",
];
for (const r of routes) console.log(`  • ${r}`);

console.log("\n" + "=".repeat(55));
if (hasErrors) {
  console.log(`\n  FAILED — set missing variables in .env.local or the host (Vercel/Railway).\n`);
  for (const key of errors) console.log(`    • ${key}`);
  process.exit(1);
}

console.log("\n  PASSED — required keys present.");
if (warnings.length > 0) {
  console.log(`  ${warnings.length} optional/placeholder note(s) above — OK for local dev if intentional.\n`);
} else {
  console.log("  No optional warnings.\n");
}
process.exit(0);
