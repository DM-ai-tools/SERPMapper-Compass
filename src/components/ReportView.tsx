"use client";

import { useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import {
  SerpMapReport,
  SerpMapResult,
  OpportunityCard as OppCard,
} from "@/lib/types";
import { calculateVisibilityScore, countSuburbsInBands, isVisiblePosition } from "@/lib/scoring";
import EmailGate from "./EmailGate";
import ScoreGauge from "./ScoreGauge";
import { downloadReportPdf } from "@/lib/pdf-report";
import { CTA_BOOK_STRATEGY_CALL, TRAFFIC_RADIUS_CONTACT_BASE } from "@/lib/lead-cta";
import TrafficRadiusMark from "./TrafficRadiusMark";
import LogoutButton from "./LogoutButton";

// Leaflet must not SSR
const VisibilityMap = dynamic(() => import("./VisibilityMap"), { ssr: false });

/** When multi-keyword batch is loaded from `/tool` */
export type KeywordMatrixRow = {
  keyword: string;
  top3: number;
  page1: number;
  page2: number;
  notVisible: number;
  score: number;
};

export type CompassContext = {
  /** One row per keyword, same order as tabs */
  matrixRows: KeywordMatrixRow[];
  activeKeywordIndex: number;
  onSelectKeyword: (index: number) => void;
  /** Averaged across all keywords in the batch */
  averageScore: number;
  keywordCount: number;
};

const AU_BENCH = 38;

const TILE = {
  top3: { bg: "#28a745", label: "TOP 3" },
  page1: { bg: "#a1e4b3", label: "PAGE 1" },
  page2: { bg: "#fdbf5e", label: "PAGE 2" },
  notVis: { bg: "#ea5455", label: "NOT VISIBLE" },
} as const;

const PHONE_DISPLAY = "1300 852 340";
export interface ReportViewProps {
  report: SerpMapReport;
  results: SerpMapResult[];
  cards: OppCard[];
  gated?: boolean;
  onEmailCaptured?: () => void;
  /** Set when the tool loaded 2+ keywords; drives matrix + layer selector + average score. */
  compass?: CompassContext | null;
}

export default function ReportView({
  report,
  results,
  cards,
  gated = false,
  onEmailCaptured,
  compass,
}: ReportViewProps) {
  const [isGated, setIsGated] = useState(gated);
  const [ctaUrl, setCtaUrl] = useState<string | null>(null);
  const [topMissedSuburb, setTopMissedSuburb] = useState<string | null>(null);
  const businessLat = toNumberOrNull(report.business_lat);
  const businessLng = toNumberOrNull(report.business_lng);
  const host =
    (() => {
      try {
        return new URL(report.business_url).hostname;
      } catch {
        return report.business_url;
      }
    })();

  const activeResults = useMemo(
    () => results.filter((r) => isDesktopRow(r.device_type)),
    [results]
  );
  const activeCards = useMemo(
    () => cards.filter((c) => isDesktopRow(c.device_type)),
    [cards]
  );
  const singleScore = useMemo(
    () => calculateVisibilityScore(activeResults),
    [activeResults]
  );

  const singleMatrixRow = useMemo((): KeywordMatrixRow => {
    const c = countSuburbsInBands(activeResults);
    return {
      keyword: report.keyword,
      top3: c.top3,
      page1: c.page1,
      page2: c.page2,
      notVisible: c.notVisible,
      score: singleScore,
    };
  }, [activeResults, report.keyword, singleScore]);

  const matrixRows = compass?.matrixRows?.length ? compass.matrixRows : [singleMatrixRow];
  const displayAverage = compass ? compass.averageScore : singleScore;
  const activeKeywordIndex = compass?.activeKeywordIndex ?? 0;
  const onSelectKeyword = compass?.onSelectKeyword ?? (() => {});
  const isMulti = Boolean(compass && compass.keywordCount > 1);

  const bands = useMemo(() => countSuburbsInBands(activeResults), [activeResults]);
  const nSub = activeResults.length;
  const pct = (c: number) => (nSub > 0 ? Math.round((c / nSub) * 100) : 0);

  function handleUnlocked(url: string, suburb: string) {
    setCtaUrl(url);
    setTopMissedSuburb(suburb);
    setIsGated(false);
    onEmailCaptured?.();
  }

  const ctaBase = TRAFFIC_RADIUS_CONTACT_BASE;
  const params = new URLSearchParams({
    url: report.business_url,
    keyword: report.keyword,
    suburb: topMissedSuburb ?? report.city,
    source: "serpmap",
    report: report.report_id,
  });
  if (ctaUrl) {
    try {
      const u = new URL(ctaUrl);
      u.searchParams.forEach((v, k) => {
        if (v && !params.has(k)) params.set(k, v);
      });
    } catch {
      /* keep base params */
    }
  }
  const finalCtaUrl = `${ctaBase}?${params.toString()}`;

  const generatedAt = useMemo(() => {
    const d = new Date(report.created_at);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });
  }, [report.created_at]);

  const radiusLine =
    report.radius_band_label || `${String(report.radius_km)} km (service area)`;
  const businessNameLine =
    report.business_name?.trim() || (host ? host.replace(/^www\./, "") : "Your business");
  const addressLine =
    report.business_address?.trim() || `${report.city} · service area map`;

  return (
    <div className="w-full max-w-[1400px] mx-auto space-y-6 sm:space-y-8">
      {/* ─── Report header (Compass) ─── */}
      <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <TrafficRadiusMark />
            <span
              className="hidden h-9 w-px shrink-0 bg-slate-200 sm:block"
              aria-hidden
            />
            <a
              href="/"
              className="min-w-0 group rounded-lg outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-tr-green-500/50 focus-visible:ring-offset-2"
              title="Back to SERPMapper Compass home"
            >
              <p className="font-display text-sm font-extrabold leading-tight sm:text-base">
                <span className="text-tr-logo-navy">SERP</span>
                <span className="text-tr-green-600">Mapper</span>{" "}
                <span className="text-tr-logo-navy">Compass</span>
              </p>
              <p className="text-[9px] font-bold uppercase leading-tight tracking-[0.16em] text-slate-400 sm:text-[10px]">
                Full visibility report
              </p>
            </a>
          </div>
        </div>

        <p className="shrink-0 text-center text-xs text-slate-500 sm:text-sm lg:max-w-md">
          Report for <span className="font-semibold text-slate-800">{host}</span>
          <span className="text-slate-300"> · </span>generated {generatedAt}
        </p>

        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-2.5">
          <ActionBtn onClick={() => downloadReportPdf({ report, results: activeResults, cards: activeCards })}>
            PDF
          </ActionBtn>
          <LogoutButton />
        </div>
      </div>

      {/* Hero */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm md:p-8">
          <h1 className="font-display text-xl font-extrabold leading-tight text-[#0f1f2e] md:text-2xl">
            Your{" "}
            {isMulti ? (
              <span className="text-tr-green-600">multi-keyword</span>
            ) : (
              <span className="text-tr-green-600">local search</span>
            )}{" "}
            visibility report
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            {report.summary_text ??
              `Here’s how ${businessNameLine} ranks on Google Maps across suburbs in your ${
                report.radius_band_label ?? report.radius_km + " km"
              } service ${
                isMulti ? "area" : "radius"
              }${isMulti ? " for each of your keywords. Switch the keyword layer below to change the map." : ". Explore the map and table for suburb-by-suburb results."}`}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge label="URL" value={host} />
            <Badge
              label="CITY"
              value={`${report.city}${activeResults[0]?.suburb_state ? `, ${activeResults[0]!.suburb_state}` : ""}`}
            />
            <Badge label="RADIUS" value={report.radius_band_label || `${report.radius_km} km`} />
            <Badge label="SUBURBS" value={String(nSub)} />
            {isMulti && <Badge label="KEYWORDS" value={String(compass?.keywordCount ?? matrixRows.length)} />}
          </div>
        </div>

        <div
          className="flex items-center justify-between gap-4 rounded-2xl px-5 py-6 text-white shadow-lg sm:px-7 sm:py-7"
          style={{
            background: "linear-gradient(140deg, #0c1929 0%, #132238 50%, #0a1624 100%)",
          }}
        >
          <ScoreGauge score={displayAverage} variant="navy" />
          <div className="min-w-0 flex-1 pl-1 sm:pl-2">
            <p className="text-[10px] font-bold uppercase leading-tight tracking-[0.2em] text-slate-400 sm:text-[11px]">
              Average visibility
            </p>
            <p className="mt-0.5 font-display text-2xl font-extrabold tabular-nums text-white sm:text-3xl">
              {displayAverage}
              <span className="text-slate-500">/100</span>
            </p>
            <p className="mt-1.5 text-left text-sm leading-snug text-tr-green-200/90">
              <span aria-hidden>↑</span>{" "}
              {isMulti
                ? `across ${compass?.keywordCount ?? matrixRows.length} keywords`
                : `for “${report.keyword}”`}{" "}
              <span className="text-slate-500">·</span> above AU avg ({AU_BENCH})
            </p>
          </div>
        </div>
      </div>

      {/* Keyword layer */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Keyword layer</p>
          <p className="text-xs italic text-slate-400">Click a keyword to change the map layer</p>
        </div>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Select keyword to change map and breakdown"
        >
          {matrixRows.map((row, i) => (
            <button
              key={row.keyword + i}
              type="button"
              onClick={() => (isMulti ? onSelectKeyword(i) : undefined)}
              className={
                "group inline-flex min-h-[2.75rem] min-w-0 max-w-full items-center gap-2 rounded-full border-2 px-3.5 py-2 text-left text-sm font-bold transition sm:px-4 " +
                (i === activeKeywordIndex
                  ? "border-tr-green-500 bg-white text-slate-900 shadow-md"
                  : "border-slate-200/80 bg-slate-50/90 text-slate-700 hover:border-tr-green-200")
              }
              disabled={!isMulti}
              aria-pressed={i === activeKeywordIndex}
            >
              <span className="truncate">{row.keyword}</span>
              <span
                className={
                  "shrink-0 rounded-md px-2 py-0.5 text-xs font-extrabold tabular-nums " +
                  scorePillClass(row.score)
                }
              >
                {row.score}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Map + matrix */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-6">
        <div className="lg:col-span-7">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-1">
            <h2 className="font-display text-sm font-extrabold text-[#0f1f2e] sm:text-base">
              Visibility Map – <span className="text-tr-green-700">‘{report.keyword}’</span>
            </h2>
            <p className="text-xs text-slate-500">
              {nSub} suburbs <span className="text-slate-300">·</span> {report.radius_band_label || `${report.radius_km} km radius`}
            </p>
          </div>
          <div
            className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-200/50"
            style={{ minHeight: 420, height: "min(58vh, 520px)" }}
          >
            {businessLat !== null && businessLng !== null ? (
              <>
                <VisibilityMap
                  results={activeResults}
                  businessLat={businessLat}
                  businessLng={businessLng}
                  isPartial={isGated}
                  compactLegend
                />
                <div className="pointer-events-none absolute left-0 top-0 z-[1100] flex w-full max-w-full justify-between p-2.5 sm:p-3">
                  <div className="pointer-events-auto max-w-[min(100%,18rem)] rounded-lg border border-slate-200/80 bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
                    <p className="text-xs font-extrabold text-slate-900">{businessNameLine}</p>
                    <p className="text-[10px] leading-snug text-slate-500">{addressLine}</p>
                  </div>
                  <div
                    className="pointer-events-none hidden rounded-full border border-slate-600/30 bg-slate-900/90 px-2.5 py-1.5 text-[9px] font-extrabold uppercase tracking-wider text-white sm:block"
                    title="Scan radius"
                  >
                    RADIUS <span className="text-tr-green-300/90">·</span> {report.radius_band_label || `${report.radius_km} km`}{" "}
                    <span className="text-tr-green-300/90">·</span> {nSub} suburbs
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-full min-h-[320px] items-center justify-center text-slate-400">
                Map unavailable
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5">
          <KeywordRankMatrix
            rows={matrixRows}
            activeIndex={activeKeywordIndex}
            onSelect={onSelectKeyword}
            isInteractive={isMulti}
          />
        </div>
      </div>

      {/* Breakdown + sidebar column */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <div className="card-elevated p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-sm font-extrabold text-[#0f1f2e] sm:text-base">
                Breakdown for <span className="text-tr-green-700">‘{report.keyword}’</span> · {nSub} suburbs
              </h2>
              <p className="text-xs font-medium text-slate-500">Visibility score: {singleScore} / 100</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
              <BigTile
                n={bands.top3}
                pct={pct(bands.top3)}
                sub={TILE.top3}
                textMode="light"
              />
              <BigTile
                n={bands.page1}
                pct={pct(bands.page1)}
                sub={TILE.page1}
                textMode="dark"
              />
              <BigTile
                n={bands.page2}
                pct={pct(bands.page2)}
                sub={TILE.page2}
                textMode="dark"
              />
              <BigTile
                n={bands.notVisible}
                pct={pct(bands.notVisible)}
                sub={TILE.notVis}
                textMode="light"
              />
            </div>
          </div>
          <CitySearchVolumeCard report={report} results={activeResults} />
        </div>

        <div className="space-y-4 lg:col-span-5">
          {isGated ? (
            <EmailGate
              reportId={report.report_id}
              visibilityScore={report.visibility_score ?? 0}
              report={report}
              results={activeResults}
              onUnlocked={handleUnlocked}
            />
          ) : (
            <>
              <div className="card-elevated p-0 overflow-hidden">
                <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3 sm:px-5">
                  <h2 className="text-sm font-extrabold text-slate-900">Top 5 opportunity suburbs</h2>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    for <span className="text-tr-green-700 normal-case">‘{report.keyword}’</span>
                  </p>
                </div>
                <ul className="max-h-[340px] divide-y divide-slate-100 overflow-y-auto">
                  {activeCards.slice(0, 5).map((c, i) => (
                    <OppLine key={c.card_id} card={c} rank={i + 1} result={activeResults.find((r) => r.suburb_name === c.suburb_name)} />
                  ))}
                  {activeCards.length === 0 && (
                    <li className="px-4 py-6 text-sm text-slate-500">No high-impact gaps in this set — great job.</li>
                  )}
                </ul>
              </div>

              <div
                className="overflow-hidden rounded-2xl p-5 text-center text-white shadow-lg sm:p-6"
                style={{
                  background: "radial-gradient(100% 120% at 100% 0%, #1a3a4f 0%, #0c1929 40%, #070f18 100%)",
                }}
              >
                <p className="text-balance text-base font-bold leading-snug sm:text-lg">
                  Want Traffic Radius to{" "}
                  <span className="text-tr-green-300">close these gaps</span> for you?
                </p>
                <p className="mt-2 text-sm text-slate-300/95">
                  Our local SEO team turns “red” suburbs into visibility wins — with clear reporting you can
                  show your boss.
                </p>
                <a
                  href={finalCtaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 block w-full rounded-lg bg-[#ff9f43] py-3.5 text-center text-sm font-extrabold text-gray-900 shadow transition hover:brightness-105"
                >
                  {CTA_BOOK_STRATEGY_CALL}
                </a>
                <p className="mt-2 text-xs text-slate-400">30 minutes · no obligation · {PHONE_DISPLAY}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {!isGated && activeResults.length > 0 && <SuburbTable results={activeResults} city={report.city} />}

      <p className="pt-2 text-center text-sm">
        <a
          href="/#check"
          className="text-tr-green-600/90 font-medium hover:text-tr-green-800 hover:underline"
        >
          ← Back to check another business
        </a>
      </p>
    </div>
  );
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function isDesktopRow(value: string | null | undefined): boolean {
  return !value || value === "desktop";
}

// ── UI atoms ─────────────────────────────────

function scorePillClass(s: number): string {
  if (s >= 60) return "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200/80";
  if (s >= 48) return "bg-amber-100 text-amber-800 ring-1 ring-amber-200/80";
  if (s >= 35) return "bg-orange-100 text-orange-800 ring-1 ring-orange-200/80";
  return "bg-rose-100 text-rose-800 ring-1 ring-rose-200/80";
}

function ActionBtn({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-[2.5rem] items-center justify-center gap-1.5 rounded-lg border border-slate-200/90 bg-white px-3.5 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
    >
      <PdfIcon className="h-4 w-4 text-slate-500" />
      {children}
    </button>
  );
}

function PdfIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function Badge({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-tr-green-200/50 bg-tr-green-50/80 px-2.5 py-1.5 text-[11px] sm:text-xs">
      <span className="shrink-0 rounded bg-tr-green-100 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-tr-green-800">
        {label}
      </span>
      <span className="min-w-0 truncate font-medium text-slate-800" title={value}>
        {value}
      </span>
    </span>
  );
}

function KeywordRankMatrix({
  rows,
  activeIndex,
  onSelect,
  isInteractive,
}: {
  rows: KeywordMatrixRow[];
  activeIndex: number;
  onSelect: (i: number) => void;
  isInteractive?: boolean;
}) {
  return (
    <div className="card-elevated h-full min-h-0 p-0 overflow-hidden">
      <div className="flex items-baseline justify-between border-b border-slate-100 bg-slate-50/50 px-3 py-2.5 sm:px-4">
        <h2 className="text-xs font-extrabold text-slate-900 sm:text-sm">Keyword × Rank matrix</h2>
        <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Coverage %</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[300px] text-left text-sm">
          <thead>
            <tr className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
              <th className="whitespace-nowrap px-2 py-2.5 pl-3 sm:px-3 sm:pl-4">Keyword</th>
              <th className="w-8 px-0.5 text-center" title="Top 3">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#22C55E]" />
              </th>
              <th className="w-8 px-0.5 text-center" title="Page 1">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#86EFAC]" />
              </th>
              <th className="w-8 px-0.5 text-center" title="Page 2">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#FCD34D]" />
              </th>
              <th className="w-8 px-0.5 text-center" title="Not visible">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#EF4444]" />
              </th>
              <th className="pr-3 text-right sm:pr-4">Score</th>
              <th className="hidden w-14 pr-2 text-right text-[8px] sm:table-cell sm:pr-3">Cov.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => {
              const vis = r.top3 + r.page1 + r.page2;
              const tot = r.top3 + r.page1 + r.page2 + r.notVisible;
              const coverage = tot > 0 ? Math.round((vis / tot) * 100) : 0;
              const isActive = i === activeIndex;
              return (
                <tr
                  key={i}
                  onClick={isInteractive ? () => onSelect(i) : undefined}
                  className={
                    (isActive ? "bg-tr-green-50/60" : isInteractive ? "hover:bg-slate-50/80" : "") +
                    " transition " +
                    (isInteractive ? "cursor-pointer" : "")
                  }
                >
                  <td className="max-w-[6rem] truncate py-2 pl-3 pr-1 text-xs font-bold text-slate-900 sm:max-w-[10rem] sm:pl-4 sm:text-sm">
                    {r.keyword}
                  </td>
                  <td className="p-0.5 text-center">
                    <CountCell n={r.top3} color="#F0FDF4" text="#14532D" border="#bbf7d0" />
                  </td>
                  <td className="p-0.5 text-center">
                    <CountCell n={r.page1} color="#E8F5E8" text="#14532D" border="#D1E8D1" />
                  </td>
                  <td className="p-0.5 text-center">
                    <CountCell n={r.page2} color="#FFFBEB" text="#92400E" border="#FEF3C7" />
                  </td>
                  <td className="p-0.5 text-center">
                    <CountCell n={r.notVisible} color="#FEF2F2" text="#9F1239" border="#FECDD3" />
                  </td>
                  <td className="pr-2 text-right font-extrabold tabular-nums" style={{ color: scoreToHex(r.score) }}>
                    {r.score}
                  </td>
                  <td className="hidden pr-2 text-right text-xs text-slate-500 sm:table-cell sm:pr-3">{coverage}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-slate-100 bg-slate-50/30 px-3 py-1.5 text-[9px] text-slate-500 sm:px-4">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#22C55E] align-middle" /> Top 3
        <span className="mx-1" /> <span className="inline-block h-1.5 w-1.5 rounded-sm bg-[#86EFAC] align-middle" /> Page
        1
        <span className="mx-1" /> <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#FCD34D] align-middle" /> Page
        2
        <span className="mx-1" />
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#EF4444] align-middle" /> Not visible
      </p>
    </div>
  );
}

function scoreToHex(s: number): string {
  if (s >= 60) return "#166534";
  if (s >= 48) return "#b45309";
  if (s >= 35) return "#c2410c";
  return "#9f1239";
}

function CountCell({
  n,
  color,
  text,
  border,
}: {
  n: number;
  color: string;
  text: string;
  border: string;
}) {
  return (
    <span
      className="inline-flex min-w-[1.4rem] justify-center rounded px-1 py-0.5 text-xs font-extrabold"
      style={{ backgroundColor: color, color: text, border: `1px solid ${border}` }}
    >
      {n}
    </span>
  );
}

function BigTile({
  n,
  pct,
  sub,
  textMode,
}: {
  n: number;
  pct: number;
  sub: { bg: string; label: string };
  textMode: "light" | "dark";
}) {
  const t = textMode === "light";
  return (
    <div
      className="flex min-h-[5.5rem] flex-col justify-center rounded-2xl px-2.5 py-3 text-center sm:min-h-[6rem] sm:px-3 sm:py-4"
      style={{ backgroundColor: sub.bg }}
    >
      <p
        className={
          (t ? "text-white" : "text-slate-900") + " text-2xl font-black tabular-nums sm:text-3xl"
        }
        style={t ? { textShadow: "0 1px 0 rgba(0,0,0,0.1)" } : undefined}
      >
        {n}
      </p>
      <p
        className={
          (t ? "text-white/95" : "text-slate-800/90") + " text-[8px] font-extrabold leading-tight sm:text-[9px]"
        }
      >
        {sub.label}
      </p>
      <p className={`mt-0.5 text-[8px] font-bold sm:text-[9px] ${t ? "text-white/80" : "text-slate-800/80"}`}>
        {pct}%
      </p>
    </div>
  );
}

function OppLine({
  card,
  rank,
  result,
}: {
  card: OppCard;
  rank: number;
  result?: SerpMapResult;
}) {
  const pos = result?.rank_position ?? null;
  const heat: "HOT" | "WARM" | "MILD" = !isVisiblePosition(pos)
    ? "HOT"
    : typeof pos === "number" && pos > 10 && pos <= 20
      ? "WARM"
      : "MILD";
  const heatClass =
    heat === "HOT"
      ? "bg-rose-100 text-rose-800 ring-rose-200/80"
      : heat === "WARM"
        ? "bg-amber-100 text-amber-900 ring-amber-200/80"
        : "bg-slate-100 text-slate-600 ring-slate-200/60";

  return (
    <li className="flex items-start gap-2.5 px-3 py-3 sm:gap-3 sm:px-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-tr-green-200 bg-white text-sm font-extrabold text-tr-green-800">
        #{rank}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-900">{card.suburb_name}</p>
        <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-slate-600">{card.card_text}</p>
      </div>
      <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-extrabold ring-1 ${heatClass}`}>{heat}</span>
    </li>
  );
}

// ── Table & demand card (unchanged data, refreshed chrome) ─────────────────

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

function CitySearchVolumeCard({
  report,
  results,
}: {
  report: SerpMapReport;
  results: SerpMapResult[];
}) {
  const cityVolume =
    report.city_monthly_volume != null &&
    Number.isFinite(Number(report.city_monthly_volume)) &&
    Number(report.city_monthly_volume) >= 0
      ? Math.round(Number(report.city_monthly_volume))
      : null;
  const peakSuburb = useMemo(() => {
    let m = 0;
    for (const r of results) {
      const v = r.monthly_volume;
      if (Number.isFinite(v) && v > m) m = v;
    }
    return m > 0 ? Math.round(m) : null;
  }, [results]);
  const stateAbbr = (results.find((r) => r.suburb_state)?.suburb_state ?? "").toUpperCase();
  const stateFull = STATE_FULL[stateAbbr] ?? stateAbbr;
  const locationLabel = stateFull
    ? `${report.city}, ${stateFull}, Australia`
    : `${report.city}, Australia`;

  const showPeakFallback = cityVolume === null && peakSuburb != null;

  return (
    <div className="card-elevated w-full border-slate-200/80 px-4 py-3 md:px-5 md:py-4">
      <div className="flex flex-row items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase leading-none tracking-[0.14em] text-tr-green-700">Local search demand</p>
          <p className="mt-1.5 font-display text-lg font-bold leading-tight text-slate-900 md:text-[22px]">
            {locationLabel}
          </p>
          <p className="mt-1 text-sm font-medium text-slate-600 md:text-base">
            Keyword:{" "}
            <span className="font-semibold text-tr-green-700">“{report.keyword.toLowerCase()}”</span>
          </p>
        </div>
        <div className="shrink-0 pt-0.5 text-right">
          {cityVolume !== null ? (
            <>
              <p className="text-[22px] font-extrabold leading-none text-slate-900 md:text-2xl">
                {cityVolume.toLocaleString()}
              </p>
              <p className="mt-0.5 text-xs font-medium text-slate-400">searches / month (city)</p>
            </>
          ) : showPeakFallback ? (
            <>
              <p className="text-[22px] font-extrabold leading-none text-slate-900 md:text-2xl">
                {peakSuburb.toLocaleString()}
              </p>
              <p className="mt-0.5 text-xs font-medium text-slate-500">peak suburb (modelled)</p>
            </>
          ) : (
            <>
              <div
                className="ml-auto h-1.5 w-16 max-w-full rounded-full bg-blue-500 shadow-sm ring-1 ring-blue-500/20"
                aria-hidden
              />
              <p className="mt-2 text-xs font-medium text-slate-500">searches / month</p>
            </>
          )}
        </div>
      </div>
      <div className="mt-2.5 rounded-xl border border-amber-100 bg-amber-50/80 px-3 py-2 text-amber-800/90 text-xs leading-relaxed">
        {cityVolume !== null ? (
          <>
            <span className="font-medium">Note:</span> This is a city/region Google Ads style estimate. Suburb cells in
            the table use a separate model.
          </>
        ) : showPeakFallback ? (
          <>
            <span className="font-medium">Note:</span> The city-level keyword call did not return a number (check
            DataforSEO Keyword Data access / balance). Showing the <strong>highest</strong> modelled volume among
            checked suburbs for this keyword instead.
          </>
        ) : (
          <>
            <span className="font-medium">Note:</span> We could not load a city or national volume for this keyword in
            this run. Confirm <code className="text-[10px]">DATAFORSEO_LOGIN</code> /{" "}
            <code className="text-[10px]">DATAFORSEO_PASSWORD</code> and that your plan includes the Keyword Data API.
          </>
        )}
      </div>
    </div>
  );
}

function getBandInfo(position: number | null | undefined) {
  if (position === null || position === undefined) {
    return { band: { bg: "#FEF2F2", text: "#B91C1C", dot: "#EF4444", label: "Not visible" } };
  }
  if (position <= 3) {
    return { band: { bg: "#F0FDF4", text: "#15803D", dot: "#22C55E", label: "Top 3" } };
  }
  if (position <= 10) {
    return { band: { bg: "#F0FDF4", text: "#166534", dot: "#86EFAC", label: "Page 1" } };
  }
  if (position <= 20) {
    return { band: { bg: "#FFFBEB", text: "#92400E", dot: "#FCD34D", label: "Page 2" } };
  }
  return { band: { bg: "#FEF2F2", text: "#B91C1C", dot: "#EF4444", label: "Not visible" } };
}

function SuburbTable({ results, city }: { results: SerpMapResult[]; city: string }) {
  const sorted = [...results].sort(
    (a, b) =>
      (a.rank_position ?? 999) - (b.rank_position ?? 999) || a.suburb_name.localeCompare(b.suburb_name)
  );

  return (
    <div className="card-elevated overflow-hidden">
      <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3 sm:px-6">
        <h2 className="font-display text-sm font-extrabold text-slate-900">All suburbs</h2>
        <p className="text-xs text-slate-500">Full list for the active keyword</p>
      </div>
      <div className="max-h-[480px] overflow-x-auto overflow-y-auto">
        <table className="w-full min-w-[520px] table-fixed text-sm">
          <thead className="bg-slate-50/90 text-xs font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-[28%] px-4 py-2.5 text-left sm:px-5">Suburb</th>
              <th className="px-3 py-2.5 text-center">City</th>
              <th className="w-20 px-3 py-2.5 text-center">State</th>
              <th className="w-24 px-3 py-2.5 text-center">Position</th>
              <th className="w-[22%] px-3 py-2.5 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((r) => {
              const { band } = getBandInfo(r.rank_position);
              return (
                <tr key={r.result_id} className="transition hover:bg-slate-50/80">
                  <td className="px-4 py-2.5 font-medium text-slate-900 sm:px-5">{r.suburb_name}</td>
                  <td className="px-3 py-2.5 text-center text-slate-500">{city}</td>
                  <td className="px-3 py-2.5 text-center text-slate-500">{r.suburb_state ?? "—"}</td>
                  <td className="px-3 py-2.5 text-center tabular-nums text-slate-800">{r.rank_position ?? "—"}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
                      style={{ backgroundColor: band.bg, color: band.text }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: band.dot }} />
                      {band.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
