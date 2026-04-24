import InputForm from "@/components/InputForm";
import { CTA_BOOK_STRATEGY_CALL, CTA_GET_REPORT, TRAFFIC_RADIUS_CONTACT_URL } from "@/lib/lead-cta";

export default function HomePage() {
  return (
    <>
      {/* Split: copy + form */}
      <section
        id="check"
        className="bg-mesh-hero scroll-mt-20 border-b border-slate-100/90 px-4 py-12 md:py-16"
      >
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-2 md:items-center md:gap-12">
          <div className="space-y-5">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-tr-green-600 sm:text-xs">
              Digital marketing · local search
            </p>
            <p className="text-xs font-bold uppercase tracking-wider text-tr-green-600">SERPMapper Compass</p>
            <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-slate-900 md:text-4xl">
              Rank for <span className="text-tr-green-600">every service</span>, in every suburb around you.
            </h2>
            <p className="text-slate-600 leading-relaxed">
              Check Google Maps visibility for up to 10 service keywords across your chosen{" "}
              <strong>service radius</strong> (0–30 km, categorised for reporting). Each keyword gets its own
              colour-coded map and visibility score.
            </p>
            <ul className="grid grid-cols-2 gap-3 text-sm sm:flex sm:flex-wrap sm:gap-6">
              {[
                ["10", "Keywords / scan max"],
                ["~50", "Suburbs in radius"],
                ["60s", "Typical time"],
                ["7-day", "Volume cache"],
              ].map(([n, l]) => (
                <li key={l} className="text-center sm:text-left">
                  <div className="text-2xl font-black text-slate-900">{n}</div>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{l}</div>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-center md:justify-end">
            <InputForm />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-mesh-section px-4 py-16 md:py-20">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-2xl font-extrabold text-slate-900 md:text-3xl">
            From invisible to <span className="text-tr-green-600">instantly findable</span> — in 3 steps
          </h2>
          <p className="mt-2 text-slate-600">Same engine whether you use one keyword or ten.</p>
        </div>
        <div className="mx-auto mt-10 grid max-w-5xl gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div
              key={s.t}
              className={
                "rounded-2xl border bg-white p-7 text-left shadow-sm " +
                (i === 1
                  ? "border-tr-green-200 ring-1 ring-tr-green-100/80"
                  : "border-slate-200/90")
              }
            >
              <div className="mb-3 text-xs font-bold text-tr-green-600">0{i + 1}</div>
              <h3 className="text-lg font-bold text-slate-900">{s.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.d}</p>
              <div className="mt-4 h-1 w-10 rounded-full bg-tr-green-500" />
            </div>
          ))}
        </div>
      </section>

      {/* Scoring + colours */}
      <section id="scoring" className="border-t border-slate-100 bg-slate-50/80 px-4 py-14">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-2xl font-extrabold text-slate-900">What the colours mean</h2>
          <p className="mt-2 text-slate-600">Each keyword’s map uses the same legend — green is winning, red is a gap.</p>
        </div>
        <div className="mx-auto mt-8 grid max-w-4xl grid-cols-2 gap-3 md:grid-cols-4">
          {COLOUR_LEGEND.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-slate-200/90 bg-white p-4 text-left shadow-sm"
            >
              <div className="mb-2 h-8 w-8 rounded-lg shadow-inner" style={{ backgroundColor: item.color }} />
              <p className="text-sm font-bold text-slate-900">{item.label}</p>
              <p className="mt-1 text-xs text-slate-500">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Dark “uncomfortable truth” closing hero (matches Traffic Radius / Compass reference) */}
      <section
        className="relative overflow-hidden border-t border-slate-800 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-16 text-center md:py-24"
        aria-labelledby="uncomfortable-truth-heading"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(59,130,246,0.3), transparent), " +
              "radial-gradient(ellipse 50% 40% at 80% 20%, rgba(139,207,74,0.2), transparent)",
          }}
        />
        <div className="relative mx-auto max-w-3xl space-y-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-tr-green-400">The uncomfortable truth</p>
          <h2
            id="uncomfortable-truth-heading"
            className="text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl md:text-5xl"
          >
            The average AU local business is invisible in{" "}
            <span className="text-amber-400">60% of their suburbs</span>
          </h2>
          <p className="text-base leading-relaxed text-slate-300 md:text-lg">
            Most business owners assume they rank well locally.{" "}
            <span className="font-semibold text-white">SERPMapper Compass</span> reveals the gaps. Once you see the
            red suburbs on your map — for each keyword — you know exactly where to focus your SEO spend.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <a
              href="#check"
              className="inline-flex w-full min-w-[200px] items-center justify-center rounded-xl bg-tr-green-500 px-6 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-tr-green-500/30 transition hover:bg-tr-green-600 sm:w-auto"
            >
              {CTA_GET_REPORT} (free)
            </a>
            <a
              href={TRAFFIC_RADIUS_CONTACT_URL}
              className="inline-flex w-full min-w-[200px] items-center justify-center rounded-xl border-2 border-white/25 bg-transparent px-6 py-3.5 text-sm font-bold text-white transition hover:border-white/50 hover:bg-white/5 sm:w-auto"
            >
              {CTA_BOOK_STRATEGY_CALL}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}

const STEPS = [
  {
    t: "Enter your details",
    d: "Paste your website, add up to 10 service keywords as chips, pick your city, and choose a service radius band (0–5 km up to 26–30 km).",
  },
  {
    t: "We scan suburbs in your radius",
    d: "SERPMapper Compass checks Google Maps rankings across suburbs inside your selected radius, for every keyword. A typical scan finishes in 20–60 seconds per keyword.",
  },
  {
    t: "Get your visibility maps",
    d: "See colour-coded suburb maps per keyword, a Visibility Score out of 100, and prioritised missed opportunities — with radius on every report for context.",
  },
];

const COLOUR_LEGEND = [
  { color: "#22C55E", label: "Top 3", description: "You rank #1–3. Strong visibility." },
  { color: "#86EFAC", label: "Page 1", description: "You rank #4–10." },
  { color: "#FCD34D", label: "Page 2", description: "Ranking #11–20 — weak." },
  { color: "#EF4444", label: "Not visible", description: "Not in top 20 — your gaps." },
];
