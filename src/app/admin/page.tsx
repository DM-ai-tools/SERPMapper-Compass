import { query } from "@/lib/db";
import AdminSearchDashboard from "@/components/AdminSearchDashboard";

export const dynamic = "force-dynamic";

interface AdminSearchRow {
  report_id: string;
  created_at: string;
  email: string | null;
  business_url: string | null;
  keyword: string;
  visibility_score: number | null;
  city_monthly_volume: number | null;
}

export default async function AdminPage() {
  const rows = await query<AdminSearchRow>(
    `SELECT
       r.report_id::text,
       r.created_at::text,
       lead.email,
       COALESCE(lead.business_url, r.business_url) AS business_url,
       r.keyword,
       r.visibility_score,
       r.city_monthly_volume
     FROM serpmap_reports r
     LEFT JOIN LATERAL (
       SELECT l.email, l.business_url
       FROM serpmap_leads l
       WHERE l.report_id = r.report_id
       ORDER BY l.created_at DESC
       LIMIT 1
     ) AS lead ON TRUE
     ORDER BY r.created_at DESC
     LIMIT 500`
  );

  return (
    <section className="bg-mesh-hero min-h-[calc(100vh-3.5rem)] px-4 py-8 md:min-h-[calc(100vh-4rem)] md:py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-tr-green-600">Admin</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">
                Live search reports
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                All scan records with user email, submitted URL, keyword, visibility score, and monthly volume.
              </p>
            </div>
            <form method="post" action="/api/auth/admin/logout">
              <button
                type="submit"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Admin logout
              </button>
            </form>
          </div>
        </div>

        <AdminSearchDashboard rows={rows} />
      </div>
    </section>
  );
}
