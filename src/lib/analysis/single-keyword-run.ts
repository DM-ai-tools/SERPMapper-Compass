import { query, execute, insertReturning } from "@/lib/db";
import { fetchLiveSuburbVolumes } from "@/lib/suburbs";
import {
  getLiveResults,
  findBusinessRank,
  DFSTaskPostRequest,
  getKeywordVolumes,
  getKeywordVolumesByLocationTasks,
  normaliseVolumeKeyword,
} from "@/lib/dataforseo";
import {
  generateVisibilitySummary,
  generateOpportunityCards,
  generateCtaCopy,
} from "@/lib/claude";
import {
  calculateVisibilityScore,
  getTopMissedSuburbs,
  buildReportSummary,
  isVisiblePosition,
} from "@/lib/scoring";
import { RankingDeviceType, SerpMapResult, SuburbCoordinate } from "@/lib/types";
import type { BusinessInfo } from "@/lib/places";

const PRIMARY_DEVICE: RankingDeviceType = "desktop";
const DFS_DEVICE_PROFILES: Array<{
  type: RankingDeviceType;
  device: "desktop" | "mobile";
  os: string;
}> = [{ type: "desktop", device: "desktop", os: "windows" }];

function parseTaskTag(tag: string): { deviceType: RankingDeviceType; suburbId: string } | null {
  const m = /^serpmap_[^_]+_(desktop|mobile)_(.+)$/.exec(tag);
  if (!m) return null;
  return { deviceType: m[1] as RankingDeviceType, suburbId: m[2] };
}

function buildVisibilitySummaryFallback(opts: {
  displayName: string;
  keyword: string;
  visibleCount: number;
  totalSuburbs: number;
  score: number;
  missedTopNames: string[];
}): string {
  const { displayName, keyword, visibleCount, totalSuburbs, score, missedTopNames } = opts;
  const gap =
    missedTopNames.length >= 2
      ? `Notable gaps include ${missedTopNames[0]} and ${missedTopNames[1]}. `
      : missedTopNames.length === 1
        ? `A priority gap is ${missedTopNames[0]}. `
        : "";
  return `${displayName} appears in the top 20 Google Maps results for "${keyword}" in ${visibleCount} of ${totalSuburbs} suburbs checked, with a visibility score of ${score}. ${gap}Improving map visibility in those areas helps more nearby customers discover you before competitors.`;
}

const STATE_FULL: Record<string, string> = {
  VIC: "Victoria",
  NSW: "New South Wales",
  QLD: "Queensland",
  WA: "Western Australia",
  SA: "South Australia",
  TAS: "Tasmania",
  ACT: "Australian Capital Territory",
  NT: "Northern Territory",
};

/**
 * `Melbourne,Victoria,Australia`-style name for Keyword Data (same for every keyword in a run).
 */
export function getCityLocationNameForVolume(city: string, uniqueSuburbs: SuburbCoordinate[]): string {
  const stateAbbr = uniqueSuburbs[0]?.state ?? "";
  const stateFull = STATE_FULL[stateAbbr.toUpperCase()] ?? stateAbbr;
  return stateFull ? `${city},${stateFull},Australia` : `${city},Australia`;
}

/**
 * Google Ads “monthly searches” for the keyword in the business city, with separate fallbacks
 * (national AUS) so a failed city call does not block other attempts (important for multi-keyword
 * runs where the DataforSEO stack may throw mid-chain).
 */
export async function resolveCityMonthlyVolume(
  keyword: string,
  city: string,
  cityLocationName: string
): Promise<number | null> {
  try {
    const cityVol = await getKeywordVolumesByLocationTasks([
      { tag: "city_volume", keyword, location_name: cityLocationName },
    ]);
    const v = cityVol.get("city_volume");
    if (v != null && Number.isFinite(v) && v >= 0) {
      return Math.round(v);
    }
  } catch (err) {
    console.warn("[analyze] city-targeted search volume failed:", err);
  }

  const k = keyword.replace(/\s+/g, " ").trim();
  const c = city.replace(/\s+/g, " ").trim();
  const phraseList = [k, `${k} ${c}`, `${c} ${k}`].filter((s) => s.length > 0);
  const phrases = Array.from(new Set(phraseList));
  try {
    const m = await getKeywordVolumes(phrases);
    for (const phrase of phrases) {
      const vol = m.get(normaliseVolumeKeyword(phrase));
      if (vol != null && Number.isFinite(vol) && vol >= 0) {
        return Math.round(vol);
      }
    }
  } catch (err) {
    console.warn("[analyze] Australia-wide search volume fallback failed:", err);
  }

  return null;
}

export interface RunSingleParams {
  city: string;
  keyword: string;
  radius_km: number;
  radiusLabel: string | null;
  business: BusinessInfo;
  businessUrlForReport: string;
  uniqueSuburbs: SuburbCoordinate[];
  today: string;
  dailyLimit: number;
  /** When true, quota is applied once in the batch route (parallel runs). */
  skipQuota?: boolean;
  /**
   * If set (including `null`), skip in-run DataforSEO city/national volume API calls. Multi-keyword
   * scans pre-fill this from a sequential pass to avoid throttling the Keyword Data API.
   */
  preResolvedCityVolume?: number | null;
}

