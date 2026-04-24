"use client";

import { useEffect, useState, useRef, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SerpMapReport, SerpMapResult, OpportunityCard } from "@/lib/types";
import { calculateVisibilityScore, countSuburbsInBands } from "@/lib/scoring";
import ProcessingState from "@/components/ProcessingState";
import ReportView, { type CompassContext } from "@/components/ReportView";
import { readCompassDraft, clearCompassDraft } from "@/components/InputForm";
import type { RadiusBandId } from "@/lib/radius-bands";

type Phase = "analyzing" | "unlocked";

type ScanDraft = {
  url: string;
  city: string;
  keywords: string[];
  radius_band_id: RadiusBandId;
};

export default function ToolPage() {
  return (
    <Suspense fallback={<ToolPageSuspenseFallback />}>
      <ToolPageInner />
    </Suspense>
  );
}

function ToolPageSuspenseFallback() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center bg-[var(--page-bg)] px-4 py-20">
      <div className="w-full max-w-sm space-y-4">
        <div className="h-10 animate-pulse rounded-xl bg-slate-200/80" />
        <div className="mx-auto h-4 w-2/3 animate-pulse rounded-lg bg-slate-100" />
        <p className="text-center text-sm text-slate-500">Preparing analysis…</p>
      </div>
    </div>
  );
}

interface BatchItem {
  report_id: string;
  keyword: string;
  visibility_score?: number | null;
  summary_text?: string | null;
}

type ReportBundle = {
  report: SerpMapReport;
  results: SerpMapResult[];
  cards: OpportunityCard[];
};

function buildCompass(
  batch: BatchItem[] | null,
  reportCache: Record<string, ReportBundle>,
  activeIdx: number,
  selectKeyword: (i: number) => void
): CompassContext | null {
  if (!batch || batch.length <= 1) return null;
  const matrixRows = batch.map((b) => {
    const bundle = reportCache[b.report_id];
    if (!bundle) {
      return {
        keyword: b.keyword,
        top3: 0,
        page1: 0,
        page2: 0,
        notVisible: 0,
        score: 0,
      };
    }
    const c = countSuburbsInBands(bundle.results);
    return {
      keyword: b.keyword,
      top3: c.top3,
      page1: c.page1,
      page2: c.page2,
      notVisible: c.notVisible,
      score: calculateVisibilityScore(bundle.results),
    };
  });
  const averageScore = Math.round(
    matrixRows.reduce((s, r) => s + r.score, 0) / Math.max(matrixRows.length, 1)
  );
  return {
    matrixRows,
    activeKeywordIndex: activeIdx,
    onSelectKeyword: selectKeyword,
    averageScore,
    keywordCount: batch.length,
  };
}

async function fetchReportBundle(id: string): Promise<ReportBundle> {
  const res = await fetch(`/api/report/${id}`);
  if (!res.ok) {
    throw new Error("Report not found");
  }
  const data = await res.json();
  return {
    report: data.report as SerpMapReport,
    results: (data.results ?? []) as SerpMapResult[],
    cards: (data.cards ?? []) as OpportunityCard[],
  };
}

