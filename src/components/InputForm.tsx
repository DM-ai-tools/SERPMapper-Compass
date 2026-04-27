"use client";

import { useState, useCallback, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import SearchableCombobox, { type ComboboxOption } from "@/components/SearchableCombobox";
import { RADIUS_OPTIONS, type RadiusBandId, DEFAULT_RADIUS_ID } from "@/lib/radius-bands";
import { CTA_GET_REPORT } from "@/lib/lead-cta";

const MAX_KEYWORDS = 10;
const KEYWORD_LIMIT_ERROR = `You can add up to ${MAX_KEYWORDS} service keywords.`;

const KEYWORD_EXAMPLES = [
  "emergency plumber",
  "roof plumber",
  "leak detection",
  "tap repair",
];

const AU_CITY_OPTIONS: ComboboxOption[] = [
  { value: "Melbourne", label: "Melbourne", searchText: "melbourne vic victoria" },
  { value: "Sydney", label: "Sydney", searchText: "sydney nsw new south wales" },
  { value: "Brisbane", label: "Brisbane", searchText: "brisbane qld queensland" },
  { value: "Canberra", label: "Canberra", searchText: "canberra act" },
  { value: "Perth", label: "Perth", searchText: "perth wa western australia" },
  { value: "Adelaide", label: "Adelaide", searchText: "adelaide sa" },
  { value: "Hobart", label: "Hobart", searchText: "hobart tas" },
  { value: "Darwin", label: "Darwin", searchText: "darwin nt" },
  { value: "Gold Coast", label: "Gold Coast", searchText: "gold coast qld" },
  { value: "Newcastle", label: "Newcastle", searchText: "newcastle nsw" },
];

const DRAFT_KEY = "serpmapper_compass_draft_v2";

export function clearCompassDraft() {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export function readCompassDraft():
  | {
      version: 2;
      url: string;
      city: string;
      keywords: string[];
      radius_band_id: RadiusBandId;
    }
  | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as {
      version?: number;
      url?: string;
      city?: string;
      keywords?: string[];
      radius_band_id?: string;
    };
    if (p.version !== 2 || !p.url || !p.city || !p.keywords?.length) return null;
    return {
      version: 2,
      url: p.url,
      city: p.city,
      keywords: p.keywords,
      radius_band_id: (p.radius_band_id as RadiusBandId) || DEFAULT_RADIUS_ID,
    };
  } catch {
    return null;
  }
}