export interface SingleKeywordResult {
  report_id: string;
  keyword: string;
  visibility_score: number;
  summary_text: string;
  business_name?: string;
  business_address?: string;
  /** Suburb × device tasks, for batch quota */
  quota_api_calls: number;
}

export async function runSingleKeywordAnalysis(
  p: RunSingleParams
): Promise<SingleKeywordResult> {
  const { keyword, city, businessUrlForReport, uniqueSuburbs, today, dailyLimit, radiusLabel, radius_km } = p;
  const skipQuota = p.skipQuota === true;
  const business = p.business;
  const businessName = business.name ?? null;
  const businessAddress = business.address ?? null;
  const businessLat = business.lat;
  const businessLng = business.lng;

  await execute(
    "DELETE FROM serpmap_reports WHERE business_url = $1 AND keyword = $2 AND city = $3",
    [businessUrlForReport, keyword, city]
  ).catch(() => {});

  const report = await insertReturning<{ report_id: string }>(
    `INSERT INTO serpmap_reports
         (business_url, business_name, keyword, city, business_lat, business_lng,
          business_address, radius_km, radius_band_label, status, suburbs_total)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'processing',$10)
       RETURNING report_id`,
    [
      businessUrlForReport,
      businessName,
      keyword,
      city,
      businessLat,
      businessLng,
      businessAddress,
      radius_km,
      radiusLabel,
      uniqueSuburbs.length,
    ]
  );
  const reportId = report.report_id;

  const volumeBySuburbId = await fetchLiveSuburbVolumes(
    uniqueSuburbs.map((s) => ({
      suburb_id: s.suburb_id,
      name: s.name,
      dataforseo_location_name: s.dataforseo_location_name,
    })),
    keyword,
    uniqueSuburbs
  );

  for (const s of uniqueSuburbs) {
    for (const profile of DFS_DEVICE_PROFILES) {
      await execute(
        `INSERT INTO serpmap_results
             (report_id, suburb_id, suburb_name, suburb_state, device_type, os_type, monthly_volume, dataforseo_status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'processing')`,
        [reportId, s.suburb_id, s.name, s.state, profile.type, profile.os, volumeBySuburbId.get(s.suburb_id) ?? 0]
      );
    }
  }

  const cityLocationName = getCityLocationNameForVolume(city, uniqueSuburbs);

  const dfsTaskRequests: DFSTaskPostRequest[] = uniqueSuburbs.flatMap((s) =>
    DFS_DEVICE_PROFILES.map((profile) => ({
      keyword: `${keyword} ${s.name}`,
      location_name: s.dataforseo_location_name ?? cityLocationName,
      language_name: "English",
      device: profile.device,
      os: profile.os,
      tag: `serpmap_${reportId}_${profile.type}_${s.suburb_id}`,
    }))
  );

  const cityMonthlyVolume =
    p.preResolvedCityVolume !== undefined
      ? p.preResolvedCityVolume
      : await resolveCityMonthlyVolume(keyword, city, cityLocationName);

  let liveResults: Array<{ tag: string; result: import("@/lib/dataforseo").DFSTaskResult | null }>;
  try {
    liveResults = await getLiveResults(dfsTaskRequests);
  } catch (err) {
    await execute("DELETE FROM serpmap_reports WHERE report_id = $1", [reportId]).catch(() => {});
    throw err;
  }

  if (liveResults.length === 0) {
    await execute("DELETE FROM serpmap_reports WHERE report_id = $1", [reportId]);
    throw new Error("DataforSEO did not return any results.");
  }

  await Promise.allSettled(
    liveResults.map(({ tag, result }) => {
      const parsedTag = parseTaskTag(tag);
      if (!parsedTag) return Promise.resolve();
      const { position, inLocalPack } = result
        ? findBusinessRank(result, businessUrlForReport, businessName)
        : { position: null, inLocalPack: false };
      return execute(
        `UPDATE serpmap_results
         SET rank_position = $1, is_in_local_pack = $2,
             dataforseo_status = 'completed', updated_at = NOW()
         WHERE report_id = $3 AND suburb_id = $4 AND device_type = $5`,
        [position, inLocalPack, reportId, parsedTag.suburbId, parsedTag.deviceType]
      );
    })
  );

  const allResults = await query<SerpMapResult>("SELECT * FROM serpmap_results WHERE report_id = $1", [reportId]);
  const resultsByDevice = new Map<RankingDeviceType, SerpMapResult[]>();
  for (const row of allResults) {
    const key = (row.device_type ?? "desktop") as RankingDeviceType;
    if (!resultsByDevice.has(key)) resultsByDevice.set(key, []);
    resultsByDevice.get(key)!.push(row);
  }
  const primaryResults = resultsByDevice.get(PRIMARY_DEVICE) ?? allResults;
  const score = calculateVisibilityScore(primaryResults);
  const displayName = businessName ?? businessUrlForReport;
  const summary = buildReportSummary(primaryResults, displayName, keyword);
  const missed = getTopMissedSuburbs(primaryResults, 5);

  let summaryText = "";
  let ctaCopy = "";
  let cardTexts: string[] = [];

  const [sumOut, ctaOut, cardsOut] = await Promise.allSettled([
    generateVisibilitySummary(summary),
    generateCtaCopy(displayName, keyword, missed[0]?.suburb_name ?? null),
    missed.length > 0
      ? generateOpportunityCards(
          displayName,
          keyword,
          missed.map((s) => ({ name: s.suburb_name }))
        )
      : Promise.resolve<string[]>([]),
  ]);

  if (sumOut.status === "fulfilled") {
    summaryText = sumOut.value;
  } else {
    console.warn("[analyze] visibility summary AI failed:", sumOut.reason);
    summaryText = buildVisibilitySummaryFallback({
      displayName,
      keyword,
      visibleCount: summary.rankingCount,
      totalSuburbs: summary.total,
      score: summary.score,
      missedTopNames: missed.slice(0, 3).map((m) => m.suburb_name),
    });
  }

  if (ctaOut.status === "fulfilled") {
    ctaCopy = ctaOut.value;
  } else {
    ctaCopy = `Improve your Google Maps visibility for "${keyword}" in ${missed[0]?.suburb_name ?? "your area"}.`;
  }

  if (cardsOut.status === "fulfilled") {
    cardTexts = cardsOut.value;
  } else {
    cardTexts = [];
  }

  await execute(
    `UPDATE serpmap_reports
     SET status = 'completed', visibility_score = $1, summary_text = $2, cta_copy = $3,
         suburbs_checked = $4, city_monthly_volume = $5, completed_at = NOW()
     WHERE report_id = $6`,
    [
      score,
      summaryText,
      ctaCopy,
      primaryResults.filter((r) => r.dataforseo_status === "completed").length,
      cityMonthlyVolume,
      reportId,
    ]
  );

  const opportunityFallbacks = [
    (name: string) =>
      `${name} is a pocket where you still do not show on Google Maps — nearby customers are likely choosing whoever appears first.`,
    (name: string) =>
      `In ${name}, your listing is not surfacing in the local map pack, so demand in that area is effectively walking past you.`,
    (name: string) =>
      `${name} represents a visibility gap: stronger map presence here would put you in front of more ready-to-buy locals.`,
    (name: string) =>
      `You are not visible in ${name} yet, which means searches there are quietly feeding competitors instead of your business.`,
    (name: string) =>
      `${name} is worth prioritising on Maps — every week you are absent, rivals keep consolidating trust in that suburb.`,
  ];

  const cardsByDevice = new Map<RankingDeviceType, string[]>();
  cardsByDevice.set(PRIMARY_DEVICE, cardTexts);

  for (const profile of DFS_DEVICE_PROFILES) {
    const deviceResults = resultsByDevice.get(profile.type) ?? [];
    const deviceMissed = getTopMissedSuburbs(deviceResults, 5);
    if (!cardsByDevice.has(profile.type)) {
      try {
        const aiTexts =
          deviceMissed.length > 0
            ? await generateOpportunityCards(
                displayName,
                keyword,
                deviceMissed.map((s) => ({ name: s.suburb_name }))
              )
            : [];
        cardsByDevice.set(profile.type, aiTexts);
      } catch (err) {
        console.warn(`[analyze] opportunity cards AI failed (${profile.type}):`, err);
        cardsByDevice.set(profile.type, []);
      }
    }
    const deviceCardTexts = cardsByDevice.get(profile.type) ?? [];
    for (let i = 0; i < deviceMissed.length; i++) {
      const suburb = deviceMissed[i];
      const monthlyVolume = Number.isFinite(suburb.monthly_volume) ? Math.max(suburb.monthly_volume, 0) : 0;
      const fallbackText = opportunityFallbacks[i % opportunityFallbacks.length](suburb.suburb_name);
      const text = deviceCardTexts[i] ?? fallbackText;
      await execute(
        `INSERT INTO opportunity_cards
           (report_id, suburb_name, device_type, rank_position, monthly_volume, card_text, display_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [reportId, suburb.suburb_name, profile.type, null, monthlyVolume, text, i]
      );
    }
  }

  if (!skipQuota) {
    await execute(
      `INSERT INTO serpmap_quota (quota_date, reports_count, api_calls_used, daily_limit, updated_at)
       VALUES ($1, 1, $2, $3, NOW())
       ON CONFLICT (quota_date) DO UPDATE
         SET reports_count  = serpmap_quota.reports_count + 1,
             api_calls_used = serpmap_quota.api_calls_used + $2,
             updated_at     = NOW()`,
      [today, uniqueSuburbs.length * DFS_DEVICE_PROFILES.length, dailyLimit]
    );
  }

  return {
    report_id: reportId,
    keyword,
    visibility_score: score,
    summary_text: summaryText,
    business_name: businessName ?? undefined,
    business_address: businessAddress ?? undefined,
    quota_api_calls: uniqueSuburbs.length * DFS_DEVICE_PROFILES.length,
  };
}