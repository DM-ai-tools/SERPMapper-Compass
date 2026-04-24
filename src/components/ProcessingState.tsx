"use client";

import { useEffect, useMemo, useState } from "react";
import { TrafficRadiusLogoImage } from "@/components/TrafficRadiusLogoImage";
import { CTA_FREE_AUDIT, TRAFFIC_RADIUS_CONTACT_URL } from "@/lib/lead-cta";
import { getRadiusOptionById } from "@/lib/radius-bands";
import { RANK_COLORS } from "@/lib/types";

// ─── Design tokens (Traffic Radius green + neutral chrome) ───
const BG = "#F0F4F8";
const ACCENT = "#5A9A2A";
const ACCENT_MUTED = "rgba(111, 179, 46, 0.15)";

const DEMO_KEYWORDS = ["plumber", "hot water repair", "blocked drains", "gas fitting"];

const CITY_PRESETS: Record<string, string[]> = {
  melbourne: [
    "Footscray", "Richmond", "Fitzroy", "Carlton", "Hawthorn", "Collingwood", "Prahran",
    "St Kilda", "South Yarra", "Brunswick", "Camberwell", "Malvern", "Caulfield", "Brighton",
    "Elsternwick", "Port Melbourne", "Williamstown", "Yarraville", "Northcote", "Preston",
    "Coburg", "Essendon", "Moonee Ponds", "Bentleigh", "Sandringham", "Black Rock",
  ],
  sydney: [
    "Parramatta", "Chatswood", "Bondi", "Manly", "Surry Hills", "Leichhardt", "Newtown",
  ],
  brisbane: [
    "South Brisbane", "Fortitude Valley", "Chermside", "Indooroopilly", "Toowong", "Coorparoo",
  ],
  default: [
    "Suburb A", "Suburb B", "Suburb C", "Suburb D", "Suburb E", "Suburb F", "Suburb G",
  ],
};

function hostFromUrl(url: string): string {
  if (!url.trim()) return "";
  try {
    const u = url.startsWith("http") ? url : `https://${url}`;
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0] ?? url;
  }
}

function labelForCity(city: string): string {
  const c = city.trim();
  if (!c) return "—";
  const k = c.toLowerCase();
  if (k.includes("melbourne")) return "Melbourne, VIC";
  if (k.includes("sydney")) return "Sydney, NSW";
  if (k.includes("brisbane")) return "Brisbane, QLD";
  if (k.includes("perth")) return "Perth, WA";
  if (k.includes("adelaide")) return "Adelaide, SA";
  if (k.includes("canberra")) return "Canberra, ACT";
  if (k.includes("darwin")) return "Darwin, NT";
  if (k.includes("hobart")) return "Hobart, TAS";
  return c;
}

function getSuburbList(city: string): string[] {
  const k = city.trim().toLowerCase();
  if (CITY_PRESETS[k]) return CITY_PRESETS[k];
  for (const [ck, v] of Object.entries(CITY_PRESETS)) {
    if (k.includes(ck) && ck !== "default") return v;
  }
  return [...CITY_PRESETS.default, ...CITY_PRESETS.melbourne].slice(0, 32);
}

/** Staggered per-keyword “done” counts to mimic parallel live scan. */
function perKeywordDone(elapsedSec: number, keywordCount: number, cap: number): number[] {
  return Array.from({ length: keywordCount }, (_, i) => {
    const t = elapsedSec;
    // Each keyword runs ~0.2–0.3 behind the previous for visual interest
    const phase = Math.max(0, t - i * 1.8) / 9.2;
    const p = 1 - Math.exp(-1.1 * Math.min(phase, 2.2));
    return Math.min(cap, Math.floor(p * cap));
  });
}

// ─── Small presentational pieces ───

function TrafficRadiusMini() {
  return (
    <a
      href="https://trafficradius.com.au/"
      className="flex shrink-0 items-center"
      target="_blank"
      rel="noreferrer"
      aria-label="Traffic Radius"
    >
      <TrafficRadiusLogoImage className="h-7 w-auto max-w-[10rem] object-contain object-left sm:h-8 sm:max-w-[12rem]" />
    </a>
  );
}

