import { NextRequest, NextResponse } from "next/server";
import { ensureDatabaseReady, queryOne, execute } from "@/lib/db";
import { resolveBusinessFromUrl } from "@/lib/places";
import { getSuburbsInRadius } from "@/lib/suburbs";
import { AnalyzeRequest, AnalyzeResponse } from "@/lib/types";
import {
  runSingleKeywordAnalysis,
  getCityLocationNameForVolume,
  resolveCityMonthlyVolume,
} from "@/lib/analysis/single-keyword-run";
import { getRadiusOptionById } from "@/lib/radius-bands";

/** One keyword can be heavy; many keywords multiply work — allow long runs on self-hosted. */
export const maxDuration = 300;

const MAX_KEYWORDS = Math.min(
  10,
  Math.max(1, Number(process.env.MAX_KEYWORDS_PER_SCAN ?? 10))
);

/** Pg and Node may throw `AggregateError` (e.g. dual-stack connect) with an empty top-level `message`. */
function getErrorDetail(err: unknown): string {
  if (err == null) return "Unknown error";
  if (typeof err === "object" && "errors" in err && Array.isArray((err as AggregateError).errors)) {
    const a = err as AggregateError;
    const parts = a.errors.map((e) => (e instanceof Error ? e.message : String(e))).filter(Boolean);
    if (parts.length) return parts.join("; ");
  }
  if (err instanceof Error) {
    if (err.message) return err.message;
    const c = (err as NodeJS.ErrnoException).code;
    if (c) return c;
  }
  return String(err);
}

function normaliseKeywordList(
  body: AnalyzeRequest
): { keywords: string[]; error: string | null } {
  const fromArray =
    Array.isArray(body.keywords) && body.keywords.length
      ? body.keywords.map((k) => String(k).trim()).filter(Boolean)
      : [];
  if (fromArray.length) {
    const seen = new Set<string>();
    const uniq: string[] = [];
    for (const k of fromArray) {
      const low = k.toLowerCase();
      if (seen.has(low)) continue;
      seen.add(low);
      uniq.push(k);
    }
    if (uniq.length > MAX_KEYWORDS) {
      return { keywords: [], error: `Maximum ${MAX_KEYWORDS} unique keywords per scan.` };
    }
    return { keywords: uniq, error: null };
  }
  const one = (body.keyword ?? "").trim();
  if (!one) return { keywords: [], error: null };
  return { keywords: [one], error: null };
}

