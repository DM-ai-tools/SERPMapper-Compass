"use client";

import { useMemo, useState } from "react";

interface AdminSearchRow {
  report_id: string;
  created_at: string;
  email: string | null;
  business_url: string | null;
  keyword: string;
  visibility_score: number | null;
  city_monthly_volume: number | null;
}

interface CompanyGroup {
  companyUrl: string;
  rows: AdminSearchRow[];
}

interface EmailGroup {
  email: string;
  companies: CompanyGroup[];
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtNum(n: number | null): string {
  if (n == null) return "-";
  return n.toLocaleString("en-AU");
}

function normaliseUrl(url: string | null): string {
  const v = (url ?? "").trim();
  return v || "Unknown URL";
}

export default function AdminSearchDashboard({ rows }: { rows: AdminSearchRow[] }) {
  const [pdfLoadingKey, setPdfLoadingKey] = useState<string | null>(null);
  const [queryText, setQueryText] = useState("");

  const groups = useMemo<EmailGroup[]>(() => {
    const byEmail = new Map<string, Map<string, AdminSearchRow[]>>();
    for (const row of rows) {
      const email = (row.email ?? "").trim() || "No email captured";
      const companyUrl = normaliseUrl(row.business_url);
      if (!byEmail.has(email)) byEmail.set(email, new Map());
      const byCompany = byEmail.get(email)!;
      if (!byCompany.has(companyUrl)) byCompany.set(companyUrl, []);
      byCompany.get(companyUrl)!.push(row);
    }

    return Array.from(byEmail.entries())
      .map(([email, byCompany]) => ({
        email,
        companies: Array.from(byCompany.entries())
          .map(([companyUrl, companyRows]) => ({
            companyUrl,
            rows: [...companyRows].sort(
              (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            ),
          }))
          .sort((a, b) => b.rows.length - a.rows.length),
      }))
      .sort((a, b) => {
        const aLatest = a.companies[0]?.rows[0]?.created_at ?? "";
        const bLatest = b.companies[0]?.rows[0]?.created_at ?? "";
        return new Date(bLatest).getTime() - new Date(aLatest).getTime();
      });
  }, [rows]);

  const filteredGroups = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        companies: g.companies
          .map((c) => ({
            ...c,
            rows: c.rows.filter(
              (r) =>
                g.email.toLowerCase().includes(q) ||
                c.companyUrl.toLowerCase().includes(q) ||
                r.keyword.toLowerCase().includes(q) ||
                r.report_id.toLowerCase().includes(q)
            ),
          }))
          .filter((c) => c.rows.length > 0),
      }))
      .filter((g) => g.companies.length > 0);
  }, [groups, queryText]);

  const stats = useMemo(() => {
    const totalSearches = rows.length;
    const emails = new Set(rows.map((r) => (r.email ?? "").trim() || "No email captured"));
    const companies = new Set(rows.map((r) => normaliseUrl(r.business_url)));
    const scored = rows.filter((r) => r.visibility_score != null).map((r) => r.visibility_score as number);
    const avgScore = scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null;
    return {
      totalSearches,
      uniqueEmails: emails.size,
      uniqueCompanies: companies.size,
      avgScore,
    };
  }, [rows]);

  function downloadCsv(email: string, companyUrl: string, companyRows: AdminSearchRow[]) {
    const header = [
      "Email",
      "Company URL",
      "Keyword",
      "Visibility Score",
      "Search Volume",
      "Report ID",
      "Created At",
    ];
    const lines = [header.join(",")];
    for (const r of companyRows) {
      const cols = [
        email,
        companyUrl,
        r.keyword,
        r.visibility_score == null ? "" : String(r.visibility_score),
        r.city_monthly_volume == null ? "" : String(r.city_monthly_volume),
        r.report_id,
        fmtDate(r.created_at),
      ].map((c) => `"${String(c).replace(/"/g, '""')}"`);
      lines.push(cols.join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeEmail = email.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const safeUrl = companyUrl.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    a.href = href;
    a.download = `admin-report-${safeEmail}-${safeUrl}.csv`;
    a.click();
    URL.revokeObjectURL(href);
  }

  async function downloadPdf(email: string, companyUrl: string, companyRows: AdminSearchRow[]) {
    const key = `${email}__${companyUrl}`;
    setPdfLoadingKey(key);
    try {
      const [{ jsPDF }, autoTableMod] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const autoTable = (autoTableMod as { default?: unknown }).default as (
        doc: unknown,
        opts: Record<string, unknown>
      ) => void;

      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const margin = 36;
      let y = 44;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("Admin Search Report", margin, y);
      y += 20;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const lines = [
        `Email: ${email}`,
        `Company URL: ${companyUrl}`,
        `Total searches: ${companyRows.length}`,
        `Generated: ${new Date().toLocaleString("en-AU")}`,
      ];
      for (const line of lines) {
        doc.text(line, margin, y);
        y += 13;
      }
      y += 8;

      autoTable(doc, {
        startY: y,
        head: [["Keyword", "Visibility Score", "Search Volume", "Report ID", "Created"]],
        body: companyRows.map((r) => [
          r.keyword,
          r.visibility_score == null ? "-" : String(r.visibility_score),
          r.city_monthly_volume == null ? "-" : String(r.city_monthly_volume),
          r.report_id,
          fmtDate(r.created_at),
        ]),
        styles: { fontSize: 8.5, cellPadding: 4.2 },
        headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] },
        margin: { left: margin, right: margin },
      });

      const safeEmail = email.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      const safeUrl = companyUrl.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      doc.save(`admin-report-${safeEmail}-${safeUrl}.pdf`);
    } finally {
      setPdfLoadingKey(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200/90 bg-white px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total searches</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">{stats.totalSearches.toLocaleString("en-AU")}</p>
        </div>
        <div className="rounded-xl border border-slate-200/90 bg-white px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Unique emails</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">{stats.uniqueEmails.toLocaleString("en-AU")}</p>
        </div>
        <div className="rounded-xl border border-slate-200/90 bg-white px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Unique companies</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">{stats.uniqueCompanies.toLocaleString("en-AU")}</p>
        </div>
        <div className="rounded-xl border border-slate-200/90 bg-white px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Avg visibility score</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">{stats.avgScore == null ? "-" : stats.avgScore}</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/90 bg-white p-3">
        <input
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          placeholder="Search by email, URL, keyword, or report ID..."
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-tr-green-500 focus:outline-none focus:ring-4 focus:ring-tr-green-500/15"
        />
      </div>

      {filteredGroups.map((group) => (
        <details
          key={group.email}
          className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm transition-shadow open:shadow-md open:ring-2 open:ring-tr-green-200"
          open
        >
          <summary className="cursor-pointer list-none bg-gradient-to-r from-slate-50 to-white px-4 py-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-bold text-slate-900">{group.email}</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                {group.companies.length} compan{group.companies.length === 1 ? "y" : "ies"} ·{" "}
                {group.companies.reduce((sum, c) => sum + c.rows.length, 0)} searches
              </span>
            </div>
          </summary>

          <div className="space-y-3 p-4">
            {group.companies.map((company) => {
              const key = `${group.email}__${company.companyUrl}`;
              return (
                <details
                  key={company.companyUrl}
                  className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_0_rgba(15,23,42,0.03)]"
                >
                  <summary className="cursor-pointer list-none px-3.5 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-800 break-all">{company.companyUrl}</span>
                      <span className="rounded-full bg-tr-green-50 px-2.5 py-1 text-[11px] font-semibold text-tr-green-700">
                        {company.rows.length} searches
                      </span>
                    </div>
                  </summary>

                  <div className="border-t border-slate-100 p-3.5">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-slate-500">
                        Download this company report with URL, keywords, score, and search volume.
                      </p>
                      <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => downloadCsv(group.email, company.companyUrl, company.rows)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Download Report (CSV)
                      </button>
                      <button
                        type="button"
                        onClick={() => void downloadPdf(group.email, company.companyUrl, company.rows)}
                        disabled={pdfLoadingKey === key}
                        className="rounded-lg bg-tr-green-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-tr-green-600 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {pdfLoadingKey === key ? "Generating PDF..." : "Download PDF"}
                      </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-3 py-2">Keyword</th>
                            <th className="px-3 py-2">Visibility Score</th>
                            <th className="px-3 py-2">Search Volume</th>
                            <th className="px-3 py-2">Report</th>
                            <th className="px-3 py-2">Created</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {company.rows.map((r) => (
                            <tr key={r.report_id} className="hover:bg-tr-green-50/40">
                              <td className="px-3 py-2 font-medium text-slate-900">{r.keyword}</td>
                              <td className="px-3 py-2">{fmtNum(r.visibility_score)}</td>
                              <td className="px-3 py-2">{fmtNum(r.city_monthly_volume)}</td>
                              <td className="px-3 py-2">
                                <a
                                  href={`/report/${r.report_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-tr-green-700 underline decoration-tr-green-200 underline-offset-2 hover:text-tr-green-800"
                                >
                                  Open report
                                </a>
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        </details>
      ))}

      {filteredGroups.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-8 text-center text-slate-500">
          No matching records found.
        </div>
      ) : null}
    </div>
  );
}
