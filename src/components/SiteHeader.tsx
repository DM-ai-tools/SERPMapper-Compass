import LogoutButton from "@/components/LogoutButton";
import TrafficRadiusMark from "@/components/TrafficRadiusMark";
import { CTA_FREE_AUDIT, TRAFFIC_RADIUS_CONTACT_URL } from "@/lib/lead-cta";

const PHONE = "1300 852 340";
const PHONE_HREF = "tel:1300852340";
const EMAIL = "info@trafficradius.com.au";

function PhoneCircle() {
  return (
    <a
      href={PHONE_HREF}
      className="hidden sm:inline-flex items-center gap-2 text-[#001c2e]"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-tr-green-100 text-tr-green-600 ring-1 ring-tr-green-200/80">
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M6.62 10.79c1.44 2.83 3.76 5.15 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
        </svg>
      </span>
      <span className="text-sm font-bold leading-none">{PHONE}</span>
    </a>
  );
}

function FreeAuditButton() {
  return (
    <a
      href={TRAFFIC_RADIUS_CONTACT_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-lg border-2 border-white/90 bg-tr-green-500 px-3 py-2 text-xs font-extrabold tracking-wide text-white shadow-sm ring-1 ring-tr-green-500/50 transition hover:bg-tr-green-600 focus:outline-none focus:ring-2 focus:ring-tr-green-500 focus:ring-offset-2 md:px-4 md:py-2.5 md:text-sm"
      title={`${CTA_FREE_AUDIT} on Traffic Radius`}
    >
      <span className="whitespace-nowrap">{CTA_FREE_AUDIT}</span>
      <span aria-hidden className="shrink-0 text-[0.7em] leading-none">
        ↗
      </span>
    </a>
  );
}

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-50">
      <div className="bg-[#001c2e] py-1.5 text-xs text-slate-100 sm:py-2 sm:text-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
          <p className="min-w-0 truncate">
            <span className="font-medium text-tr-green-400">Melbourne-based</span>
            <span className="text-slate-500"> · </span>
            <span>Trusted by 500+ local businesses</span>
          </p>
          <div className="flex shrink-0 items-center gap-1.5 text-slate-200/95">
            <a href={PHONE_HREF} className="text-xs font-medium text-white hover:underline sm:hidden">
              {PHONE}
            </a>
            <span className="hidden sm:inline text-tr-green-500" aria-hidden>
              •
            </span>
            <a href={`mailto:${EMAIL}`} className="hidden hover:underline sm:inline">
              {EMAIL}
            </a>
            <span className="hidden text-tr-green-500 sm:inline" aria-hidden>
              •
            </span>
            <a href={PHONE_HREF} className="hidden font-medium text-white hover:underline sm:inline">
              {PHONE}
            </a>
          </div>
        </div>
      </div>

      <div className="border-b border-slate-200/90 bg-white shadow-sm supports-[backdrop-filter]:bg-white/98">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex min-h-14 items-center justify-between gap-2 py-2 md:min-h-16 md:gap-4 md:py-2.5">
            <div className="flex min-w-0 items-center gap-2 md:gap-3 lg:gap-4">
              <TrafficRadiusMark />
              <span
                className="hidden h-10 w-px shrink-0 bg-slate-200 sm:block"
                aria-hidden
              />
              <a href="/" className="min-w-0 group flex items-center">
                <span className="text-sm font-extrabold leading-tight text-tr-logo-navy md:text-base">
                  <span>SERP</span>
                  <span className="text-tr-green-600">Mapper</span>{" "}
                  <span>Compass</span>
                </span>
              </a>
            </div>

            <nav className="hidden min-w-0 items-center justify-center text-sm text-slate-600 md:flex md:flex-1">
              <div className="flex flex-wrap items-center justify-end gap-0.5 md:mx-auto">
                <a href="/#how-it-works" className="nav-link-underline rounded-lg px-2.5 py-2 lg:px-3">
                  How it works
                </a>
                <a
                  href="https://trafficradius.com.au/seo/local-seo"
                  className="nav-link-underline rounded-lg px-2.5 py-2 lg:px-3"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Blog
                </a>
              </div>
            </nav>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <PhoneCircle />
              <LogoutButton />
              <FreeAuditButton />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
