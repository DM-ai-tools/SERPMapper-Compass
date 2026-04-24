/**
 * Multi-keyword smoke: POST /api/analyze with `keywords: [...]`.
 * Uses a non-resolvable URL to fail fast at Google Places (or 502) without burning DataforSEO.
 *
 * Usage (with server running):
 *   npm run smoke-analyze:multi
 *
 * Optional: ANALYZE_BASE_URL=http://localhost:3001 npm run smoke-analyze:multi
 */
const base = (process.env.ANALYZE_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

async function main() {
  const res = await fetch(`${base}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: "https://zzzz-nonexistent-test-domain.invalid",
      city: "Melbourne",
      keywords: ["emergency plumber", "blocked drain", "hot water system"],
      radius_band_id: "16-20",
    }),
    signal: AbortSignal.timeout(120_000),
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    console.error("FAIL: Non-JSON response", res.status, text.slice(0, 200));
    process.exit(1);
  }

  console.log("HTTP", res.status);
  console.log(JSON.stringify(json, null, 2));

  if (res.status === 500) {
    console.error("\nFAIL: 500 from /api/analyze (see detail in JSON if in dev).");
    process.exit(1);
  }

  const expected =
    res.status === 422 || res.status === 200 || res.status === 502 || res.status === 503 || res.status === 429;
  if (expected) {
    console.log(
      "\nOK: Multi-keyword request was accepted; route returned a structured status (not 500).\n" +
        "  • 422/502 = expected for junk URL (no business / Places).\n" +
        "  • 200 with reports[] = real run succeeded (use a real GBP website + env keys for a full test)."
    );
    process.exit(0);
  }

  console.warn("\nWARN: Unexpected status — inspect response above.");
  process.exit(0);
}

main().catch((e) => {
  if (e?.name === "TimeoutError" || String(e).includes("aborted due to timeout")) {
    console.error("FAIL: Timeout — start: npm run dev (see smoke-analyze.mjs for tips)\n", e.message);
    process.exit(1);
  }
  if (String(e).includes("fetch failed") || e?.cause?.code === "ECONNREFUSED") {
    console.error("FAIL: Could not connect. Start: npm run dev\n", e.message);
    process.exit(1);
  }
  console.error(e);
  process.exit(1);
});
