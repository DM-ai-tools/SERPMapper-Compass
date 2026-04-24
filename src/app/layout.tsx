import type { Metadata } from "next";
import { Poppins, Montserrat } from "next/font/google";
import "./globals.css";
import ConditionalSiteHeader from "@/components/ConditionalSiteHeader";

/** Primary UI — clean geometric sans (Traffic Radius–style marketing stack) */
const sans = Poppins({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

/** Headlines & map titles */
const display = Montserrat({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: "SERPMapper — Local Search Visibility Heat Map",
  description:
    "See exactly which suburbs you rank in on Google Maps — free. Enter your URL and keyword to get a colour-coded suburb-by-suburb visibility map in under 60 seconds.",
  keywords: [
    "local SEO checker Australia",
    "check Google ranking by suburb",
    "Google Maps ranking tool Australia",
    "local search visibility",
    "suburb SEO checker",
  ],
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://serpmap.com.au"),
  openGraph: {
    title: "SERPMapper — Local Search Visibility Heat Map",
    description:
      "Can people in your city find you on Google? See your suburb-by-suburb visibility map in 60 seconds. Free.",
    type: "website",
    locale: "en_AU",
  },
  twitter: {
    card: "summary_large_image",
    title: "SERPMapper — Local Search Visibility Heat Map",
    description: "See exactly which suburbs you rank in on Google Maps — free.",
  },
  icons: {
    icon: "/Traffic-Radius-Logo.webp",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-AU">
      <head>
        {/* Leaflet CSS loaded via globals.css import */}
      </head>
      <body
        className={`${sans.variable} ${display.variable} ${sans.className} min-h-screen flex flex-col antialiased text-slate-900 bg-[var(--page-bg)]`}
      >
        <ConditionalSiteHeader />

        <main className="flex-1 w-full">{children}</main>

        <footer className="mt-auto border-t border-slate-200/90 bg-white/80 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center text-sm text-slate-500">
            <p>
              SERMapper Compass is a free tool by{" "}
              <a
                href="https://trafficradius.com.au/"
                className="font-medium text-brand-600 hover:text-brand-700 underline decoration-brand-200 underline-offset-4 hover:decoration-brand-400 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                Traffic radius
              </a>
            </p>
            <p className="mt-3 flex items-center justify-center gap-3 text-xs text-slate-400">
              <a href="/privacy" className="hover:text-slate-700 transition-colors">
                Privacy
              </a>
              <span className="text-slate-300" aria-hidden>
                ·
              </span>
              <a href="/terms" className="hover:text-slate-700 transition-colors">
                Terms
              </a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