export async function POST(req: NextRequest) {
  let body: AnalyzeRequest;
  try {
    body = (await req.json()) as AnalyzeRequest;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  try {
    const url = (body.url ?? "").trim();
    const city = (body.city ?? "").trim();
    const { keywords, error: kwErr } = normaliseKeywordList(body);
    const hasLegacyKeyword = (body.keyword ?? "").trim();
    if (!url || !city || (keywords.length === 0 && !hasLegacyKeyword)) {
      return NextResponse.json(
        { error: "url, city, and at least one keyword are required" },
        { status: 400 }
      );
    }
    if (kwErr) {
      return NextResponse.json({ error: kwErr }, { status: 400 });
    }
    const finalKeywords =
      keywords.length > 0 ? keywords : [hasLegacyKeyword.trim()].filter(Boolean);
    if (finalKeywords.length === 0) {
      return NextResponse.json({ error: "Add at least one service keyword." }, { status: 400 });
    }

    const opt = getRadiusOptionById(body.radius_band_id);
    const radius_km = body.radius_km != null && Number.isFinite(body.radius_km) ? body.radius_km! : opt.radiusKm;
    const radiusLabel = opt.label;

    if (!process.env.DATABASE_URL?.trim()) {
      return NextResponse.json(
        { error: "Database is not configured (DATABASE_URL missing)." },
        { status: 503 }
      );
    }

    await ensureDatabaseReady();

    const today = new Date().toISOString().split("T")[0];
    const quota = await queryOne<{ reports_count: number; daily_limit: number }>(
      "SELECT reports_count, daily_limit FROM serpmap_quota WHERE quota_date = $1",
      [today]
    );
    const dailyLimit = Number(process.env.DAILY_REPORT_QUOTA ?? 200);
    if (quota && quota.reports_count >= (quota.daily_limit ?? dailyLimit)) {
      return NextResponse.json(
        { error: "Daily report quota reached. Try again after midnight AEST." },
        { status: 429 }
      );
    }
    if (quota && quota.reports_count + finalKeywords.length > (quota.daily_limit ?? dailyLimit)) {
      return NextResponse.json(
        { error: "Not enough daily quota remaining for this many keywords. Try fewer keywords or try tomorrow." },
        { status: 429 }
      );
    }

    let business;
    try {
      business = await resolveBusinessFromUrl(url, city);
    } catch (placesErr) {
      const msg = placesErr instanceof Error ? placesErr.message : String(placesErr);
      console.error("[analyze] Google Places error:", placesErr);
      return NextResponse.json(
        { error: "Google Places could not complete the lookup.", detail: msg },
        { status: 502 }
      );
    }

    const businessUrlForReport = business?.websiteUri?.trim() ? business.websiteUri.trim() : url;
    const businessLat = business?.lat ?? null;
    const businessLng = business?.lng ?? null;
    if (!business || !businessLat || !businessLng) {
      return NextResponse.json(
        {
          error:
            "We could not match your website to a Google Business Profile. Use the exact website URL shown on your Google listing, and check that your city matches the listing.",
        },
        { status: 422 }
      );
    }

    const sortKeyword = finalKeywords[0]!;
    const rawSuburbs = await getSuburbsInRadius(
      businessLat,
      businessLng,
      radius_km,
      sortKeyword
    );
    if (rawSuburbs.length === 0) {
      return NextResponse.json(
        {
          error:
            "No suburbs found within the specified radius. Ensure suburb data exists in the database (latest deploy auto-seeds an empty table) or run: node scripts/seed-all-australia.js",
        },
        { status: 422 }
      );
    }
    const uniqueSuburbs = rawSuburbs.filter(
      (s, i, arr) => arr.findIndex((x) => x.suburb_id === s.suburb_id) === i
    );

    /**
     * For a single keyword, we resolve “city monthly volume” once inside `runSingleKeywordAnalysis`.
     * For 2+ keywords, the analyses run in parallel, which previously fanned out that many
     * DataforSEO Keyword Data calls at once and often led to 429/empty results for “searches / month”.
     * Pre-resolve volumes sequentially (with a short pause between calls), then pass into each run.
     */
    const cityLocationName = getCityLocationNameForVolume(city, uniqueSuburbs);
    const preResolvedCityByKeyword: Record<string, number | null> = {};
    if (finalKeywords.length > 1) {
      for (let i = 0; i < finalKeywords.length; i++) {
        if (i > 0) {
          await new Promise((r) => setTimeout(r, 500));
        }
        const kw = finalKeywords[i]!;
        preResolvedCityByKeyword[kw] = await resolveCityMonthlyVolume(kw, city, cityLocationName);
      }
    }

    const parallel = finalKeywords.map((keyword) =>
      runSingleKeywordAnalysis({
        city,
        keyword,
        radius_km,
        radiusLabel,
        business,
        businessUrlForReport,
        uniqueSuburbs,
        today,
        dailyLimit,
        skipQuota: true,
        preResolvedCityVolume: finalKeywords.length > 1 ? (preResolvedCityByKeyword[keyword] ?? null) : undefined,
      })
    );

    let batchResults: Awaited<ReturnType<typeof runSingleKeywordAnalysis>>[];
    try {
      batchResults = await Promise.all(parallel);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("[analyze] parallel batch failed:", e);
      if (message.includes("40100")) {
        return NextResponse.json(
          { error: "DataforSEO authentication failed. Check DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD." },
          { status: 502 }
        );
      }
      if (message.includes("DataforSEO did not return")) {
        return NextResponse.json(
          { error: "DataforSEO did not return any results. Check your account access and balance." },
          { status: 502 }
        );
      }
      return NextResponse.json(
        { error: "Keyword analysis failed.", detail: message.slice(0, 400) },
        { status: 502 }
      );
    }

    const totalApiCalls = batchResults.reduce((sum, r) => sum + r.quota_api_calls, 0);
    try {
      await execute(
        `INSERT INTO serpmap_quota (quota_date, reports_count, api_calls_used, daily_limit, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (quota_date) DO UPDATE
           SET reports_count  = serpmap_quota.reports_count + EXCLUDED.reports_count,
               api_calls_used  = serpmap_quota.api_calls_used + EXCLUDED.api_calls_used,
               updated_at      = NOW()`,
        [today, finalKeywords.length, totalApiCalls, dailyLimit]
      );
    } catch (qErr) {
      console.error("[analyze] quota update failed (response still returned; reports are saved):", qErr);
    }

    const out = batchResults.map((r) => ({
      report_id: r.report_id,
      keyword: r.keyword,
      status: "completed" as const,
      visibility_score: r.visibility_score,
      summary_text: r.summary_text,
    }));

    const first = out[0]!;
    const response: AnalyzeResponse = {
      report_id: first.report_id,
      status: "completed",
      cached: false,
      business_name: business.name ?? undefined,
      business_address: business.address ?? undefined,
      multi: out.length > 1,
      reports: out,
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[analyze] error:", err);
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as NodeJS.ErrnoException).code)
        : "";
    const detail = [getErrorDetail(err), code].filter(Boolean).join(" ");
    const isDbish =
      /ECONNREFUSED|ETIMEDOUT|EPERM|EPIPE|ENOTFOUND|getaddrinfo|password authentication failed|too many connections|the database system is|relation ".*" does not exist|uuid_generate_v4/i.test(
        detail
      ) || code === "ECONNREFUSED";
    if (isDbish) {
      return NextResponse.json(
        {
          error:
            "Database error — check that PostgreSQL is running, DATABASE_URL is correct, and migrations (postgres_schema.sql) have been applied.",
          ...(/does not exist/.test(detail) || /uuid_generate/i.test(detail)
            ? { detail: detail.slice(0, 500) }
            : process.env.NODE_ENV === "development"
              ? { detail }
              : { detail: detail.split("\n")[0]!.slice(0, 200) }),
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error", ...(process.env.NODE_ENV === "development" ? { detail } : {}) },
      { status: 500 }
    );
  }
}