interface ProcessingStateProps {
  total: number;
  checked: number;
  businessName?: string | null;
  suburbNames?: string[];
  city?: string;
  websiteUrl?: string;
  /** Multi-keyword; defaults to a demo set */
  keywords?: string[];
  radiusBandId?: string;
}

export default function ProcessingState({
  total: totalProp,
  checked,
  businessName,
  suburbNames,
  city = "your area",
  websiteUrl = "",
  keywords: keywordsProp,
  radiusBandId,
}: ProcessingStateProps) {
  const keywords = useMemo(() => {
    const k = keywordsProp && keywordsProp.length ? keywordsProp : DEMO_KEYWORDS;
    return k.slice(0, 10);
  }, [keywordsProp]);

  const startTs = useMemo(() => Date.now(), []);
  const [nowTs, setNowTs] = useState(Date.now());
  const [activeLayer, setActiveLayer] = useState(0);

  const radius = getRadiusOptionById(radiusBandId);
  const perKw = useMemo(() => {
    if (totalProp > 0 && keywords.length) return Math.max(1, Math.round(totalProp / keywords.length));
    return 40;
  }, [totalProp, keywords.length]);
  const totalChecks = perKw * keywords.length;

  useEffect(() => {
    const i = setInterval(() => setNowTs(Date.now()), 180);
    return () => clearInterval(i);
  }, []);

  const elapsed = (nowTs - startTs) / 1000;
  const estimatedChecked = useMemo(() => {
    if (totalChecks <= 0) return 0;
    if (totalProp > 0 && Math.floor(checked) > 0) {
      return Math.max(0, Math.min(totalChecks, Math.floor((checked / totalProp) * totalChecks)));
    }
    const estMs = 32_000;
    const r = Math.min(1, Math.max(0, (nowTs - startTs) / estMs));
    return Math.min(totalChecks - 1, Math.floor(r * (totalChecks * 0.92) + 1));
  }, [checked, nowTs, startTs, totalChecks, totalProp]);

  const perKwDone = perKeywordDone(elapsed, keywords.length, perKw);
  const serpComplete = perKwDone.reduce((a, b) => a + b, 0);
  const overallLabel = Math.min(serpComplete, totalChecks);

  const suburbPool = useMemo(
    () => (suburbNames && suburbNames.length > 0 ? suburbNames : getSuburbList(city)),
    [suburbNames, city]
  );

  const doneTags = useMemo(
    () => Math.min(serpComplete, Math.min(suburbPool.length, 28 + Math.min(2, perKw / 4))),
    [serpComplete, suburbPool.length, perKw]
  );
  const checkingN = 1;
  const queuedN = Math.max(0, suburbPool.length - doneTags - checkingN);

  const host = useMemo(() => (websiteUrl ? hostFromUrl(websiteUrl) : "your-site.com"), [websiteUrl]);
  const displayName = businessName || host;

  const mapPct = (idx: number) =>
    Math.min(100, Math.round((perKwDone[idx]! / perKw) * 100) || 0);

  // Sync active layer: first in-progress, else last
  useEffect(() => {
    const idx = perKwDone.findIndex((d) => d > 0 && d < perKw);
    if (idx >= 0) setActiveLayer(idx);
  }, [perKwDone, perKw]);

  const legend = [
    { c: RANK_COLORS.top3, l: "Top 3" },
    { c: RANK_COLORS.page1, l: "Page 1" },
    { c: RANK_COLORS.page2, l: "Page 2" },
    { c: RANK_COLORS.missing, l: "Not visible" },
    { c: RANK_COLORS.nodata, l: "Pending…" },
  ];

  const etaSec = Math.max(5, 28 - Math.min(23, Math.floor(elapsed * 0.8)));

  return (
    <div
      className="min-h-[calc(100vh-3.5rem)] w-full"
      style={{ backgroundColor: BG, fontFamily: "var(--font-sans), ui-sans-serif, system-ui" }}
    >
      {/* In-page top strip (sits under global SiteHeader) */}
      <div className="border-b border-slate-200/80 bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-4">
            <TrafficRadiusMini />
            <div className="hidden h-10 w-px shrink-0 bg-slate-200 sm:block" />
            <a
              href="/"
              className="min-w-0 rounded-lg outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-tr-green-500/50 focus-visible:ring-offset-2"
              title="Back to SERPMapper Compass home"
            >
              <p className="text-sm font-extrabold text-tr-logo-navy sm:text-base">
                <span>SERP</span>
                <span className="text-tr-green-600">Mapper</span> <span>Compass</span>
              </p>
              <p className="text-[0.5rem] font-bold uppercase leading-tight tracking-[0.12em] text-slate-400 sm:text-[10px]">
                <span>Processing</span> <span className="text-tr-green-600">·</span>{" "}
                <span className="text-tr-green-600">LIVE SCAN</span>
              </p>
            </a>
          </div>
          <div className="flex min-w-0 flex-wrap shrink-0 items-center justify-end gap-2 sm:gap-3">
            <a
              href={TRAFFIC_RADIUS_CONTACT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[2.5rem] min-w-0 max-w-full items-center justify-center gap-1 rounded-lg border-2 border-tr-green-500 bg-white px-3 py-1.5 text-center text-xs font-extrabold tracking-wide text-tr-green-700 shadow-sm transition hover:bg-tr-green-50 focus:outline-none focus:ring-2 focus:ring-tr-green-500/50 sm:py-2"
              title="Traffic Radius — contact"
            >
              {CTA_FREE_AUDIT}
              <span className="text-[0.7em] leading-none" aria-hidden>
                ↗
              </span>
            </a>
            <div
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-bold"
              style={{ color: ACCENT, background: ACCENT_MUTED }}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span
                  className="absolute h-full w-full animate-ping rounded-full opacity-60"
                  style={{ background: ACCENT }}
                />
                <span className="relative h-1.5 w-1.5 rounded-full" style={{ background: ACCENT }} />
              </span>
              LIVE SCAN IN PROGRESS
            </div>
            <p className="max-w-[14rem] truncate text-xs font-medium text-slate-500" title={host}>
              {host}
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 md:px-6 lg:grid-cols-2 lg:items-start">
        {/* LEFT — narrative + progress + suburbs */}
        <div className="order-1 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)] sm:p-7">
          <div className="h-0.5 w-14 rounded-full bg-tr-green-500" />
          <h1
            className="mt-1 text-2xl font-extrabold leading-tight text-slate-900 sm:text-3xl"
            style={{ fontFamily: "var(--font-display), var(--font-sans), sans-serif" }}
          >
            <span className="text-tr-green-700">Scanning </span>
            <span className="text-tr-green-600">{displayName}</span>
            <span className="text-slate-400">.</span>
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            We’re checking your visibility across{" "}
            <span className="font-semibold text-slate-600">{keywords.length} keywords</span> ×{" "}
            <span className="font-semibold text-slate-600">{perKw} suburbs</span> (
            {radius.short.replace(/–/g, "–")} km). Results stream in as each suburb resolves.
          </p>

          <div
            className="mt-5 grid gap-2.5 rounded-xl border-2 border-dashed border-tr-green-200/60 bg-tr-green-50/40 px-3 py-3.5 sm:grid-cols-2"
          >
            {(
              [
                ["URL", host || "—"],
                ["CITY", labelForCity(city)],
                ["RADIUS", radius.label.replace(/km/g, " km")],
                ["KEYWORDS", `${keywords.length} / 10`],
                ["ETA", `~${etaSec} s`],
              ] as const
            ).map(([L, v]) => (
              <div
                key={L}
                className={"min-w-0 " + (L === "ETA" ? "col-span-2" : "")}
              >
                <div className="mb-1 inline-block rounded bg-tr-green-100/80 px-1.5 py-0.5 text-[9px] font-bold text-tr-green-800">
                  {L}
                </div>
                <p className="break-all pl-0.5 text-sm font-medium text-slate-800">{v}</p>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <div className="mb-1.5 flex flex-wrap items-end justify-between gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Overall progress</span>
              <span>
                {overallLabel} of {totalChecks} SERP checks complete
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-200/80 ring-1 ring-slate-200/80">
              <div
                className="h-full min-h-[2px] rounded-full bg-gradient-to-r from-tr-green-600 via-tr-green-500 to-tr-green-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] transition-[width] duration-500 ease-out"
                style={{
                  width: `${totalChecks > 0 ? (overallLabel / totalChecks) * 100 : 0}%`,
                }}
                aria-hidden
              />
            </div>
          </div>

          <p className="mb-2 mt-8 text-[0.65rem] font-bold uppercase tracking-wide text-slate-400">
            Per-keyword progress
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {keywords.map((kw, i) => {
              const d = perKwDone[i] ?? 0;
              const done = d >= perKw;
              const inProg = d > 0 && !done;
              const p = d / perKw;
              return (
                <div
                  key={kw + i}
                  className={
                    "rounded-xl border-2 p-2.5 transition " +
                    (done
                      ? "border-emerald-300/90 bg-emerald-50/40"
                      : inProg
                        ? "border-tr-green-200 bg-white shadow-sm ring-1 ring-tr-green-200/50"
                        : "border-slate-200/90 bg-slate-50/80")
                  }
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <div
                      className={
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm font-extrabold " +
                        (done ? "bg-emerald-500 text-white" : inProg ? "bg-tr-green-500 text-white" : "bg-slate-200 text-slate-600")
                      }
                    >
                      {kw[0]!.toUpperCase()}
                    </div>
                    <p className="line-clamp-1 text-xs font-bold capitalize text-slate-800" title={kw}>
                      {kw}
                    </p>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80">
                    <div
                      className={
                        "h-full rounded-full transition-all " +
                        (done ? "bg-emerald-500" : inProg ? "bg-gradient-to-r from-tr-green-600 to-tr-green-500" : "bg-slate-200")
                      }
                      style={{ width: `${p * 100}%` }}
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-end gap-0.5 text-[11px] font-bold text-slate-600">
                    {done && <span className="text-emerald-600">✓</span>}
                    {inProg && (
                      <span className="text-tr-green-500">
                        <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border-2 border-tr-green-400 border-t-transparent" />
                      </span>
                    )}{" "}
                    {d} / {perKw}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mb-0 mt-6 flex items-center justify-between text-xs text-slate-500">
            <p className="text-[0.7rem] font-bold uppercase tracking-wide text-slate-500">
              Suburb stream – {radius.short} km
            </p>
            <p>
              {Math.min(doneTags, 32)} done · {checkingN} checking · {queuedN} queued
            </p>
          </div>
          <div className="mt-1.5 flex min-h-[6rem] flex-wrap gap-1.5 content-start">
            {suburbPool.slice(0, doneTags + checkingN + 2).map((n, j) => {
              const g = j < doneTags;
              const cur = j === doneTags;
              return (
                <span
                  key={n + j}
                  className={
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium " +
                    (g
                      ? "border-emerald-200 bg-emerald-50/90 text-emerald-800"
                      : cur
                        ? "border-tr-green-200 bg-tr-green-50/90 text-tr-green-900"
                        : "border-slate-200 bg-slate-100/60 text-slate-500")
                  }
                >
                  {g && <span className="text-[10px]">✓</span>}
                  {n}
                </span>
              );
            })}
          </div>

          <p className="mt-4 text-center text-xs text-slate-400">
            Your multi-keyword map is filling in on the right <span className="font-semibold">→</span> switch
            layers to see each keyword’s coverage
          </p>
        </div>

        {/* RIGHT — map card */}
        <div className="order-2 rounded-2xl border border-slate-200/80 bg-white p-0 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5 sm:px-4">
            <div>
              <p className="text-sm font-extrabold text-tr-green-800">
                Live map preview
                <span className="pl-1 text-xs font-semibold text-slate-500">
                  | LAYER · {keywords[activeLayer] ?? "—"}
                </span>
              </p>
            </div>
            <span
              className="inline-flex items-center gap-1 rounded-md border border-red-200/90 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
              LIVE
            </span>
          </div>

          <div className="px-2 pb-2 sm:px-3">
            <div className="flex gap-1.5 overflow-x-auto pb-2 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {keywords.map((kw, i) => {
                const pct = mapPct(i);
                return (
                  <button
                    key={kw + i}
                    type="button"
                    onClick={() => setActiveLayer(i)}
                    className={
                      "shrink-0 rounded-lg border-2 px-2.5 py-1.5 text-xs font-bold transition " +
                      (i === activeLayer
                        ? "border-tr-green-500 bg-tr-green-50/80 text-tr-green-800"
                        : "border-slate-200/90 bg-slate-50/80 text-slate-600 hover:border-tr-green-200/80")
                    }
                  >
                    {kw.length > 20 ? kw.slice(0, 16) + "…" : kw} {pct > 0 ? <span className="opacity-80">{pct}%</span> : null}
                  </button>
                );
              })}
            </div>
            <div
              className="relative h-0.5 w-full overflow-visible rounded-sm bg-slate-200/80"
              style={{ minHeight: "4px" }}
            >
              <div className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 bg-slate-200" />
            </div>
            <div
              className="mx-auto -mt-3 mb-2 flex w-[85%] justify-center rounded border border-tr-green-400/20 px-1 py-0.5"
              style={{ background: "rgba(111, 179, 46, 0.08)" }}
            />
          </div>

          <div
            className="relative m-2 mt-0 flex min-h-[280px] flex-col items-center justify-center overflow-hidden rounded-xl border border-slate-100/90 sm:min-h-[320px]"
            style={{ background: "linear-gradient(180deg,#F8FAFC 0%,#F0FDF4 100%)" }}
          >
            <p
              className="z-[1] mb-2 max-w-full truncate rounded-md bg-tr-green-800 px-2 py-0.5 text-[0.5rem] font-extrabold text-white"
              style={{ letterSpacing: "0.06em" }}
            >
              SERVICE RADIUS · {radius.label.replace(/[–-]/, " – ").replace("km", " km").toUpperCase()}
            </p>
            <div
              className="absolute inset-5 rounded-full border-2 border-dashed border-tr-green-400/60"
              style={{ zIndex: 0 }}
            />
            <div className="relative z-[1] p-3">
              {Array.from({ length: 4 }, (_, row) => (
                <div
                  key={row}
                  className="mb-0.5 flex justify-center gap-0.5"
                  style={{ marginLeft: row % 2 ? "18px" : 0 }}
                >
                  {Array.from({ length: 6 }, (_, col) => {
                    const k = col + row * 6;
                    const phase = (activeLayer * 0.2 + (k * 0.1)) % 1;
                    const colors = ["#16a34a", "#4ade80", "#facc15", "#f97316", "#ef4444", "#E5E7EB"];
                    const c = colors[k % 6] ?? "#E5E7EB";
                    return (
                      <div
                        key={k}
                        className="shrink-0"
                        style={{
                          width: 32,
                          height: 36,
                          clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                          backgroundColor: c,
                          opacity: 0.2 + 0.8 * Math.min(1, Math.max(0, mapPct(activeLayer) / 100 * 1.3 - phase * 0.1)),
                          boxShadow: "1px 2px 0 rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.35)",
                          transform: "scale(0.95)",
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-900 ring-1 ring-tr-green-400" />
            <div className="z-[1] mt-3 flex flex-wrap items-center justify-center gap-2 rounded-md bg-white/90 px-2 py-1.5 shadow-sm">
              {legend.map((L) => (
                <div key={L.l} className="flex items-center gap-1 text-[0.5rem] font-bold text-slate-600 sm:text-xs">
                  <div className="h-2.5 w-2.5 rounded-sm" style={{ background: L.c }} />
                  {L.l}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 border-t border-slate-100/90 px-3 py-2.5 text-xs sm:gap-6">
            <a href="/" className="font-medium text-tr-green-600 transition hover:underline">
              ← Back to flow overview
            </a>
            <a href="/#check" className="hidden text-tr-green-600 hover:underline sm:inline">
              Previous: Landing
            </a>
            <span className="text-slate-400">Next: report →</span>
          </div>
        </div>
      </div>
    </div>
  );
}