export default function InputForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [city, setCity] = useState("");
  const [radiusId, setRadiusId] = useState<RadiusBandId>(DEFAULT_RADIUS_ID);
  const [loading, setLoading] = useState(false);
  const [splittingKeywords, setSplittingKeywords] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAdd = keywords.length < MAX_KEYWORDS;
  const isAtKeywordLimit = keywords.length >= MAX_KEYWORDS;

  const addKeywordsFromRaw = useCallback(
    (raw: string) => {
      const tokens = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (!tokens.length) return;

      if (keywords.length >= MAX_KEYWORDS) {
        setError(KEYWORD_LIMIT_ERROR);
        return;
      }

      const existingLower = new Set(keywords.map((k) => k.toLowerCase()));
      const batchLower = new Set<string>();
      const uniqueIncoming: string[] = [];

      for (const t of tokens) {
        const lower = t.toLowerCase();
        if (existingLower.has(lower) || batchLower.has(lower)) continue;
        batchLower.add(lower);
        uniqueIncoming.push(t);
      }

      if (!uniqueIncoming.length) return;

      const availableSlots = MAX_KEYWORDS - keywords.length;
      const accepted = uniqueIncoming.slice(0, availableSlots);

      if (accepted.length) {
        setKeywords((prev) => [...prev, ...accepted]);
        setError((prev) => (prev === KEYWORD_LIMIT_ERROR ? null : prev));
      }

      if (uniqueIncoming.length > availableSlots) {
        setError(KEYWORD_LIMIT_ERROR);
      }
    },
    [keywords]
  );

  const splitKeywordsWithClaude = useCallback(
    async (raw: string): Promise<string[]> => {
      const cleaned = raw.trim();
      if (!cleaned) return [];
      const availableSlots = Math.max(0, MAX_KEYWORDS - keywords.length);
      if (availableSlots <= 0) {
        setError(KEYWORD_LIMIT_ERROR);
        return [];
      }
      try {
        setSplittingKeywords(true);
        const res = await fetch("/api/keywords/split", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ raw: cleaned, max_keywords: availableSlots }),
        });
        if (!res.ok) {
          return [cleaned];
        }
        const data = (await res.json()) as { keywords?: unknown };
        const tokens = Array.isArray(data.keywords)
          ? data.keywords.map((k) => String(k).trim()).filter(Boolean)
          : [];
        return tokens.length ? tokens : [cleaned];
      } catch {
        return [cleaned];
      } finally {
        setSplittingKeywords(false);
      }
    },
    [keywords.length]
  );

  const hasLikelyMergedKeywords = useCallback((raw: string): boolean => {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .some((segment) => segment.split(/\s+/).length >= 4);
  }, []);

  const commitDraftKeywords = useCallback(
    async (raw: string) => {
      const value = raw.trim();
      if (!value) return;

      if (value.includes(",")) {
        if (hasLikelyMergedKeywords(value)) {
          const splitTokens = await splitKeywordsWithClaude(value);
          addKeywordsFromRaw(splitTokens.join(", "));
        } else {
          addKeywordsFromRaw(value);
        }
        setDraft("");
        return;
      }

      const splitTokens = await splitKeywordsWithClaude(value);
      addKeywordsFromRaw(splitTokens.join(", "));
      setDraft("");
    },
    [addKeywordsFromRaw, hasLikelyMergedKeywords, splitKeywordsWithClaude]
  );

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !draft.trim() && keywords.length > 0) {
      e.preventDefault();
      setKeywords((prev) => prev.slice(0, -1));
      setError((prev) => (prev === KEYWORD_LIMIT_ERROR ? null : prev));
      return;
    }
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      void commitDraftKeywords(draft);
    }
  };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedUrl = url.trim();
    const trimmedCity = city.trim();
    const pending = draft.trim();
    let kws = keywords;
    if (pending && canAdd && !keywords.some((k) => k.toLowerCase() === pending.toLowerCase())) {
      kws = [...keywords, pending];
    }
    if (!trimmedUrl || !trimmedCity) {
      setError("Add your website URL and city / suburb.");
      return;
    }
    const finalKw = kws
      .map((k) => k.trim())
      .filter(Boolean)
      .filter((k, i, a) => a.findIndex((x) => x.toLowerCase() === k.toLowerCase()) === i);
    if (finalKw.length < 1) {
      setError("Add at least one service keyword (or press Enter in the keyword field).");
      return;
    }
    if (finalKw.length > MAX_KEYWORDS) {
      setError(KEYWORD_LIMIT_ERROR);
      return;
    }

    setError(null);
    setLoading(true);
    const payload = {
      version: 2 as const,
      url: trimmedUrl,
      city: trimmedCity,
      keywords: finalKw,
      radius_band_id: radiusId,
    };
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    } catch {
      setError("Could not save your form. Enable cookies / storage and try again.");
      setLoading(false);
      return;
    }
    router.push("/tool");
  }

  const fieldClass =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-slate-900 shadow-sm " +
    "placeholder:text-slate-400 transition-all duration-200 " +
    "hover:border-slate-300 focus:border-tr-green-500 focus:outline-none focus:ring-4 focus:ring-tr-green-500/15";

  return (
    <form
      onSubmit={handleSubmit}
      className="relative w-full max-w-md overflow-visible rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-7 text-left shadow-xl shadow-slate-900/5 ring-1 ring-slate-100"
    >
      <div className="absolute -right-1 -top-1 rounded-lg bg-cta-orange px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-md sm:text-xs">
        Free · 60 sec
      </div>

      <h2 className="text-lg font-extrabold text-slate-900 tracking-tight sm:text-xl">
        Check your Google visibility
      </h2>
      <p className="mt-1.5 text-sm text-slate-500">
        Up to {MAX_KEYWORDS} service keywords, one map per keyword, inside your service radius.
      </p>

      <div className="mt-6 space-y-5">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-800">
            Business website <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            required
            placeholder="https://example.com.au"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className={fieldClass}
            autoComplete="url"
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-sm font-semibold text-slate-800">
              Service keywords <span className="text-red-500">*</span>
            </label>
            <span className="text-xs text-slate-500">
              {keywords.length} of {MAX_KEYWORDS} · <span className="hidden sm:inline">Enter or comma</span>
            </span>
          </div>
          <div className="min-h-[3.25rem] flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 py-2 focus-within:ring-4 focus-within:ring-tr-green-500/15">
            {keywords.map((k) => (
              <span
                key={k + keywords.indexOf(k)}
                className="inline-flex items-center gap-1 rounded-lg bg-tr-green-100 px-2.5 py-1 text-sm font-medium text-tr-green-900"
              >
                {k}
                <button
                  type="button"
                  className="ml-0.5 rounded p-0.5 text-tr-green-700 hover:bg-tr-green-200"
                  onClick={() => {
                    setKeywords((prev) => prev.filter((x) => x !== k));
                    setError((prev) => (prev === KEYWORD_LIMIT_ERROR ? null : prev));
                  }}
                  aria-label={`Remove ${k}`}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              className="min-w-[8rem] flex-1 border-0 bg-transparent py-1.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
              placeholder="Type a keyword, press Enter…"
              value={draft}
              onChange={(e) => {
                const value = e.target.value;
                if (value.includes(",")) {
                  void commitDraftKeywords(value);
                  return;
                }
                setDraft(value);
              }}
              onBlur={() => {
                if (!draft.trim()) return;
                void commitDraftKeywords(draft);
              }}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData("text").trim();
                if (!pasted) return;
                const looksLikeKeywordBatch =
                  pasted.includes(",") || pasted.split(/\s+/).length >= 4;
                if (!looksLikeKeywordBatch) return;
                e.preventDefault();
                void commitDraftKeywords(pasted);
              }}
              onKeyDown={onKeyDown}
              disabled={splittingKeywords}
            />
          </div>
          <p className={"mt-1.5 text-xs " + (isAtKeywordLimit ? "text-amber-600" : "text-slate-500")}>
            {isAtKeywordLimit
              ? `Maximum ${MAX_KEYWORDS} keywords reached.`
              : splittingKeywords
                ? "Separating keywords..."
                : "Press Enter or comma to add a keyword"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500">Example:</span>
            {KEYWORD_EXAMPLES.map((s) => (
              <span
                key={s}
                className="rounded-full border border-tr-green-200 bg-white px-2.5 py-0.5 font-medium text-tr-green-700"
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-1">
          <SearchableCombobox
            label="City / suburb"
            icon={null}
            name="city"
            value={city}
            onChange={setCity}
            options={AU_CITY_OPTIONS}
            placeholder="e.g. Melbourne"
            required
            allowCustom
            hint="Type any Australian city or major suburb."
            autoComplete="off"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-800">
            Service radius <span className="text-red-500">*</span>
          </label>
          <p className="mb-2 text-xs text-slate-500">We scan suburbs inside this distance — categorised for reporting.</p>
          <select
            value={radiusId}
            onChange={(e) => setRadiusId(e.target.value as RadiusBandId)}
            className={fieldClass + " py-3"}
            aria-label="Service radius"
          >
            {RADIUS_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {RADIUS_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setRadiusId(o.id)}
                className={
                  "rounded-lg px-2.5 py-1 text-xs font-bold transition " +
                  (radiusId === o.id
                    ? "bg-tr-green-500 text-white shadow-md"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200")
                }
              >
                {o.short}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      <div className="relative z-20 mt-6">
        <button
          type="submit"
          disabled={loading}
          aria-label={CTA_GET_REPORT + " — continues to the Compass scan in a new step"}
          className="flex w-full min-h-[3rem] items-center justify-center gap-2 rounded-lg bg-tr-green-500 px-4 py-3.5 text-sm font-extrabold text-white shadow-md transition hover:bg-tr-green-600 focus:outline-none focus:ring-2 focus:ring-tr-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:rounded-xl"
        >
          {loading ? (
            <>
              <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span>Starting your report…</span>
            </>
          ) : (
            <>
              {CTA_GET_REPORT}
              <span aria-hidden className="text-lg font-bold leading-none">
                →
              </span>
            </>
          )}
        </button>
      </div>

      <p className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center text-xs text-slate-500">
        <span className="text-emerald-600">✓ Free</span>
        <span className="text-emerald-600">✓ No credit card</span>
        <span className="text-emerald-600">✓ Under 60s typical</span>
      </p>
    </form>
  );
}