function ToolPageInner() {
  const params = useSearchParams();
  const reportIdParam = params.get("report");
  const isCached = params.get("cached") === "true";
  const legacyUrl = params.get("url") ?? "";
  const legacyKeyword = params.get("keyword") ?? "";
  const legacyCity = params.get("city") ?? "";
  const isDirectLink = Boolean(reportIdParam);

  const [phase, setPhase] = useState<Phase>(isDirectLink ? "unlocked" : "analyzing");
  const [batch, setBatch] = useState<BatchItem[] | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [reportCache, setReportCache] = useState<Record<string, ReportBundle>>({});
  const [report, setReport] = useState<SerpMapReport | null>(null);
  const [results, setResults] = useState<SerpMapResult[]>([]);
  const [cards, setCards] = useState<OpportunityCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ctxCity, setCtxCity] = useState("your area");
  /** Snapshot for the “live scan” processing UI (draft cleared after read). */
  const [scanDraft, setScanDraft] = useState<ScanDraft | null>(null);
  const didRun = useRef(false);
  const esRef = useRef<EventSource | null>(null);

  const loadReport = useCallback(async (id: string) => {
    const res = await fetch(`/api/report/${id}`);
    if (!res.ok) {
      setError("Report not found.");
      return;
    }
    const data = await res.json();
    setReport(data.report);
    setResults(data.results ?? []);
    setCards(data.cards ?? []);
  }, []);

  const selectKeyword = useCallback(
    (i: number) => {
      if (!batch?.length) return;
      setActiveIdx(i);
      const b = batch[i];
      if (!b) return;
      const bundle = reportCache[b.report_id];
      if (bundle) {
        setReport(bundle.report);
        setResults(bundle.results);
        setCards(bundle.cards);
      } else {
        void loadReport(b.report_id);
      }
    },
    [batch, reportCache, loadReport]
  );

  const compass = useMemo(
    () => (batch && batch.length > 1 ? buildCompass(batch, reportCache, activeIdx, selectKeyword) : null),
    [batch, reportCache, activeIdx, selectKeyword]
  );

  useEffect(() => {
    if (!isDirectLink) return;
    if (isCached) {
      void loadReport(reportIdParam!);
      return;
    }
    esRef.current?.close();
    const es = new EventSource(`/api/stream/${reportIdParam}`);
    esRef.current = es;
    es.addEventListener("report", (e) => setReport(JSON.parse(e.data)));
    es.addEventListener("result", (e) => {
      const incoming = JSON.parse(e.data) as SerpMapResult;
      setResults((prev) => {
        const idx = prev.findIndex(
          (r) => r.suburb_id === incoming.suburb_id || r.result_id === incoming.result_id
        );
        if (idx >= 0) {
          const u = [...prev];
          u[idx] = incoming;
          return u;
        }
        return [...prev, incoming];
      });
    });
    es.addEventListener("complete", (e) => {
      const d = JSON.parse(e.data);
      setReport(d.report);
      setResults(d.results ?? []);
      setCards(d.cards ?? []);
      es.close();
    });
    es.addEventListener("timeout", () => {
      es.close();
      void loadReport(reportIdParam!);
    });
    es.addEventListener("error", () => {
      es.close();
      void loadReport(reportIdParam!);
    });
    return () => es.close();
  }, [isDirectLink, reportIdParam, isCached, loadReport]);

  useEffect(() => {
    if (isDirectLink || didRun.current) return;
    didRun.current = true;

    (async () => {
      const draft = readCompassDraft();
      if (draft) setCtxCity(draft.city);
      else if (legacyCity) setCtxCity(legacyCity);

      if (draft) {
        setScanDraft(draft);
        clearCompassDraft();
        try {
          const res = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: draft.url,
              city: draft.city,
              keywords: draft.keywords,
              radius_band_id: draft.radius_band_id,
            }),
          });
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
            detail?: string;
            report_id?: string;
            reports?: BatchItem[];
          };
          if (!res.ok) {
            const msg = [data.error, data.detail].filter(Boolean).join(" — ");
            setError(
              msg ||
                (res.status === 500
                  ? "The analysis service returned an error. Check server logs; confirm DATABASE_URL, DataforSEO, and Google Places keys in .env.local."
                  : "Analysis failed. Please try again.")
            );
            return;
          }
          const list: BatchItem[] =
            data.reports && data.reports.length
              ? data.reports
              : data.report_id
                ? [{ report_id: data.report_id, keyword: draft.keywords[0] ?? "Service" }]
                : [];
          if (list.length === 0) {
            setError("Analysis returned no report id. Please try again.");
            return;
          }
          const bundles = await Promise.all(
            list.map((b) => fetchReportBundle(b.report_id).then((bundle) => [b.report_id, bundle] as const))
          );
          const nextCache: Record<string, ReportBundle> = Object.fromEntries(bundles) as Record<
            string,
            ReportBundle
          >;
          setReportCache(nextCache);
          setBatch(list.length > 1 ? list : null);
          setActiveIdx(0);
          const first = nextCache[list[0]!.report_id];
          if (first) {
            setReport(first.report);
            setResults(first.results);
            setCards(first.cards);
          } else {
            await loadReport(list[0]!.report_id);
          }
          setPhase("unlocked");
        } catch {
          setError("Network error. Please check your connection and try again.");
        }
        return;
      }

      if (legacyUrl && legacyKeyword && legacyCity) {
        setScanDraft({
          url: legacyUrl,
          city: legacyCity,
          keywords: [legacyKeyword],
          radius_band_id: "16-20",
        });
        try {
          const res = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: legacyUrl,
              keyword: legacyKeyword,
              city: legacyCity,
              radius_band_id: "16-20",
            }),
          });
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
            detail?: string;
            report_id?: string;
          };
          if (!res.ok) {
            setError(
              [data.error, data.detail].filter(Boolean).join(" — ") || "Analysis failed. Please try again."
            );
            return;
          }
          if (!data.report_id) {
            setError("Analysis returned no report id. Please try again.");
            return;
          }
          await loadReport(data.report_id);
          setPhase("unlocked");
        } catch {
          setError("Network error. Please check your connection and try again.");
        }
        return;
      }

      setError("No analysis to run. Go back to the home page and submit the form.");
    })();
  }, [isDirectLink, legacyUrl, legacyKeyword, legacyCity, loadReport]);

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-[var(--page-bg)] px-4 py-16">
        <div className="card-elevated w-full max-w-md space-y-5 p-8 text-center">
          <p className="text-lg font-semibold text-slate-900">Something went wrong</p>
          <p className="text-sm leading-relaxed text-red-700/90 break-words">{error}</p>
          <a
            href="/"
            className="mt-2 inline-flex min-h-[2.75rem] w-full max-w-xs items-center justify-center rounded-lg border-2 border-compass-700/25 bg-compass-600 px-5 py-2.5 text-sm font-semibold !text-white shadow-sm transition hover:bg-compass-700"
          >
            Back to home
          </a>
        </div>
      </div>
    );
  }

  if (phase === "analyzing") {
    return (
      <ProcessingState
        total={(scanDraft?.keywords.length ? scanDraft.keywords.length * 40 : 50) || 50}
        checked={0}
        businessName={null}
        city={scanDraft?.city ?? ctxCity}
        websiteUrl={scanDraft?.url}
        keywords={scanDraft?.keywords}
        radiusBandId={scanDraft?.radius_band_id}
      />
    );
  }

  if (!report) return null;

  return (
    <div className="min-h-screen bg-[#f8fafc] px-4 py-6 sm:px-6 md:py-10 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <ReportView
          report={report}
          results={results}
          cards={cards}
          gated={false}
          compass={compass}
        />
      </div>
    </div>
  );
}
